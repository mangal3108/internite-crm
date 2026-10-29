package com.nexacrm.model;

import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.LocalDateTime;
import java.util.Map;

@Document(collection = "audit_logs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditLog {

    @Id
    private String id;

    @Field("action")
    private String action;

    @Field("entity_type")
    private String entityType;

    @Field("entity_id")
    private String entityId;

    @Field("entity_name")
    private String entityName;

    @Field("performed_by")
    private String performedBy;

    @Field("performed_by_email")
    private String performedByEmail;

    @Field("tenant_id")
    private Long tenantId;

    @Field("details")
    private Map<String, Object> details;

    @CreatedDate
    @Field("created_at")
    private LocalDateTime createdAt;
}
