package com.nexacrm.controller;

import com.nexacrm.dto.DealDTO;
import com.nexacrm.dto.PageResponse;
import com.nexacrm.service.DealService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/deals")
@RequiredArgsConstructor
@Tag(name = "Deals", description = "Sales pipeline & deal management")
public class DealController {

    private final DealService dealService;

    @GetMapping
    @PreAuthorize("hasAuthority('deals.read')")
    public ResponseEntity<PageResponse<DealDTO>> getDeals(
            @RequestParam(required = false) String stage,
            @RequestParam(required = false) String ownerId,
            @RequestParam(required = false) Long pipelineId,
            Pageable pageable) {
        return ResponseEntity.ok(dealService.findAll(stage, ownerId, pipelineId, pageable));
    }

    @GetMapping("/board")
    @PreAuthorize("hasAuthority('deals.read')")
    @Operation(summary = "Get all deals grouped by stage for Kanban board")
    public ResponseEntity<Map<String, List<DealDTO>>> getBoard(
            @RequestParam(defaultValue = "1") Long pipelineId) {
        return ResponseEntity.ok(dealService.getBoardView(pipelineId));
    }

    @GetMapping("/options")
    @PreAuthorize("hasAuthority('deals.read')")
    @Operation(summary = "Get lightweight deal options")
    public ResponseEntity<List<Map<String, Object>>> getDealOptions(
            @RequestParam(defaultValue = "50") int size) {
        return ResponseEntity.ok(dealService.findOptions(size));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('deals.read')")
    public ResponseEntity<DealDTO> getDealById(@PathVariable String id) {
        return ResponseEntity.ok(dealService.findById(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('deals.create')")
    public ResponseEntity<DealDTO> createDeal(@Valid @RequestBody DealDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(dealService.create(dto));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('deals.update')")
    public ResponseEntity<DealDTO> updateDeal(@PathVariable String id, @Valid @RequestBody DealDTO dto) {
        return ResponseEntity.ok(dealService.update(id, dto));
    }

    @PatchMapping("/{id}/stage")
    @PreAuthorize("hasAuthority('deals.move_stage')")
    @Operation(summary = "Move deal to a different stage")
    public ResponseEntity<DealDTO> moveStage(
            @PathVariable String id,
            @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(dealService.moveStage(id, body.get("stage")));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('deals.delete')")
    public ResponseEntity<Void> deleteDeal(@PathVariable String id) {
        dealService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/activities")
    @PreAuthorize("hasAuthority('deals.read')")
    public ResponseEntity<List<Map<String, Object>>> getActivities(@PathVariable String id) {
        return ResponseEntity.ok(dealService.getActivities(id));
    }

    @PostMapping("/{id}/activities")
    @PreAuthorize("hasAuthority('deals.update')")
    public ResponseEntity<Map<String, Object>> addActivity(
            @PathVariable String id,
            @RequestBody Map<String, Object> activity) {
        return ResponseEntity.status(HttpStatus.CREATED).body(dealService.addActivity(id, activity));
    }
}
