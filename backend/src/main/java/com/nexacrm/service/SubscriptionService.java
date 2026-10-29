package com.nexacrm.service;

import com.nexacrm.dto.SubscriptionDTO;
import com.nexacrm.exception.ResourceNotFoundException;
import com.nexacrm.model.Subscription;
import com.nexacrm.model.SubscriptionInvoice;
import com.nexacrm.model.Tenant;
import com.nexacrm.repository.SubscriptionRepository;
import com.nexacrm.repository.TenantRepository;
import com.nexacrm.security.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class SubscriptionService {

    private final SubscriptionRepository subscriptionRepository;
    private final TenantRepository tenantRepository;

    // ── Company-level (own subscription) ────────────────────────────

    @Transactional(readOnly = true)
    public SubscriptionDTO getCurrentSubscription() {
        Long tenantId = TenantContext.currentTenantId();
        Subscription subscription = subscriptionRepository.findByTenantIdAndDeletedFalse(tenantId)
            .orElseThrow(() -> new ResourceNotFoundException("No subscription found for current tenant"));
        return toDTO(subscription);
    }

    // ── Platform admin operations ───────────────────────────────────

    @Transactional(readOnly = true)
    public List<SubscriptionDTO> getAllSubscriptions() {
        return subscriptionRepository.findAllByDeletedFalse().stream()
            .map(this::toDTO)
            .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public SubscriptionDTO getSubscriptionById(String id) {
        Subscription subscription = subscriptionRepository.findById(id)
            .filter(s -> !Boolean.TRUE.equals(s.getDeleted()))
            .orElseThrow(() -> new ResourceNotFoundException("Subscription not found: " + id));
        return toDTO(subscription);
    }

    @Transactional(readOnly = true)
    public SubscriptionDTO getSubscriptionByTenantId(Long tenantId) {
        Subscription subscription = subscriptionRepository.findByTenantIdAndDeletedFalse(tenantId)
            .orElseThrow(() -> new ResourceNotFoundException("No subscription found for tenant: " + tenantId));
        return toDTO(subscription);
    }

    public SubscriptionDTO createSubscription(SubscriptionDTO dto) {
        Subscription subscription = fromDTO(dto);
        subscription.setStatus(normalizeValue(subscription.getStatus(), "TRIALING"));
        subscription.setPlanName(normalizeValue(subscription.getPlanName(), "FREE"));
        subscription.setBillingCycle(normalizeValue(subscription.getBillingCycle(), "MONTHLY"));

        Subscription saved = subscriptionRepository.save(subscription);
        return toDTO(saved);
    }

    public SubscriptionDTO updateSubscription(String id, SubscriptionDTO dto) {
        Subscription subscription = subscriptionRepository.findById(id)
            .filter(s -> !Boolean.TRUE.equals(s.getDeleted()))
            .orElseThrow(() -> new ResourceNotFoundException("Subscription not found: " + id));

        if (dto.getPlanName() != null) subscription.setPlanName(normalizeValue(dto.getPlanName(), "FREE"));
        if (dto.getStatus() != null) subscription.setStatus(normalizeValue(dto.getStatus(), "TRIALING"));
        if (dto.getBillingCycle() != null) subscription.setBillingCycle(normalizeValue(dto.getBillingCycle(), "MONTHLY"));
        if (dto.getPricePerMonth() != null) subscription.setPricePerMonth(dto.getPricePerMonth());
        if (dto.getCurrency() != null) subscription.setCurrency(dto.getCurrency());
        if (dto.getMaxUsers() != null) subscription.setMaxUsers(dto.getMaxUsers());
        if (dto.getMaxLeads() != null) subscription.setMaxLeads(dto.getMaxLeads());
        if (dto.getMaxDeals() != null) subscription.setMaxDeals(dto.getMaxDeals());
        if (dto.getStorageGb() != null) subscription.setStorageGb(dto.getStorageGb());
        if (dto.getFeatures() != null) subscription.setFeatures(dto.getFeatures());
        if (dto.getCurrentPeriodStart() != null) subscription.setCurrentPeriodStart(dto.getCurrentPeriodStart());
        if (dto.getCurrentPeriodEnd() != null) subscription.setCurrentPeriodEnd(dto.getCurrentPeriodEnd());
        if (dto.getTrialEndsAt() != null) subscription.setTrialEndsAt(dto.getTrialEndsAt());
        if (dto.getPaymentMethod() != null) subscription.setPaymentMethod(dto.getPaymentMethod());
        if (dto.getLastPaymentAt() != null) subscription.setLastPaymentAt(dto.getLastPaymentAt());
        if (dto.getNextBillingAt() != null) subscription.setNextBillingAt(dto.getNextBillingAt());

        Subscription saved = subscriptionRepository.save(subscription);
        return toDTO(saved);
    }

    public SubscriptionDTO cancelSubscription(String id) {
        Subscription subscription = subscriptionRepository.findById(id)
            .filter(s -> !Boolean.TRUE.equals(s.getDeleted()))
            .orElseThrow(() -> new ResourceNotFoundException("Subscription not found: " + id));
        subscription.setStatus("CANCELLED");
        subscription.setCancelledAt(LocalDateTime.now());
        Subscription saved = subscriptionRepository.save(subscription);
        return toDTO(saved);
    }

    public SubscriptionDTO changePlan(String id, String newPlan) {
        Subscription subscription = subscriptionRepository.findById(id)
            .filter(s -> !Boolean.TRUE.equals(s.getDeleted()))
            .orElseThrow(() -> new ResourceNotFoundException("Subscription not found: " + id));
        subscription.setPlanName(normalizeValue(newPlan, "FREE"));
        Subscription saved = subscriptionRepository.save(subscription);
        return toDTO(saved);
    }

    public SubscriptionDTO addInvoice(String subscriptionId, SubscriptionDTO.SubscriptionInvoiceDTO invoiceDto) {
        Subscription subscription = subscriptionRepository.findById(subscriptionId)
            .filter(s -> !Boolean.TRUE.equals(s.getDeleted()))
            .orElseThrow(() -> new ResourceNotFoundException("Subscription not found: " + subscriptionId));

        SubscriptionInvoice invoice = SubscriptionInvoice.builder()
            .id(UUID.randomUUID().toString())
            .invoiceNumber(invoiceDto.getInvoiceNumber())
            .amount(invoiceDto.getAmount())
            .currency(invoiceDto.getCurrency() != null ? invoiceDto.getCurrency() : "INR")
            .status(invoiceDto.getStatus() != null ? normalizeValue(invoiceDto.getStatus(), "PENDING") : "PENDING")
            .paidAt(invoiceDto.getPaidAt())
            .createdAt(LocalDateTime.now())
            .description(invoiceDto.getDescription())
            .build();

        subscription.getInvoiceHistory().add(invoice);
        Subscription saved = subscriptionRepository.save(subscription);
        return toDTO(saved);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getSubscriptionStats() {
        List<Subscription> all = subscriptionRepository.findAllByDeletedFalse();

        long totalActive = all.stream().filter(s -> "ACTIVE".equals(s.getStatus())).count();
        long totalTrialing = all.stream().filter(s -> "TRIALING".equals(s.getStatus())).count();
        long totalCancelled = all.stream().filter(s -> "CANCELLED".equals(s.getStatus())).count();

        double mrr = all.stream()
            .filter(s -> "ACTIVE".equals(s.getStatus()))
            .mapToDouble(s -> s.getPricePerMonth() != null ? s.getPricePerMonth() : 0.0)
            .sum();

        double arr = mrr * 12;

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalActive", totalActive);
        stats.put("totalTrialing", totalTrialing);
        stats.put("totalCancelled", totalCancelled);
        stats.put("mrr", mrr);
        stats.put("arr", arr);
        stats.put("total", (long) all.size());
        return stats;
    }

    // ── DTO mapping ─────────────────────────────────────────────────

    private SubscriptionDTO toDTO(Subscription subscription) {
        String tenantName = null;
        if (subscription.getTenantId() != null) {
            tenantName = tenantRepository.findById(String.valueOf(subscription.getTenantId()))
                .map(Tenant::getName)
                .orElse(null);
        }

        List<SubscriptionDTO.SubscriptionInvoiceDTO> invoiceDTOs = subscription.getInvoiceHistory() != null
            ? subscription.getInvoiceHistory().stream().map(this::toInvoiceDTO).collect(Collectors.toList())
            : List.of();

        return SubscriptionDTO.builder()
            .id(subscription.getId())
            .tenantId(subscription.getTenantId())
            .tenantName(tenantName)
            .planName(subscription.getPlanName())
            .status(subscription.getStatus())
            .billingCycle(subscription.getBillingCycle())
            .pricePerMonth(subscription.getPricePerMonth())
            .currency(subscription.getCurrency())
            .maxUsers(subscription.getMaxUsers())
            .maxLeads(subscription.getMaxLeads())
            .maxDeals(subscription.getMaxDeals())
            .storageGb(subscription.getStorageGb())
            .features(subscription.getFeatures())
            .currentPeriodStart(subscription.getCurrentPeriodStart())
            .currentPeriodEnd(subscription.getCurrentPeriodEnd())
            .trialEndsAt(subscription.getTrialEndsAt())
            .cancelledAt(subscription.getCancelledAt())
            .paymentMethod(subscription.getPaymentMethod())
            .lastPaymentAt(subscription.getLastPaymentAt())
            .nextBillingAt(subscription.getNextBillingAt())
            .invoiceHistory(invoiceDTOs)
            .createdAt(subscription.getCreatedAt())
            .updatedAt(subscription.getUpdatedAt())
            .build();
    }

    private SubscriptionDTO.SubscriptionInvoiceDTO toInvoiceDTO(SubscriptionInvoice invoice) {
        return SubscriptionDTO.SubscriptionInvoiceDTO.builder()
            .id(invoice.getId())
            .invoiceNumber(invoice.getInvoiceNumber())
            .amount(invoice.getAmount())
            .currency(invoice.getCurrency())
            .status(invoice.getStatus())
            .paidAt(invoice.getPaidAt())
            .createdAt(invoice.getCreatedAt())
            .description(invoice.getDescription())
            .build();
    }

    private Subscription fromDTO(SubscriptionDTO dto) {
        Subscription subscription = Subscription.builder()
            .planName(dto.getPlanName())
            .status(dto.getStatus() != null ? dto.getStatus() : "TRIALING")
            .billingCycle(dto.getBillingCycle() != null ? dto.getBillingCycle() : "MONTHLY")
            .pricePerMonth(dto.getPricePerMonth())
            .currency(dto.getCurrency() != null ? dto.getCurrency() : "INR")
            .maxUsers(dto.getMaxUsers())
            .maxLeads(dto.getMaxLeads())
            .maxDeals(dto.getMaxDeals())
            .storageGb(dto.getStorageGb())
            .features(dto.getFeatures() != null ? dto.getFeatures() : new LinkedHashMap<>())
            .currentPeriodStart(dto.getCurrentPeriodStart())
            .currentPeriodEnd(dto.getCurrentPeriodEnd())
            .trialEndsAt(dto.getTrialEndsAt())
            .paymentMethod(dto.getPaymentMethod())
            .lastPaymentAt(dto.getLastPaymentAt())
            .nextBillingAt(dto.getNextBillingAt())
            .build();
        subscription.setTenantId(dto.getTenantId());
        return subscription;
    }

    private String normalizeValue(String value, String defaultValue) {
        if (value == null || value.isBlank()) {
            return defaultValue;
        }
        return value.trim().toUpperCase(Locale.ROOT).replace(' ', '_');
    }
}
