package com.nexacrm.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TicketDTO {
    private String id;
    private String ticketNumber;

    @NotBlank(message = "Subject is required")
    private String subject;

    private String description;
    private String category;
    private String priority;
    private String status;
    private String assignedToId;
    private String assignedToName;
    private String createdById;
    private String createdByName;
    private String customerEmail;
    private List<String> tags;
    private LocalDateTime resolvedAt;
    private LocalDateTime closedAt;
    private List<TicketCommentDTO> comments;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TicketCommentDTO {
        private String id;
        private String userId;
        private String userName;

        @NotBlank(message = "Message is required")
        private String message;

        private LocalDateTime createdAt;
        private Boolean isInternal;
    }
}
