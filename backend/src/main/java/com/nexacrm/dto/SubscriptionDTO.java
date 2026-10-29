package com.nexacrm.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SubscriptionDTO {
    private String id;
    private Long tenantId;
    private String tenantName;

    @NotBlank(message = "Plan name is required")
    private String planName;

    private String status;
    private String billingCycle;
    private Double pricePerMonth;
    private String currency;
    private Integer maxUsers;
    private Integer maxLeads;
    private Integer maxDeals;
    private Integer storageGb;
    private Map<String, Boolean> features;
    private LocalDateTime currentPeriodStart;
    private LocalDateTime currentPeriodEnd;
    private LocalDateTime trialEndsAt;
    private LocalDateTime cancelledAt;
    private String paymentMethod;
    private LocalDateTime lastPaymentAt;
    private LocalDateTime nextBillingAt;
    private List<SubscriptionInvoiceDTO> invoiceHistory;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SubscriptionInvoiceDTO {
        private String id;
        private String invoiceNumber;
        private Double amount;
        private String currency;
        private String status;
        private LocalDateTime paidAt;
        private LocalDateTime createdAt;
        private String description;
    }
}
