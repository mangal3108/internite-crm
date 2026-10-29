package com.nexacrm.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Document(collection = "subscriptions")
@CompoundIndexes({
    @CompoundIndex(name = "subscription_tenant_idx", def = "{'tenant_id': 1, 'deleted': 1}"),
    @CompoundIndex(name = "subscription_status_idx", def = "{'status': 1, 'deleted': 1}")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Subscription extends BaseEntity {

    @Field("plan_name")
    private String planName;

    @Field("status")
    @Builder.Default
    private String status = "TRIALING";

    @Field("billing_cycle")
    @Builder.Default
    private String billingCycle = "MONTHLY";

    @Field("price_per_month")
    private Double pricePerMonth;

    @Field("currency")
    @Builder.Default
    private String currency = "INR";

    @Field("max_users")
    private Integer maxUsers;

    @Field("max_leads")
    private Integer maxLeads;

    @Field("max_deals")
    private Integer maxDeals;

    @Field("storage_gb")
    private Integer storageGb;

    @Field("features")
    @Builder.Default
    private Map<String, Boolean> features = new LinkedHashMap<>();

    @Field("current_period_start")
    private LocalDateTime currentPeriodStart;

    @Field("current_period_end")
    private LocalDateTime currentPeriodEnd;

    @Field("trial_ends_at")
    private LocalDateTime trialEndsAt;

    @Field("cancelled_at")
    private LocalDateTime cancelledAt;

    @Field("payment_method")
    private String paymentMethod;

    @Field("last_payment_at")
    private LocalDateTime lastPaymentAt;

    @Field("next_billing_at")
    private LocalDateTime nextBillingAt;

    @Field("invoice_history")
    @Builder.Default
    private List<SubscriptionInvoice> invoiceHistory = new ArrayList<>();
}
