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

@Document(collection = "tasks")
@CompoundIndexes({
    @CompoundIndex(name = "task_tenant_status_due_idx", def = "{'tenant_id': 1, 'deleted': 1, 'status': 1, 'due_date': 1}"),
    @CompoundIndex(name = "task_tenant_assigned_due_idx", def = "{'tenant_id': 1, 'deleted': 1, 'assigned_to': 1, 'due_date': 1}"),
    @CompoundIndex(name = "task_tenant_assigned_status_due_idx", def = "{'tenant_id': 1, 'deleted': 1, 'assigned_to': 1, 'status': 1, 'due_date': 1}"),
    @CompoundIndex(name = "task_tenant_lead_deal_idx", def = "{'tenant_id': 1, 'lead_id': 1, 'deal_id': 1}")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Task extends BaseEntity {

    @Field("title")
    private String title;

    @Field("description")
    private String description;

    @Field("type")
    private String type;

    @Field("status")
    private String status = "PENDING";

    @Field("priority")
    private String priority = "MEDIUM";

    @Field("due_date")
    private LocalDateTime dueDate;

    @Field("lead_id")
    private String leadId;

    @Field("deal_id")
    private String dealId;

    @Field("assigned_to")
    private String assignedToId;

    @Field("created_by_id")
    private String createdById;

    @Field("completed_at")
    private LocalDateTime completedAt;
}
