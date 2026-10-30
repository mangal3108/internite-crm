package com.internite.controller;

import com.internite.service.AIService;
import com.internite.service.SarathiAgentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "AI Engine", description = "AI-powered CRM features via Mistral")
public class AIController {

    private final AIService aiService;
    private final SarathiAgentService sarathiAgentService;

    @PostMapping("/chat")
    @PreAuthorize("hasAuthority('ai.use')")
    @Operation(summary = "Chat with Sarathi, the read-only CRM agent that looks up your data to answer")
    public ResponseEntity<Map<String, Object>> chat(
            @RequestBody Map<String, List<Map<String, String>>> body) {
        List<Map<String, String>> messages = body.get("messages");
        try {
            SarathiAgentService.Reply reply = sarathiAgentService.chat(messages);
            Map<String, Object> result = new java.util.LinkedHashMap<>();
            result.put("response", reply.response());
            result.put("toolsUsed", reply.toolsUsed());
            if (reply.notice() != null) {
                result.put("notice", reply.notice());
            }
            return ResponseEntity.ok(result);
        } catch (Exception ex) {
            log.warn("Sarathi agent failed, using plain chat: {}", ex.getMessage());
            return ResponseEntity.ok(Map.of(
                "response", aiService.chat(messages),
                "toolsUsed", List.of(),
                "notice", "Sarathi could not read your CRM data for this answer: "
                    + (ex.getMessage() == null ? ex.getClass().getSimpleName() : ex.getMessage())));
        }
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
