package com.nexacrm.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TaskDTO {
    private String id;

    @NotBlank(message = "Title is required")
    private String title;

    private String description;
    private String type;
    private String status;
    private String priority;
    private LocalDateTime dueDate;
    private String leadId;
    private String dealId;
    private String assignedToId;
    private String assignedToName;
    private String createdById;
    private String createdByName;
    private LocalDateTime completedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
