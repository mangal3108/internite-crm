package com.nexacrm.dto;

import lombok.Builder;
import lombok.Data;

import java.time.OffsetDateTime;

@Data
@Builder
public class WhatsAppConversationResponse {
    private String contact;
    private String name;
    private String lastMessage;
    private String lastDirection;
    private OffsetDateTime lastAt;
}
