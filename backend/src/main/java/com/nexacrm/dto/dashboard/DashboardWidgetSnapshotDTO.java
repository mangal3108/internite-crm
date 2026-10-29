package com.nexacrm.dto.dashboard;

import java.io.Serializable;
import java.util.List;

public record DashboardWidgetSnapshotDTO(
    AgingCounts agingCounts,
    LeadSlaSummary slaSummary,
    List<EmployeePerformance> employeePerformance,
    List<RevenueBucket> monthlyRevenue,
    List<FunnelStage> funnelData,
    List<LeadSourceShare> leadSources,
    String generatedAt
) implements Serializable {
    public record AgingCounts(long fresh, long warning, long critical) implements Serializable {}

    public record LeadSlaSummary(
        long total,
        long unattendedCritical,
        long pending,
        long met,
        long breached,
        Double avgResponseMinutes
    ) implements Serializable {}

    public record EmployeePerformance(
        String owner,
        long total,
        long unattended,
        long met,
        long breached,
        long pending
    ) implements Serializable {}

    public record RevenueBucket(
        String month,
        double revenue,
        long deals
    ) implements Serializable {}

    public record FunnelStage(
        String stage,
        long count,
        String color
    ) implements Serializable {}

    public record LeadSourceShare(
        String name,
        double value,
        String color
    ) implements Serializable {}
}
