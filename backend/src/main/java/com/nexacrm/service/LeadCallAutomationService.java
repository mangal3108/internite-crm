package com.nexacrm.service;

import com.nexacrm.model.Lead;
import com.nexacrm.model.LeadCallAutomation;
import com.nexacrm.repository.LeadCallAutomationRepository;
import com.nexacrm.repository.LeadRepository;
import com.nexacrm.security.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class LeadCallAutomationService {

    private static final List<Lead.AutomatedCallingStatus> DUE_STATUSES = List.of(
        Lead.AutomatedCallingStatus.NEW_LEAD,
        Lead.AutomatedCallingStatus.CALLING,
        Lead.AutomatedCallingStatus.NO_ANSWER,
        Lead.AutomatedCallingStatus.RETRY_SCHEDULED,
        Lead.AutomatedCallingStatus.FAILED
    );
    private static final List<String> CONNECTED_TERMINAL_STATUSES = List.of(
        "COMPLETED",
        "CONNECTED",
        "ANSWERED",
        "SUCCESS"
    );

    private final LeadCallAutomationRepository leadCallAutomationRepository;
    private final LeadRepository leadRepository;
    private final CommunicationService communicationService;

    @Autowired
    @Lazy
    private CallAgentService callAgentService;

    @Value("${nexacrm.lead-call-automation.enabled:true}")
    private boolean enabled;

    @Value("${nexacrm.lead-call-automation.retry-minutes:60}")
    private long retryMinutes;

    @Async
    public void startForNewLeadAsync(Lead lead, Long tenantId) {
        if (tenantId != null) {
            TenantContext.setCurrentTenantId(tenantId);
        }
        try {
            startForNewLead(lead, tenantId);
        } finally {
            TenantContext.clear();
        }
    }

    @Transactional
    public LeadCallAutomation startForNewLead(Lead lead, Long tenantId) {
        if (!enabled || lead == null || lead.getId() == null || tenantId == null) {
            return null;
        }

        Optional<LeadCallAutomation> existing = leadCallAutomationRepository.findByTenantIdAndLeadId(tenantId, lead.getId());
        if (existing.isPresent()) {
            return existing.get();
        }

        LocalDateTime now = LocalDateTime.now();
        LeadCallAutomation workflow = LeadCallAutomation.builder()
            .leadId(lead.getId())
            .leadName(trim(lead.getName()))
            .contactNumber(trim(lead.getPhone()))
            .leadSource(lead.getSource() != null ? lead.getSource().name() : "OTHER")
            .status(Lead.AutomatedCallingStatus.NEW_LEAD)
            .attemptCount(0)
            .nextScheduledAt(now)
            .build();
        workflow.setTenantId(tenantId);

        try {
            workflow = leadCallAutomationRepository.save(workflow);
        } catch (DuplicateKeyException duplicate) {
            return leadCallAutomationRepository.findByTenantIdAndLeadId(tenantId, lead.getId()).orElse(null);
        }

        updateLeadCallingState(lead, workflow);
        return queueAttemptIfAllowed(workflow, "new_lead");
    }

    @Scheduled(fixedDelayString = "${nexacrm.lead-call-automation.fixed-delay-ms:60000}")
    public void processDueAttempts() {
        if (!enabled) {
            return;
        }
        LocalDateTime now = LocalDateTime.now();
        List<LeadCallAutomation> due = leadCallAutomationRepository
            .findTop100ByStatusInAndNextScheduledAtLessThanEqualOrderByNextScheduledAtAsc(DUE_STATUSES, now);

        for (LeadCallAutomation workflow : due) {
            Long tenantId = workflow.getTenantId();
            if (tenantId == null) {
                continue;
            }
            TenantContext.setCurrentTenantId(tenantId);
            try {
                processDueWorkflow(workflow);
            } catch (Exception ex) {
                log.warn("Lead call automation failed for lead {}: {}", workflow.getLeadId(), ex.getMessage());
            } finally {
                TenantContext.clear();
            }
        }
    }

    @Transactional
    protected void processDueWorkflow(LeadCallAutomation workflow) {
        LeadCallAutomation fresh = leadCallAutomationRepository
            .findByTenantIdAndLeadId(workflow.getTenantId(), workflow.getLeadId())
            .orElse(null);
        if (fresh == null || !isActive(fresh.getStatus())) {
            return;
        }
        if (fresh.getNextScheduledAt() == null || fresh.getNextScheduledAt().isAfter(LocalDateTime.now())) {
            return;
        }

        if (fresh.getStatus() == Lead.AutomatedCallingStatus.CALLING) {
            syncLatestProviderResult(fresh);
            fresh = leadCallAutomationRepository
                .findByTenantIdAndLeadId(workflow.getTenantId(), workflow.getLeadId())
                .orElse(null);
            if (fresh == null || !isActive(fresh.getStatus())) {
                return;
            }
            if (fresh.getNextScheduledAt() == null || fresh.getNextScheduledAt().isAfter(LocalDateTime.now())) {
                return;
            }
        }

        queueAttemptIfAllowed(fresh, "scheduled_retry");
    }

    @Transactional
    public void handleCallResult(String leadId, String status, String outcome, Integer durationSeconds, String externalId) {
        Long tenantId = TenantContext.currentTenantId();
        String normalizedLeadId = trim(leadId);
        if (normalizedLeadId.isBlank()) {
            return;
        }
        LeadCallAutomation workflow = leadCallAutomationRepository.findByTenantIdAndLeadId(tenantId, normalizedLeadId).orElse(null);
        if (workflow == null || !isActive(workflow.getStatus())) {
            return;
        }

        String normalizedStatus = normalize(status);
        String normalizedOutcome = normalize(outcome);
        workflow.setLastCallStatus(firstNonBlank(normalizedStatus, normalizedOutcome));
        workflow.setLastCallDurationSeconds(durationSeconds);
        workflow.setLastExternalId(trim(externalId));

        Lead lead = leadRepository.findByIdAndTenantIdAndDeletedFalse(normalizedLeadId, tenantId).orElse(null);
        if (lead == null) {
            stopWorkflow(workflow, null, "Lead no longer exists");
            return;
        }

        if (isConnected(normalizedStatus, normalizedOutcome)) {
            workflow.setStatus(Lead.AutomatedCallingStatus.CONNECTED);
            workflow.setNextScheduledAt(null);
            workflow.setStoppedAt(LocalDateTime.now());
            workflow.setStopReason("Lead connected");
            leadCallAutomationRepository.save(workflow);
            if (lead != null) {
                lead.setAutomatedCallingStatus(Lead.AutomatedCallingStatus.COMPLETED);
                lead.setAutomatedCallingAttempt(workflow.getAttemptCount());
                lead.setNextAutomatedCallAt(null);
                leadRepository.save(lead);
            }
            // Belt-and-suspenders: trigger call intelligence + WhatsApp notifications
            // via the scheduler path (in case the Bolna webhook callback was missed)
            try {
                callAgentService.triggerCallIntelligenceForLead(normalizedLeadId);
            } catch (Exception ex) {
                log.warn("Scheduler-triggered call intelligence failed for lead {}: {}", normalizedLeadId, ex.getMessage());
            }
            return;
        }
        if (!isTerminalNonConnected(normalizedStatus, normalizedOutcome)) {
            workflow.setStatus(Lead.AutomatedCallingStatus.CALLING);
            workflow.setNextScheduledAt(LocalDateTime.now().plusMinutes(retryMinutes));
            leadCallAutomationRepository.save(workflow);
            updateLeadCallingState(lead, workflow);
            return;
        }

        scheduleRetry(workflow, lead, firstNonBlank(normalizedStatus, normalizedOutcome, "NO_ANSWER"));
    }

    @Transactional
    public void stopForLead(String leadId, String reason) {
        Long tenantId = TenantContext.currentTenantId();
        LeadCallAutomation workflow = leadCallAutomationRepository.findByTenantIdAndLeadId(tenantId, trim(leadId)).orElse(null);
        Lead lead = leadRepository.findByIdAndTenantIdAndDeletedFalse(trim(leadId), tenantId).orElse(null);
        if (workflow != null) {
            stopWorkflow(workflow, lead, reason);
        } else if (lead != null) {
            lead.setAutomatedCallingStatus(Lead.AutomatedCallingStatus.STOPPED);
            lead.setNextAutomatedCallAt(null);
            leadRepository.save(lead);
        }
    }

    @Transactional(readOnly = true)
    public Optional<LeadCallAutomation> findForLead(String leadId) {
        return leadCallAutomationRepository.findByTenantIdAndLeadId(TenantContext.currentTenantId(), trim(leadId));
    }

    @Transactional(readOnly = true)
    public List<LeadCallAutomation> findForLeadIds(Collection<String> leadIds) {
        return leadCallAutomationRepository.findByTenantIdAndLeadIdIn(TenantContext.currentTenantId(), leadIds);
    }

    private LeadCallAutomation queueAttemptIfAllowed(LeadCallAutomation workflow, String triggerSource) {
        Lead lead = leadRepository.findByIdAndTenantIdAndDeletedFalse(workflow.getLeadId(), workflow.getTenantId()).orElse(null);
        if (lead == null) {
            return stopWorkflow(workflow, null, "Lead no longer exists");
        }

        String phone = firstNonBlank(trim(workflow.getContactNumber()), lead != null ? trim(lead.getPhone()) : "");
        if (phone.isBlank()) {
            return stopWorkflow(workflow, lead, "Lead phone number is missing");
        }

        LocalDateTime now = LocalDateTime.now();
        int nextAttempt = workflow.getAttemptCount() + 1;
        workflow.setContactNumber(phone);
        workflow.setLeadName(lead != null ? trim(lead.getName()) : trim(workflow.getLeadName()));
        workflow.setLeadSource(lead != null && lead.getSource() != null ? lead.getSource().name() : trim(workflow.getLeadSource()));
        workflow.setAttemptCount(nextAttempt);
        workflow.setLastAttemptAt(now);
        workflow.setStatus(Lead.AutomatedCallingStatus.CALLING);
        workflow.setLastCallStatus("QUEUED");
        workflow.setNextScheduledAt(now.plusMinutes(retryMinutes));
        workflow = leadCallAutomationRepository.save(workflow);
        updateLeadCallingState(lead, workflow);

        try {
            communicationService.sendLeadVoiceCall(
                workflow.getLeadId(),
                workflow.getLeadName(),
                phone,
                buildCallScript(lead, workflow),
                triggerSource,
                Map.of(
                    "leadId", workflow.getLeadId(),
                    "leadName", workflow.getLeadName(),
                    "leadSource", workflow.getLeadSource(),
                    "company", lead != null ? trim(lead.getCompany()) : "",
                    "service", lead != null ? trim(lead.getService()) : "",
                    "source", firstNonBlank(workflow.getLeadSource(), lead != null && lead.getSource() != null ? lead.getSource().name() : ""),
                    "automatedCallWorkflowId", workflow.getId(),
                    "attemptNumber", nextAttempt,
                    "nextScheduledAttempt", workflow.getNextScheduledAt().toString()
                )
            );
            return workflow;
        } catch (Exception ex) {
            log.warn("Automated call attempt {} failed for lead {}: {}", nextAttempt, workflow.getLeadId(), ex.getMessage());
            scheduleRetry(workflow, lead, "FAILED");
            return workflow;
        }
    }

    private void syncLatestProviderResult(LeadCallAutomation workflow) {
        communicationService.fetchLatestLeadCallProviderResult(workflow.getLeadId())
            .ifPresent(result -> handleCallResult(
                workflow.getLeadId(),
                result.status(),
                result.outcome(),
                result.durationSeconds(),
                result.externalId()
            ));
    }

    private LeadCallAutomation scheduleRetry(LeadCallAutomation workflow, Lead lead, String lastStatus) {
        workflow.setStatus(Lead.AutomatedCallingStatus.RETRY_SCHEDULED);
        workflow.setLastCallStatus(firstNonBlank(lastStatus, "NO_ANSWER"));
        workflow.setNextScheduledAt(LocalDateTime.now().plusMinutes(retryMinutes));
        LeadCallAutomation saved = leadCallAutomationRepository.save(workflow);
        updateLeadCallingState(lead, saved);
        return saved;
    }

    private LeadCallAutomation stopWorkflow(LeadCallAutomation workflow, Lead lead, String reason) {
        communicationService.cancelPendingLeadVoiceCalls(workflow.getLeadId(), workflow.getLastExternalId());
        workflow.setStatus(Lead.AutomatedCallingStatus.STOPPED);
        workflow.setNextScheduledAt(null);
        workflow.setStoppedAt(LocalDateTime.now());
        workflow.setStopReason(trim(reason));
        LeadCallAutomation saved = leadCallAutomationRepository.save(workflow);
        updateLeadCallingState(lead, saved);
        return saved;
    }

    private void updateLeadCallingState(Lead lead, LeadCallAutomation workflow) {
        if (lead == null || workflow == null) {
            return;
        }
        Lead.AutomatedCallingStatus leadStatus = workflow.getStatus();
        if (leadStatus == Lead.AutomatedCallingStatus.CONNECTED) {
            leadStatus = Lead.AutomatedCallingStatus.COMPLETED;
        } else if (leadStatus == Lead.AutomatedCallingStatus.RETRY_SCHEDULED
            && containsAny(normalize(workflow.getLastCallStatus()), "NO_ANSWER", "MISSED", "BUSY", "FAILED", "NOT_CONNECTED")) {
            leadStatus = Lead.AutomatedCallingStatus.RETRY_SCHEDULED;
        }
        lead.setAutomatedCallingStatus(leadStatus);
        lead.setAutomatedCallingAttempt(workflow.getAttemptCount());
        lead.setNextAutomatedCallAt(workflow.getNextScheduledAt());
        leadRepository.save(lead);
    }

    private boolean isActive(Lead.AutomatedCallingStatus status) {
        return status == Lead.AutomatedCallingStatus.NEW_LEAD
            || status == Lead.AutomatedCallingStatus.CALLING
            || status == Lead.AutomatedCallingStatus.NO_ANSWER
            || status == Lead.AutomatedCallingStatus.RETRY_SCHEDULED
            || status == Lead.AutomatedCallingStatus.FAILED;
    }

    private boolean isConnected(String status, String outcome) {
        return isConnectedTerminalStatus(status) || isConnectedTerminalStatus(outcome);
    }

    private boolean isConnectedTerminalStatus(String value) {
        return CONNECTED_TERMINAL_STATUSES.contains(normalize(value));
    }

    private boolean isTerminalNonConnected(String status, String outcome) {
        String combined = normalize(status + " " + outcome);
        return containsAny(
            combined,
            "NO_ANSWER",
            "NOT_CONNECTED",
            "MISSED",
            "BUSY",
            "FAILED",
            "REJECTED",
            "CANCELLED",
            "CANCELED",
            "VOICEMAIL",
            "TIMEOUT"
        );
    }

    private boolean containsAny(String value, String... needles) {
        String normalized = normalize(value);
        for (String needle : needles) {
            if (normalized.contains(needle)) {
                return true;
            }
        }
        return false;
    }

    private String buildCallScript(Lead lead, LeadCallAutomation workflow) {
        String leadName = lead != null ? trim(lead.getName()) : trim(workflow.getLeadName());
        String service = lead != null ? trim(lead.getService()) : "";
        String serviceSnippet = service.isBlank() ? "" : " for " + service;
        return "Hi " + (leadName.isBlank() ? "there" : leadName)
            + ", this is Internite CRM calling regarding your enquiry"
            + serviceSnippet
            + ". Is this a good time to talk?";
    }

    public static String statusLabel(Lead.AutomatedCallingStatus status) {
        if (status == null) {
            return "New Lead";
        }
        return switch (status) {
            case NEW_LEAD -> "New Lead";
            case CALLING -> "Calling";
            case NO_ANSWER -> "No Answer";
            case RETRY_SCHEDULED -> "Retry Scheduled";
            case CONNECTED -> "Connected";
            case COMPLETED -> "Completed";
            case STOPPED -> "Completed";
            case FAILED -> "Failed";
        };
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            String normalized = trim(value);
            if (!normalized.isBlank()) {
                return normalized;
            }
        }
        return "";
    }

    private String normalize(String value) {
        return trim(value).toUpperCase(Locale.ROOT).replace(' ', '_').replace('-', '_');
    }

    private String trim(String value) {
        return value == null ? "" : value.trim();
    }
}
