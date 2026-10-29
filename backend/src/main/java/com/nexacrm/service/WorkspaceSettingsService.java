package com.nexacrm.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexacrm.model.AppSetting;
import com.nexacrm.model.Tenant;
import com.nexacrm.repository.AppSettingRepository;
import com.nexacrm.repository.TenantRepository;
import com.nexacrm.security.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Transactional
public class WorkspaceSettingsService {

    private static final String NAMESPACE = "workspace";
    private static final String GENERAL_KEY = "generalSettings";
    private static final String NOTIFICATION_KEY = "notificationPrefs";
    private static final String SECURITY_KEY = "security";
    private static final String INTEGRATION_KEY = "integrations";
    private static final String THEME_KEY = "theme";

    private final AppSettingRepository appSettingRepository;
    private final TenantRepository tenantRepository;
    private final ObjectMapper objectMapper;

    private Long tenantId() {
        return TenantContext.currentTenantId();
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getWorkspaceSettings() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("generalSettings", readSetting(
            GENERAL_KEY,
            new TypeReference<List<Map<String, Object>>>() {},
            defaultGeneralSettings()
        ));
        response.put("notificationPrefs", readSetting(
            NOTIFICATION_KEY,
            new TypeReference<List<Map<String, Object>>>() {},
            defaultNotificationPrefs()
        ));
        response.put("security", readSetting(
            SECURITY_KEY,
            new TypeReference<Map<String, Object>>() {},
            defaultSecuritySettings()
        ));
        response.put("integrations", readSetting(
            INTEGRATION_KEY,
            new TypeReference<List<Map<String, Object>>>() {},
            defaultIntegrations()
        ));
        response.put("theme", readString(THEME_KEY, "corporate"));
        response.put("billing", billingSnapshot());
        response.put("updatedAt", latestUpdatedAt());
        return response;
    }

    public Map<String, Object> saveWorkspaceSettings(Map<String, Object> payload) {
        if (payload == null) {
            return getWorkspaceSettings();
        }

        if (payload.containsKey("generalSettings")) {
            upsertJsonSetting(GENERAL_KEY, payload.get("generalSettings"), "Workspace general preferences");
        }
        if (payload.containsKey("notificationPrefs")) {
            upsertJsonSetting(NOTIFICATION_KEY, payload.get("notificationPrefs"), "Notification preferences");
        }
        if (payload.containsKey("security")) {
            upsertJsonSetting(SECURITY_KEY, payload.get("security"), "Security preferences");
        }
        if (payload.containsKey("integrations")) {
            upsertJsonSetting(INTEGRATION_KEY, payload.get("integrations"), "Integration status snapshot");
        }
        if (payload.containsKey("theme")) {
            upsertStringSetting(THEME_KEY, payload.get("theme"), "Selected UI theme");
        }

        return getWorkspaceSettings();
    }

    @Transactional(readOnly = true)
    public Map<String, Object> billingSnapshot() {
        Long currentTenantId = tenantId();
        Tenant tenant = tenantRepository.findAll().stream()
            .filter(row -> currentTenantId.equals(row.getTenantId()))
            .filter(row -> !Boolean.TRUE.equals(row.getDeleted()))
            .findFirst()
            .orElse(null);

        Map<String, Object> billing = new LinkedHashMap<>();
        billing.put("plan", tenant != null && tenant.getPlan() != null ? tenant.getPlan() : "TRIAL");
        billing.put("billingStatus", tenant != null && tenant.getBillingStatus() != null ? tenant.getBillingStatus() : "TRIAL");
        billing.put("maxUsers", tenant != null && tenant.getMaxUsers() != null ? tenant.getMaxUsers() : 5);
        billing.put("trialEndsAt", tenant != null ? tenant.getTrialEndsAt() : null);
        billing.put("subscriptionStartedAt", tenant != null ? tenant.getSubscriptionStartedAt() : null);
        billing.put("subscriptionEndsAt", tenant != null ? tenant.getSubscriptionEndsAt() : null);
        billing.put("isActive", tenant == null || tenant.getIsActive() == null || tenant.getIsActive());
        return billing;
    }

    private <T> T readSetting(String key, TypeReference<T> typeRef, T fallback) {
        return appSettingRepository
            .findByTenantIdAndNamespaceAndKeyAndDeletedFalse(tenantId(), NAMESPACE, key)
            .map(setting -> parseJson(setting.getValue(), typeRef, fallback))
            .orElse(fallback);
    }

    private String readString(String key, String fallback) {
        return appSettingRepository
            .findByTenantIdAndNamespaceAndKeyAndDeletedFalse(tenantId(), NAMESPACE, key)
            .map(AppSetting::getValue)
            .filter(value -> value != null && !value.isBlank())
            .orElse(fallback);
    }

    private void upsertJsonSetting(String key, Object value, String description) {
        upsertSetting(key, serialize(value), description);
    }

    private void upsertStringSetting(String key, Object value, String description) {
        String text = value == null ? "" : String.valueOf(value).trim();
        if (text.isBlank()) {
            return;
        }
        upsertSetting(key, text, description);
    }

    private void upsertSetting(String key, String value, String description) {
        AppSetting setting = appSettingRepository
            .findByTenantIdAndNamespaceAndKeyAndDeletedFalse(tenantId(), NAMESPACE, key)
            .orElseGet(() -> AppSetting.builder()
                .namespace(NAMESPACE)
                .key(key)
                .encrypted(false)
                .build());
        setting.setTenantId(tenantId());
        setting.setNamespace(NAMESPACE);
        setting.setKey(key);
        setting.setValue(value);
        setting.setEncrypted(false);
        setting.setDescription(description);
        setting.setDeleted(false);
        appSettingRepository.save(setting);
    }

    private <T> T parseJson(String json, TypeReference<T> typeRef, T fallback) {
        if (json == null || json.isBlank()) {
            return fallback;
        }
        try {
            return objectMapper.readValue(json, typeRef);
        } catch (Exception ex) {
            return fallback;
        }
    }

    private String serialize(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to serialize settings payload", ex);
        }
    }

    private LocalDateTime latestUpdatedAt() {
        return appSettingRepository.findByTenantIdAndNamespaceAndDeletedFalse(tenantId(), NAMESPACE).stream()
            .map(AppSetting::getUpdatedAt)
            .filter(value -> value != null)
            .max(LocalDateTime::compareTo)
            .orElse(null);
    }

    private List<Map<String, Object>> defaultGeneralSettings() {
        List<Map<String, Object>> defaults = new ArrayList<>();
        defaults.add(setting("companyName", "Company Name", "Internite CRM Workspace"));
        defaults.add(setting("timezone", "Timezone", "Asia/Kolkata (IST)"));
        defaults.add(setting("currency", "Currency", "INR (₹)"));
        defaults.add(setting("language", "Language", "English"));
        defaults.add(setting("dateFormat", "Date Format", "DD/MM/YYYY"));
        defaults.add(setting("fiscalYear", "Fiscal Year", "April - March"));
        return defaults;
    }

    private List<Map<String, Object>> defaultNotificationPrefs() {
        List<Map<String, Object>> defaults = new ArrayList<>();
        defaults.add(notification("New Lead", List.of("Email", "In-App", "WhatsApp")));
        defaults.add(notification("Deal Update", List.of("Email", "In-App")));
        defaults.add(notification("Follow-up Reminder", List.of("Email", "In-App", "Push")));
        defaults.add(notification("Invoice Overdue", List.of("Email", "WhatsApp")));
        defaults.add(notification("AI Insights", List.of("In-App")));
        return defaults;
    }

    private Map<String, Object> defaultSecuritySettings() {
        Map<String, Object> defaults = new LinkedHashMap<>();
        defaults.put("twoFAEnabled", false);
        defaults.put("sessionTimeoutEnabled", true);
        defaults.put("sessionTimeoutMinutes", 30);
        defaults.put("ipWhitelistEnabled", false);
        return defaults;
    }

    private List<Map<String, Object>> defaultIntegrations() {
        List<Map<String, Object>> defaults = new ArrayList<>();
        defaults.add(integration("Facebook / Instagram", "connected", "📘"));
        defaults.add(integration("LinkedIn", "connected", "💼"));
        defaults.add(integration("WhatsApp Business", "connected", "💬"));
        defaults.add(integration("Gmail / Google", "connected", "📧"));
        defaults.add(integration("Google Calendar", "pending", "📅"));
        defaults.add(integration("Mistral AI", "connected", "🤖"));
        defaults.add(integration("AWS S3", "connected", "☁️"));
        defaults.add(integration("Tally XML", "pending", "📊"));
        return defaults;
    }

    private Map<String, Object> setting(String key, String label, String value) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("key", key);
        row.put("label", label);
        row.put("value", value);
        return row;
    }

    private Map<String, Object> notification(String label, List<String> channels) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("label", label);
        row.put("channels", channels);
        return row;
    }

    private Map<String, Object> integration(String name, String status, String icon) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("name", name);
        row.put("status", status);
        row.put("icon", icon);
        return row;
    }
}
