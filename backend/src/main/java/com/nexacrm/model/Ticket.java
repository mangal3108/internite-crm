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
import java.util.List;

@Document(collection = "tickets")
@CompoundIndexes({
    @CompoundIndex(name = "ticket_tenant_status_idx", def = "{'tenant_id': 1, 'deleted': 1, 'status': 1}"),
    @CompoundIndex(name = "ticket_tenant_assigned_idx", def = "{'tenant_id': 1, 'deleted': 1, 'assigned_to_id': 1}"),
    @CompoundIndex(name = "ticket_tenant_category_priority_idx", def = "{'tenant_id': 1, 'deleted': 1, 'category': 1, 'priority': 1}")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Ticket extends BaseEntity {

    @Field("ticket_number")
    private String ticketNumber;

    @Field("subject")
    private String subject;

    @Field("description")
    private String description;

    @Field("category")
    private String category;

    @Field("priority")
    @Builder.Default
    private String priority = "MEDIUM";

    @Field("status")
    @Builder.Default
    private String status = "OPEN";

    @Field("assigned_to_id")
    private String assignedToId;

    @Field("created_by_id")
    private String createdById;

    @Field("customer_email")
    private String customerEmail;

    @Field("tags")
    @Builder.Default
    private List<String> tags = new ArrayList<>();

    @Field("resolved_at")
    private LocalDateTime resolvedAt;

    @Field("closed_at")
    private LocalDateTime closedAt;

    @Field("comments")
    @Builder.Default
    private List<TicketComment> comments = new ArrayList<>();
}
