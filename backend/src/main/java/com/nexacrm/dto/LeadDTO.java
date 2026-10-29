package com.nexacrm.dto;

import com.nexacrm.model.Lead;
import jakarta.validation.constraints.*;
import lombok.*;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class LeadDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    private String id;

    @NotBlank(message = "Name is required")
    private String name;

    @Email(message = "Valid email required")
    @NotBlank(message = "Email is required")
    private String email;

    private String phone;
    private String company;
    private String website;
    private String designation;
    private String service;
    private String specialization;

    @NotNull(message = "Source is required")
    private Lead.LeadSource source;
    private String sourceLabel;

    private Lead.LeadStatus status;
    private Lead.LeadScore score;
    private Lead.LeadPriority priority;

    @DecimalMin("0")
    private BigDecimal dealValue;

    private String utmSource;
    private String utmMedium;
    private String utmCampaign;

    private Integer aiScoreValue;
    private String aiNextAction;

    private String assignedToId;
    private String assignedToName;

    private List<String> tags;
    private String notes;

    private String facebookLeadId;
    private String facebookFormId;
    private String facebookAdId;

    private Lead.ExpectedCloseTimeline expectedCloseTimeline;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime lastContactedAt;
    private LocalDateTime convertedAt;
    private String lostReason;
    private LocalDateTime followUpDate;
    private LocalDateTime reminder15SentAt;
    private LocalDateTime reminder45SentAt;
    private LocalDateTime reminder60SentAt;
    private LocalDateTime escalatedAt;
    private LocalDateTime reassignedAt;
    private BigDecimal revenueValue;
    private Integer activityStageIndex;
    private List<String> activityLogs;
    private Lead.AutomatedCallingStatus automatedCallingStatus;
    private String automatedCallingStatusLabel;
    private Integer automatedCallingAttempt;
    private LocalDateTime nextAutomatedCallAt;
}
