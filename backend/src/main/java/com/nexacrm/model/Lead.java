package com.nexacrm.model;

import lombok.*;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.index.TextIndexed;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Document(collection = "leads")
@CompoundIndexes({
    @CompoundIndex(name = "lead_tenant_deleted_idx", def = "{'tenant_id': 1, 'deleted': 1}"),
    @CompoundIndex(name = "lead_tenant_deleted_status_idx", def = "{'tenant_id': 1, 'deleted': 1, 'status': 1}"),
    @CompoundIndex(name = "lead_tenant_deleted_score_idx", def = "{'tenant_id': 1, 'deleted': 1, 'score': 1}"),
    @CompoundIndex(name = "lead_tenant_deleted_source_idx", def = "{'tenant_id': 1, 'deleted': 1, 'source': 1}"),
    @CompoundIndex(name = "lead_tenant_deleted_created_idx", def = "{'tenant_id': 1, 'deleted': 1, 'createdAt': -1}"),
    @CompoundIndex(name = "lead_tenant_deleted_assigned_idx", def = "{'tenant_id': 1, 'deleted': 1, 'assigned_to': 1, 'createdAt': -1}"),
    @CompoundIndex(name = "lead_tenant_deleted_followup_idx", def = "{'tenant_id': 1, 'deleted': 1, 'follow_up_date': 1}"),
    @CompoundIndex(name = "lead_tenant_deleted_email_idx", def = "{'tenant_id': 1, 'deleted': 1, 'email': 1}"),
    @CompoundIndex(name = "lead_tenant_phone_idx", def = "{'tenant_id': 1, 'phone': 1}", partialFilter = "{ 'phone': { '$type': 'string', '$gt': '' } }")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Lead extends BaseEntity {

    @TextIndexed
    @Field("name")
    private String name;

    @TextIndexed
    @Field("email")
    private String email;

    @TextIndexed
    @Field("phone")
    private String phone;
    @TextIndexed
    @Field("company")
    private String company;
    @Field("website")
    private String website;
    @Field("designation")
    private String designation;
    @Field("service")
    private String service;
    @Field("specialization")
    private String specialization;

    @Indexed
    @Field("source")
    private LeadSource source;

    @Field("source_label")
    private String sourceLabel;

    @Indexed
    @Field("status")
    private LeadStatus status = LeadStatus.NEW;

    @Indexed
    @Field("score")
    private LeadScore score = LeadScore.COLD;

    @Field("priority")
    private LeadPriority priority = LeadPriority.MEDIUM;

    @Field("deal_value")
    private BigDecimal dealValue;

    // UTM Tracking
    @Field("utm_source")
    private String utmSource;

    @Field("utm_medium")
    private String utmMedium;

    @Field("utm_campaign")
    private String utmCampaign;

    // AI fields
    @Field("ai_score_value")
    private Integer aiScoreValue;

    @Field("ai_next_action")
    private String aiNextAction;

    // Relations
    @DBRef(lazy = true)
    @Field("assigned_to")
    private User assignedTo;

    @Field("tags")
    private String tags;  // comma-separated

    @Field("notes")
    private String notes;

    @Field("last_contacted_at")
    private LocalDateTime lastContactedAt;

    @Field("converted_at")
    private LocalDateTime convertedAt;

    @Field("lost_reason")
    private String lostReason;

    @Field("follow_up_date")
    private LocalDateTime followUpDate;

    @Field("reminder_15_sent_at")
    private LocalDateTime reminder15SentAt;

    @Field("reminder_45_sent_at")
    private LocalDateTime reminder45SentAt;

    @Field("reminder_60_sent_at")
    private LocalDateTime reminder60SentAt;

    @Field("escalated_at")
    private LocalDateTime escalatedAt;

    @Field("reassigned_at")
    private LocalDateTime reassignedAt;

    @Field("revenue_value")
    private BigDecimal revenueValue;

    @Field("activity_logs")
    private List<String> activityLogs;

    @Builder.Default
    @Field("automated_calling_status")
    private AutomatedCallingStatus automatedCallingStatus = AutomatedCallingStatus.NEW_LEAD;

    @Builder.Default
    @Field("automated_calling_attempt")
    private Integer automatedCallingAttempt = 0;

    @Field("next_automated_call_at")
    private LocalDateTime nextAutomatedCallAt;

    // Facebook Lead Ads tracking
    @Indexed(unique = true, partialFilter = "{ 'facebook_lead_id': { '$type': 'string', '$gt': '' } }")
    @Field("facebook_lead_id")
    private String facebookLeadId;

    @Field("facebook_form_id")
    private String facebookFormId;

    @Field("facebook_ad_id")
    private String facebookAdId;

    @Field("expected_close_timeline")
    private ExpectedCloseTimeline expectedCloseTimeline;

    // Enums
    public enum LeadSource { FACEBOOK, INSTAGRAM, LINKEDIN, WEBSITE, WHATSAPP, GOOGLE_ADS, META_ADS, REFERRAL, EMAIL, OTHER }
    public enum LeadStatus { NEW, CONTACTED, QUALIFIED, PROPOSAL, NEGOTIATION, WON, LOST }
    public enum LeadScore  { HOT, WARM, COLD }
    public enum LeadPriority { HIGH, MEDIUM, LOW }
    public enum AutomatedCallingStatus {
        NEW_LEAD,
        CALLING,
        NO_ANSWER,
        RETRY_SCHEDULED,
        CONNECTED,
        COMPLETED,
        STOPPED,
        FAILED
    }
    public enum ExpectedCloseTimeline {
        DAYS_1_3,   // 1-3 days → HOT
        DAYS_7_10,  // 7-10 days → WARM
        DAYS_10_15_PLUS // 10-15+ days → COLD
    }
}
