package com.nexacrm.controller;

import com.nexacrm.service.WhatsAppActivityNotificationService;
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
@RequestMapping("/api/automation/whatsapp-activity-notifications")
@RequiredArgsConstructor
@Tag(name = "WhatsApp Activity Notifications", description = "Activity change + follow-up reminder WhatsApp notifications")
public class WhatsAppActivityNotificationController {

    private final WhatsAppActivityNotificationService service;

    @GetMapping
    @PreAuthorize("hasAuthority('automation.read')")
    @Operation(summary = "Get WhatsApp activity notification settings")
    public ResponseEntity<Map<String, Object>> get() {
        return ResponseEntity.ok(service.getConfig());
    }

    @PutMapping
    @PreAuthorize("hasAuthority('automation.manage')")
    @Operation(summary = "Save WhatsApp activity notification settings")
    public ResponseEntity<Map<String, Object>> save(@RequestBody Map<String, Object> request) {
        return ResponseEntity.ok(service.saveConfig(request));
    }
}
