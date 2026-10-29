package com.nexacrm.model;

import lombok.*;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

@Document(collection = "notifications")
@CompoundIndexes({
    @CompoundIndex(name = "notification_tenant_user_unread_idx", def = "{'tenant_id': 1, 'user': 1, 'is_read': 1, 'deleted': 1, 'createdAt': -1}"),
    @CompoundIndex(name = "notification_tenant_entity_idx", def = "{'tenant_id': 1, 'entity_type': 1, 'entity_id': 1, 'createdAt': -1}")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Notification extends BaseEntity {

    @DBRef(lazy = true)
    @Field("user")
    private User user;

    @Field("title")
    private String title;

    @Field("message")
    private String message;

    @Field("type")
    private NotificationType type;

    @Field("is_read")
    private Boolean isRead = false;

    @Field("action_url")
    private String actionUrl;

    @Field("entity_type")
    private String entityType;

    @Field("entity_id")
    private String entityId;

    @Field("direction")
    private NotificationDirection direction;

    public enum NotificationType { LEAD, DEAL, TASK, INVOICE, AI, SYSTEM, AUTOMATION, COMMUNICATION }
    public enum NotificationDirection { INBOUND, OUTBOUND }
}
