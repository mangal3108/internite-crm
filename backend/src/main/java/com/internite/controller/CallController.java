package com.internite.controller;

import com.internite.service.CallAgentService;
import com.internite.service.LeadService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/calls")
@RequiredArgsConstructor
@Tag(name = "Calls", description = "AI calling agent endpoints")
public class CallController {

    private final LeadService leadService;
    private final CallAgentService callAgentService;

    @GetMapping("/options")
    @PreAuthorize("hasAuthority('leads.read') or hasAuthority('communications.send')")
    @Operation(summary = "Get available call setups and caller phone numbers")
    public ResponseEntity<Map<String, Object>> getCallOptions() {
        return ResponseEntity.ok(callAgentService.getCallOptions());
    }

    @GetMapping("/recent")
    @PreAuthorize("hasAuthority('leads.read') or hasAuthority('communications.read') or hasAuthority('communications.send')")
    @Operation(summary = "Get recent call records across all leads and dialer calls")
    public ResponseEntity<List<Map<String, Object>>> getRecentCalls() {
        return ResponseEntity.ok(callAgentService.getRecentCalls());
    }

    @PostMapping("/trigger/{leadId}")
    @PreAuthorize("hasAuthority('communications.send')")
    @Operation(summary = "Trigger outbound AI call for a lead")
    public ResponseEntity<Map<String, Object>> triggerLeadCall(
        @PathVariable String leadId,
        @RequestBody(required = false) Map<String, String> body
    ) {
        String script = body != null ? body.get("script") : null;
        String setup = body != null ? (body.get("setup") != null ? body.get("setup") : body.get("provider")) : null;
        String fromNumber = body != null ? body.get("fromNumber") : null;
        String toNumber = body != null ? body.get("toNumber") : null;
        return ResponseEntity.ok(leadService.callLeadNow(leadId, script, setup, fromNumber, toNumber));
    }

    @PostMapping("/webhook")
    @Operation(summary = "Receive voice-call provider webhook callbacks")
    public ResponseEntity<Map<String, Object>> processWebhook(
        @RequestBody Map<String, Object> payload,
        @RequestHeader(value = "X-Call-Agent-Secret", required = false) String secretHeader,
        @RequestHeader(value = "Authorization", required = false) String authorizationHeader
    ) {
        boolean authorized = callAgentService.isWebhookAuthorized(secretHeader, authorizationHeader, payload);
        if (!authorized) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("ok", false, "error", "Invalid webhook secret"));
        }
        return ResponseEntity.ok(callAgentService.processWebhook(payload));
    }

    @GetMapping("/{leadId}")
    @PreAuthorize("hasAuthority('leads.read')")
    @Operation(summary = "Get AI call history for one lead")
    public ResponseEntity<List<Map<String, Object>>> getLeadCalls(@PathVariable String leadId) {
        return ResponseEntity.ok(callAgentService.getLeadCallHistory(leadId));
    }

    @GetMapping("/{leadId}/intelligence")
    @PreAuthorize("hasAuthority('leads.read')")
    @Operation(summary = "Get AI call intelligence for one lead")
    public ResponseEntity<Map<String, Object>> getLeadCallIntelligence(@PathVariable String leadId) {
        return ResponseEntity.ok(callAgentService.getLeadCallIntelligence(leadId));
    }

    @PostMapping("/retry/{callId}")
    @PreAuthorize("hasAuthority('communications.send')")
    @Operation(summary = "Retry one previous call by call log id")
    public ResponseEntity<Map<String, Object>> retryCall(
        @PathVariable String callId,
        @RequestBody(required = false) Map<String, String> body
    ) {
        String setup = body != null ? (body.get("setup") != null ? body.get("setup") : body.get("provider")) : null;
        String fromNumber = body != null ? body.get("fromNumber") : null;
        return ResponseEntity.ok(callAgentService.retryCall(callId, setup, fromNumber));
    }

    @PostMapping("/direct")
    @PreAuthorize("hasAuthority('communications.send')")
    @Operation(summary = "Initiate direct 2-way call via Twilio line")
    public ResponseEntity<Map<String, Object>> makeDirectCall(@RequestBody Map<String, String> body) {
        String toNumber = body != null ? body.get("toNumber") : null;
        String fromNumber = body != null ? body.get("fromNumber") : null;
        String agentNumber = body != null ? body.get("agentNumber") : null;
        String leadId = body != null ? body.get("leadId") : null;
        String leadName = body != null ? body.get("leadName") : null;
        return ResponseEntity.ok(callAgentService.makeDirectCall(toNumber, fromNumber, agentNumber, leadId, leadName));
    }

    @PostMapping("/ai")
    @PreAuthorize("hasAuthority('communications.send')")
    @Operation(summary = "Place an AI voice call from the dialer to any number")
    public ResponseEntity<Map<String, Object>> makeAiDialerCall(@RequestBody Map<String, String> body) {
        return ResponseEntity.ok(callAgentService.makeAiDialerCall(
            body.get("toNumber"),
            body.get("fromNumber"),
            body.get("script"),
            body.get("setup")
        ));
    }

    @PostMapping("/voice-token")
    @PreAuthorize("hasAuthority('communications.send')")
    @Operation(summary = "Issue a Twilio Voice SDK access token for in-browser calling")
    public ResponseEntity<Map<String, Object>> voiceToken() {
        return ResponseEntity.ok(callAgentService.createBrowserVoiceToken());
    }

    @PostMapping("/browser-log")
    @PreAuthorize("hasAuthority('communications.send')")
    @Operation(summary = "Record a browser softphone call (on connect and on hang-up)")
    public ResponseEntity<Map<String, Object>> logBrowserCall(@RequestBody Map<String, String> body) {
        return ResponseEntity.ok(callAgentService.logBrowserCall(body));
    }

    @PostMapping(value = "/twilio/voice", consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE, produces = MediaType.APPLICATION_XML_VALUE)
    @Operation(summary = "TwiML App Voice URL for laptop calls: dials the customer directly from the browser")
    public ResponseEntity<String> twilioBrowserVoice(@RequestParam Map<String, String> params) {
        return ResponseEntity.ok(callAgentService.buildBrowserDialTwiml(params));
    }

    @PostMapping(value = "/twilio/status", consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE)
    @Operation(summary = "Receive Twilio call/recording status callbacks (signed by Twilio)")
    public ResponseEntity<Void> twilioStatusCallback(
        @RequestParam Map<String, String> params,
        @RequestHeader(value = "X-Twilio-Signature", required = false) String signature
    ) {
        String result = callAgentService.processTwilioStatusCallback(params, signature);
        return "forbidden".equals(result)
            ? ResponseEntity.status(HttpStatus.FORBIDDEN).build()
            : ResponseEntity.noContent().build();
    }

    @PostMapping("/hangup/{callSid}")
    @PreAuthorize("hasAuthority('communications.send')")
    @Operation(summary = "Terminate an active Twilio call")
    public ResponseEntity<Map<String, Object>> hangupCall(@PathVariable String callSid) {
        return ResponseEntity.ok(callAgentService.hangupCall(callSid));
    }

    @GetMapping("/status/{callSid}")
    @PreAuthorize("hasAuthority('communications.send') or hasAuthority('leads.read')")
    @Operation(summary = "Get live Twilio call status")
    public ResponseEntity<Map<String, Object>> getCallStatus(@PathVariable String callSid) {
        return ResponseEntity.ok(callAgentService.getCallStatus(callSid));
    }
}
