package com.internite.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.internite.model.AppSetting;
import com.internite.model.Lead;
import com.internite.repository.AppSettingRepository;
import com.internite.repository.LeadRepository;
import com.internite.security.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.CompletableFuture;

@Service
@RequiredArgsConstructor
@Slf4j
public class PipelineWhatsAppDigestService {

    private static final String NAMESPACE = "automation";
    private static final String KEY = "pipelineWhatsappDigest";
    private static final String DEFAULT_TIME = "18:00";
    private static final String DEFAULT_TIMEZONE = "Asia/Kolkata";
    private static final TypeReference<Map<String, Object>> CONFIG_TYPE = new TypeReference<>() {};
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd MMM yyyy");
    private static final DateTimeFormatter TIME_FORMAT = DateTimeFormatter.ofPattern("HH:mm");

    private final AppSettingRepository appSettingRepository;
    private final LeadRepository leadRepository;
    private final CommunicationService communicationService;
    private final PipelinePlaybookPdfService pipelinePlaybookPdfService;
    private final PipelinePdfMediaService pipelinePdfMediaService;
    private final MongoTemplate mongoTemplate;
    private final ObjectMapper objectMapper;

    @Value("${internite.public-base-url:${PUBLIC_BASE_URL:http://localhost:5173}}")
    private String publicBaseUrl;

    public Map<String, Object> getCurrentConfiguration() {
        return publicConfiguration(readConfiguration(TenantContext.currentTenantId()));
    }

    public Map<String, Object> saveCurrentConfiguration(Map<String, Object> request) {
        Long tenantId = TenantContext.currentTenantId();
        Map<String, Object> current = readConfiguration(tenantId);
        Map<String, Object> config = new LinkedHashMap<>();
        config.put("enabled", booleanValue(request != null && request.containsKey("enabled") ? request.get("enabled") : current.get("enabled"), false));
        config.put("time", normalizeTime(textValue(request, "time", textValue(current, "time", DEFAULT_TIME))));
        Object requestedRecipients = request != null && request.containsKey("recipients")
            ? request.get("recipients")
            : request != null && request.containsKey("recipient")
                ? request.get("recipient")
                : currentRecipients(current);
        List<String> recipients = normalizeRecipients(requestedRecipients);
        config.put("recipients", recipients);
        config.put("timezone", normalizeTimezone(textValue(request, "timezone", textValue(current, "timezone", DEFAULT_TIMEZONE))));
        config.put("pdfEnabled", booleanValue(request != null && request.containsKey("pdfEnabled") ? request.get("pdfEnabled") : current.get("pdfEnabled"), false));
        config.put("lastSentDate", textValue(current, "lastSentDate", ""));
        config.put("lastSentAt", textValue(current, "lastSentAt", ""));
        config.put("lastPdfSentDate", textValue(current, "lastPdfSentDate", ""));
        config.put("lastPdfSentAt", textValue(current, "lastPdfSentAt", ""));
        config.put("pdfSendStatus", textValue(current, "pdfSendStatus", "IDLE"));
        config.put("pdfSendError", textValue(current, "pdfSendError", ""));
        config.put("pdfSendStartedAt", textValue(current, "pdfSendStartedAt", ""));

        if ((Boolean.TRUE.equals(config.get("enabled")) || Boolean.TRUE.equals(config.get("pdfEnabled"))) && recipients.isEmpty()) {
            throw new IllegalArgumentException("Add at least one WhatsApp recipient when a daily pipeline automation is enabled.");
        }
        persistConfiguration(tenantId, config);
        return publicConfiguration(config);
    }

    public Map<String, Object> sendCurrentDigestNow() {
        Long tenantId = TenantContext.currentTenantId();
        Map<String, Object> config = readConfiguration(tenantId);
        if (currentRecipients(config).isEmpty()) {
            throw new IllegalArgumentException("Add at least one WhatsApp recipient before sending the digest.");
        }
        sendDigest(tenantId, config);
        return publicConfiguration(readConfiguration(tenantId));
    }

    public synchronized Map<String, Object> sendCurrentPipelinePdfNow() {
        Long tenantId = TenantContext.currentTenantId();
        Map<String, Object> config = readConfiguration(tenantId);
        if (currentRecipients(config).isEmpty()) {
            throw new IllegalArgumentException("Add at least one WhatsApp recipient before sending the pipeline PDF.");
        }
        if ("SENDING".equalsIgnoreCase(textValue(config, "pdfSendStatus", "IDLE"))) {
            throw new IllegalStateException("Pipeline PDF sending is already in progress. Please wait for it to finish.");
        }

        config.put("pdfSendStatus", "SENDING");
        config.put("pdfSendError", "");
        config.put("pdfSendStartedAt", Instant.now().toString());
        persistConfiguration(tenantId, config);
        Map<String, Object> backgroundConfig = new LinkedHashMap<>(config);
        CompletableFuture.runAsync(() -> {
            try {
                sendPipelinePdf(tenantId, backgroundConfig);
            } catch (Exception ex) {
                markPdfSendFailed(tenantId, ex);
                log.warn("Pipeline WhatsApp PDF background send failed for tenant {}: {}", tenantId, ex.getMessage());
            }
        });

        Map<String, Object> response = publicConfiguration(config);
        response.put("pdfSendStatus", "SENDING");
        response.put("pdfSendError", "");
        return response;
    }

    @Scheduled(cron = "0 * * * * *")
    public void sendScheduledDigests() {
        for (Long tenantId : resolveTenantIds()) {
            try {
                Map<String, Object> config = readConfiguration(tenantId);
                boolean digestEnabled = booleanValue(config.get("enabled"), false);
                boolean pdfEnabled = booleanValue(config.get("pdfEnabled"), false);
                if (!digestEnabled && !pdfEnabled) {
                    continue;
                }

                ZoneId zone = ZoneId.of(String.valueOf(config.get("timezone")));
                LocalDateTime now = LocalDateTime.now(zone);
                LocalTime scheduledTime = LocalTime.parse(String.valueOf(config.get("time")), TIME_FORMAT);
                boolean due = now.getHour() == scheduledTime.getHour() && now.getMinute() == scheduledTime.getMinute();
                if (digestEnabled && due && !textValue(config, "lastSentDate", "").equals(now.toLocalDate().toString())) {
                    try {
                        sendDigest(tenantId, config);
                    } catch (Exception ex) {
                        log.warn("Pipeline WhatsApp digest failed for tenant {}: {}", tenantId, ex.getMessage());
                    }
                }
                if (pdfEnabled && due && !textValue(config, "lastPdfSentDate", "").equals(now.toLocalDate().toString())) {
                    try {
                        sendPipelinePdf(tenantId, config);
                    } catch (Exception ex) {
                        log.warn("Pipeline WhatsApp PDF failed for tenant {}: {}", tenantId, ex.getMessage());
                    }
                }
            } catch (Exception ex) {
                log.warn("Pipeline WhatsApp digest failed for tenant {}: {}", tenantId, ex.getMessage());
            }
        }
    }

    private void sendDigest(Long tenantId, Map<String, Object> config) {
        TenantContext.setCurrentTenantId(tenantId);
        try {
            ZoneId zone = ZoneId.of(String.valueOf(config.get("timezone")));
            LocalDateTime now = LocalDateTime.now(zone);
            List<Lead> leads = leadRepository.findByTenantIdAndDeletedFalse(tenantId);
            String message = buildMessage(leads, now);
            List<String> recipients = currentRecipients(config);
            if (recipients.isEmpty()) {
                throw new IllegalStateException("No WhatsApp recipients are configured.");
            }

            int sent = 0;
            for (String recipient : recipients) {
                try {
                    communicationService.sendChannelMessage("whatsapp", recipient, "", message);
                    sent++;
                } catch (Exception ex) {
                    log.warn("Pipeline WhatsApp digest failed for tenant {} recipient {}: {}", tenantId, maskPhone(recipient), ex.getMessage());
                }
            }
            if (sent == 0) {
                throw new IllegalStateException("No WhatsApp messages were sent successfully.");
            }

            config.put("lastSentDate", now.toLocalDate().toString());
            config.put("lastSentAt", Instant.now().toString());
            persistConfiguration(tenantId, config);
            log.info("Pipeline WhatsApp digest sent for tenant {} to {} recipient(s)", tenantId, sent);
        } finally {
            TenantContext.clear();
        }
    }

    private void sendPipelinePdf(Long tenantId, Map<String, Object> config) {
        TenantContext.setCurrentTenantId(tenantId);
        try {
            ZoneId zone = ZoneId.of(String.valueOf(config.get("timezone")));
            LocalDateTime now = LocalDateTime.now(zone);
            byte[] pdf = pipelinePlaybookPdfService.generate();
            List<String> recipients = currentRecipients(config);
            if (recipients.isEmpty()) {
                throw new IllegalStateException("No WhatsApp recipients are configured.");
            }

            String date = now.toLocalDate().toString();
            String fileName = "internite-pipeline-" + date + ".pdf";
            String caption = "📎 Daily Pipeline PDF\n📅 " + now.toLocalDate().format(DATE_FORMAT);
            String mediaUrl = normalizePublicBaseUrl() + "/api/public/pipeline-pdf/" + pipelinePdfMediaService.publish(pdf, fileName);
            int sent = 0;
            for (String recipient : recipients) {
                try {
                    communicationService.sendWhatsAppDocument(recipient, pdf, fileName, caption, mediaUrl);
                    sent++;
                } catch (Exception ex) {
                    log.warn("Pipeline WhatsApp PDF failed for tenant {} recipient {}: {}", tenantId, maskPhone(recipient), ex.getMessage());
                }
            }
            if (sent == 0) {
                throw new IllegalStateException("No pipeline PDFs were sent successfully.");
            }

            config.put("lastPdfSentDate", now.toLocalDate().toString());
            config.put("lastPdfSentAt", Instant.now().toString());
            config.put("pdfSendStatus", "SENT");
            config.put("pdfSendError", "");
            config.put("pdfSendStartedAt", "");
            persistConfiguration(tenantId, config);
            log.info("Pipeline WhatsApp PDF sent for tenant {} to {} recipient(s)", tenantId, sent);
        } finally {
            TenantContext.clear();
        }
    }

    private void markPdfSendFailed(Long tenantId, Exception failure) {
        try {
            Map<String, Object> config = readConfiguration(tenantId);
            config.put("pdfSendStatus", "FAILED");
            config.put("pdfSendStartedAt", "");
            String message = failure == null ? "Unable to send pipeline PDF." : failure.getMessage();
            config.put("pdfSendError", message == null || message.isBlank() ? "Unable to send pipeline PDF." : message.substring(0, Math.min(message.length(), 240)));
            persistConfiguration(tenantId, config);
        } catch (Exception persistFailure) {
            log.warn("Unable to record pipeline PDF failure for tenant {}: {}", tenantId, persistFailure.getMessage());
        }
    }

    private String buildMessage(List<Lead> leads, LocalDateTime now) {
        List<Lead> rows = leads == null ? List.of() : leads.stream().filter(Objects::nonNull).toList();
        Map<Lead.LeadStatus, Integer> counts = new EnumMap<>(Lead.LeadStatus.class);
        for (Lead.LeadStatus status : Lead.LeadStatus.values()) counts.put(status, 0);
        rows.forEach(lead -> counts.compute(lead.getStatus() == null ? Lead.LeadStatus.NEW : lead.getStatus(), (key, value) -> value + 1));

        LocalDateTime since = now.minusHours(24);
        List<Lead> recent = rows.stream()
            .filter(lead -> lead.getUpdatedAt() != null && !lead.getUpdatedAt().isBefore(since))
            .sorted(Comparator.comparing(Lead::getUpdatedAt).reversed())
            .limit(8)
            .toList();

        StringBuilder message = new StringBuilder()
            .append("📊 *Daily Pipeline Update*\n")
            .append("📅 ").append(now.toLocalDate().format(DATE_FORMAT)).append("\n\n")
            .append("*Current pipeline:* ").append(rows.size()).append(" leads\n")
            .append("• New: ").append(counts.get(Lead.LeadStatus.NEW))
            .append("  • Contacted: ").append(counts.get(Lead.LeadStatus.CONTACTED)).append("\n")
            .append("• Qualified: ").append(counts.get(Lead.LeadStatus.QUALIFIED))
            .append("  • Proposal: ").append(counts.get(Lead.LeadStatus.PROPOSAL)).append("\n")
            .append("• Negotiation: ").append(counts.get(Lead.LeadStatus.NEGOTIATION))
            .append("  • Won: ").append(counts.get(Lead.LeadStatus.WON))
            .append("  • Lost: ").append(counts.get(Lead.LeadStatus.LOST)).append("\n\n")
            .append("*Updated in the last 24 hours: ").append(recent.size()).append("*\n");

        if (recent.isEmpty()) {
            message.append("No lead records were updated in the last 24 hours.");
        } else {
            for (Lead lead : recent) {
                String name = cleanText(lead.getName(), "Unnamed lead");
                String status = lead.getStatus() == null ? "NEW" : lead.getStatus().name();
                String value = lead.getDealValue() == null ? "" : " · ₹" + lead.getDealValue().stripTrailingZeros().toPlainString();
                message.append("• ").append(name).append(" — ").append(status).append(value).append("\n");
            }
        }
        message.append("\nOpen Internite CRM Pipeline for full details.");
        return message.toString();
    }

    private Map<String, Object> readConfiguration(Long tenantId) {
        Map<String, Object> defaults = new LinkedHashMap<>();
        defaults.put("enabled", false);
        defaults.put("time", DEFAULT_TIME);
        defaults.put("recipients", List.of());
        defaults.put("timezone", DEFAULT_TIMEZONE);
        defaults.put("pdfEnabled", false);
        defaults.put("lastSentDate", "");
        defaults.put("lastSentAt", "");
        defaults.put("lastPdfSentDate", "");
        defaults.put("lastPdfSentAt", "");
        defaults.put("pdfSendStatus", "IDLE");
        defaults.put("pdfSendError", "");
        defaults.put("pdfSendStartedAt", "");
        return appSettingRepository.findByTenantIdAndNamespaceAndKeyAndDeletedFalse(tenantId, NAMESPACE, KEY)
            .map(AppSetting::getValue)
            .map(this::parseConfiguration)
            .map(config -> mergeDefaults(defaults, config))
            .map(this::recoverStalePdfSend)
            .orElse(defaults);
    }

    private Map<String, Object> parseConfiguration(String json) {
        try {
            return objectMapper.readValue(json, CONFIG_TYPE);
        } catch (Exception ex) {
            return Map.of();
        }
    }

    private Map<String, Object> mergeDefaults(Map<String, Object> defaults, Map<String, Object> saved) {
        Map<String, Object> merged = new LinkedHashMap<>(defaults);
        if (saved != null) merged.putAll(saved);
        return merged;
    }

    private Map<String, Object> publicConfiguration(Map<String, Object> config) {
        Map<String, Object> response = new LinkedHashMap<>(config);
        response.put("recipients", currentRecipients(config));
        response.remove("recipient");
        response.remove("lastSentDate");
        response.remove("lastPdfSentDate");
        response.remove("pdfSendStartedAt");
        return response;
    }

    private Map<String, Object> recoverStalePdfSend(Map<String, Object> config) {
        if (!"SENDING".equalsIgnoreCase(textValue(config, "pdfSendStatus", "IDLE"))) {
            return config;
        }
        String startedAt = textValue(config, "pdfSendStartedAt", "");
        boolean stale;
        try {
            stale = startedAt.isBlank() || Instant.parse(startedAt).isBefore(Instant.now().minusSeconds(600));
        } catch (Exception ex) {
            stale = true;
        }
        if (stale) {
            config.put("pdfSendStatus", "FAILED");
            config.put("pdfSendError", "Previous PDF sending stopped before completion. Please try again.");
            config.put("pdfSendStartedAt", "");
        }
        return config;
    }

    private List<String> currentRecipients(Map<String, Object> config) {
        List<String> recipients = normalizeRecipients(config == null ? null : config.get("recipients"));
        if (!recipients.isEmpty()) {
            return recipients;
        }
        String legacyRecipient = textValue(config, "recipient", "");
        return legacyRecipient.isBlank() ? List.of() : List.of(normalizePhone(legacyRecipient));
    }

    private List<String> normalizeRecipients(Object raw) {
        List<String> values = new ArrayList<>();
        if (raw instanceof Collection<?> collection) {
            for (Object value : collection) {
                addNormalizedRecipient(values, value == null ? "" : String.valueOf(value));
            }
        } else if (raw != null) {
            addNormalizedRecipient(values, String.valueOf(raw));
        }
        return values.stream().distinct().toList();
    }

    private void addNormalizedRecipient(List<String> values, String raw) {
        String normalized = normalizePhone(raw);
        if (!normalized.isBlank()) {
            values.add(normalized);
        }
    }

    private void persistConfiguration(Long tenantId, Map<String, Object> config) {
        AppSetting setting = appSettingRepository
            .findByTenantIdAndNamespaceAndKeyAndDeletedFalse(tenantId, NAMESPACE, KEY)
            .orElseGet(() -> AppSetting.builder().namespace(NAMESPACE).key(KEY).encrypted(false).build());
        try {
            setting.setTenantId(tenantId);
            setting.setNamespace(NAMESPACE);
            setting.setKey(KEY);
            setting.setValue(objectMapper.writeValueAsString(config));
            setting.setDescription("Daily WhatsApp pipeline digest");
            setting.setEncrypted(false);
            setting.setDeleted(false);
            appSettingRepository.save(setting);
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to save pipeline WhatsApp digest settings.", ex);
        }
    }

    private Set<Long> resolveTenantIds() {
        Set<Long> tenantIds = new LinkedHashSet<>();
        try {
            tenantIds.addAll(mongoTemplate.findDistinct(
                Query.query(Criteria.where("deleted").is(false)), "tenant_id", "settings", Long.class));
            tenantIds.addAll(mongoTemplate.findDistinct(
                Query.query(Criteria.where("deleted").is(false)), "tenant_id", "leads", Long.class));
        } catch (Exception ex) {
            log.warn("Unable to enumerate tenants for pipeline WhatsApp digest: {}", ex.getMessage());
        }
        return tenantIds.stream().filter(Objects::nonNull).collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
    }

    private String normalizeTime(String raw) {
        try {
            return LocalTime.parse(raw, TIME_FORMAT).format(TIME_FORMAT);
        } catch (DateTimeParseException ex) {
            throw new IllegalArgumentException("Time must use 24-hour HH:mm format.");
        }
    }

    private String normalizeTimezone(String raw) {
        try {
            return ZoneId.of(raw).getId();
        } catch (Exception ex) {
            throw new IllegalArgumentException("Select a valid timezone.");
        }
    }

    private String normalizePhone(String raw) {
        String digits = raw == null ? "" : raw.replaceAll("\\D", "");
        if (digits.isBlank()) return "";
        if (digits.length() < 7 || digits.length() > 15) {
            throw new IllegalArgumentException("WhatsApp number must contain 7 to 15 digits.");
        }
        return digits.length() == 10 ? "+91" + digits : "+" + digits;
    }

    private String textValue(Map<String, Object> map, String key, String fallback) {
        Object value = map == null ? null : map.get(key);
        return value == null ? fallback : String.valueOf(value).trim();
    }

    private boolean booleanValue(Object value, boolean fallback) {
        if (value == null) return fallback;
        if (value instanceof Boolean bool) return bool;
        return Boolean.parseBoolean(String.valueOf(value));
    }

    private String cleanText(String value, String fallback) {
        String normalized = value == null ? "" : value.replaceAll("[\\r\\n]+", " ").trim();
        return normalized.isBlank() ? fallback : normalized;
    }

    private String maskPhone(String phone) {
        String digits = phone == null ? "" : phone.replaceAll("\\D", "");
        return digits.length() <= 4 ? "****" : "****" + digits.substring(digits.length() - 4);
    }

    private String normalizePublicBaseUrl() {
        String base = publicBaseUrl == null ? "http://localhost:5173" : publicBaseUrl.trim();
        while (base.endsWith("/")) base = base.substring(0, base.length() - 1);
        return base.isBlank() ? "http://localhost:5173" : base;
    }
}
