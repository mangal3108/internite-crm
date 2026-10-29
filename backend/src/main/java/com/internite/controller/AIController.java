package com.internite.controller;

import com.internite.service.AIService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
@Tag(name = "AI Engine", description = "AI-powered CRM features via Mistral")
public class AIController {

    private final AIService aiService;

    @PostMapping("/chat")
    @PreAuthorize("hasAuthority('ai.use')")
    @Operation(summary = "Chat with Internite AI assistant")
    public ResponseEntity<Map<String, String>> chat(
            @RequestBody Map<String, List<Map<String, String>>> body) {
        String response = aiService.chat(body.get("messages"));
        return ResponseEntity.ok(Map.of("response", response));
    }

    @PostMapping("/score/{leadId}")
    @PreAuthorize("hasAuthority('ai.use')")
    @Operation(summary = "Score a lead using AI — returns Hot/Warm/Cold with reasoning")
    public ResponseEntity<Map<String, Object>> scoreLead(@PathVariable String leadId) {
        return ResponseEntity.ok(aiService.scoreLead(leadId));
    }

    @PostMapping("/predict/{dealId}")
    @PreAuthorize("hasAuthority('ai.use')")
    @Operation(summary = "Predict deal win probability using AI")
    public ResponseEntity<Map<String, Object>> predictDeal(@PathVariable String dealId) {
        return ResponseEntity.ok(aiService.predictDealOutcome(dealId));
    }

    @PostMapping("/generate-email")
    @PreAuthorize("hasAuthority('ai.use')")
    @Operation(summary = "Generate AI email draft")
    public ResponseEntity<Map<String, String>> generateEmail(@RequestBody Map<String, Object> params) {
        String email = aiService.generateEmail(params);
        return ResponseEntity.ok(Map.of("email", email));
    }

    @GetMapping("/insights")
    @PreAuthorize("hasAuthority('ai.use')")
    @Operation(summary = "Get AI-generated business insights for the dashboard")
    public ResponseEntity<List<Map<String, Object>>> getInsights() {
        return ResponseEntity.ok(aiService.generateInsights());
    }

    @GetMapping("/next-actions/{leadId}")
    @PreAuthorize("hasAuthority('ai.use')")
    @Operation(summary = "Get AI-suggested next best actions for a lead")
    public ResponseEntity<List<String>> getNextActions(@PathVariable String leadId) {
        return ResponseEntity.ok(aiService.suggestNextActions(leadId));
    }

    @PostMapping("/summarize/{entityType}/{entityId}")
    @PreAuthorize("hasAuthority('ai.use')")
    @Operation(summary = "Summarize a lead, deal, or customer using AI")
    public ResponseEntity<Map<String, String>> summarize(
            @PathVariable String entityType,
            @PathVariable String entityId) {
        String summary = aiService.summarizeEntity(entityType, entityId);
        return ResponseEntity.ok(Map.of("summary", summary));
    }
}
