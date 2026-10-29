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

@Document(collection = "lead_call_automations")
@CompoundIndexes({
    @CompoundIndex(name = "lead_call_auto_tenant_lead_uidx", def = "{'tenant_id': 1, 'lead_id': 1}", unique = true),
    @CompoundIndex(name = "lead_call_auto_due_idx", def = "{'tenant_id': 1, 'status': 1, 'next_scheduled_at': 1}")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LeadCallAutomation extends BaseEntity {

    @Field("lead_id")
    private String leadId;

    @Field("lead_name")
    private String leadName;

    @Field("contact_number")
    private String contactNumber;

    @Field("lead_source")
    private String leadSource;

    @Field("status")
    private Lead.AutomatedCallingStatus status;

    @Field("attempt_count")
    private int attemptCount;

    @Field("last_attempt_at")
    private LocalDateTime lastAttemptAt;

    @Field("next_scheduled_at")
    private LocalDateTime nextScheduledAt;

    @Field("last_call_status")
    private String lastCallStatus;

    @Field("last_call_duration_seconds")
    private Integer lastCallDurationSeconds;

    @Field("last_external_id")
    private String lastExternalId;

    @Field("stopped_at")
    private LocalDateTime stoppedAt;

    @Field("stop_reason")
    private String stopReason;
}
