package com.nexacrm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LeadTimelineEventDTO {
    private String id;
    private String leadId;
    private String eventType;
    private String sourceType;
    private String sourceId;
    private String sourceCollection;
    private String title;
    private String description;
    private String status;
    private String owner;
    private LocalDateTime eventAt;
    private Map<String, Object> metadata;
}
