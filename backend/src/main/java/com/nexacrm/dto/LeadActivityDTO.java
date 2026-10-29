package com.nexacrm.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Max;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LeadActivityDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    private String id;
    private String leadId;

    @NotNull(message = "Activity index is required")
    @Min(value = 0, message = "Activity index must be between 0 and 2")
    @Max(value = 2, message = "Activity index must be between 0 and 2")
    private Integer activityIndex;

    private String activityId;
    private String activityLabel;
    private String activityTitle;
    private String assignedTo;
    private String summary;
    private Map<String, Object> values;
    private LocalDateTime savedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
