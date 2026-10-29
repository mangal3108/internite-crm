package com.nexacrm.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.LocalDateTime;
import java.util.Map;

@Document(collection = "lead_activities")
@CompoundIndexes({
    @CompoundIndex(name = "lead_activity_tenant_lead_saved_idx", def = "{'tenant_id': 1, 'lead_id': 1, 'deleted': 1, 'saved_at': -1}"),
    @CompoundIndex(name = "lead_activity_tenant_created_idx", def = "{'tenant_id': 1, 'deleted': 1, 'createdAt': -1}"),
    @CompoundIndex(name = "lead_activity_bulk_stage_preview_idx", def = "{'tenant_id': 1, 'deleted': 1, 'lead_id': 1, 'activity_index': 1, 'saved_at': -1}")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LeadActivity extends BaseEntity {

    @Indexed
    @Field("lead_id")
    private String leadId;

    @Field("activity_index")
    private Integer activityIndex;

    @Field("activity_id")
    private String activityId;

    @Field("activity_label")
    private String activityLabel;

    @Field("activity_title")
    private String activityTitle;

    @Field("assigned_to")
    private String assignedTo;

    @Field("summary")
    private String summary;

    @Field("values")
    private Map<String, Object> values;

    @Indexed
    @Field("saved_at")
    private LocalDateTime savedAt;
}
