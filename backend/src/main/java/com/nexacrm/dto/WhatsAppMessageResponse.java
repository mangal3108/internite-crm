package com.nexacrm.dto;

import lombok.Builder;
import lombok.Data;

import java.time.OffsetDateTime;

@Data
@Builder
public class WhatsAppMessageResponse {
    private String id;
    private String contact;
    private String direction;
    private String body;
    private String status;
    private String externalId;
    private String contactName;
    private OffsetDateTime createdAt;
}
