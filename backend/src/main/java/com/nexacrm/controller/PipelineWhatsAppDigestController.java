package com.nexacrm.controller;

import com.nexacrm.service.PipelineWhatsAppDigestService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/automation/pipeline-whatsapp-digest")
@RequiredArgsConstructor
@Tag(name = "Pipeline WhatsApp Digest", description = "Daily pipeline summary WhatsApp automation")
public class PipelineWhatsAppDigestController {

    private final PipelineWhatsAppDigestService digestService;

    @GetMapping
    @PreAuthorize("hasAuthority('automation.read')")
    @Operation(summary = "Get daily pipeline WhatsApp digest settings")
    public ResponseEntity<Map<String, Object>> get() {
        return ResponseEntity.ok(digestService.getCurrentConfiguration());
    }

    @PutMapping
    @PreAuthorize("hasAuthority('automation.manage')")
    @Operation(summary = "Save daily pipeline WhatsApp digest settings")
    public ResponseEntity<Map<String, Object>> save(@RequestBody Map<String, Object> request) {
        return ResponseEntity.ok(digestService.saveCurrentConfiguration(request));
    }

    @PostMapping("/send-now")
    @PreAuthorize("hasAuthority('automation.manage')")
    @Operation(summary = "Send the pipeline WhatsApp digest immediately")
    public ResponseEntity<Map<String, Object>> sendNow() {
        return ResponseEntity.ok(digestService.sendCurrentDigestNow());
    }

    @PostMapping("/send-pdf-now")
    @PreAuthorize("hasAuthority('automation.manage')")
    @Operation(summary = "Send the pipeline PDF immediately")
    public ResponseEntity<Map<String, Object>> sendPdfNow() {
        return ResponseEntity.ok(digestService.sendCurrentPipelinePdfNow());
    }
}
