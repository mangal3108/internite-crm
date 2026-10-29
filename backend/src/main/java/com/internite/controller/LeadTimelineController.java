package com.internite.controller;

import com.internite.dto.LeadTimelineEventDTO;
import com.internite.dto.PageResponse;
import com.internite.service.LeadTimelineService;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/leads/{leadId}/timeline")
@RequiredArgsConstructor
public class LeadTimelineController {

    private final LeadTimelineService leadTimelineService;

    @GetMapping
    @PreAuthorize("hasAuthority('leads.read') or hasAuthority('tasks.read')")
    @Operation(summary = "Get paginated lead timeline")
    public PageResponse<LeadTimelineEventDTO> timeline(
            @PathVariable String leadId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return leadTimelineService.findByLeadId(leadId, page, size);
    }

    @PostMapping("/rebuild")
    @PreAuthorize("hasAuthority('leads.read') or hasAuthority('tasks.read')")
    @Operation(summary = "Rebuild timeline for a lead")
    public void rebuild(@PathVariable String leadId) {
        leadTimelineService.rebuildLead(leadId);
    }
}
