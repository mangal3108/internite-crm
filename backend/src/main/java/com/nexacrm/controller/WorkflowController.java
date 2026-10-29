package com.nexacrm.controller;

import com.nexacrm.dto.WorkflowDTO;
import com.nexacrm.service.WorkflowService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/workflows")
@RequiredArgsConstructor
@Tag(name = "Workflows", description = "Automation workflow endpoints")
public class WorkflowController {

    private final WorkflowService workflowService;

    @GetMapping
    @PreAuthorize("hasAuthority('automation.read')")
    @Operation(summary = "Get all workflows")
    public ResponseEntity<List<WorkflowDTO>> getAll() {
        return ResponseEntity.ok(workflowService.findAll());
    }

    @PostMapping
    @PreAuthorize("hasAuthority('automation.create')")
    @Operation(summary = "Create workflow")
    public ResponseEntity<WorkflowDTO> create(@Valid @RequestBody WorkflowDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(workflowService.create(dto));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('automation.update')")
    @Operation(summary = "Update workflow")
    public ResponseEntity<WorkflowDTO> update(@PathVariable String id, @RequestBody WorkflowDTO dto) {
        return ResponseEntity.ok(workflowService.update(id, dto));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('automation.delete')")
    @Operation(summary = "Delete workflow")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        workflowService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}/toggle")
    @PreAuthorize("hasAuthority('automation.manage')")
    @Operation(summary = "Toggle workflow active/paused status")
    public ResponseEntity<WorkflowDTO> toggle(@PathVariable String id) {
        return ResponseEntity.ok(workflowService.toggle(id));
    }

    @GetMapping("/{id}/logs")
    @PreAuthorize("hasAuthority('automation.read')")
    @Operation(summary = "Get workflow logs")
    public ResponseEntity<List<Map<String, Object>>> logs(@PathVariable String id) {
        return ResponseEntity.ok(workflowService.logs(id));
    }
}
