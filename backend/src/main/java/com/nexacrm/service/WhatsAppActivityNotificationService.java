package com.nexacrm.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexacrm.model.AppSetting;
import com.nexacrm.model.Lead;
import com.nexacrm.model.LeadActivity;
import com.nexacrm.repository.AppSettingRepository;
import com.nexacrm.repository.LeadRepository;
import com.nexacrm.security.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class WhatsAppActivityNotificationService {

    private static final String NAMESPACE = "automation";
    private static final String KEY = "whatsappActivityNotifications";
    private static final TypeReference<Map<String, Object>> CONFIG_TYPE = new TypeReference<>() {};
    private static final DateTimeFormatter DT_FORMAT = DateTimeFormatter.ofPattern("dd MMM yyyy hh:mm a");
    private static final DateTimeFormatter ZONED_DT_FORMAT = DateTimeFormatter.ofPattern("dd MMM yyyy hh:mm a z");
    private static final DateTimeFormatter ZONE_FORMAT = DateTimeFormatter.ofPattern("z");
    private static final DateTimeFormatter FOLLOW_UP_TIME_FORMAT = DateTimeFormatter.ofPattern("hh:mm a");

    private final AppSettingRepository appSettingRepository;
    private final LeadRepository leadRepository;
    private final CommunicationService communicationService;
    private final MongoTemplate mongoTemplate;
    private final ObjectMapper objectMapper;

    // ── Config CRUD ────────────────────────────────────────────

    public Map<String, Object> getConfig() {
        return publicConfig(readConfig(TenantContext.currentTenantId()));
    }

    public Map<String, Object> saveConfig(Map<String, Object> request) {
        Long tenantId = TenantContext.currentTenantId();
        Map<String, Object> current = readConfig(tenantId);
        Map<String, Object> config = new LinkedHashMap<>();
        config.put("activityEnabled", boolVal(request, "activityEnabled", boolVal(current, "activityEnabled", false)));
        config.put("reminderEnabled", boolVal(request, "reminderEnabled", boolVal(current, "reminderEnabled", false)));
        config.put("reminderMinutesBefore", intVal(request, "reminderMinutesBefore", intVal(current, "reminderMinutesBefore", 15)));
        config.put("timezone", normalizeTimezone(strVal(request, "timezone", strVal(current, "timezone", "Asia/Kolkata"))));
        List<String> recipients = normalizeRecipients(request != null && request.containsKey("recipients") ? request.get("recipients") : current.get("recipients"));
        config.put("recipients", recipients);

        boolean anyEnabled = Boolean.TRUE.equals(config.get("activityEnabled")) || Boolean.TRUE.equals(config.get("reminderEnabled"));
        if (anyEnabled && recipients.isEmpty()) {
            throw new IllegalArgumentException("Add at least one WhatsApp number when notifications are enabled.");
        }

        persistConfig(tenantId, config);
        return publicConfig(config);
    }

    // ── Activity notification (called after activity create/update) ────

    @Async
    public void notifyActivitySaved(Long tenantId, Lead lead, LeadActivity activity) {
        try {
            Map<String, Object> config = readConfig(tenantId);
            if (!Boolean.TRUE.equals(config.get("activityEnabled"))) return;
            List<String> recipients = currentRecipients(config);
            if (recipients.isEmpty()) return;

            ZoneId zone = notificationZone(config);
            String message = buildActivityMessage(lead, activity, zone);
            TenantContext.setCurrentTenantId(tenantId);
            try {
                for (String recipient : recipients) {
                    try {
                        communicationService.sendChannelMessage("whatsapp", recipient, "", message);
                    } catch (Exception ex) {
                        log.warn("WhatsApp activity notification failed for recipient {}: {}", maskPhone(recipient), ex.getMessage());
                    }
                }
            } finally {
                TenantContext.clear();
            }
        } catch (Exception ex) {
            log.warn("WhatsApp activity notification failed for tenant {}: {}", tenantId, ex.getMessage());
        }
    }

    // ── Follow-up reminder scheduler ────────────────────────────

    @Scheduled(cron = "0 * * * * *")
    public void sendFollowUpReminders() {
        for (Long tenantId : resolveTenantIds()) {
            try {
                Map<String, Object> config = readConfig(tenantId);
                if (!Boolean.TRUE.equals(config.get("reminderEnabled"))) continue;
                List<String> recipients = currentRecipients(config);
                if (recipients.isEmpty()) continue;

                int minutesBefore = intVal(config, "reminderMinutesBefore", 15);
                ZoneId zone = notificationZone(config);
                LocalDateTime now = LocalDateTime.now(zone);
                LocalDateTime windowStart = now.plusMinutes(minutesBefore);
                LocalDateTime windowEnd = windowStart.plusMinutes(1);

                List<Lead> dueLeads = leadRepository.findByTenantIdAndDeletedFalse(tenantId).stream()
                    .filter(lead -> lead.getFollowUpDate() != null)
                    .filter(lead -> !lead.getFollowUpDate().isBefore(windowStart) && lead.getFollowUpDate().isBefore(windowEnd))
                    .toList();

                if (dueLeads.isEmpty()) continue;

                TenantContext.setCurrentTenantId(tenantId);
                try {
                    for (Lead lead : dueLeads) {
                        String message = buildReminderMessage(lead, minutesBefore, zone);
                        for (String recipient : recipients) {
                            try {
                                communicationService.sendChannelMessage("whatsapp", recipient, "", message);
                            } catch (Exception ex) {
                                log.warn("WhatsApp follow-up reminder failed for recipient {}: {}", maskPhone(recipient), ex.getMessage());
                            }
                        }
                    }
                } finally {
                    TenantContext.clear();
                }
            } catch (Exception ex) {
                log.warn("WhatsApp follow-up reminder failed for tenant {}: {}", tenantId, ex.getMessage());
            }
        }
    }

    // ── Message builders ────────────────────────────────────────

    private String buildActivityMessage(Lead lead, LeadActivity activity, ZoneId zone) {
        String leadName = cleanText(lead.getName(), "Unnamed Lead");
        String leadPhone = cleanText(lead.getPhone(), "");
        String activityTitle = cleanText(activity.getActivityTitle(), cleanText(activity.getActivityLabel(), "Activity"));
        int stage = activity.getActivityIndex() != null ? activity.getActivityIndex() + 1 : 0;
        String stageLabel = stage > 0 ? "Activity " + stage : "Activity";

        Map<String, Object> values = activity.getValues() != null ? activity.getValues() : Map.of();
        String remarks = firstNonBlank(
            strObj(values.get("remark")),
            strObj(values.get("remarks")),
            strObj(values.get("note")),
            strObj(values.get("remarkWon")),
            strObj(values.get("remarkLost"))
        );
        String status = firstNonBlank(
            strObj(values.get("status")),
            strObj(values.get("connectionStatus")),
            strObj(values.get("callOutcome")),
            strObj(values.get("outcome"))
        );
        String followUp = firstNonBlank(
            strObj(values.get("nextFollowUpDate")),
            strObj(values.get("followUpDate"))
        );
        String followUpTime = firstNonBlank(
            strObj(values.get("nextFollowUpTime")),
            strObj(values.get("followUpTime"))
        );
        String assignedTo = cleanText(activity.getAssignedTo(), "");

        StringBuilder msg = new StringBuilder();
        msg.append("📋 *CRM Activity Update*\n\n");
        msg.append("👤 *Lead:* ").append(leadName);
        if (!leadPhone.isBlank()) msg.append(" (").append(leadPhone).append(")");
        msg.append("\n");
        msg.append("📌 *").append(stageLabel).append(":* ").append(activityTitle).append("\n");
        if (status != null) msg.append("📊 *Status:* ").append(status).append("\n");
        if (!assignedTo.isBlank()) msg.append("👨‍💼 *Assigned:* ").append(assignedTo).append("\n");
        if (remarks != null) msg.append("💬 *Remarks:* ").append(remarks).append("\n");
        if (followUp != null) msg.append("📅 *Next Follow-up:* ").append(formatFollowUp(followUp, followUpTime, zone)).append("\n");
        msg.append("\n⏰ ").append(ZonedDateTime.now(zone).format(ZONED_DT_FORMAT));
        return msg.toString();
    }

    private String buildReminderMessage(Lead lead, int minutesBefore, ZoneId zone) {
        String leadName = cleanText(lead.getName(), "Unnamed Lead");
        String leadPhone = cleanText(lead.getPhone(), "");
        String followUpTime = lead.getFollowUpDate().format(DT_FORMAT) + " " + shortZoneName(zone);
        String assignee = lead.getAssignedTo() != null ? cleanText(lead.getAssignedTo().getName(), "") : "";
        String service = cleanText(lead.getService(), "");

        StringBuilder msg = new StringBuilder();
        msg.append("⏰ *Follow-up Reminder*\n\n");
        msg.append("👤 *Lead:* ").append(leadName);
        if (!leadPhone.isBlank()) msg.append(" (").append(leadPhone).append(")");
        msg.append("\n");
        msg.append("📅 *Scheduled at:* ").append(followUpTime).append("\n");
        msg.append("🔔 *In:* ").append(minutesBefore).append(" minutes\n");
        if (!assignee.isBlank()) msg.append("👨‍💼 *Assigned to:* ").append(assignee).append("\n");
        if (!service.isBlank()) msg.append("🏷️ *Service:* ").append(service).append("\n");
        msg.append("\n_Please ensure timely follow-up._");
        return msg.toString();
    }

    // ── Helpers ──────────────────────────────────────────────────

    private Map<String, Object> readConfig(Long tenantId) {
        Map<String, Object> defaults = new LinkedHashMap<>();
        defaults.put("activityEnabled", false);
        defaults.put("reminderEnabled", false);
        defaults.put("reminderMinutesBefore", 15);
        defaults.put("timezone", "Asia/Kolkata");
        defaults.put("recipients", List.of());
        return appSettingRepository.findByTenantIdAndNamespaceAndKeyAndDeletedFalse(tenantId, NAMESPACE, KEY)
            .map(AppSetting::getValue)
            .map(this::parseConfig)
            .map(saved -> { Map<String, Object> merged = new LinkedHashMap<>(defaults); merged.putAll(saved); return merged; })
            .orElse(defaults);
    }

    private Map<String, Object> parseConfig(String json) {
        try { return objectMapper.readValue(json, CONFIG_TYPE); }
        catch (Exception ex) { return Map.of(); }
    }

    private Map<String, Object> publicConfig(Map<String, Object> config) {
        Map<String, Object> response = new LinkedHashMap<>(config);
        response.put("recipients", currentRecipients(config));
        return response;
    }

    private void persistConfig(Long tenantId, Map<String, Object> config) {
        AppSetting setting = appSettingRepository
            .findByTenantIdAndNamespaceAndKeyAndDeletedFalse(tenantId, NAMESPACE, KEY)
            .orElseGet(() -> AppSetting.builder().namespace(NAMESPACE).key(KEY).encrypted(false).build());
        try {
            setting.setTenantId(tenantId);
            setting.setNamespace(NAMESPACE);
            setting.setKey(KEY);
            setting.setValue(objectMapper.writeValueAsString(config));
            setting.setDescription("WhatsApp activity notification settings");
            setting.setEncrypted(false);
            setting.setDeleted(false);
            appSettingRepository.save(setting);
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to save WhatsApp notification settings.", ex);
        }
    }

    private List<String> currentRecipients(Map<String, Object> config) {
        return normalizeRecipients(config == null ? null : config.get("recipients"));
    }

    private ZoneId notificationZone(Map<String, Object> config) {
        try { return ZoneId.of(strVal(config, "timezone", "Asia/Kolkata")); }
        catch (Exception ex) { return ZoneId.of("Asia/Kolkata"); }
    }

    private String formatFollowUp(String dateValue, String timeValue, ZoneId zone) {
        String date = cleanText(dateValue, "");
        if (date.isBlank()) return "";
        String time = cleanText(timeValue, "");
        if (time.isBlank()) return date;
        return date + " " + formatTime(time) + " " + shortZoneName(zone);
    }

    private String shortZoneName(ZoneId zone) {
        return ZonedDateTime.now(zone).format(ZONE_FORMAT);
    }

    private String formatTime(String value) {
        try {
            return LocalTime.parse(value).format(FOLLOW_UP_TIME_FORMAT);
        } catch (DateTimeParseException ex) {
            return value;
        }
    }

    private List<String> normalizeRecipients(Object raw) {
        List<String> values = new ArrayList<>();
        if (raw instanceof Collection<?> collection) {
            for (Object value : collection) {
                String normalized = normalizePhone(value == null ? "" : String.valueOf(value));
                if (!normalized.isBlank()) values.add(normalized);
            }
        } else if (raw != null) {
            String normalized = normalizePhone(String.valueOf(raw));
            if (!normalized.isBlank()) values.add(normalized);
        }
        return values.stream().distinct().toList();
    }

    private String normalizePhone(String raw) {
        String digits = raw == null ? "" : raw.replaceAll("\\D", "");
        if (digits.isBlank() || digits.length() < 7 || digits.length() > 15) return "";
        return digits.length() == 10 ? "+91" + digits : "+" + digits;
    }

    private String normalizeTimezone(String raw) {
        try { return ZoneId.of(raw).getId(); }
        catch (Exception ex) { throw new IllegalArgumentException("Select a valid timezone."); }
    }

    private Set<Long> resolveTenantIds() {
        Set<Long> ids = new LinkedHashSet<>();
        try {
            ids.addAll(mongoTemplate.findDistinct(
                Query.query(Criteria.where("deleted").is(false)), "tenant_id", "settings", Long.class));
            ids.addAll(mongoTemplate.findDistinct(
                Query.query(Criteria.where("deleted").is(false)), "tenant_id", "leads", Long.class));
        } catch (Exception ex) {
            log.warn("Unable to enumerate tenants for WhatsApp activity notifications: {}", ex.getMessage());
        }
        return ids.stream().filter(Objects::nonNull).collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private boolean boolVal(Map<String, Object> map, String key, boolean fallback) {
        Object v = map == null ? null : map.get(key);
        if (v == null) return fallback;
        if (v instanceof Boolean b) return b;
        return Boolean.parseBoolean(String.valueOf(v));
    }

    private int intVal(Map<String, Object> map, String key, int fallback) {
        Object v = map == null ? null : map.get(key);
        if (v == null) return fallback;
        if (v instanceof Number n) return n.intValue();
        try { return Integer.parseInt(String.valueOf(v).trim()); }
        catch (NumberFormatException ex) { return fallback; }
    }

    private String strVal(Map<String, Object> map, String key, String fallback) {
        Object v = map == null ? null : map.get(key);
        return v == null ? fallback : String.valueOf(v).trim();
    }

    private String strObj(Object v) {
        return v == null ? null : String.valueOf(v).trim();
    }

    private String cleanText(String value, String fallback) {
        String normalized = value == null ? "" : value.replaceAll("[\\r\\n]+", " ").trim();
        return normalized.isBlank() ? fallback : normalized;
    }

    private String firstNonBlank(String... values) {
        if (values == null) return null;
        for (String v : values) {
            if (v != null && !v.isBlank()) return v.trim();
        }
        return null;
    }

    private String maskPhone(String phone) {
        String digits = phone == null ? "" : phone.replaceAll("\\D", "");
        return digits.length() <= 4 ? "****" : "****" + digits.substring(digits.length() - 4);
    }
}
