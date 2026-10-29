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

@Document(collection = "ai_calls")
@CompoundIndexes({
    @CompoundIndex(name = "ai_call_tenant_external_idx", def = "{'tenant_id': 1, 'provider': 1, 'external_call_id': 1}", unique = true, partialFilter = "{ 'external_call_id': { '$type': 'string', '$gt': '' } }"),
    @CompoundIndex(name = "ai_call_tenant_lead_created_idx", def = "{'tenant_id': 1, 'lead_id': 1, 'status': 1, 'createdAt': -1}"),
    @CompoundIndex(name = "ai_call_tenant_status_idx", def = "{'tenant_id': 1, 'status': 1, 'createdAt': -1}")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AICall extends BaseEntity {

    @Field("lead_id")
    private String leadId;

    @Field("deal_id")
    private String dealId;

    @Field("user_id")
    private String userId;

    @Field("provider")
    private String provider;

    @Field("external_call_id")
    private String externalCallId;

    @Field("status")
    private String status;

    @Field("outcome")
    private String outcome;

    @Field("summary")
    private String summary;

    @Field("transcript")
    private String transcript;

    @Field("recording_url")
    private String recordingUrl;

    @Field("started_at")
    private LocalDateTime startedAt;

    @Field("ended_at")
    private LocalDateTime endedAt;

    @Field("duration_seconds")
    private Integer durationSeconds;

    @Field("raw_payload")
    private String rawPayload;
}
