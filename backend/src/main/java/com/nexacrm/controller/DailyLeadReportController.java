package com.nexacrm.controller;

import com.nexacrm.service.DailyLeadReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/reports/daily-lead-activity")
@RequiredArgsConstructor
public class DailyLeadReportController {
    private final DailyLeadReportService reports;

    @GetMapping
    @PreAuthorize("hasAuthority('tasks.read') or hasAuthority('reports.read')")
    public ResponseEntity<DailyLeadReportService.Report> yesterday() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(reports.yesterday());
    }

    @GetMapping("/export")
    @PreAuthorize("hasAuthority('reports.export') and (hasAuthority('tasks.read') or hasAuthority('reports.read'))")
    public ResponseEntity<DailyLeadReportService.Report> export() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(reports.yesterday());
    }
}
