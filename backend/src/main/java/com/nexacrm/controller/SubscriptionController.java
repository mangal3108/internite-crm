package com.nexacrm.controller;

import com.nexacrm.dto.SubscriptionDTO;
import com.nexacrm.service.SubscriptionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@Tag(name = "Subscriptions", description = "Subscription and billing management")
public class SubscriptionController {

    private final SubscriptionService subscriptionService;

    // ── Company-level: own subscription ─────────────────────────────

    @GetMapping("/api/subscription/current")
    @PreAuthorize("!hasRole('PLATFORM_ADMIN')")
    @Operation(summary = "Get current company subscription")
    public ResponseEntity<SubscriptionDTO> getCurrentSubscription() {
        return ResponseEntity.ok(subscriptionService.getCurrentSubscription());
    }

    // ── Platform Admin: SaaS subscription management ────────────────

    @GetMapping("/api/admin/saas/subscriptions")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    @Operation(summary = "List all subscriptions")
    public ResponseEntity<List<SubscriptionDTO>> getAllSubscriptions() {
        return ResponseEntity.ok(subscriptionService.getAllSubscriptions());
    }

    @GetMapping("/api/admin/saas/subscriptions/{id}")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    @Operation(summary = "Get subscription by ID")
    public ResponseEntity<SubscriptionDTO> getSubscriptionById(@PathVariable String id) {
        return ResponseEntity.ok(subscriptionService.getSubscriptionById(id));
    }

    @PostMapping("/api/admin/saas/subscriptions")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    @Operation(summary = "Create a new subscription")
    public ResponseEntity<SubscriptionDTO> createSubscription(@Valid @RequestBody SubscriptionDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(subscriptionService.createSubscription(dto));
    }

    @PutMapping("/api/admin/saas/subscriptions/{id}")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    @Operation(summary = "Update a subscription")
    public ResponseEntity<SubscriptionDTO> updateSubscription(
        @PathVariable String id,
        @RequestBody SubscriptionDTO dto
    ) {
        return ResponseEntity.ok(subscriptionService.updateSubscription(id, dto));
    }

    @PatchMapping("/api/admin/saas/subscriptions/{id}/cancel")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    @Operation(summary = "Cancel a subscription")
    public ResponseEntity<SubscriptionDTO> cancelSubscription(@PathVariable String id) {
        return ResponseEntity.ok(subscriptionService.cancelSubscription(id));
    }

    @PatchMapping("/api/admin/saas/subscriptions/{id}/change-plan")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    @Operation(summary = "Change subscription plan")
    public ResponseEntity<SubscriptionDTO> changePlan(
        @PathVariable String id,
        @RequestParam String plan
    ) {
        return ResponseEntity.ok(subscriptionService.changePlan(id, plan));
    }

    @PostMapping("/api/admin/saas/subscriptions/{id}/invoices")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    @Operation(summary = "Add an invoice record to a subscription")
    public ResponseEntity<SubscriptionDTO> addInvoice(
        @PathVariable String id,
        @Valid @RequestBody SubscriptionDTO.SubscriptionInvoiceDTO invoiceDto
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(subscriptionService.addInvoice(id, invoiceDto));
    }

    @GetMapping("/api/admin/saas/subscriptions/stats")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    @Operation(summary = "Get subscription statistics")
    public ResponseEntity<Map<String, Object>> getSubscriptionStats() {
        return ResponseEntity.ok(subscriptionService.getSubscriptionStats());
    }
}
