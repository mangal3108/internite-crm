package com.nexacrm.service;

import com.nexacrm.dto.LeadActivityDTO;
import com.nexacrm.exception.ResourceNotFoundException;
import com.nexacrm.model.Lead;
import com.nexacrm.model.LeadActivity;
import com.nexacrm.repository.LeadActivityRepository;
import com.nexacrm.repository.LeadRepository;
import com.nexacrm.repository.UserRepository;
import com.nexacrm.security.TenantContext;
import lombok.RequiredArgsConstructor;
import org.bson.Document;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Caching;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Optional;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class LeadActivityService {
    private Long tenantId() {
        return TenantContext.currentTenantId();
    }

    private final LeadActivityRepository leadActivityRepository;
    private final LeadRepository leadRepository;
    private final LeadChangeAuditService leadChangeAuditService;
    private final UserRepository userRepository;
    private final MongoTemplate mongoTemplate;
    private final LeadTimelineService leadTimelineService;
    private final WhatsAppActivityNotificationService whatsAppActivityNotificationService;

    @Value("${nexacrm.uploads.dir:}")
    private String configuredUploadsDir;

    private static final long MAX_RECORDING_BYTES = 50L * 1024L * 1024L;

    @Transactional(readOnly = true)
    public List<LeadActivityDTO> listByLeadId(String leadId) {
        ensureLeadVisible(ensureLeadExists(leadId));
        return leadActivityRepository
            .findByLeadIdAndTenantIdAndDeletedFalseOrderBySavedAtDesc(leadId, tenantId())
            .stream()
            .map(this::toDTO)
            .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Map<String, List<LeadActivityDTO>> listByLeadIds(Collection<String> requestedLeadIds) {
        return listByLeadIds(requestedLeadIds, true);
    }

    @Transactional(readOnly = true)
    public Map<String, List<LeadActivityDTO>> listVisibleLeadIds(Collection<String> requestedLeadIds) {
        return listByLeadIds(requestedLeadIds, false);
    }

    private Map<String, List<LeadActivityDTO>> listByLeadIds(Collection<String> requestedLeadIds, boolean verifyVisibility) {
        Set<String> leadIds = requestedLeadIds == null
            ? Set.of()
            : requestedLeadIds.stream()
                .filter(id -> id != null && !id.isBlank())
                .map(String::trim)
                .limit(500)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        Map<String, List<LeadActivityDTO>> grouped = new LinkedHashMap<>();
        leadIds.forEach(id -> grouped.put(id, new ArrayList<>()));
        if (leadIds.isEmpty()) {
            return grouped;
        }

        Set<String> visibleLeadIds = verifyVisibility
            ? visibleLeadIds(leadIds)
            : leadIds;

        if (visibleLeadIds.isEmpty()) {
            return grouped;
        }

        fetchBulkActivityPreview(visibleLeadIds)
            .forEach(activity -> {
                if (activity.getLeadId() != null && grouped.containsKey(activity.getLeadId())) {
                    grouped.get(activity.getLeadId()).add(toDTO(activity));
                }
            });

        return grouped;
    }

    private Set<String> visibleLeadIds(Set<String> leadIds) {
        var current = currentUser();
        boolean canSeeAll = current == null
            || com.nexacrm.model.User.isAdminLike(current.getRole())
            || current.getRole() == com.nexacrm.model.User.Role.MANAGER;
        String currentUserId = current != null ? current.getId() : null;

        return leadRepository.findByIdInAndTenantIdAndDeletedFalse(leadIds, tenantId()).stream()
            .filter(lead -> canSeeAll || (
                currentUserId != null
                    && lead.getAssignedTo() != null
                    && currentUserId.equals(lead.getAssignedTo().getId())
            ))
            .map(Lead::getId)
            .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private List<LeadActivity> fetchBulkActivityPreview(Set<String> visibleLeadIds) {
        List<Document> pipeline = List.of(
            new Document("$match", new Document("tenant_id", tenantId())
                .append("deleted", false)
                .append("lead_id", new Document("$in", new ArrayList<>(visibleLeadIds)))),
            new Document("$sort", new Document("lead_id", 1)
                .append("activity_index", 1)
                .append("saved_at", -1)),
            new Document("$group", new Document("_id", new Document("leadId", "$lead_id")
                    .append("activityIndex", "$activity_index"))
                .append("activity", new Document("$first", "$$ROOT"))),
            new Document("$replaceRoot", new Document("newRoot", "$activity")),
            new Document("$sort", new Document("lead_id", 1)
                .append("saved_at", -1))
        );

        // Try the optimised aggregation (uses lead_activity_bulk_stage_preview_idx)
        try {
            List<LeadActivity> activities = new ArrayList<>();
            mongoTemplate.getCollection("lead_activities")
                .aggregate(pipeline)
                .hintString("lead_activity_bulk_stage_preview_idx")
                .allowDiskUse(false)
                .maxTime(8, TimeUnit.SECONDS)
                .forEach(doc -> activities.add(mongoTemplate.getConverter().read(LeadActivity.class, doc)));
            return activities;
        } catch (RuntimeException ex) {
            org.slf4j.LoggerFactory.getLogger(LeadActivityService.class).warn(
                "Bulk activity aggregation failed for {} leads, falling back to simple query: {}",
                visibleLeadIds.size(),
                ex.getMessage()
            );
        }

        // Fallback: simple indexed query — returns all activities (frontend handles dedup)
        try {
            return leadActivityRepository.findByLeadIdInAndTenantIdAndDeletedFalseOrderBySavedAtDesc(
                new ArrayList<>(visibleLeadIds), tenantId());
        } catch (RuntimeException ex2) {
            org.slf4j.LoggerFactory.getLogger(LeadActivityService.class).warn(
                "Bulk activity fallback query also failed for {} leads: {}",
                visibleLeadIds.size(),
                ex2.getMessage()
            );
            return List.of();
        }
    }

    @Transactional(readOnly = true)
    public Map<String, Integer> getMaxStageByLeadIds(Collection<String> requestedLeadIds) {
        Set<String> leadIds = requestedLeadIds == null
            ? Set.of()
            : requestedLeadIds.stream()
                .filter(id -> id != null && !id.isBlank())
                .map(String::trim)
                .limit(500)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        Map<String, Integer> result = new LinkedHashMap<>();
        leadIds.forEach(id -> result.put(id, -1));
        if (leadIds.isEmpty()) return result;

        // Lightweight aggregation: just $match + $group/$max — no $sort, no $replaceRoot
        List<Document> pipeline = List.of(
            new Document("$match", new Document("tenant_id", tenantId())
                .append("deleted", false)
                .append("lead_id", new Document("$in", new ArrayList<>(leadIds)))),
            new Document("$group", new Document("_id", "$lead_id")
                .append("maxIdx", new Document("$max", "$activity_index")))
        );

        try {
            mongoTemplate.getCollection("lead_activities")
                .aggregate(pipeline)
                .maxTime(4, TimeUnit.SECONDS)
                .forEach(doc -> {
                    String leadId = doc.getString("_id");
                    Integer maxIdx = doc.getInteger("maxIdx");
                    if (leadId != null && maxIdx != null) {
                        result.put(leadId, maxIdx);
                    }
                });
        } catch (RuntimeException ex) {
            org.slf4j.LoggerFactory.getLogger(LeadActivityService.class).warn(
                "Stage aggregation failed for {} leads: {}", leadIds.size(), ex.getMessage());
        }

        return result;
    }

    @Caching(evict = {
        @CacheEvict(value = "leads-list", allEntries = true),
        @CacheEvict(value = "pipeline-board", allEntries = true)
    })
    public LeadActivityDTO create(String leadId, LeadActivityDTO dto) {
        Lead lead = ensureLeadExists(leadId);
        ensureLeadVisible(lead);
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime savedAt = dto.getSavedAt() != null ? dto.getSavedAt() : now;
        Map<String, Object> values = dto.getValues() != null ? new LinkedHashMap<>(dto.getValues()) : new LinkedHashMap<>();
        String assignedTo = resolveAssignedTo(lead, dto, values);
        applyActivityDefaults(lead, dto, values, savedAt, assignedTo);
        applyLeadPipelineStatusFromActivity(lead, dto, values, savedAt);
        String summary = firstNonBlank(dto.getSummary(), buildSummary(values));

        LeadActivity activity = LeadActivity.builder()
            .leadId(leadId)
            .activityIndex(dto.getActivityIndex())
            .activityId(dto.getActivityId())
            .activityLabel(dto.getActivityLabel())
            .activityTitle(dto.getActivityTitle())
            .assignedTo(assignedTo)
            .summary(summary)
            .values(values)
            .savedAt(savedAt)
            .build();
        activity.setTenantId(tenantId());

        LeadActivity saved = leadActivityRepository.save(activity);

        lead.setLastContactedAt(savedAt);
        List<String> activityLogs = lead.getActivityLogs() != null ? new ArrayList<>(lead.getActivityLogs()) : new ArrayList<>();
        String logEntry = savedAt + " | " + firstNonBlank(dto.getActivityTitle(), dto.getActivityLabel()) + " | " + firstNonBlank(summary, "Activity recorded");
        activityLogs.add(0, logEntry);
        if (activityLogs.size() > 25) {
            activityLogs = activityLogs.subList(0, 25);
        }
        lead.setActivityLogs(activityLogs);
        leadChangeAuditService.save(lead);
        leadTimelineService.syncActivity(saved);
        whatsAppActivityNotificationService.notifyActivitySaved(tenantId(), lead, saved);

        return toDTO(saved);
    }

    @Caching(evict = {
        @CacheEvict(value = "leads-list", allEntries = true),
        @CacheEvict(value = "pipeline-board", allEntries = true)
    })
    public LeadActivityDTO update(String leadId, String activityId, LeadActivityDTO dto) {
        Lead lead = ensureLeadExists(leadId);
        ensureLeadVisible(lead);
        LeadActivity activity = leadActivityRepository.findByIdAndTenantIdAndDeletedFalse(activityId, tenantId())
            .orElseThrow(() -> new ResourceNotFoundException("Lead activity not found: " + activityId));
        if (!leadId.equals(activity.getLeadId())) {
            throw new ResourceNotFoundException("Lead activity not found: " + activityId);
        }

        LocalDateTime savedAt = dto.getSavedAt() != null ? dto.getSavedAt() : activity.getSavedAt();
        Map<String, Object> values = dto.getValues() != null ? new LinkedHashMap<>(dto.getValues()) : new LinkedHashMap<>();
        String assignedTo = resolveAssignedTo(lead, dto, values);
        applyActivityDefaults(lead, dto, values, savedAt, assignedTo);
        applyLeadPipelineStatusFromActivity(lead, dto, values, savedAt);
        String summary = firstNonBlank(dto.getSummary(), buildSummary(values));

        activity.setActivityIndex(dto.getActivityIndex());
        activity.setActivityId(dto.getActivityId());
        activity.setActivityLabel(dto.getActivityLabel());
        activity.setActivityTitle(dto.getActivityTitle());
        activity.setAssignedTo(assignedTo);
        activity.setSummary(summary);
        activity.setValues(values);
        activity.setSavedAt(savedAt);

        LeadActivity saved = leadActivityRepository.save(activity);
        lead.setLastContactedAt(savedAt);
        leadChangeAuditService.save(lead);
        leadTimelineService.syncActivity(saved);
        whatsAppActivityNotificationService.notifyActivitySaved(tenantId(), lead, saved);

        return toDTO(saved);
    }

    @Caching(evict = {
        @CacheEvict(value = "leads-list", allEntries = true),
        @CacheEvict(value = "pipeline-board", allEntries = true)
    })
    public LeadActivityDTO uploadRecording(String leadId, MultipartFile file) {
        Lead lead = ensureLeadExists(leadId);
        ensureLeadVisible(lead);
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Recording file is required");
        }
        if (file.getSize() > MAX_RECORDING_BYTES) {
            throw new IllegalArgumentException("Recording must be 50 MB or smaller");
        }

        String originalName = sanitizeFilename(file.getOriginalFilename());
        String extension = recordingExtension(originalName, file.getContentType());
        String contentType = recordingContentType(file.getContentType(), extension);
        String storedName = UUID.randomUUID() + extension;
        Path targetDir = recordingsDir().resolve(String.valueOf(tenantId())).resolve(leadId);
        Path target = targetDir.resolve(storedName).normalize();

        try {
            Files.createDirectories(targetDir);
            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException ex) {
            throw new IllegalStateException("Unable to store recording upload", ex);
        }

        LocalDateTime savedAt = LocalDateTime.now();
        String assignedTo = currentUserName();
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("recording", true);
        values.put("recordingFileName", storedName);
        values.put("recordingOriginalName", originalName);
        values.put("recordingContentType", contentType);
        values.put("recordingSize", file.getSize());
        values.put("recordingActivityId", "");
        values.put("uploadedAt", savedAt.toString());

        LeadActivity activity = LeadActivity.builder()
            .leadId(leadId)
            .activityIndex(0)
            .activityId("call-recording")
            .activityLabel("Call Recording")
            .activityTitle("Call recording uploaded")
            .assignedTo(assignedTo != null ? assignedTo : "Sales Team")
            .summary("Call recording uploaded: " + originalName)
            .values(values)
            .savedAt(savedAt)
            .build();
        activity.setTenantId(tenantId());

        LeadActivity saved = leadActivityRepository.save(activity);
        values.put("recordingActivityId", saved.getId());
        saved.setValues(values);
        saved = leadActivityRepository.save(saved);

        lead.setLastContactedAt(savedAt);
        List<String> activityLogs = lead.getActivityLogs() != null ? new ArrayList<>(lead.getActivityLogs()) : new ArrayList<>();
        activityLogs.add(0, savedAt + " | Call recording | " + originalName);
        if (activityLogs.size() > 25) {
            activityLogs = activityLogs.subList(0, 25);
        }
        lead.setActivityLogs(activityLogs);
        leadChangeAuditService.save(lead);
        leadTimelineService.syncActivity(saved);

        return toDTO(saved);
    }

    @Transactional(readOnly = true)
    public RecordingResource loadRecording(String activityId) {
        LeadActivity activity = leadActivityRepository.findByIdAndTenantIdAndDeletedFalse(activityId, tenantId())
            .orElseThrow(() -> new ResourceNotFoundException("Recording not found: " + activityId));
        Lead lead = ensureLeadExists(activity.getLeadId());
        ensureLeadVisible(lead);
        Map<String, Object> values = activity.getValues() != null ? activity.getValues() : Map.of();
        String storedName = stringValue(values.get("recordingFileName"));
        if (storedName.isBlank()) {
            throw new ResourceNotFoundException("Recording not found: " + activityId);
        }

        Path file = recordingsDir().resolve(String.valueOf(tenantId())).resolve(activity.getLeadId()).resolve(storedName).normalize();
        if (!file.startsWith(recordingsDir().normalize())) {
            throw new ResourceNotFoundException("Recording not found: " + activityId);
        }
        try {
            Resource resource = new UrlResource(file.toUri());
            if (!resource.exists() || !resource.isReadable()) {
                throw new ResourceNotFoundException("Recording not found: " + activityId);
            }
            String filename = firstNonBlank(stringValue(values.get("recordingOriginalName")), storedName);
            String contentType = firstNonBlank(stringValue(values.get("recordingContentType")), "audio/mpeg");
            return new RecordingResource(resource, filename, contentType);
        } catch (MalformedURLException ex) {
            throw new ResourceNotFoundException("Recording not found: " + activityId);
        }
    }

    public record RecordingResource(Resource resource, String filename, String contentType) {}

    private void applyLeadPipelineStatusFromActivity(Lead lead, LeadActivityDTO dto, Map<String, Object> values, LocalDateTime savedAt) {
        if (lead == null || dto == null || dto.getActivityIndex() == null) {
            return;
        }

        Lead.LeadStatus nextStatus = resolveLeadStatusFromActivity(dto.getActivityIndex(), values);
        if (nextStatus != null) {
            lead.setStatus(nextStatus);
            if (nextStatus == Lead.LeadStatus.WON) {
                if (lead.getConvertedAt() == null) {
                    lead.setConvertedAt(savedAt);
                }
                BigDecimal revenue = parseMoney(stringValue(values.get("revenueValue")));
                BigDecimal finalPrice = parseMoney(stringValue(values.get("meetingPriceFinal")));
                if (finalPrice != null) {
                    lead.setDealValue(finalPrice);
                }
                if (revenue == null && isAffirmative(values.get("paymentReceived"))) {
                    revenue = finalPrice != null ? finalPrice : lead.getDealValue();
                }
                if (revenue == null && stringValue(values.get("paymentReceived")).isBlank()) {
                    revenue = lead.getRevenueValue() != null ? lead.getRevenueValue() : lead.getDealValue();
                }
                if (revenue != null) {
                    lead.setRevenueValue(revenue);
                }
                lead.setLostReason(null);
            } else if (nextStatus == Lead.LeadStatus.LOST) {
                String lostReason = firstNonBlank(
                    stringValue(values.get("lostCategory")),
                    stringValue(values.get("remarkLost")),
                    stringValue(values.get("remark")),
                    stringValue(values.get("remarks")),
                    stringValue(values.get("note"))
                );
                if (lostReason != null && !lostReason.isBlank()) {
                    lead.setLostReason(lostReason);
                }
            }
        }

        parseFollowUpDate(
            firstNonBlank(
                stringValue(values.get("nextFollowUpDate")),
                stringValue(values.get("followUpDate")),
                stringValue(values.get("callbackAt"))
            ),
            firstNonBlank(
                stringValue(values.get("nextFollowUpTime")),
                stringValue(values.get("followUpTime"))
            )
        ).ifPresent(lead::setFollowUpDate);
    }

    private Lead.LeadStatus resolveLeadStatusFromActivity(Integer activityIndex, Map<String, Object> values) {
        String status = normalizeStatusText(firstNonBlank(
            stringValue(values.get("status")),
            stringValue(values.get("connectionStatus")),
            stringValue(values.get("callOutcome")),
            stringValue(values.get("outcome")),
            stringValue(values.get("remarkStatus"))
        ));
        String interestStatus = normalizeStatusText(stringValue(values.get("interestStatus")));

        if (activityIndex == 0) {
            // Connected + Not Interested → LOST
            if (containsAny(status, "connected") && containsAny(interestStatus, "not interested", "not_interested")) {
                return Lead.LeadStatus.LOST;
            }
            // Connected + Interested → CONTACTED (will advance to Activity 02)
            if (containsAny(status, "connected") && containsAny(interestStatus, "interested")) {
                return Lead.LeadStatus.CONTACTED;
            }
            // Not Connected → CONTACTED (stays at Activity 01 with follow-up)
            if (containsAny(status, "not connected", "non connected", "no answer", "callback", "busy", "wrong number")) {
                return Lead.LeadStatus.CONTACTED;
            }
            return null;
        }
        if (activityIndex == 1) {
            if (containsAny(status, "lost", "closed lost")) return Lead.LeadStatus.LOST;
            if (containsAny(status, "allowed person", "meeting")) return Lead.LeadStatus.QUALIFIED;
            if (containsAny(status, "follow")) return Lead.LeadStatus.CONTACTED;
            return null;
        }
        if (activityIndex == 2) {
            if (containsAny(status, "won", "win", "closed won")) return Lead.LeadStatus.WON;
            if (containsAny(status, "lost", "closed lost")) return Lead.LeadStatus.LOST;
            if (containsAny(status, "negoti")) return Lead.LeadStatus.NEGOTIATION;
        }
        return null;
    }

    private Lead ensureLeadExists(String leadId) {
        return leadRepository.findByIdAndTenantIdAndDeletedFalse(leadId, tenantId())
            .orElseThrow(() -> new ResourceNotFoundException("Lead not found: " + leadId));
    }

    private void ensureLeadVisible(Lead lead) {
        if (!canCurrentUserAccess(lead)) {
            throw new ResourceNotFoundException("Lead not found: " + lead.getId());
        }
    }

    private boolean canCurrentUserAccess(Lead lead) {
        var current = currentUser();
        if (current == null || com.nexacrm.model.User.isAdminLike(current.getRole()) || current.getRole() == com.nexacrm.model.User.Role.MANAGER) {
            return true;
        }
        if (current.getId() == null || current.getId().isBlank() || lead == null) {
            return false;
        }
        return lead.getAssignedTo() != null && current.getId().equals(lead.getAssignedTo().getId());
    }

    private String buildSummary(Map<String, Object> values) {
        if (values == null || values.isEmpty()) return "No extra details";
        Set<String> seenLabels = new LinkedHashSet<>();
        Set<String> seenValues = new LinkedHashSet<>();
        List<String> parts = new ArrayList<>();

        values.forEach((key, value) -> {
            String text = stringValue(value);
            if (key == null || text.isBlank()) return;
            String label = summaryLabel(key);
            String normalizedValue = text.toLowerCase(Locale.ROOT);
            if (seenLabels.contains(label)) return;
            if (seenValues.contains(normalizedValue) && !isImportantDuplicateLabel(label)) return;
            seenLabels.add(label);
            seenValues.add(normalizedValue);
            parts.add(label + ": " + text);
        });

        return parts.isEmpty() ? "No extra details" : String.join(" | ", parts);
    }

    private String summaryLabel(String key) {
        return switch (key) {
            case "status", "connectionStatus", "callOutcome", "outcome", "remarkStatus" -> "Status";
            case "remark", "remarks", "note", "remarkWon", "remarkLost" -> "Remarks";
            case "lostCategory" -> "Lost category";
            case "nextFollowUpDate", "followUpDate" -> "Next follow-up";
            case "meetingPriceFinal" -> "Final price";
            case "paymentReceived" -> "Payment received";
            default -> humanizeKey(key);
        };
    }

    private boolean isImportantDuplicateLabel(String label) {
        return Set.of("Lost category", "Next follow-up", "Final price", "Payment received").contains(label);
    }

    private String humanizeKey(String key) {
        String spaced = key.replaceAll("([a-z])([A-Z])", "$1 $2").replace('_', ' ').replace('-', ' ').trim();
        if (spaced.isBlank()) return key;
        return spaced.substring(0, 1).toUpperCase(Locale.ROOT) + spaced.substring(1);
    }

    private void applyActivityDefaults(Lead lead, LeadActivityDTO dto, Map<String, Object> values, LocalDateTime savedAt, String assignedTo) {
        if (dto.getActivityIndex() == null || dto.getActivityIndex() != 0) {
            applyGenericDefaults(values, savedAt, assignedTo);
            if (dto.getActivityIndex() != null && dto.getActivityIndex() == 1) {
                applyActivityTwoDefaults(lead, values, savedAt, assignedTo);
            } else if (dto.getActivityIndex() != null && dto.getActivityIndex() == 2) {
                applyActivityThreeDefaults(lead, values, savedAt, assignedTo);
            }
            return;
        }

        LocalDateTime plannedDate = lead.getCreatedAt() != null ? lead.getCreatedAt() : savedAt;
        String source = lead.getSource() != null ? lead.getSource().name() : stringValue(values.get("source"));
        String serviceRequirement = firstNonBlank(lead.getService(), lead.getSpecialization(), stringValue(values.get("serviceRequirement")));
        String connectionStatus = normalizeConnectionStatus(
            firstNonBlank(
                stringValue(values.get("connectionStatus")),
                stringValue(values.get("callOutcome")),
                stringValue(values.get("status"))
            )
        );
        String interestStatus = normalizeInterestStatus(
            firstNonBlank(
                stringValue(values.get("interestStatus")),
                stringValue(values.get("interest"))
            )
        );
        String remarks = firstNonBlank(
            stringValue(values.get("remark")),
            stringValue(values.get("remarks")),
            stringValue(values.get("note"))
        );
        String nextFollowUpDate = firstNonBlank(
            stringValue(values.get("nextFollowUpDate")),
            stringValue(values.get("followUpDate"))
        );
        double delayHours = Math.abs(Duration.between(plannedDate, savedAt).toMinutes() / 60.0);

        values.put("source", source);
        values.put("serviceRequirement", serviceRequirement);
        values.put("plannedDate", plannedDate.toString());
        values.put("actualDate", savedAt.toString());
        values.put("actual", savedAt.toString());
        values.put("delayHours", roundOneDecimal(delayHours));
        values.put("delay", roundOneDecimal(delayHours));
        values.put("actualDateStatus", computeActualDateStatus(plannedDate, savedAt));
        values.put("assignedTo", assignedTo);

        if (connectionStatus != null && !connectionStatus.isBlank()) {
            values.put("connectionStatus", connectionStatus);
            values.put("callOutcome", connectionStatus);
        }
        if (interestStatus != null && !interestStatus.isBlank()) {
            values.put("interestStatus", interestStatus);
        }
        if (remarks != null && !remarks.isBlank()) {
            values.put("remark", remarks);
            values.put("remarks", remarks);
        }
        if (nextFollowUpDate != null && !nextFollowUpDate.isBlank()) {
            values.put("nextFollowUpDate", nextFollowUpDate);
            values.put("followUpDate", nextFollowUpDate);
        }
    }

    private void applyGenericDefaults(Map<String, Object> values, LocalDateTime savedAt, String assignedTo) {
        values.put("actualDate", savedAt.toString());
        values.put("actual", savedAt.toString());
        values.put("actualDateStatus", "On Time");
        if (assignedTo != null && !assignedTo.isBlank()) {
            values.putIfAbsent("assignedTo", assignedTo);
        }
    }

    private void applyActivityTwoDefaults(Lead lead, Map<String, Object> values, LocalDateTime savedAt, String assignedTo) {
        LocalDateTime plannedDate = resolvePreviousActivityActualDate(lead.getId(), 0)
            .orElseGet(() -> lead.getCreatedAt() != null ? lead.getCreatedAt() : savedAt);
        String status = normalizeActivityTwoStatus(firstNonBlank(
            stringValue(values.get("status")),
            stringValue(values.get("remarkStatus"))
        ));
        String remark = firstNonBlank(stringValue(values.get("remark")), stringValue(values.get("remarks")), stringValue(values.get("note")));
        String nextFollowUpDate = firstNonBlank(stringValue(values.get("nextFollowUpDate")), stringValue(values.get("followUpDate")));
        double delayHours = Math.abs(Duration.between(plannedDate, savedAt).toMinutes() / 60.0);

        values.put("plannedDate", plannedDate.toString());
        values.put("actualDate", savedAt.toString());
        values.put("actual", savedAt.toString());
        values.put("delayHours", roundOneDecimal(delayHours));
        values.put("delay", roundOneDecimal(delayHours));
        values.put("actualDateStatus", computeActualDateStatus(plannedDate, savedAt));
        values.put("assignedTo", assignedTo);

        if (status != null && !status.isBlank()) {
            values.put("status", status);
        }
        if (remark != null && !remark.isBlank()) {
            values.put("remark", remark);
            values.put("remarks", remark);
        }
        if (nextFollowUpDate != null && !nextFollowUpDate.isBlank()) {
            values.put("nextFollowUpDate", nextFollowUpDate);
            values.put("followUpDate", nextFollowUpDate);
        }
    }

    private void applyActivityThreeDefaults(Lead lead, Map<String, Object> values, LocalDateTime savedAt, String assignedTo) {
        LocalDateTime plannedDate = resolvePreviousActivityActualDate(lead.getId(), 1)
            .orElseGet(() -> lead.getCreatedAt() != null ? lead.getCreatedAt() : savedAt);
        String status = normalizeActivityThreeStatus(firstNonBlank(
            stringValue(values.get("status")),
            stringValue(values.get("outcome"))
        ));
        String remark = firstNonBlank(
            stringValue(values.get("remark")),
            stringValue(values.get("remarks")),
            stringValue(values.get("note")),
            stringValue(values.get("remarkWon")),
            stringValue(values.get("remarkLost"))
        );
        String lostCategory = firstNonBlank(stringValue(values.get("lostCategory")));
        String paymentReceived = firstNonBlank(stringValue(values.get("paymentReceived")));
        String meetingPriceFinal = firstNonBlank(stringValue(values.get("meetingPriceFinal")));
        double delayHours = Math.abs(Duration.between(plannedDate, savedAt).toMinutes() / 60.0);

        values.put("plannedDate", plannedDate.toString());
        values.put("actualDate", savedAt.toString());
        values.put("actual", savedAt.toString());
        values.put("delayHours", roundOneDecimal(delayHours));
        values.put("delay", roundOneDecimal(delayHours));
        values.put("actualDateStatus", computeActualDateStatus(plannedDate, savedAt));
        values.put("assignedTo", assignedTo);

        if (status != null && !status.isBlank()) {
            values.put("status", status);
        }
        if (remark != null && !remark.isBlank()) {
            values.put("remark", remark);
            values.put("remarks", remark);
        }
        if (lostCategory != null && !lostCategory.isBlank()) {
            values.put("lostCategory", lostCategory);
        }
        if (paymentReceived != null && !paymentReceived.isBlank()) {
            values.put("paymentReceived", paymentReceived);
        }
        if (meetingPriceFinal != null && !meetingPriceFinal.isBlank()) {
            values.put("meetingPriceFinal", meetingPriceFinal);
        }
    }

    private Optional<LocalDateTime> resolvePreviousActivityActualDate(String leadId, int activityIndex) {
        return leadActivityRepository.findByLeadIdAndTenantIdAndDeletedFalseOrderBySavedAtDesc(leadId, tenantId()).stream()
            .filter(activity -> activity.getActivityIndex() != null && activity.getActivityIndex() == activityIndex)
            .findFirst()
            .map(this::extractActivityActualDate);
    }

    private LocalDateTime extractActivityActualDate(LeadActivity activity) {
        if (activity == null) return null;
        Map<String, Object> values = activity.getValues();
        String raw = firstNonBlank(
            values != null ? stringValue(values.get("actualDate")) : null,
            values != null ? stringValue(values.get("actual")) : null,
            activity.getSavedAt() != null ? activity.getSavedAt().toString() : null
        );
        if (raw == null || raw.isBlank()) return null;
        try {
            return LocalDateTime.parse(raw);
        } catch (Exception ignored) {
            return activity.getSavedAt();
        }
    }

    private String resolveAssignedTo(Lead lead, LeadActivityDTO dto, Map<String, Object> values) {
        String explicit = firstNonBlank(dto.getAssignedTo(), stringValue(values.get("assignedTo")));
        if (explicit != null) {
            return explicit;
        }
        if (lead.getAssignedTo() != null) {
            return firstNonBlank(lead.getAssignedTo().getName(), lead.getAssignedTo().getEmail());
        }
        String currentUser = currentUserName();
        return currentUser != null ? currentUser : "Sales Team";
    }

    private String currentUserName() {
        com.nexacrm.model.User current = currentUser();
        return current != null ? firstNonBlank(current.getName(), current.getEmail()) : null;
    }

    private com.nexacrm.model.User currentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmailAndTenantIdAndDeletedFalse(email, tenantId())
            .orElse(null);
    }

    private String normalizeConnectionStatus(String value) {
        String normalized = stringValue(value).toLowerCase(Locale.ROOT);
        if (normalized.contains("callback") || normalized.contains("call back") || normalized.contains("call-back")) return "CallBack";
        if (normalized.contains("not") || normalized.contains("non")) return "Not Connected";
        if (normalized.contains("connect")) return "Connected";
        return "";
    }

    private String normalizeInterestStatus(String value) {
        String normalized = stringValue(value).toLowerCase(Locale.ROOT);
        if (normalized.contains("not interested") || normalized.contains("not_interested")) return "Not Interested";
        if (normalized.contains("interested")) return "Interested";
        return "";
    }

    private String normalizeActivityTwoStatus(String value) {
        String normalized = stringValue(value).toLowerCase(Locale.ROOT);
        if (normalized.contains("allowed person")) return "Allowed Person for Meeting";
        if (normalized.contains("meeting")) return "Meeting";
        if (normalized.contains("follow")) return "Follow Up";
        return "";
    }

    private String normalizeActivityThreeStatus(String value) {
        String normalized = stringValue(value).toLowerCase(Locale.ROOT);
        if (normalized.contains("won") || normalized.contains("win")) return "Won";
        if (normalized.contains("lost")) return "Lost";
        if (normalized.contains("negoti")) return "Negotiation";
        return "";
    }

    private Optional<LocalDateTime> parseFollowUpDate(String value, String timeValue) {
        String raw = stringValue(value);
        if (raw.isBlank()) return Optional.empty();
        try {
            if (raw.length() == 10) {
                LocalTime time = parseFollowUpTime(timeValue).orElse(LocalTime.MIDNIGHT);
                return Optional.of(LocalDate.parse(raw).atTime(time));
            }
            return Optional.of(LocalDateTime.parse(raw));
        } catch (Exception ignored) {
            return Optional.empty();
        }
    }

    private Optional<LocalTime> parseFollowUpTime(String value) {
        String raw = stringValue(value).toUpperCase(Locale.ROOT);
        if (raw.isBlank()) return Optional.empty();
        for (DateTimeFormatter formatter : List.of(
            DateTimeFormatter.ISO_LOCAL_TIME,
            DateTimeFormatter.ofPattern("H:mm"),
            DateTimeFormatter.ofPattern("h:mm a")
        )) {
            try {
                return Optional.of(LocalTime.parse(raw, formatter));
            } catch (Exception ignored) {
                // Try the next supported browser/user-facing time format.
            }
        }
        return Optional.empty();
    }

    private BigDecimal parseMoney(String value) {
        String raw = stringValue(value).replace(",", "");
        if (raw.isBlank()) return null;
        try {
            return new BigDecimal(raw);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private boolean isAffirmative(Object value) {
        String normalized = normalizeStatusText(stringValue(value));
        return normalized.equals("yes") || normalized.equals("true") || normalized.equals("paid") || normalized.equals("received");
    }

    private boolean containsAny(String normalized, String... needles) {
        if (normalized == null || normalized.isBlank() || needles == null) return false;
        for (String needle : needles) {
            if (needle != null && !needle.isBlank() && normalized.contains(normalizeStatusText(needle))) {
                return true;
            }
        }
        return false;
    }

    private String normalizeStatusText(String value) {
        return stringValue(value)
            .toLowerCase(Locale.ROOT)
            .replace('-', ' ')
            .replace('_', ' ')
            .replaceAll("\\s+", " ")
            .trim();
    }

    private String computeActualDateStatus(LocalDateTime plannedDate, LocalDateTime actualDate) {
        if (plannedDate == null || actualDate == null) return "On Time";
        long minutes = Duration.between(plannedDate, actualDate).toMinutes();
        if (Math.abs(minutes) < 1) return "On Time";
        if (minutes > 0) return "Delayed";
        return "Early";
    }

    private double roundOneDecimal(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    private String firstNonBlank(String... values) {
        if (values == null) return null;
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return null;
    }

    private Path recordingsDir() {
        String configured = configuredUploadsDir != null ? configuredUploadsDir.trim() : "";
        Path base;
        if (!configured.isBlank()) {
            base = Path.of(configured);
        } else if (System.getProperty("os.name", "").toLowerCase(Locale.ROOT).contains("win")) {
            base = Path.of("uploads");
        } else {
            base = Path.of("/home/nexacrm/uploads");
        }
        return base.resolve("lead-recordings").toAbsolutePath().normalize();
    }

    private String sanitizeFilename(String filename) {
        String cleaned = filename == null ? "call-recording" : filename.replace('\\', '/');
        int slash = cleaned.lastIndexOf('/');
        if (slash >= 0) cleaned = cleaned.substring(slash + 1);
        cleaned = cleaned.replaceAll("[^A-Za-z0-9._ -]", "_").trim();
        return cleaned.isBlank() ? "call-recording" : cleaned;
    }

    private String recordingExtension(String filename, String contentType) {
        String lower = filename != null ? filename.toLowerCase(Locale.ROOT) : "";
        for (String extension : List.of(".mp3", ".wav", ".m4a", ".aac", ".ogg", ".webm", ".amr", ".flac")) {
            if (lower.endsWith(extension)) return extension;
        }
        String type = contentType != null ? contentType.toLowerCase(Locale.ROOT) : "";
        if (type.contains("wav")) return ".wav";
        if (type.contains("mp4") || type.contains("m4a")) return ".m4a";
        if (type.contains("aac")) return ".aac";
        if (type.contains("ogg")) return ".ogg";
        if (type.contains("webm")) return ".webm";
        if (type.contains("amr")) return ".amr";
        if (type.contains("flac")) return ".flac";
        if (type.startsWith("audio/") || type.equals("application/octet-stream")) return ".mp3";
        throw new IllegalArgumentException("Please upload an audio recording file");
    }

    private String recordingContentType(String contentType, String extension) {
        String type = contentType != null ? contentType.trim().toLowerCase(Locale.ROOT) : "";
        if (type.startsWith("audio/")) return type;
        return switch (extension) {
            case ".wav" -> "audio/wav";
            case ".m4a" -> "audio/mp4";
            case ".aac" -> "audio/aac";
            case ".ogg" -> "audio/ogg";
            case ".webm" -> "audio/webm";
            case ".amr" -> "audio/amr";
            case ".flac" -> "audio/flac";
            default -> "audio/mpeg";
        };
    }

    private String stringValue(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private LeadActivityDTO toDTO(LeadActivity activity) {
        return LeadActivityDTO.builder()
            .id(activity.getId())
            .leadId(activity.getLeadId())
            .activityIndex(activity.getActivityIndex())
            .activityId(activity.getActivityId())
            .activityLabel(activity.getActivityLabel())
            .activityTitle(activity.getActivityTitle())
            .assignedTo(activity.getAssignedTo())
            .summary(activity.getSummary())
            .values(activity.getValues())
            .savedAt(activity.getSavedAt())
            .createdAt(activity.getCreatedAt())
            .updatedAt(activity.getUpdatedAt())
            .build();
    }
}
