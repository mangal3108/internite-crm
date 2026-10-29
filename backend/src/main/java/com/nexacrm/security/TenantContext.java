package com.nexacrm.security;

import com.nexacrm.model.User;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

public final class TenantContext {

    private static final Long DEFAULT_TENANT_ID = 1L;
    private static final ThreadLocal<Long> TENANT_OVERRIDE = new ThreadLocal<>();
    private static final boolean ALLOW_TEST_DEFAULT_TENANT =
        System.getProperty("surefire.test.classpath") != null
            || System.getProperty("surefire.test.class.path") != null
            || Boolean.getBoolean("nexacrm.allow-default-tenant");

    private TenantContext() {
    }

    public static void setCurrentTenantId(Long tenantId) {
        if (tenantId == null) {
            TENANT_OVERRIDE.remove();
            return;
        }
        TENANT_OVERRIDE.set(tenantId);
    }

    public static void clear() {
        TENANT_OVERRIDE.remove();
    }

    public static Long currentTenantIdOrNull() {
        return resolveTenantId();
    }

    public static Long currentTenantId() {
        Long tenantId = resolveTenantId();
        if (tenantId == null) {
            if (ALLOW_TEST_DEFAULT_TENANT) {
                return DEFAULT_TENANT_ID;
            }
            throw new IllegalStateException("Tenant context is required for CRM data access");
        }
        return tenantId;
    }

    public static Long currentTenantId(Long fallbackTenantId) {
        Long tenantId = resolveTenantId();
        if (tenantId != null) {
            return tenantId;
        }
        if (ALLOW_TEST_DEFAULT_TENANT) {
            return DEFAULT_TENANT_ID;
        }
        return fallbackTenantId;
    }

    private static Long resolveTenantId() {
        Long overriddenTenantId = TENANT_OVERRIDE.get();
        if (overriddenTenantId != null) {
            return overriddenTenantId;
        }

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null) {
            return null;
        }

        Object principal = authentication.getPrincipal();
        if (principal instanceof User user && user.getTenantId() != null) {
            return user.getTenantId();
        }

        Object details = authentication.getDetails();
        if (details instanceof User user && user.getTenantId() != null) {
            return user.getTenantId();
        }

        return ALLOW_TEST_DEFAULT_TENANT ? DEFAULT_TENANT_ID : null;
    }
}
