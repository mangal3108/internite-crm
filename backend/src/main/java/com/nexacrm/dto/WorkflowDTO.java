package com.nexacrm.dto;

import com.nexacrm.model.Workflow;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;

import java.time.LocalDateTime;
import java.util.List;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class WorkflowDTO {
    private String id;

    @NotBlank(message = "Workflow name is required")
    private String name;

    @NotBlank(message = "Workflow category is required")
    private String category;

    @NotNull(message = "Workflow status is required")
    private Workflow.WorkflowStatus status;

    private Integer runs;
    private String lastRun;
    private String priority;

    @Valid
    @NotNull(message = "Workflow steps are required")
    @Size(min = 2, message = "At least 2 workflow steps are required")
    private List<WorkflowStepDTO> steps;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class WorkflowStepDTO {
        @NotBlank(message = "Step type is required")
        private String type;

        @NotBlank(message = "Step text is required")
        private String text;
    }
}
