package com.nexacrm.controller.dashboard;

import com.nexacrm.dto.dashboard.LeadConversionActivityDTO;
import com.nexacrm.dto.dashboard.LeadConversionEmployeeDTO;
import com.nexacrm.dto.dashboard.LeadConversionFunnelDTO;
import com.nexacrm.dto.dashboard.LeadConversionSourceDTO;
import com.nexacrm.dto.dashboard.LeadConversionSummaryDTO;
import com.nexacrm.dto.dashboard.LeadConversionTrendDTO;
import com.nexacrm.service.dashboard.LeadConversionDashboardService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/dashboard/lead-conversion")
@RequiredArgsConstructor
@Tag(name = "Lead Conversion Dashboard", description = "Real-time lead conversion analytics")
public class LeadConversionDashboardController {

    private final LeadConversionDashboardService dashboardService;

    @GetMapping("/summary")
    @PreAuthorize("hasAuthority('dashboard.view')")
    @Operation(summary = "Lead conversion summary")
    public ResponseEntity<LeadConversionSummaryDTO> summary(
        @RequestParam(required = false, defaultValue = "thisMonth") String filter,
        @RequestParam(required = false) String startDate,
        @RequestParam(required = false) String endDate,
        @RequestParam(required = false) String employeeId,
        @RequestParam(required = false) String status
    ) {
        return ResponseEntity.ok(dashboardService.summary(filter, startDate, endDate, employeeId, status));
    }

    @GetMapping("/funnel")
    @PreAuthorize("hasAuthority('dashboard.view')")
    @Operation(summary = "Lead conversion funnel stages")
    public ResponseEntity<List<LeadConversionFunnelDTO>> funnel(
        @RequestParam(required = false, defaultValue = "thisMonth") String filter,
        @RequestParam(required = false) String startDate,
        @RequestParam(required = false) String endDate,
        @RequestParam(required = false) String employeeId,
        @RequestParam(required = false) String status
    ) {
        return ResponseEntity.ok(dashboardService.funnel(filter, startDate, endDate, employeeId, status));
    }

    @GetMapping("/employees")
    @PreAuthorize("hasAuthority('dashboard.view')")
    @Operation(summary = "Employee-wise conversion analytics")
    public ResponseEntity<List<LeadConversionEmployeeDTO>> employees(
        @RequestParam(required = false, defaultValue = "thisMonth") String filter,
        @RequestParam(required = false) String startDate,
        @RequestParam(required = false) String endDate,
        @RequestParam(required = false) String employeeId,
        @RequestParam(required = false) String status,
        @RequestParam(required = false, defaultValue = "conversion") String sortBy,
        @RequestParam(required = false, defaultValue = "desc") String sortDir
    ) {
        return ResponseEntity.ok(dashboardService.employees(filter, startDate, endDate, employeeId, status, sortBy, sortDir));
    }

    @GetMapping("/sources")
    @PreAuthorize("hasAuthority('dashboard.view')")
    @Operation(summary = "Lead source conversion analytics")
    public ResponseEntity<List<LeadConversionSourceDTO>> sources(
        @RequestParam(required = false, defaultValue = "thisMonth") String filter,
        @RequestParam(required = false) String startDate,
        @RequestParam(required = false) String endDate,
        @RequestParam(required = false) String employeeId,
        @RequestParam(required = false) String status
    ) {
        return ResponseEntity.ok(dashboardService.sources(filter, startDate, endDate, employeeId, status));
    }

    @GetMapping("/activities")
    @PreAuthorize("hasAuthority('dashboard.view')")
    @Operation(summary = "Recent lead conversion activities")
    public ResponseEntity<List<LeadConversionActivityDTO>> activities(
        @RequestParam(required = false, defaultValue = "thisMonth") String filter,
        @RequestParam(required = false) String startDate,
        @RequestParam(required = false) String endDate,
        @RequestParam(required = false) String employeeId,
        @RequestParam(required = false) String status,
        @RequestParam(required = false, defaultValue = "50") Integer limit
    ) {
        return ResponseEntity.ok(dashboardService.activities(filter, startDate, endDate, employeeId, status, limit));
    }

    @GetMapping("/trend")
    @PreAuthorize("hasAuthority('dashboard.view')")
    @Operation(summary = "Lead conversion trend line data")
    public ResponseEntity<List<LeadConversionTrendDTO>> trend(
        @RequestParam(required = false, defaultValue = "thisMonth") String filter,
        @RequestParam(required = false) String startDate,
        @RequestParam(required = false) String endDate,
        @RequestParam(required = false) String employeeId,
        @RequestParam(required = false) String status,
        @RequestParam(required = false, defaultValue = "day") String granularity
    ) {
        return ResponseEntity.ok(dashboardService.trend(filter, startDate, endDate, employeeId, status, granularity));
    }
}
