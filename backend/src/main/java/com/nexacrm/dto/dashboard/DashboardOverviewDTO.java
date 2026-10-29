package com.nexacrm.dto.dashboard;

import com.nexacrm.dto.DealDTO;
import com.nexacrm.dto.LeadDTO;

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
