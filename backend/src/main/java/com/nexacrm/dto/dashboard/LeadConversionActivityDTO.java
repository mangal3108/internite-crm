package com.nexacrm.dto.dashboard;

import java.io.Serializable;

import java.time.LocalDateTime;

public record LeadConversionActivityDTO(
    String id,
    String leadId,
    String leadName,
    String employeeId,
    String employeeName,
    String activityType,
    String oldStatus,
    String newStatus,
    String notes,
    String source,
    LocalDateTime occurredAt
) implements Serializable {}
