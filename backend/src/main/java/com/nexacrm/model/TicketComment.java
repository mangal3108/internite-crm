package com.nexacrm.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TicketComment {

    @Field("id")
    @Builder.Default
    private String id = UUID.randomUUID().toString();

    @Field("user_id")
    private String userId;

    @Field("user_name")
    private String userName;

    @Field("message")
    private String message;

    @Field("created_at")
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Field("is_internal")
    @Builder.Default
    private Boolean isInternal = false;
}
