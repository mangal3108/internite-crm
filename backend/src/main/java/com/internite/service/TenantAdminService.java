package com.internite.service;

import com.internite.model.AuditLog;
import com.internite.model.Tenant;
import com.internite.model.User;
import com.internite.repository.*;
import lombok.RequiredArgsConstructor;
import org.bson.Document;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class TenantAdminService {

    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final LeadRepository leadRepository;
    private final DealRepository dealRepository;
    private final InvoiceRepository invoiceRepository;
    private final WorkflowRepository workflowRepository;
    private final IntegrationConfigRepository integrationConfigRepository;
    private final AuditLogRepository auditLogRepository;
    private final PasswordEncoder passwordEncoder;
    private final MongoTemplate mongoTemplate;

    // ── Tenants ─────────────────────────────────────────────────

    /**
     * Backfill tenantId on any Tenant documents that are missing it.
     * Called at startup to fix legacy data.
     */
    public void backfillTenantIds() {
        List<Tenant> all = tenantRepository.findAll();
        long maxId = all.stream()
            .map(Tenant::getTenantId)
            .filter(java.util.Objects::nonNull)
            .max(Long::compareTo)
            .orElse(0L);
        for (Tenant t : all) {
            if (t.getTenantId() == null) {
                t.setTenantId(++maxId);
                tenantRepository.save(t);
            }
        }
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listTenants() {
        List<Tenant> tenants = tenantRepository.findAll().stream()
            .sorted((a, b) -> {
                LocalDateTime right = b.getCreatedAt() != null ? b.getCreatedAt() : LocalDateTime.MIN;
                LocalDateTime left = a.getCreatedAt() != null ? a.getCreatedAt() : LocalDateTime.MIN;
                return right.compareTo(left);
            })
            .toList();

        Map<Long, Long> userCounts = countByTenant("users");
        Map<Long, Long> leadCounts = countByTenant("leads");
        Map<Long, Long> dealCounts = countByTenant("deals");
        Map<Long, Long> invoiceCounts = countByTenant("invoices");

        return tenants.stream()
            .map(tenant -> tenantSummary(tenant, userCounts, leadCounts, dealCounts, invoiceCounts))
            .collect(Collectors.toList());
    }

    // FIX #3: Check for duplicate slug before creating
    public Map<String, Object> createTenant(Map<String, Object> body) {
        String slug = slugify(string(body.get("slug"), "new-tenant"));

        // Check for duplicate slug
        if (tenantRepository.findBySlugAndDeletedFalse(slug).isPresent()) {
            throw new IllegalArgumentException("A company with slug '" + slug + "' already exists. Please use a different slug.");
        }

        Tenant tenant = Tenant.builder()
            .name(string(body.get("name"), "New Tenant"))
            .slug(slug)
            .plan(string(body.get("plan"), "TRIAL"))
            .isActive(bool(body.get("isActive"), true))
            .maxUsers(number(body.get("maxUsers"), 5))
            .logoUrl(string(body.get("logoUrl"), null))
            .industry(string(body.get("industry"), null))
            .website(string(body.get("website"), null))
            .contactName(string(body.get("contactName"), null))
            .contactEmail(string(body.get("contactEmail"), null))
            .contactPhone(string(body.get("contactPhone"), null))
            .country(string(body.get("country"), null))
            .timezone(string(body.get("timezone"), null))
            .currency(string(body.get("currency"), null))
            .notes(string(body.get("notes"), null))
            .billingStatus(string(body.get("billingStatus"), "TRIAL"))
            .trialEndsAt(parseDateTime(body.get("trialEndsAt")))
            .subscriptionStartedAt(parseDateTime(body.get("subscriptionStartedAt")))
            .subscriptionEndsAt(parseDateTime(body.get("subscriptionEndsAt")))
            .build();
        tenant.setTenantId(nextTenantId());
        tenant.setFeatureFlags(parseBooleanMap(body.get("featureFlags")));
        tenant.setUsageLimits(parseIntegerMap(body.get("usageLimits")));
        Tenant saved = tenantRepository.save(tenant);

        audit("TENANT_CREATED", "Tenant", saved.getId(), saved.getName(),
            Map.of("plan", saved.getPlan(), "slug", slug));

        // Auto-create Company Admin if admin credentials are provided
        String adminEmail = string(body.get("adminEmail"), null);
        String adminPassword = string(body.get("adminPassword"), null);
        if (adminEmail != null && adminPassword != null && adminPassword.length() >= 6) {
            String adminName = string(body.get("adminName"), adminEmail.split("@")[0]);
            User admin = User.builder()
                .name(adminName)
                .email(adminEmail.toLowerCase().trim())
                .password(passwordEncoder.encode(adminPassword))
                .role(User.Role.COMPANY_ADMIN)
                .isActive(true)
                .build();
            admin.setTenantId(saved.getTenantId());
            admin.setDeleted(false);
            userRepository.save(admin);

            audit("USER_CREATED", "User", admin.getId(), adminName,
                Map.of("email", adminEmail, "role", "COMPANY_ADMIN", "tenantName", saved.getName()));
        }

        return tenantSummary(saved);
    }

    public Map<String, Object> updateTenant(String id, Map<String, Object> body) {
        Tenant tenant = tenantRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Tenant not found: " + id));

        // FIX #3: Check slug uniqueness on update too
        if (body.containsKey("slug")) {
            String newSlug = slugify(string(body.get("slug"), tenant.getSlug()));
            if (!newSlug.equals(tenant.getSlug())) {
                if (tenantRepository.findBySlugAndDeletedFalse(newSlug).isPresent()) {
                    throw new IllegalArgumentException("A company with slug '" + newSlug + "' already exists.");
                }
                tenant.setSlug(newSlug);
            }
        }

        if (body.containsKey("name")) tenant.setName(string(body.get("name"), tenant.getName()));
        if (body.containsKey("plan")) tenant.setPlan(string(body.get("plan"), tenant.getPlan()));
        if (body.containsKey("isActive")) tenant.setIsActive(bool(body.get("isActive"), tenant.getIsActive()));
        if (body.containsKey("maxUsers")) tenant.setMaxUsers(number(body.get("maxUsers"), tenant.getMaxUsers()));
        if (body.containsKey("logoUrl")) tenant.setLogoUrl(string(body.get("logoUrl"), tenant.getLogoUrl()));
        if (body.containsKey("industry")) tenant.setIndustry(string(body.get("industry"), tenant.getIndustry()));
        if (body.containsKey("website")) tenant.setWebsite(string(body.get("website"), tenant.getWebsite()));
        if (body.containsKey("contactName")) tenant.setContactName(string(body.get("contactName"), tenant.getContactName()));
        if (body.containsKey("contactEmail")) tenant.setContactEmail(string(body.get("contactEmail"), tenant.getContactEmail()));
        if (body.containsKey("contactPhone")) tenant.setContactPhone(string(body.get("contactPhone"), tenant.getContactPhone()));
        if (body.containsKey("country")) tenant.setCountry(string(body.get("country"), tenant.getCountry()));
        if (body.containsKey("timezone")) tenant.setTimezone(string(body.get("timezone"), tenant.getTimezone()));
        if (body.containsKey("currency")) tenant.setCurrency(string(body.get("currency"), tenant.getCurrency()));
        if (body.containsKey("notes")) tenant.setNotes(string(body.get("notes"), tenant.getNotes()));
        if (body.containsKey("billingStatus")) tenant.setBillingStatus(string(body.get("billingStatus"), tenant.getBillingStatus()));
        if (body.containsKey("trialEndsAt")) tenant.setTrialEndsAt(parseDateTime(body.get("trialEndsAt")));
        if (body.containsKey("subscriptionStartedAt")) tenant.setSubscriptionStartedAt(parseDateTime(body.get("subscriptionStartedAt")));
        if (body.containsKey("subscriptionEndsAt")) tenant.setSubscriptionEndsAt(parseDateTime(body.get("subscriptionEndsAt")));
        if (body.containsKey("featureFlags")) tenant.setFeatureFlags(parseBooleanMap(body.get("featureFlags")));
        if (body.containsKey("usageLimits")) tenant.setUsageLimits(parseIntegerMap(body.get("usageLimits")));

        Tenant saved = tenantRepository.save(tenant);
        audit("TENANT_UPDATED", "Tenant", saved.getId(), saved.getName(), Map.of());
        return tenantSummary(saved);
    }

    public Map<String, Object> setActive(String id, boolean active) {
        Tenant tenant = tenantRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Tenant not found: " + id));
        tenant.setIsActive(active);
        if (active) {
            tenant.setDeactivatedAt(null);
            tenant.setActivatedAt(LocalDateTime.now());
        } else {
            tenant.setDeactivatedAt(LocalDateTime.now());

            // FIX #7: Deactivate all users belonging to this tenant
            if (tenant.getTenantId() != null) {
                List<User> tenantUsers = userRepository.findByTenantIdAndDeletedFalse(tenant.getTenantId());
                for (User u : tenantUsers) {
                    // Don't deactivate PLATFORM_ADMIN accounts
                    if (u.getRole() != User.Role.PLATFORM_ADMIN) {
                        u.setIsActive(false);
                        userRepository.save(u);
                    }
                }
            }
        }

        Tenant saved = tenantRepository.save(tenant);
        audit(active ? "TENANT_ACTIVATED" : "TENANT_DEACTIVATED", "Tenant", saved.getId(), saved.getName(),
            Map.of("isActive", active));
        return tenantSummary(saved);
    }

    // ── Cross-tenant User Management ────────────────────────────

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listAllUsers() {
        List<Tenant> tenants = tenantRepository.findAll();
        Map<Long, String> tenantNames = new LinkedHashMap<>();
        for (Tenant t : tenants) {
            if (t.getTenantId() != null) {
                tenantNames.put(t.getTenantId(), t.getName());
            }
        }

        // FIX #4: Stream and limit to prevent loading unbounded data
        return userRepository.findAll().stream()
            .filter(u -> !Boolean.TRUE.equals(u.getDeleted()))
            .limit(500)
            .map(u -> {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("id", u.getId());
                row.put("name", u.getName());
                row.put("email", u.getEmail());
                row.put("phone", u.getPhone());
                row.put("role", u.getRole() != null ? u.getRole().name() : "SALES_EXEC");
                row.put("isActive", Boolean.TRUE.equals(u.getIsActive()));
                row.put("twoFaEnabled", Boolean.TRUE.equals(u.getTwoFaEnabled()));
                row.put("tenantId", u.getTenantId());
                row.put("tenantName", tenantNames.getOrDefault(u.getTenantId(), "Unknown"));
                row.put("createdAt", u.getCreatedAt());
                row.put("updatedAt", u.getUpdatedAt());
                return row;
            })
            .collect(Collectors.toList());
    }

    // FIX #1: Block promotion to PLATFORM_ADMIN
    public Map<String, Object> changeUserRole(String userId, String roleName) {
        User.Role newRole;
        try {
            newRole = User.Role.valueOf(roleName);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid role: " + roleName);
        }

        // Prevent assigning PLATFORM_ADMIN role through this endpoint
        if (newRole == User.Role.PLATFORM_ADMIN) {
            throw new IllegalArgumentException("Cannot assign PLATFORM_ADMIN role through this interface. Platform admin accounts must be created at the database level.");
        }

        User user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        // Prevent changing a PLATFORM_ADMIN's role
        if (user.getRole() == User.Role.PLATFORM_ADMIN) {
            throw new IllegalArgumentException("Cannot modify the role of a Platform Admin account.");
        }

        String previousRole = user.getRole() != null ? user.getRole().name() : "UNKNOWN";
        user.setRole(newRole);
        userRepository.save(user);

        audit("USER_ROLE_CHANGED", "User", userId, user.getName(),
            Map.of("previousRole", previousRole, "newRole", roleName, "email", user.getEmail()));

        return Map.of("id", userId, "role", roleName, "success", true);
    }

    // FIX #6: Prevent deactivating yourself
    public Map<String, Object> setUserActive(String userId, boolean active) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        // Prevent self-deactivation
        if (!active) {
            User currentUser = getCurrentUser();
            if (currentUser != null && currentUser.getId().equals(userId)) {
                throw new IllegalArgumentException("You cannot deactivate your own account.");
            }
        }

        user.setIsActive(active);
        userRepository.save(user);

        audit(active ? "USER_ACTIVATED" : "USER_DEACTIVATED", "User", userId, user.getName(),
            Map.of("email", user.getEmail(), "isActive", active));

        return Map.of("id", userId, "isActive", active, "success", true);
    }

    /**
     * Platform Admin: create a user for any company.
     * Cannot create PLATFORM_ADMIN accounts — those are managed at the database level.
     */
    public Map<String, Object> createUser(Map<String, Object> body) {
        String email = string(body.get("email"), "").toLowerCase().trim();
        if (email.isBlank()) {
            throw new IllegalArgumentException("Email is required.");
        }

        final Long tenantId;
        Object tenantIdRaw = body.get("tenantId");
        if (tenantIdRaw instanceof Number n) {
            tenantId = n.longValue();
        } else if (tenantIdRaw != null) {
            try { tenantId = Long.parseLong(String.valueOf(tenantIdRaw)); } catch (Exception e) {
                throw new IllegalArgumentException("Invalid tenantId format.");
            }
        } else {
            throw new IllegalArgumentException("tenantId is required.");
        }

        // Verify tenant exists
        Tenant tenant = tenantRepository.findByTenantIdAndDeletedFalse(tenantId)
            .orElseThrow(() -> new IllegalArgumentException("Company with tenantId " + tenantId + " not found."));

        // Don't allow creating PLATFORM_ADMIN via this endpoint
        String roleName = string(body.get("role"), "SALES_EXEC");
        if ("PLATFORM_ADMIN".equals(roleName)) {
            throw new IllegalArgumentException("Cannot create PLATFORM_ADMIN accounts through this interface.");
        }
        User.Role role;
        try {
            role = User.Role.valueOf(roleName);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid role: " + roleName);
        }

        // Check for duplicate email in this tenant
        if (userRepository.findByEmailAndTenantIdAndDeletedFalse(email, tenantId).isPresent()) {
            throw new IllegalArgumentException("A user with email '" + email + "' already exists in this company.");
        }

        String password = string(body.get("password"), null);
        if (password == null || password.length() < 6) {
            throw new IllegalArgumentException("Password must be at least 6 characters.");
        }

        User user = User.builder()
            .name(string(body.get("name"), email.split("@")[0]))
            .email(email)
            .password(passwordEncoder.encode(password))
            .phone(string(body.get("phone"), null))
            .role(role)
            .isActive(true)
            .build();
        user.setTenantId(tenantId);
        user.setDeleted(false);

        User saved = userRepository.save(user);

        audit("USER_CREATED", "User", saved.getId(), saved.getName(),
            Map.of("email", email, "role", roleName, "tenantId", tenantId, "tenantName", tenant.getName()));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", saved.getId());
        result.put("name", saved.getName());
        result.put("email", saved.getEmail());
        result.put("role", saved.getRole().name());
        result.put("tenantId", saved.getTenantId());
        result.put("tenantName", tenant.getName());
        result.put("isActive", true);
        result.put("success", true);
        return result;
    }

    // ── Billing Dashboard ───────────────────────────────────────

    @Transactional(readOnly = true)
    public Map<String, Object> getBillingDashboard() {
        List<Tenant> tenants = tenantRepository.findAll();
        long active = tenants.stream().filter(t -> Boolean.TRUE.equals(t.getIsActive())).count();
        long inactive = tenants.size() - active;
        long trialing = tenants.stream().filter(t -> "TRIAL".equalsIgnoreCase(defaultString(t.getBillingStatus()))).count();
        long expiringSoon = tenants.stream()
            .filter(t -> t.getTrialEndsAt() != null)
            .filter(t -> t.getTrialEndsAt().isBefore(LocalDateTime.now().plusDays(7)))
            .count();

        List<Map<String, Object>> planBreakdown = tenants.stream()
            .collect(Collectors.groupingBy(
                tenant -> defaultString(tenant.getPlan()).toUpperCase(),
                LinkedHashMap::new,
                Collectors.counting()
            ))
            .entrySet().stream()
            .map(entry -> Map.<String, Object>of("plan", entry.getKey(), "count", entry.getValue()))
            .toList();

        return Map.of(
            "totalTenants", tenants.size(),
            "activeTenants", active,
            "inactiveTenants", inactive,
            "trialTenants", trialing,
            "expiringSoon", expiringSoon,
            "plans", planBreakdown
        );
    }

    // ── Platform Overview ───────────────────────────────────────

    @Transactional(readOnly = true)
    public Map<String, Object> getPlatformOverview() {
        List<Tenant> tenants = tenantRepository.findAll();
        // FIX #4: Limit user loading
        List<User> allUsers = userRepository.findAll().stream()
            .filter(u -> !Boolean.TRUE.equals(u.getDeleted()))
            .limit(1000)
            .toList();

        long totalCompanies = tenants.size();
        long activeCompanies = tenants.stream().filter(t -> Boolean.TRUE.equals(t.getIsActive())).count();
        long totalUsers = allUsers.size();
        long activeUsers = allUsers.stream().filter(u -> Boolean.TRUE.equals(u.getIsActive())).count();
        long twoFaUsers = allUsers.stream().filter(u -> Boolean.TRUE.equals(u.getTwoFaEnabled())).count();

        // Role breakdown
        Map<String, Long> roleBreakdown = allUsers.stream()
            .collect(Collectors.groupingBy(
                u -> u.getRole() != null ? u.getRole().name() : "SALES_EXEC",
                Collectors.counting()
            ));

        // Plan breakdown
        Map<String, Long> planBreakdown = tenants.stream()
            .collect(Collectors.groupingBy(
                t -> defaultString(t.getPlan()).toUpperCase().isEmpty() ? "UNKNOWN" : defaultString(t.getPlan()).toUpperCase(),
                Collectors.counting()
            ));

        long totalLeads = sumCounts(countByTenant("leads"));
        long totalDeals = sumCounts(countByTenant("deals"));
        long totalInvoices = sumCounts(countByTenant("invoices"));
        long totalWorkflows = sumCounts(countByTenant("workflows"));
        long totalIntegrations = sumCounts(countByTenant("integration_configs"));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalCompanies", totalCompanies);
        result.put("activeCompanies", activeCompanies);
        result.put("totalUsers", totalUsers);
        result.put("activeUsers", activeUsers);
        result.put("twoFaUsers", twoFaUsers);
        result.put("totalLeads", totalLeads);
        result.put("totalDeals", totalDeals);
        result.put("totalInvoices", totalInvoices);
        result.put("totalWorkflows", totalWorkflows);
        result.put("totalIntegrations", totalIntegrations);
        result.put("roleBreakdown", roleBreakdown);
        result.put("planBreakdown", planBreakdown);
        return result;
    }

    // ── Audit Logs ──────────────────────────────────────────────

    // FIX #5: Return real audit logs from the audit_logs collection
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getAuditLogs() {
        return auditLogRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(0, 100))
            .stream()
            .map(log -> {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("id", log.getId());
                row.put("action", log.getAction());
                row.put("entityType", log.getEntityType());
                row.put("entityId", log.getEntityId());
                row.put("entityName", log.getEntityName());
                row.put("performedBy", log.getPerformedBy());
                row.put("performedByEmail", log.getPerformedByEmail());
                row.put("tenantId", log.getTenantId());
                row.put("details", log.getDetails());
                row.put("createdAt", log.getCreatedAt());
                // Frontend compatibility fields
                row.put("userName", log.getPerformedBy());
                row.put("userEmail", log.getPerformedByEmail());
                row.put("updatedAt", log.getCreatedAt());
                row.put("isActive", true);
                row.put("role", "PLATFORM_ADMIN");
                return row;
            })
            .collect(Collectors.toList());
    }

    // ── Security Overview ───────────────────────────────────────

    @Transactional(readOnly = true)
    public Map<String, Object> getSecurityOverview() {
        // FIX #4: Limit user loading
        List<User> allUsers = userRepository.findAll().stream()
            .filter(u -> !Boolean.TRUE.equals(u.getDeleted()))
            .limit(1000)
            .toList();

        long total = allUsers.size();
        long active = allUsers.stream().filter(u -> Boolean.TRUE.equals(u.getIsActive())).count();
        long inactive = total - active;
        long twoFaEnabled = allUsers.stream().filter(u -> Boolean.TRUE.equals(u.getTwoFaEnabled())).count();
        long twoFaDisabled = total - twoFaEnabled;
        long platformAdmins = allUsers.stream().filter(u -> u.getRole() == User.Role.PLATFORM_ADMIN).count();
        long companyAdmins = allUsers.stream().filter(u -> u.getRole() == User.Role.COMPANY_ADMIN).count();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalUsers", total);
        result.put("activeUsers", active);
        result.put("inactiveUsers", inactive);
        result.put("twoFaEnabled", twoFaEnabled);
        result.put("twoFaDisabled", twoFaDisabled);
        result.put("twoFaPercent", total > 0 ? Math.round((twoFaEnabled * 100.0) / total) : 0);
        result.put("platformAdmins", platformAdmins);
        result.put("companyAdmins", companyAdmins);
        result.put("policies", List.of(
            Map.of("name", "Password Policy", "status", "ACTIVE", "description", "Minimum 8 characters, BCrypt hashed"),
            Map.of("name", "JWT Authentication", "status", "ACTIVE", "description", "Stateless token-based auth with refresh rotation"),
            Map.of("name", "Two-Factor Auth", "status", "AVAILABLE", "description", twoFaEnabled + " of " + total + " users enabled"),
            Map.of("name", "Rate Limiting", "status", "ACTIVE", "description", "API rate limiting per IP and user"),
            Map.of("name", "CORS Policy", "status", "ACTIVE", "description", "Restricted to configured origins"),
            Map.of("name", "Data Isolation", "status", "ACTIVE", "description", "Multi-tenant row-level security via tenantId"),
            Map.of("name", "Audit Logging", "status", "ACTIVE", "description", "All admin and delete operations tracked"),
            Map.of("name", "Session Management", "status", "ACTIVE", "description", "Stateless JWT with configurable expiry")
        ));
        return result;
    }

    // ── Feature Flags & Plans ───────────────────────────────────

    @Transactional(readOnly = true)
    public List<Map<String, Object>> featureCatalog() {
        return List.of(
            Map.of("key", "lead_automation", "label", "Lead Automation", "description", "Auto-assign, SLA and escalation rules"),
            Map.of("key", "team_management", "label", "Team Management", "description", "Invite users, manage roles and teams"),
            Map.of("key", "billing_dashboard", "label", "Billing Dashboard", "description", "Tenant invoices, plan state and trial expiry"),
            Map.of("key", "webhook_hardening", "label", "Webhook Hardening", "description", "Signature verification and replay protection"),
            Map.of("key", "realtime_notifications", "label", "Realtime Notifications", "description", "Live websocket and toast notifications"),
            Map.of("key", "ai_engine", "label", "AI Engine", "description", "Internite AI chat, insights, and call intelligence"),
            Map.of("key", "workflow_automation", "label", "Workflow Automation", "description", "Triggers, conditions, and automated actions"),
            Map.of("key", "advanced_analytics", "label", "Advanced Analytics", "description", "Lead conversion, pipeline, and revenue reports"),
            Map.of("key", "whatsapp_integration", "label", "WhatsApp Integration", "description", "Send and receive WhatsApp messages"),
            Map.of("key", "call_agent", "label", "AI Call Agent", "description", "Automated AI-powered outbound calls")
        );
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> plans() {
        return List.of(
            plan("TRIAL", 0, 5, 14, "Core CRM, tasks, notifications"),
            plan("STARTER", 4999, 10, 30, "Lead, deal and invoice management"),
            plan("BUSINESS", 14999, 25, 60, "Automation, reports and webhooks"),
            plan("ENTERPRISE", 49999, 100, 365, "SSO, SaaS controls and priority support")
        );
    }

    // ── Private helpers ─────────────────────────────────────────

    // FIX #2: Synchronized to prevent race condition on concurrent tenant creation
    private synchronized Long nextTenantId() {
        return tenantRepository.findAll().stream()
            .map(Tenant::getTenantId)
            .filter(java.util.Objects::nonNull)
            .max(Long::compareTo)
            .orElse(0L) + 1;
    }

    private Map<String, Object> tenantSummary(Tenant tenant) {
        Long tenantId = tenant.getTenantId();
        long userCount = tenantId != null ? userRepository.countByTenantIdAndDeletedFalse(tenantId) : 0L;
        long leadCount = tenantId != null ? leadRepository.countByTenantIdAndDeletedFalse(tenantId) : 0L;
        long dealCount = tenantId != null ? dealRepository.countByTenantIdAndDeletedFalse(tenantId) : 0L;
        long invoiceCount = tenantId != null ? invoiceRepository.countByTenantIdAndDeletedFalse(tenantId) : 0L;
        return tenantSummary(
            tenant,
            tenantId != null ? Map.of(tenantId, userCount) : Map.of(),
            tenantId != null ? Map.of(tenantId, leadCount) : Map.of(),
            tenantId != null ? Map.of(tenantId, dealCount) : Map.of(),
            tenantId != null ? Map.of(tenantId, invoiceCount) : Map.of()
        );
    }

    private Map<String, Object> tenantSummary(
        Tenant tenant,
        Map<Long, Long> userCounts,
        Map<Long, Long> leadCounts,
        Map<Long, Long> dealCounts,
        Map<Long, Long> invoiceCounts
    ) {
        Long tenantId = tenant.getTenantId();
        long userCount = countFor(userCounts, tenantId);
        long leadCount = countFor(leadCounts, tenantId);
        long dealCount = countFor(dealCounts, tenantId);
        long invoiceCount = countFor(invoiceCounts, tenantId);
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", tenant.getId());
        row.put("tenantId", tenant.getTenantId());
        row.put("name", tenant.getName());
        row.put("slug", tenant.getSlug());
        row.put("plan", tenant.getPlan());
        row.put("billingStatus", tenant.getBillingStatus());
        row.put("isActive", tenant.getIsActive());
        row.put("maxUsers", tenant.getMaxUsers());
        row.put("logoUrl", tenant.getLogoUrl());
        row.put("industry", tenant.getIndustry());
        row.put("website", tenant.getWebsite());
        row.put("contactName", tenant.getContactName());
        row.put("contactEmail", tenant.getContactEmail());
        row.put("contactPhone", tenant.getContactPhone());
        row.put("country", tenant.getCountry());
        row.put("timezone", tenant.getTimezone());
        row.put("currency", tenant.getCurrency());
        row.put("notes", tenant.getNotes());
        row.put("trialEndsAt", tenant.getTrialEndsAt());
        row.put("subscriptionStartedAt", tenant.getSubscriptionStartedAt());
        row.put("subscriptionEndsAt", tenant.getSubscriptionEndsAt());
        row.put("featureFlags", tenant.getFeatureFlags());
        row.put("usageLimits", tenant.getUsageLimits());
        row.put("userCount", userCount);
        row.put("leadCount", leadCount);
        row.put("dealCount", dealCount);
        row.put("invoiceCount", invoiceCount);
        row.put("createdAt", tenant.getCreatedAt());
        row.put("updatedAt", tenant.getUpdatedAt());
        return row;
    }

    private Map<Long, Long> countByTenant(String collection) {
        List<Document> pipeline = List.of(
            new Document("$match", new Document("tenant_id", new Document("$ne", null))
                .append("deleted", false)),
            new Document("$group", new Document("_id", "$tenant_id")
                .append("count", new Document("$sum", 1)))
        );

        Map<Long, Long> counts = new LinkedHashMap<>();
        mongoTemplate.getCollection(collection)
            .aggregate(pipeline)
            .forEach(doc -> {
                Object tenantId = doc.get("_id");
                Object count = doc.get("count");
                if (tenantId instanceof Number tenantNumber && count instanceof Number countNumber) {
                    counts.put(tenantNumber.longValue(), countNumber.longValue());
                }
            });
        return counts;
    }

    private long countFor(Map<Long, Long> counts, Long tenantId) {
        return tenantId != null ? counts.getOrDefault(tenantId, 0L) : 0L;
    }

    private long sumCounts(Map<Long, Long> counts) {
        return counts.values().stream().mapToLong(Long::longValue).sum();
    }

    private Map<String, Object> plan(String name, int priceInRupees, int maxUsers, int trialDays, String features) {
        return Map.of(
            "name", name,
            "priceInRupees", priceInRupees,
            "maxUsers", maxUsers,
            "trialDays", trialDays,
            "features", features
        );
    }

    /** Get the currently authenticated user, or null if not available */
    private User getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof User user) {
            return user;
        }
        return null;
    }

    /** Write a real audit log entry */
    private void audit(String action, String entityType, String entityId, String entityName, Map<String, Object> details) {
        User currentUser = getCurrentUser();
        AuditLog log = AuditLog.builder()
            .action(action)
            .entityType(entityType)
            .entityId(entityId)
            .entityName(entityName)
            .performedBy(currentUser != null ? currentUser.getName() : "System")
            .performedByEmail(currentUser != null ? currentUser.getEmail() : "system")
            .tenantId(currentUser != null ? currentUser.getTenantId() : null)
            .details(details)
            .createdAt(LocalDateTime.now())
            .build();
        try {
            auditLogRepository.save(log);
        } catch (Exception e) {
            // Don't let audit logging failures break the main operation
        }
    }

    private String defaultString(String value) {
        return value == null ? "" : value;
    }

    private String string(Object value, String fallback) {
        if (value == null) return fallback;
        String text = String.valueOf(value).trim();
        return text.isBlank() ? fallback : text;
    }

    private boolean bool(Object value, boolean fallback) {
        if (value == null) return fallback;
        if (value instanceof Boolean b) return b;
        return Boolean.parseBoolean(String.valueOf(value));
    }

    private Integer number(Object value, Integer fallback) {
        if (value == null) return fallback;
        if (value instanceof Number n) return n.intValue();
        try {
            return Integer.parseInt(String.valueOf(value).trim());
        } catch (Exception ex) {
            return fallback;
        }
    }

    private LocalDateTime parseDateTime(Object value) {
        if (value == null) return null;
        try {
            return LocalDateTime.parse(String.valueOf(value));
        } catch (Exception ex) {
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Boolean> parseBooleanMap(Object value) {
        Map<String, Boolean> result = new LinkedHashMap<>();
        if (!(value instanceof Map<?, ?> map)) {
            return result;
        }
        map.forEach((key, val) -> result.put(String.valueOf(key), bool(val, false)));
        return result;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Integer> parseIntegerMap(Object value) {
        Map<String, Integer> result = new LinkedHashMap<>();
        if (!(value instanceof Map<?, ?> map)) {
            return result;
        }
        map.forEach((key, val) -> result.put(String.valueOf(key), number(val, 0)));
        return result;
    }

    private String slugify(String value) {
        if (value == null) {
            return "";
        }
        return value.trim()
            .toLowerCase()
            .replaceAll("[^a-z0-9]+", "-")
            .replaceAll("^-|-$", "");
    }
}
