package com.nexacrm.dto.dashboard;

import java.io.Serializable;

public record LeadConversionSourceDTO(
    String sourceKey,
    String sourceLabel,
    long totalLeads,
    long convertedLeads,
    long lostLeads,
    double conversionRate,
    double revenueGenerated,
    boolean bestPerforming
) implements Serializable {}
