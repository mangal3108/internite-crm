package com.nexacrm.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ChannelSendRequest {

    @NotBlank(message = "Channel is required")
    private String channel;

    @NotBlank(message = "Recipient is required")
    private String recipient;

    private String subject;

    @NotBlank(message = "Message body is required")
    private String body;
}
