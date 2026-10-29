package com.nexacrm.controller;

import com.nexacrm.service.WorkspaceSettingsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/settings")
@RequiredArgsConstructor
@Tag(name = "Settings", description = "Workspace preferences and security settings")
public class SettingsController {

    private final WorkspaceSettingsService settingsService;

    @GetMapping
    @PreAuthorize("hasAuthority('settings.view')")
    @Operation(summary = "Get workspace settings")
    public ResponseEntity<Map<String, Object>> getWorkspaceSettings() {
        return ResponseEntity.ok(settingsService.getWorkspaceSettings());
    }

    @PutMapping
    @PreAuthorize("hasAuthority('settings.update')")
    @Operation(summary = "Update workspace settings")
    public ResponseEntity<Map<String, Object>> updateWorkspaceSettings(@RequestBody Map<String, Object> payload) {
        return ResponseEntity.ok(settingsService.saveWorkspaceSettings(payload));
    }
}
