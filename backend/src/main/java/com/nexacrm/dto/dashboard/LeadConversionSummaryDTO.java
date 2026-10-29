package com.nexacrm.dto.dashboard;

import java.io.Serializable;

import java.util.List;

public record LeadConversionSummaryDTO(
    LeadConversionMetricDTO totalLeads,
    LeadConversionMetricDTO newLeads,
    LeadConversionMetricDTO assignedLeads,
    LeadConversionMetricDTO contactedLeads,
    LeadConversionMetricDTO interestedLeads,
    LeadConversionMetricDTO qualifiedLeads,
    LeadConversionMetricDTO proposalSentLeads,
    LeadConversionMetricDTO convertedLeads,
    LeadConversionMetricDTO lostLeads,
    LeadConversionMetricDTO pendingFollowUps,
    LeadConversionMetricDTO conversionRate,
    LeadConversionMetricDTO revenueFromConvertedLeads,
    String periodLabel,
    String previousPeriodLabel,
    List<LeadConversionStatusCountDTO> statusBreakdown
) implements Serializable {}
