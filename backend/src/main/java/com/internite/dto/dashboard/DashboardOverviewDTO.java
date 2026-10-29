package com.internite.dto.dashboard;

import com.internite.dto.DealDTO;
import com.internite.dto.LeadDTO;

import java.io.Serializable;
import java.util.List;
import java.util.Map;

public record DashboardOverviewDTO(
    List<LeadDTO> leads,
    List<DealDTO> deals,
    List<Map<String, Object>> insights,
    List<Map<String, Object>> recentActivity,
    List<Map<String, Object>> recentCallSnapshots,
    String generatedAt
) implements Serializable {}
