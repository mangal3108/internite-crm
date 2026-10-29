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
import java.util.LinkedHashMap;
import java.util.Map;

@Document(collection = "tenants")
@CompoundIndexes({
    @CompoundIndex(name = "tenant_slug_idx", def = "{'slug': 1}", unique = true)
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Tenant extends BaseEntity {

    @Field("name")
    private String name;

    @Field("slug")
    private String slug;

    @Field("plan")
    private String plan;

    @Field("is_active")
    private Boolean isActive = true;

    @Field("max_users")
    private Integer maxUsers = 5;

    @Field("logo_url")
    private String logoUrl;

    @Field("industry")
    private String industry;

    @Field("website")
    private String website;

    @Field("contact_name")
    private String contactName;

    @Field("contact_email")
    private String contactEmail;

    @Field("contact_phone")
    private String contactPhone;

    @Field("country")
    private String country;

    @Field("timezone")
    private String timezone;

    @Field("currency")
    private String currency;

    @Field("notes")
    private String notes;

    @Field("billing_status")
    private String billingStatus = "TRIAL";

    @Field("trial_ends_at")
    private LocalDateTime trialEndsAt;

    @Field("subscription_started_at")
    private LocalDateTime subscriptionStartedAt;

    @Field("subscription_ends_at")
    private LocalDateTime subscriptionEndsAt;

    @Field("activated_at")
    private LocalDateTime activatedAt;

    @Field("deactivated_at")
    private LocalDateTime deactivatedAt;

    @Field("feature_flags")
    @Builder.Default
    private Map<String, Boolean> featureFlags = new LinkedHashMap<>();

    @Field("usage_limits")
    @Builder.Default
    private Map<String, Integer> usageLimits = new LinkedHashMap<>();
}
