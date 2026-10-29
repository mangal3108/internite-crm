package com.nexacrm.controller;

import com.nexacrm.service.TenantAdminService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/saas")
@RequiredArgsConstructor
@Tag(name = "Platform Admin", description = "Platform admin — companies, users, subscriptions, security, and system controls")
@PreAuthorize("hasRole('PLATFORM_ADMIN')")
public class SuperAdminController {

    private final TenantAdminService tenantAdminService;

    // ── Companies (Tenants) ─────────────────────────────────────

    @GetMapping("/tenants")
    @Operation(summary = "List all companies")
    public ResponseEntity<List<Map<String, Object>>> tenants() {
        return ResponseEntity.ok(tenantAdminService.listTenants());
    }

    @PostMapping("/tenants")
    @Operation(summary = "Create a company")
    public ResponseEntity<Map<String, Object>> createTenant(@RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(tenantAdminService.createTenant(body));
    }

    @PutMapping("/tenants/{id}")
    @Operation(summary = "Update a company")
    public ResponseEntity<Map<String, Object>> updateTenant(@PathVariable String id, @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(tenantAdminService.updateTenant(id, body));
    }

    @PatchMapping("/tenants/{id}/activate")
    @Operation(summary = "Activate company")
    public ResponseEntity<Map<String, Object>> activateTenant(@PathVariable String id) {
        return ResponseEntity.ok(tenantAdminService.setActive(id, true));
    }

    @PatchMapping("/tenants/{id}/deactivate")
    @Operation(summary = "Deactivate company")
    public ResponseEntity<Map<String, Object>> deactivateTenant(@PathVariable String id) {
        return ResponseEntity.ok(tenantAdminService.setActive(id, false));
    }

    // ── Subscriptions & Plans ───────────────────────────────────

    @GetMapping("/plans")
    @Operation(summary = "Subscription plans")
    public ResponseEntity<List<Map<String, Object>>> plans() {
        return ResponseEntity.ok(tenantAdminService.plans());
    }

    @GetMapping("/billing")
    @Operation(summary = "Billing dashboard summary")
    public ResponseEntity<Map<String, Object>> billing() {
        return ResponseEntity.ok(tenantAdminService.getBillingDashboard());
    }

    // ── Feature Flags ───────────────────────────────────────────

    @GetMapping("/feature-flags")
    @Operation(summary = "Feature flag catalog")
    public ResponseEntity<List<Map<String, Object>>> features() {
        return ResponseEntity.ok(tenantAdminService.featureCatalog());
    }

    // ── Cross-tenant User Management ────────────────────────────

    @GetMapping("/users")
    @Operation(summary = "List all users across all companies")
    public ResponseEntity<List<Map<String, Object>>> allUsers() {
        return ResponseEntity.ok(tenantAdminService.listAllUsers());
    }

    @PostMapping("/users")
    @Operation(summary = "Create a user for a company")
    public ResponseEntity<Map<String, Object>> createUser(@RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(tenantAdminService.createUser(body));
    }

    @PatchMapping("/users/{id}/role")
    @Operation(summary = "Change a user's role")
    public ResponseEntity<Map<String, Object>> changeUserRole(
            @PathVariable String id, @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(tenantAdminService.changeUserRole(id, (String) body.get("role")));
    }

    @PatchMapping("/users/{id}/activate")
    @Operation(summary = "Activate user")
    public ResponseEntity<Map<String, Object>> activateUser(@PathVariable String id) {
        return ResponseEntity.ok(tenantAdminService.setUserActive(id, true));
    }

    @PatchMapping("/users/{id}/deactivate")
    @Operation(summary = "Deactivate user")
    public ResponseEntity<Map<String, Object>> deactivateUser(@PathVariable String id) {
        return ResponseEntity.ok(tenantAdminService.setUserActive(id, false));
    }

    // ── Platform Overview / System Monitor ──────────────────────

    @GetMapping("/overview")
    @Operation(summary = "Platform-wide overview stats")
    public ResponseEntity<Map<String, Object>> overview() {
        return ResponseEntity.ok(tenantAdminService.getPlatformOverview());
    }

    // ── Audit Logs ──────────────────────────────────────────────

    @GetMapping("/audit-logs")
    @Operation(summary = "Global audit logs")
    public ResponseEntity<List<Map<String, Object>>> auditLogs() {
        return ResponseEntity.ok(tenantAdminService.getAuditLogs());
    }

    // ── Security Policies ───────────────────────────────────────

    @GetMapping("/security")
    @Operation(summary = "Security policies overview")
    public ResponseEntity<Map<String, Object>> securityOverview() {
        return ResponseEntity.ok(tenantAdminService.getSecurityOverview());
    }
}
