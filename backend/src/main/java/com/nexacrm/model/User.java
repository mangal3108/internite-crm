package com.nexacrm.model;

import lombok.*;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.util.ArrayList;
import java.util.Collection;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

@Document(collection = "users")
@CompoundIndexes({
    @CompoundIndex(name = "uk_user_tenant_email", def = "{'tenant_id': 1, 'email': 1}", unique = true),
    @CompoundIndex(name = "uk_user_tenant_phone", def = "{'tenant_id': 1, 'phone': 1}", unique = true, partialFilter = "{ 'phone': { '$type': 'string', '$gt': '' } }"),
    @CompoundIndex(name = "user_tenant_active_role_idx", def = "{'tenant_id': 1, 'deleted': 1, 'is_active': 1, 'role': 1}")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class User extends BaseEntity implements UserDetails {
    private static final List<String> ALL_PERMISSIONS = List.of(
        "dashboard.view",
        "leads.read", "leads.create", "leads.update", "leads.delete", "leads.import", "leads.export",
        "leads.assign", "leads.merge", "leads.reopen", "leads.escalate",
        "deals.read", "deals.create", "deals.update", "deals.move_stage", "deals.delete", "deals.assign",
        "customers.read", "customers.create", "customers.update", "customers.delete",
        "communications.read", "communications.send",
        "ai.use",
        "automation.read", "automation.create", "automation.update", "automation.delete", "automation.manage",
        "workflows.view", "workflows.manage",
        "invoices.read", "invoices.create", "invoices.update", "invoices.delete", "invoices.mark_paid", "invoices.reminder", "invoices.export",
        "reports.read", "reports.export",
        "analytics.view", "analytics.export",
        "team.read", "team.create", "team.update", "team.delete", "team.invite", "team.deactivate", "team.assign",
        "settings.view", "settings.update",
        "integrations.read", "integrations.create", "integrations.update", "integrations.delete", "integrations.manage",
        "profile.update",
        "notifications.read",
        "tasks.read", "tasks.create", "tasks.update", "tasks.delete", "tasks.assign", "tasks.complete",
        "tickets.read", "tickets.create", "tickets.update", "tickets.delete", "tickets.assign"
    );

    private static final Map<Role, List<String>> ROLE_PERMISSIONS = new EnumMap<>(Role.class);

    // Platform Admin permissions — platform-level operations only, not company CRM data
    private static final List<String> PLATFORM_ADMIN_PERMISSIONS = List.of(
        "profile.update", "notifications.read"
    );

    static {
        ROLE_PERMISSIONS.put(Role.PLATFORM_ADMIN, PLATFORM_ADMIN_PERMISSIONS);
        ROLE_PERMISSIONS.put(Role.COMPANY_ADMIN, ALL_PERMISSIONS);
        ROLE_PERMISSIONS.put(Role.ADMIN, ALL_PERMISSIONS);
        ROLE_PERMISSIONS.put(Role.MANAGER, List.of(
            "dashboard.view",
            "leads.read", "leads.create", "leads.update", "leads.import", "leads.export",
            "leads.assign", "leads.merge", "leads.reopen", "leads.escalate",
            "deals.read", "deals.create", "deals.update", "deals.move_stage", "deals.assign",
            "customers.read", "customers.create", "customers.update",
            "communications.read", "communications.send",
            "ai.use",
            "automation.read", "automation.create", "automation.update", "automation.manage",
            "workflows.view", "workflows.manage",
            "invoices.read", "invoices.create", "invoices.update", "invoices.mark_paid", "invoices.reminder", "invoices.export",
            "reports.read", "reports.export",
            "analytics.view", "analytics.export",
            "team.read", "team.create", "team.update", "team.invite",
            "settings.view",
            "integrations.read", "integrations.update", "integrations.manage",
            "profile.update",
            "notifications.read",
            "tasks.read", "tasks.create", "tasks.update", "tasks.assign", "tasks.complete",
            "tickets.read", "tickets.create", "tickets.update", "tickets.assign"
        ));
        ROLE_PERMISSIONS.put(Role.SALES_EXEC, List.of(
            "dashboard.view",
            "leads.read", "leads.create", "leads.update",
            "deals.read", "deals.create", "deals.update", "deals.move_stage",
            "customers.read",
            "communications.read", "communications.send",
            "ai.use",
            "automation.read",
            "invoices.read",
            "reports.read",
            "profile.update",
            "notifications.read",
            "tasks.read", "tasks.create", "tasks.update", "tasks.complete",
            "tickets.read", "tickets.create", "tickets.update"
        ));
        ROLE_PERMISSIONS.put(Role.NORMAL_USER, ROLE_PERMISSIONS.get(Role.SALES_EXEC));
    }

    @Field("name")
    private String name;

    @Indexed
    @Field("email")
    private String email;

    @Field("password")
    private String password;

    @Field("role")
    private Role role;

    @Field("phone")
    private String phone;

    @Field("avatar_url")
    private String avatarUrl;

    @Field("is_active")
    private Boolean isActive = true;

    @Field("two_fa_enabled")
    private Boolean twoFaEnabled = false;

    @Field("two_fa_secret")
    private String twoFaSecret;

    // ── UserDetails implementation ───────────────────────────────

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        Role effectiveRole = role != null ? role : Role.SALES_EXEC;
        List<GrantedAuthority> authorities = new ArrayList<>();
        authorities.add(new SimpleGrantedAuthority("ROLE_" + effectiveRole.name()));
        getPermissionsForRole(effectiveRole).forEach(permission -> authorities.add(new SimpleGrantedAuthority(permission)));
        return authorities;
    }

    @Override
    public String getUsername() {
        return email;  // email is the unique login identifier
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return Boolean.TRUE.equals(isActive);
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return Boolean.TRUE.equals(isActive);
    }

    public static List<String> getPermissionsForRole(Role role) {
        Role effectiveRole = role != null ? role : Role.SALES_EXEC;
        return ROLE_PERMISSIONS.getOrDefault(effectiveRole, ROLE_PERMISSIONS.get(Role.SALES_EXEC));
    }

    /** Returns true for company-level admin roles */
    public static boolean isAdminLike(Role role) {
        return role == Role.COMPANY_ADMIN || role == Role.ADMIN;
    }

    /** Returns true for the SaaS platform operator (not part of any company) */
    public static boolean isPlatformAdmin(Role role) {
        return role == Role.PLATFORM_ADMIN;
    }

    public static boolean isSalesLike(Role role) {
        return role == Role.SALES_EXEC || role == Role.NORMAL_USER;
    }

    public static String getDisplayLabel(Role role) {
        if (role == null) {
            return "Sales Executive";
        }
        return switch (role) {
            case PLATFORM_ADMIN -> "Platform Admin";
            case COMPANY_ADMIN -> "Company Admin";
            case ADMIN -> "Admin";
            case MANAGER -> "Manager";
            case SALES_EXEC -> "Sales Executive";
            case NORMAL_USER -> "Normal User";
        };
    }

    public enum Role { PLATFORM_ADMIN, COMPANY_ADMIN, ADMIN, MANAGER, SALES_EXEC, NORMAL_USER }
}
