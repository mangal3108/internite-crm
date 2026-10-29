package com.nexacrm.dto.dashboard;

import java.io.Serializable;

public record LeadConversionEmployeeDTO(
    String employeeId,
    String employeeName,
    long assignedLeads,
    long contactedLeads,
    long convertedLeads,
    long lostLeads,
    long pendingLeads,
    long followUpsDone,
    double conversionRate,
    double averageResponseMinutes,
    double revenueGenerated
) implements Serializable {}
