package com.nexacrm.dto;

import com.nexacrm.model.Deal;
import jakarta.validation.constraints.*;
import lombok.*;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class DealDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    private String id;

    @NotBlank
    private String title;

    private String description;

    private Deal.DealStage stage;
    private Deal.DealPriority priority;

    @NotNull @DecimalMin("0")
    private BigDecimal dealValue;

    private LocalDate expectedCloseDate;
    private LocalDate actualCloseDate;
    private Integer winProbability;
    private Long pipelineId;

    private String leadId;
    private String leadName;
    private String company;

    private String ownerId;
    private String ownerName;

    private String aiScore;
    private String tags;
    private String notes;
    private Integer activitiesCount;
    private String latestCallRecordingUrl;
    private String latestCallSummary;
    private LocalDateTime latestCallAt;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
