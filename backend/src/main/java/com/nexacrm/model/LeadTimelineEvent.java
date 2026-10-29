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
import java.util.Map;

@Document(collection = "lead_timeline_events")
@CompoundIndexes({
    @CompoundIndex(name = "lead_timeline_feed_idx", def = "{'tenant_id': 1, 'lead_id': 1, 'deleted': 1, 'event_at': -1}"),
    @CompoundIndex(name = "lead_timeline_source_uidx", def = "{'tenant_id': 1, 'source_type': 1, 'source_id': 1}", unique = true)
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LeadTimelineEvent extends BaseEntity {

    @Field("lead_id")
    private String leadId;

    @Field("event_type")
    private String eventType;

    @Field("source_type")
    private String sourceType;

    @Field("source_id")
    private String sourceId;

    @Field("source_collection")
    private String sourceCollection;

    @Field("title")
    private String title;

    @Field("description")
    private String description;

    @Field("status")
    private String status;

    @Field("owner")
    private String owner;

    @Field("event_at")
    private LocalDateTime eventAt;

    @Field("metadata")
    private Map<String, Object> metadata;
}
