package com.internite.service;

import com.internite.model.Lead;
import com.internite.repository.LeadRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import com.internite.security.TenantContext;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.time.LocalDateTime;
import java.util.Locale;

/**
 * AI Service — integrates with OpenAI for lead scoring, deal prediction,
 * email generation, CRM chat, insights, and next-best-action suggestions.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AIService {

    private Long tenantId() {
        return TenantContext.currentTenantId();
    }

    @Value("${openai.api.key:}")
    private String openaiApiKey;

    @Value("${openai.model:gpt-4o-mini}")
    private String model;

    @Value("${openai.max-tokens:1500}")
    private int defaultMaxTokens;

    private final LeadRepository leadRepository;
    private final IntegrationService integrationService;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    // ── Chat ──────────────────────────────────────────────────────

    public String chat(List<Map<String, String>> messages) {
        List<Map<String, String>> safeMessages = messages == null ? Collections.emptyList() : messages;
        log.info("AI chat request with {} messages", safeMessages.size());

        List<Map<String, String>> payloadMessages = new ArrayList<>();
        payloadMessages.add(Map.of(
            "role", "system",
            "content", "You are Internite AI, an expert CRM copilot. Be concise, practical, and actionable."
        ));
        payloadMessages.addAll(safeMessages);

        try {
            return callOpenAIText(payloadMessages, Math.max(defaultMaxTokens, 1200), 0.6);
        } catch (Exception ex) {
            log.warn("Falling back to local AI chat response: {}", ex.getMessage());
            return buildFallbackChatResponse(safeMessages);
        }
    }

    // ── Lead Scoring ──────────────────────────────────────────────

    public Map<String, Object> scoreLead(String leadId) {
        Optional<Lead> leadOpt = leadRepository.findByIdAndTenantIdAndDeletedFalse(leadId, tenantId());
        if (leadOpt.isEmpty()) {
            return Map.of("error", "Lead not found");
        }
        Lead lead = leadOpt.get();

        String prompt = """
            Score this CRM lead and return strict JSON:
            {
              "scoreLabel": "HOT|WARM|COLD",
              "scoreValue": <integer 0-99>,
              "reasoning": "<short reason>",
              "nextAction": "<single clear action>"
            }

            Scoring rules for expected close timeline (if provided):
            - DAYS_1_3 (1-3 days) = HOT, scoreValue 85-95
            - DAYS_7_10 (7-10 days) = WARM, scoreValue 55-75
            - DAYS_10_15_PLUS (10-15+ days) = COLD, scoreValue 20-40

            Lead:
            %s
            """.formatted(buildLeadPromptData(lead));

        String scoreLabel;
        int scoreValue;
        String reasoning;
        String nextAction;
        try {
            Map<String, Object> ai = callOpenAIJson(
                "You are a CRM lead scoring analyst. Output only valid JSON.",
                prompt,
                500,
                0.2
            );
            scoreLabel = requireEnum(ai, "scoreLabel", List.of("HOT", "WARM", "COLD"));
            scoreValue = requireInt(ai, "scoreValue", 0, 99);
            reasoning = requireText(ai, "reasoning");
            nextAction = requireText(ai, "nextAction");
        } catch (Exception ex) {
            log.warn("Falling back to local lead scoring for lead {}: {}", leadId, ex.getMessage());
            Map<String, Object> fallback = buildFallbackLeadScore(lead);
            scoreLabel = String.valueOf(fallback.get("score"));
            scoreValue = ((Number) fallback.get("scoreValue")).intValue();
            reasoning = String.valueOf(fallback.get("reasoning"));
            nextAction = String.valueOf(fallback.get("nextAction"));
        }

        // Persist back to DB
        lead.setAiScoreValue(scoreValue);
        lead.setAiNextAction(nextAction);
        lead.setScore(
            switch (scoreLabel) {
                case "HOT" -> Lead.LeadScore.HOT;
                case "WARM" -> Lead.LeadScore.WARM;
                default -> Lead.LeadScore.COLD;
            }
        );
        leadRepository.save(lead);

        return Map.of(
            "leadId", leadId,
            "score", scoreLabel,
            "scoreValue", scoreValue,
            "reasoning", reasoning,
            "nextAction", nextAction
        );
    }

    @Async
    public void scoreLeadAsync(String leadId) {
        try {
            scoreLead(leadId);
        } catch (Exception e) {
            log.error("Async lead scoring failed for id={}: {}", leadId, e.getMessage());
        }
    }

    // ── Deal Prediction ───────────────────────────────────────────

    public Map<String, Object> predictDealOutcome(String dealId) {
        String prompt = """
            Predict win probability for this CRM opportunity and return strict JSON:
            {
              "winProbability": <integer 0-100>,
              "confidence": "LOW|MEDIUM|HIGH",
              "keyFactors": ["..."],
              "riskFactors": ["..."],
              "recommendation": "..."
            }

            DealId: %s
            """.formatted(dealId);

        try {
            Map<String, Object> ai = callOpenAIJson(
                "You are a B2B sales forecasting assistant. Output only valid JSON.",
                prompt,
                700,
                0.3
            );

            return Map.of(
                "dealId", dealId,
                "winProbability", requireInt(ai, "winProbability", 0, 100),
                "confidence", requireEnum(ai, "confidence", List.of("LOW", "MEDIUM", "HIGH")),
                "keyFactors", requireStringList(ai, "keyFactors"),
                "riskFactors", requireStringList(ai, "riskFactors"),
                "recommendation", requireText(ai, "recommendation")
            );
        } catch (Exception ex) {
            log.warn("Falling back to local deal prediction for deal {}: {}", dealId, ex.getMessage());
            return Map.of(
                "dealId", dealId,
                "winProbability", 55,
                "confidence", "MEDIUM",
                "keyFactors", List.of("Live AI model unavailable", "Using conservative default forecast"),
                "riskFactors", List.of("No model response available"),
                "recommendation", "Review the opportunity manually and keep the next customer touch active."
            );
        }
    }

    // ── Email Generation ──────────────────────────────────────────

    public String generateEmail(Map<String, Object> params) {
        String leadName    = (String) params.getOrDefault("leadName", "");
        String company     = (String) params.getOrDefault("company", "");
        String emailType   = (String) params.getOrDefault("emailType", "Follow-up");
        String tone        = (String) params.getOrDefault("tone", "Professional");
        String keyPoints   = (String) params.getOrDefault("keyPoints", "");

        String userPrompt = """
            Write a complete sales email draft.
            Constraints:
            - Include a clear subject line as first line prefixed with "Subject:".
            - Keep the tone: %s.
            - Email type: %s.
            - Personalize for contact: %s, company: %s.
            - Use this context where relevant: %s.
            - Keep it concise, persuasive, and natural.
            - Do not include markdown.
            """.formatted(
                tone,
                emailType,
                leadName.isBlank() ? "there" : leadName,
                company.isBlank() ? "their organization" : company,
                keyPoints.isBlank() ? "No extra context" : keyPoints
            );

        try {
            return callOpenAIText(
                List.of(
                    Map.of("role", "system", "content", "You are an expert B2B sales copywriter."),
                    Map.of("role", "user", "content", userPrompt)
                ),
                900,
                0.8
            );
        } catch (Exception ex) {
            log.warn("Falling back to local email generation: {}", ex.getMessage());
            return buildFallbackEmail(leadName, company, emailType, tone, keyPoints);
        }
    }

    // ── Insights ─────────────────────────────────────────────────

    public List<Map<String, Object>> generateLocalInsights() {
        return buildFallbackInsights();
    }

    public List<Map<String, Object>> generateInsights() {
        try {
            String prompt = """
                Return strict JSON array with exactly 4 CRM insights.
                Each item format:
                {
                  "id": <integer>,
                  "type": "prediction|warning|opportunity|insight",
                  "title": "...",
                  "body": "...",
                  "action": "..."
                }
                """;

            String raw = callOpenAIText(
                List.of(
                    Map.of("role", "system", "content", "You are a CRM analytics assistant. Output valid JSON only."),
                    Map.of("role", "user", "content", prompt)
                ),
                900,
                0.5
            );
            String jsonArray = extractJsonArray(raw);
            List<Map<String, Object>> insights = objectMapper.readValue(jsonArray, new TypeReference<List<Map<String, Object>>>() {});
            validateInsights(insights);
            return insights;
        } catch (Exception e) {
            log.warn("Falling back to live CRM insights: {}", e.getMessage());
            return buildFallbackInsights();
        }
    }

    // ── Next Actions ──────────────────────────────────────────────

    public List<String> suggestNextActions(String leadId) {
        try {
            String prompt = """
                Suggest 4 next best sales actions for lead id %s.
                Return strict JSON array of strings only.
                """.formatted(leadId);

            String raw = callOpenAIText(
                List.of(
                    Map.of("role", "system", "content", "You are a CRM sales coach. Output valid JSON only."),
                    Map.of("role", "user", "content", prompt)
                ),
                400,
                0.4
            );
            String jsonArray = extractJsonArray(raw);
            List<String> actions = objectMapper.readValue(jsonArray, new TypeReference<List<String>>() {});
            validateActions(actions);
            return actions;
        } catch (Exception e) {
            log.warn("Falling back to local next-actions suggestions for lead {}: {}", leadId, e.getMessage());
            return buildFallbackActions(leadId);
        }
    }

    // ── Summarize ─────────────────────────────────────────────────

    public String summarizeEntity(String entityType, String entityId) {
        String prompt = """
            Summarize this CRM entity in 3-5 sentences with actionable guidance.
            Entity type: %s
            Entity id: %s
            """.formatted(entityType, entityId);

        try {
            return callOpenAIText(
                List.of(
                    Map.of("role", "system", "content", "You are a CRM analyst. Be specific and concise."),
                    Map.of("role", "user", "content", prompt)
                ),
                500,
                0.4
            );
        } catch (Exception ex) {
            log.warn("Falling back to local entity summary for {} {}: {}", entityType, entityId, ex.getMessage());
            return "Summary unavailable from the AI model right now. Entity type: %s, entity id: %s. Please review the record directly in CRM.".formatted(entityType, entityId);
        }
    }

    public Map<String, Object> analyzeCallIntelligence(Lead lead, List<Map<String, Object>> calls) {
        try {
            Map<String, Object> ai = callOpenAIJson(
                "You are a CRM voice-call intelligence analyst. Evaluate call transcripts and determine lead quality from the conversation history.",
                buildCallIntelligencePrompt(lead, calls),
                1200,
                0.2
            );

            String leadVerdict = requireEnumOrDefault(ai, "leadVerdict", List.of("GENUINE", "NOT_GENUINE", "UNCERTAIN"), "UNCERTAIN");
            String suggestedLeadStatus = requireEnumOrDefault(
                ai,
                "suggestedLeadStatus",
                List.of("NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"),
                lead.getStatus() != null ? lead.getStatus().name() : "NEW"
            );
            int confidence = requireIntOrDefault(ai, "confidence", 0, 100, 0);
            String summary = optionalText(ai, "summary", buildFallbackCallReview(calls, lead));
            String reasoning = optionalText(ai, "reasoning", "Model did not provide reasoning; review the transcript and call history.");
            List<String> positiveSignals = optionalStringList(ai, "positiveSignals");
            List<String> riskSignals = optionalStringList(ai, "riskSignals");
            String nextBestAction = optionalText(ai, "nextBestAction", "Review the most recent call transcript and schedule a follow-up.");

            return Map.of(
                "leadVerdict", leadVerdict,
                "suggestedLeadStatus", suggestedLeadStatus,
                "confidence", confidence,
                "summary", summary,
                "reasoning", reasoning,
                "positiveSignals", positiveSignals,
                "riskSignals", riskSignals,
                "nextBestAction", nextBestAction
            );
        } catch (Exception e) {
            log.warn("Falling back to local call intelligence for lead {}: {}", lead != null ? lead.getId() : "unknown", e.getMessage());
            return buildFallbackCallIntelligence(lead, calls);
        }
    }

    private String buildCallIntelligencePrompt(Lead lead, List<Map<String, Object>> calls) {
        Map<String, Object> leadSnapshot = new LinkedHashMap<>();
        leadSnapshot.put("id", lead.getId());
        leadSnapshot.put("name", lead.getName());
        leadSnapshot.put("email", lead.getEmail());
        leadSnapshot.put("phone", lead.getPhone());
        leadSnapshot.put("company", lead.getCompany());
        leadSnapshot.put("source", lead.getSource() != null ? lead.getSource().name() : "");
        leadSnapshot.put("status", lead.getStatus() != null ? lead.getStatus().name() : "");
        leadSnapshot.put("score", lead.getScore() != null ? lead.getScore().name() : "");
        leadSnapshot.put("aiScoreValue", lead.getAiScoreValue());
        leadSnapshot.put("aiNextAction", lead.getAiNextAction());
        leadSnapshot.put("lastContactedAt", lead.getLastContactedAt());

        List<Map<String, Object>> callSummaries = new ArrayList<>();
        for (Map<String, Object> call : calls == null ? Collections.<Map<String, Object>>emptyList() : calls) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", call.getOrDefault("id", ""));
            row.put("externalId", call.getOrDefault("externalId", ""));
            row.put("status", call.getOrDefault("status", ""));
            row.put("outcome", call.getOrDefault("outcome", ""));
            row.put("summary", call.getOrDefault("summary", ""));
            row.put("transcript", call.getOrDefault("transcript", ""));
            row.put("recordingUrl", call.getOrDefault("recordingUrl", ""));
            row.put("createdAt", call.getOrDefault("createdAt", ""));
            row.put("provider", call.getOrDefault("provider", ""));
            callSummaries.add(row);
        }

        return """
            Analyze these Bolna call records and decide whether this is a genuine sales lead.
            Return strict JSON only with the following schema:
            {
              "leadVerdict": "GENUINE|NOT_GENUINE|UNCERTAIN",
              "suggestedLeadStatus": "NEW|CONTACTED|QUALIFIED|PROPOSAL|NEGOTIATION|WON|LOST",
              "confidence": <integer 0-100>,
              "summary": "<3-5 sentence executive summary>",
              "reasoning": "<brief explanation>",
              "positiveSignals": ["..."],
              "riskSignals": ["..."],
              "nextBestAction": "<single clear action>"
            }
            Never omit any key. If you have no evidence for a list field, return [].
            Base the review on the transcript, objections, buying intent, and the call outcome.
            Use the full conversation history, not only the newest call.
            Prioritize transcript-bearing or connected calls over later unanswered attempts.
            A missing transcript or recording is an evidence gap, not proof that the lead is not genuine.
            If an earlier call shows real interest, callbacks, or intent, do not force NOT_GENUINE from a later no-answer attempt alone.

            Lead snapshot:
            %s

            Call history:
            %s
            """.formatted(toJson(leadSnapshot), toJson(callSummaries));
    }

    private List<Map<String, Object>> buildFallbackInsights() {
        Long tid = tenantId();
        long total = leadRepository.countByTenantIdAndDeletedFalse(tid);
        long qualified = leadRepository.countByTenantIdAndDeletedFalseAndStatus(tid, Lead.LeadStatus.QUALIFIED)
            + leadRepository.countByTenantIdAndDeletedFalseAndStatus(tid, Lead.LeadStatus.PROPOSAL)
            + leadRepository.countByTenantIdAndDeletedFalseAndStatus(tid, Lead.LeadStatus.NEGOTIATION);
        long won = leadRepository.countByTenantIdAndDeletedFalseAndStatus(tid, Lead.LeadStatus.WON);
        // ponytail: stale count & top source still need lead data but only fields: source, lastContactedAt, createdAt
        List<Lead> leads = leadRepository.findByTenantIdAndDeletedFalse(tid);
        long stale = leads.stream().filter(this::isStaleLead).count();

        Map<String, Long> sourceCounts = new LinkedHashMap<>();
        for (Lead lead : leads) {
            String source = lead.getSource() != null ? lead.getSource().name().toLowerCase(Locale.ROOT) : "unknown";
            sourceCounts.put(source, sourceCounts.getOrDefault(source, 0L) + 1);
        }
        Map.Entry<String, Long> topSource = sourceCounts.entrySet().stream()
            .max(Map.Entry.comparingByValue())
            .orElse(Map.entry("unknown", 0L));

        List<Map<String, Object>> insights = new ArrayList<>();
        insights.add(Map.of(
            "id", 1,
            "type", "prediction",
            "title", "Qualified pipeline momentum",
            "body", qualified + " of " + total + " leads are already qualified or beyond, and " + won + " have closed won.",
            "action", "View Profile"
        ));
        insights.add(Map.of(
            "id", 2,
            "type", "warning",
            "title", "Stale follow-ups need attention",
            "body", stale + " leads have not been touched recently and are at risk of cooling off.",
            "action", "Schedule Call"
        ));
        insights.add(Map.of(
            "id", 3,
            "type", "opportunity",
            "title", "Strongest lead source",
            "body", "Your most active source is " + topSource.getKey() + " with " + topSource.getValue() + " live leads.",
            "action", "Plan Campaign"
        ));
        insights.add(Map.of(
            "id", 4,
            "type", "insight",
            "title", "Re-engagement opportunity",
            "body", "Many active prospects still need a follow-up touch. A quick re-engagement sequence can recover momentum.",
            "action", "Send Follow-up"
        ));
        return insights;
    }

    private List<String> buildFallbackActions(String leadId) {
        Optional<Lead> leadOpt = leadRepository.findByIdAndTenantIdAndDeletedFalse(leadId, tenantId());
        Lead lead = leadOpt.orElse(null);
        if (lead == null) {
            return List.of(
                "Review the lead record and confirm the next contact channel.",
                "Check recent activity for any missed responses.",
                "Assign a follow-up owner before reaching out again.",
                "Log the lead status update after the next touch."
            );
        }

        String leadName = lead.getName() != null && !lead.getName().isBlank() ? lead.getName().trim() : "this lead";
        String status = lead.getStatus() != null ? lead.getStatus().name().toLowerCase(Locale.ROOT) : "new";
        return List.of(
            "Call " + leadName + " and confirm the current buying timeline.",
            "Send a short follow-up referencing the current " + status + " stage.",
            "Capture objections and update the lead status after the conversation.",
            "Move the opportunity forward once intent is confirmed."
        );
    }

    private Map<String, Object> buildFallbackCallIntelligence(Lead lead, List<Map<String, Object>> calls) {
        List<Map<String, Object>> safeCalls = calls == null ? List.of() : calls;
        Map<String, Object> latest = safeCalls.isEmpty() ? Map.of() : safeCalls.get(0);
        String transcript = trim(stringValue(latest.get("transcript")));
        String summary = trim(stringValue(latest.get("summary")));
        String outcome = trim(stringValue(latest.get("outcome")));
        String status = trim(stringValue(latest.get("status")));

        List<String> positiveSignals = new ArrayList<>();
        List<String> riskSignals = new ArrayList<>();
        String verdict = "UNCERTAIN";
        int confidence = 25;
        String nextBestAction = "Review the latest call and schedule a follow-up.";

        boolean hasConversation = !transcript.isBlank() || containsAny(summary, List.of("demo", "pricing", "callback", "follow up", "follow-up", "budget", "interested"));
        boolean connected = containsAny(outcome, List.of("connected", "answered", "completed", "success")) || containsAny(status, List.of("connected", "completed"));
        boolean noAnswerOnly = !hasConversation && safeCalls.stream().allMatch(call -> containsAny(stringValue(call.get("outcome")), List.of("no_answer", "no answer", "failed", "voicemail", "busy")));

        if (hasConversation || connected) {
            verdict = "GENUINE";
            confidence = transcript.isBlank() ? 72 : 88;
            nextBestAction = "Follow up with a tailored proposal and confirm the next step.";
            positiveSignals.add(transcript.isBlank() ? "Connected conversation captured" : "Transcript shows active conversation");
            if (containsAny(transcript, List.of("pricing", "budget"))) {
                positiveSignals.add("Discussed pricing or budget");
                nextBestAction = "Send pricing details and propose the next meeting.";
            }
            if (containsAny(transcript, List.of("demo", "meeting", "callback", "follow up", "follow-up"))) {
                positiveSignals.add("Requested a demo or callback");
            }
            if (lead != null && lead.getStatus() != null && (lead.getStatus() == Lead.LeadStatus.QUALIFIED || lead.getStatus() == Lead.LeadStatus.PROPOSAL || lead.getStatus() == Lead.LeadStatus.NEGOTIATION)) {
                nextBestAction = "Move the deal forward in the pipeline and follow up on the agreed next step.";
            }
        } else if (noAnswerOnly) {
            verdict = "NOT_GENUINE";
            confidence = 78;
            riskSignals.add("Only no-answer or failed call attempts were captured");
            riskSignals.add("No transcript or connected conversation is available");
            nextBestAction = "Retry the call once more or switch to another contact channel.";
        } else {
            riskSignals.add("Call data is incomplete");
            riskSignals.add("No strong buying intent captured yet");
        }

        String fallbackStatus = lead != null && lead.getStatus() != null ? lead.getStatus().name() : "NEW";
        if ("GENUINE".equals(verdict)) {
            fallbackStatus = switch (lead != null && lead.getStatus() != null ? lead.getStatus() : Lead.LeadStatus.NEW) {
                case NEW, CONTACTED -> "QUALIFIED";
                case QUALIFIED -> "PROPOSAL";
                case PROPOSAL -> "NEGOTIATION";
                case NEGOTIATION -> "NEGOTIATION";
                case WON, LOST -> lead.getStatus().name();
            };
        } else if ("NOT_GENUINE".equals(verdict) && lead != null && lead.getStatus() != Lead.LeadStatus.WON) {
            fallbackStatus = "LOST";
        }

        String callReviewSummary = buildFallbackCallReview(safeCalls, lead);
        String summaryText = !summary.isBlank()
            ? summary
            : (hasConversation
                ? "A connected conversation was captured, but the model output was unavailable. " + callReviewSummary
                : callReviewSummary);

        return Map.of(
            "leadVerdict", verdict,
            "suggestedLeadStatus", fallbackStatus,
            "confidence", confidence,
            "summary", summaryText,
            "reasoning", hasConversation
                ? "The fallback analyzer found conversation-level evidence in the available Bolna call data."
                : "The fallback analyzer only found limited call evidence, so it kept the verdict conservative.",
            "positiveSignals", positiveSignals,
            "riskSignals", riskSignals,
            "nextBestAction", nextBestAction
        );
    }

    private Map<String, Object> buildFallbackLeadScore(Lead lead) {
        if (lead.getExpectedCloseTimeline() != null) {
            return switch (lead.getExpectedCloseTimeline()) {
                case DAYS_1_3 -> Map.of(
                    "score", "HOT", "scoreValue", 90,
                    "reasoning", "Lead expects to close within 1-3 days — high urgency.",
                    "nextAction", "Schedule a closing call immediately.");
                case DAYS_7_10 -> Map.of(
                    "score", "WARM", "scoreValue", 65,
                    "reasoning", "Lead expects to close within 7-10 days — moderate urgency.",
                    "nextAction", "Send a follow-up proposal and schedule a check-in.");
                case DAYS_10_15_PLUS -> Map.of(
                    "score", "COLD", "scoreValue", 30,
                    "reasoning", "Lead expects to close in 10-15+ days — low urgency.",
                    "nextAction", "Nurture the lead and check back next week.");
            };
        }

        Lead.LeadScore score = lead.getScore() != null ? lead.getScore() : Lead.LeadScore.COLD;
        Lead.LeadStatus status = lead.getStatus() != null ? lead.getStatus() : Lead.LeadStatus.NEW;

        String scoreLabel;
        int scoreValue;
        String reasoning;
        String nextAction;

        switch (status) {
            case WON -> {
                scoreLabel = "HOT";
                scoreValue = 95;
                reasoning = "The lead is already marked won, so it is the strongest possible opportunity.";
                nextAction = "Keep the relationship warm and look for expansion or referral opportunities.";
            }
            case NEGOTIATION, PROPOSAL, QUALIFIED -> {
                scoreLabel = "HOT";
                scoreValue = 82;
                reasoning = "The lead is already in the sales pipeline and is ready for active follow-up.";
                nextAction = "Move the opportunity forward with the agreed next step.";
            }
            case CONTACTED -> {
                scoreLabel = "WARM";
                scoreValue = lead.getAiScoreValue() != null ? Math.max(55, Math.min(79, lead.getAiScoreValue())) : 68;
                reasoning = "The lead has been contacted and is showing some engagement.";
                nextAction = "Send a concise follow-up and confirm buying intent.";
            }
            case LOST -> {
                scoreLabel = "COLD";
                scoreValue = 10;
                reasoning = "The lead is already marked lost.";
                nextAction = "Do not prioritize unless the customer re-engages.";
            }
            default -> {
                if (lead.getAiScoreValue() != null && lead.getAiScoreValue() >= 80) {
                    scoreLabel = "HOT";
                    scoreValue = lead.getAiScoreValue();
                    reasoning = "Fallback heuristic used the lead's existing AI score.";
                    nextAction = "Call the lead and confirm the next buying step.";
                } else if (score == Lead.LeadScore.HOT) {
                    scoreLabel = "HOT";
                    scoreValue = 85;
                    reasoning = "The lead was already marked hot in CRM.";
                    nextAction = "Schedule a quick follow-up while the lead is still warm.";
                } else if (score == Lead.LeadScore.WARM) {
                    scoreLabel = "WARM";
                    scoreValue = 65;
                    reasoning = "The lead has moderate engagement and needs follow-up.";
                    nextAction = "Send a short follow-up and qualify the opportunity.";
                } else {
                    scoreLabel = "COLD";
                    scoreValue = 35;
                    reasoning = "The lead has limited evidence of high intent in CRM.";
                    nextAction = "Nurture the lead and watch for a stronger signal.";
                }
            }
        }

        return Map.of(
            "score", scoreLabel,
            "scoreValue", scoreValue,
            "reasoning", reasoning,
            "nextAction", nextAction
        );
    }

    private String buildFallbackEmail(String leadName, String company, String emailType, String tone, String keyPoints) {
        String subject = switch (emailType.toLowerCase(Locale.ROOT)) {
            case "proposal" -> "Subject: Proposal for " + (company.isBlank() ? "your team" : company);
            case "meeting request" -> "Subject: Quick meeting request";
            case "introduction" -> "Subject: Nice to connect";
            case "re-engagement" -> "Subject: Let’s reconnect";
            default -> "Subject: Following up on your CRM enquiry";
        };

        String body = """
            Hi %s,

            Thanks for reaching out. I wanted to follow up and keep things moving in the right direction for %s.

            %s

            %s

            Best regards,
            Internite CRM Team
            """.formatted(
                leadName.isBlank() ? "there" : leadName,
                company.isBlank() ? "your business" : company,
                keyPoints.isBlank() ? "I’d be happy to share the next steps, pricing, or a demo based on what matters most to you." : keyPoints,
                tone.isBlank() ? "" : "Tone: " + tone
            ).trim();

        return subject + "\n\n" + body;
    }

    private String buildFallbackChatResponse(List<Map<String, String>> messages) {
        String latestUserMessage = "";
        for (int i = messages.size() - 1; i >= 0; i--) {
            Map<String, String> message = messages.get(i);
            if (!"user".equalsIgnoreCase(String.valueOf(message.get("role")))) {
                continue;
            }
            latestUserMessage = trim(String.valueOf(message.getOrDefault("content", "")));
            if (!latestUserMessage.isBlank()) {
                break;
            }
        }

        String normalized = latestUserMessage.toLowerCase(Locale.ROOT);
        if (normalized.contains("prioritize") || normalized.contains("today")) {
            List<Lead> leads = leadRepository.findByTenantIdAndDeletedFalse(tenantId());
            List<Lead> priority = leads.stream()
                .filter(lead -> lead.getStatus() != Lead.LeadStatus.WON && lead.getStatus() != Lead.LeadStatus.LOST)
                .sorted((left, right) -> {
                    int leftRank = leadPriorityRank(left);
                    int rightRank = leadPriorityRank(right);
                    if (leftRank != rightRank) {
                        return Integer.compare(leftRank, rightRank);
                    }
                    int leftScore = left.getAiScoreValue() != null ? left.getAiScoreValue() : 0;
                    int rightScore = right.getAiScoreValue() != null ? right.getAiScoreValue() : 0;
                    return Integer.compare(rightScore, leftScore);
                })
                .limit(3)
                .toList();

            if (priority.isEmpty()) {
                return "I couldn’t find any active leads to prioritize right now.";
            }

            StringBuilder response = new StringBuilder("Based on your live CRM data, prioritize these leads today:\n");
            for (int i = 0; i < priority.size(); i++) {
                Lead lead = priority.get(i);
                response.append(i + 1)
                    .append(". ")
                    .append(lead.getName() != null ? lead.getName() : "Unnamed lead")
                    .append(" — ")
                    .append(lead.getStatus() != null ? lead.getStatus().name() : "NEW")
                    .append(lead.getCompany() != null && !lead.getCompany().isBlank() ? " at " + lead.getCompany() : "")
                    .append(lead.getAiScoreValue() != null ? " (AI score " + lead.getAiScoreValue() + ")" : "")
                    .append("\n");
            }
            response.append("If you want, I can also break this into hot, warm, and follow-up lists.");
            return response.toString().trim();
        }

        if (normalized.contains("pipeline")) {
            long qualifiedCount = leadRepository.countByTenantIdAndDeletedFalseAndStatus(tenantId(), Lead.LeadStatus.QUALIFIED)
                + leadRepository.countByTenantIdAndDeletedFalseAndStatus(tenantId(), Lead.LeadStatus.PROPOSAL)
                + leadRepository.countByTenantIdAndDeletedFalseAndStatus(tenantId(), Lead.LeadStatus.NEGOTIATION);
            return "Your live CRM currently has " + qualifiedCount + " pipeline-ready leads. If the AI model is unavailable, I can still help you triage the next best actions.";
        }

        if (normalized.contains("lead")) {
            return "I’m running in fallback mode right now, but I can still help with live CRM data: ask me for lead priorities, pipeline status, or a follow-up plan.";
        }

        return "The AI model is temporarily unavailable, so I’m using live CRM data instead. Ask me about lead priorities, pipeline health, or next best actions.";
    }

    private int leadPriorityRank(Lead lead) {
        Lead.LeadStatus status = lead.getStatus() != null ? lead.getStatus() : Lead.LeadStatus.NEW;
        return switch (status) {
            case NEGOTIATION -> 0;
            case PROPOSAL -> 1;
            case QUALIFIED -> 2;
            case CONTACTED -> 3;
            case NEW -> 4;
            case WON -> 5;
            case LOST -> 6;
        };
    }

    private boolean isStaleLead(Lead lead) {
        LocalDateTime lastTouch = lead.getLastContactedAt() != null ? lead.getLastContactedAt() : lead.getCreatedAt();
        return lastTouch != null && lastTouch.isBefore(LocalDateTime.now().minusDays(7));
    }

    private boolean containsAny(String value, List<String> terms) {
        if (value == null || value.isBlank()) {
            return false;
        }
        String normalized = value.toLowerCase(Locale.ROOT);
        for (String term : terms) {
            if (term != null && !term.isBlank() && normalized.contains(term.toLowerCase(Locale.ROOT))) {
                return true;
            }
        }
        return false;
    }

    private String stringValue(Object value) {
        if (value == null) {
            return "";
        }
        if (value instanceof String text) {
            return text;
        }
        return String.valueOf(value);
    }

    private String trim(String value) {
        return value == null ? "" : value.trim();
    }

    // ── Private helpers ───────────────────────────────────────────

    private String callOpenAIText(List<Map<String, String>> messages, int maxTokens, double temperature) {
        Map<String, ?> message = chatCompletion(new ArrayList<>(messages), null, maxTokens, temperature);
        return extractTextContent(message.get("content"));
    }

    /** Text of an assistant message from {@link #chatCompletion}. */
    public String messageText(Map<String, ?> message) {
        return extractTextContent(message == null ? null : message.get("content"));
    }

    /**
     * One Chat Completions round trip with the tenant's AI provider. When {@code tools} is non-empty they are
     * offered to the model, and the returned assistant message may carry {@code tool_calls} instead of text.
     */
    public Map<String, ?> chatCompletion(List<? extends Map<String, ?>> messages, List<Map<String, Object>> tools,
                                         int maxTokens, double temperature) {
        Map<String, String> tenantConfig = resolveTenantOpenAIConfig();
        String provider = AiProviders.providerId(tenantConfig.get("provider"));
        String apiKey = resolveApiKey(tenantConfig);
        String configuredModel = resolveModel(tenantConfig, provider);
        if (!hasRealApiKey(apiKey) && !AiProviders.preset(provider).keyOptional()) {
            throw new IllegalStateException("AI provider API key is not configured");
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (hasRealApiKey(apiKey)) {
            headers.setBearerAuth(apiKey);
        }

        Map<String, Object> payload = new java.util.LinkedHashMap<>();
        payload.put("model", configuredModel);
        payload.put("messages", messages);
        payload.put("max_tokens", maxTokens);
        payload.put("temperature", temperature);
        if (tools != null && !tools.isEmpty()) {
            payload.put("tools", tools);
            payload.put("tool_choice", "auto");
        }

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(payload, headers);
        @SuppressWarnings("unchecked")
        Map<String, Object> response = restTemplate.postForObject(
            AiProviders.chatCompletionsUrl(provider, tenantConfig.get("baseUrl")),
            entity,
            Map.class
        );

        if (response == null) {
            throw new IllegalStateException("Empty AI provider response");
        }

        Object choicesObj = response.get("choices");
        if (!(choicesObj instanceof List<?> choices) || choices.isEmpty()) {
            throw new IllegalStateException("AI provider response missing choices");
        }

        Object firstObj = choices.get(0);
        if (!(firstObj instanceof Map<?, ?> firstChoice)) {
            throw new IllegalStateException("AI provider response choice format invalid");
        }

        Object messageObj = firstChoice.get("message");
        if (!(messageObj instanceof Map<?, ?> message)) {
            throw new IllegalStateException("AI provider response missing message");
        }

        @SuppressWarnings("unchecked")
        Map<String, ?> assistantMessage = (Map<String, ?>) message;
        return assistantMessage;
    }

    private Map<String, Object> callOpenAIJson(String systemPrompt, String userPrompt, int maxTokens, double temperature) {
        String raw = callOpenAIText(
            List.of(
                Map.of("role", "system", "content", systemPrompt),
                Map.of("role", "user", "content", userPrompt)
            ),
            maxTokens,
            temperature
        );
        try {
            String json = extractJsonObject(raw);
            return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            throw new IllegalStateException("Failed to parse OpenAI JSON response", e);
        }
    }

    private Map<String, Object> buildLeadPromptData(Lead lead) {
        Map<String, Object> data = new java.util.LinkedHashMap<>();
        data.put("id", lead.getId());
        data.put("name", lead.getName());
        data.put("company", lead.getCompany());
        data.put("source", String.valueOf(lead.getSource()));
        data.put("status", String.valueOf(lead.getStatus()));
        data.put("dealValue", lead.getDealValue());
        data.put("expectedCloseTimeline", lead.getExpectedCloseTimeline() != null
            ? lead.getExpectedCloseTimeline().name() : null);
        return data;
    }

    private String requireText(Map<String, Object> ai, String key) {
        Object value = ai.get(key);
        if (value instanceof String text && !text.isBlank()) {
            return text.trim();
        }
        throw new IllegalStateException("AI response missing text field: " + key);
    }

    private String optionalText(Map<String, Object> ai, String key, String fallback) {
        Object value = ai.get(key);
        if (value instanceof String text && !text.isBlank()) {
            return text.trim();
        }
        return fallback;
    }

    private int requireInt(Map<String, Object> ai, String key, int min, int max) {
        Object value = ai.get(key);
        if (value instanceof Number number) {
            int intValue = number.intValue();
            if (intValue >= min && intValue <= max) {
                return intValue;
            }
        }
        throw new IllegalStateException("AI response missing numeric field: " + key);
    }

    private int requireIntOrDefault(Map<String, Object> ai, String key, int min, int max, int fallback) {
        Object value = ai.get(key);
        if (value instanceof Number number) {
            int intValue = number.intValue();
            if (intValue >= min && intValue <= max) {
                return intValue;
            }
        }
        return fallback;
    }

    private String requireEnum(Map<String, Object> ai, String key, List<String> allowedValues) {
        String value = requireText(ai, key).toUpperCase();
        if (allowedValues.contains(value)) {
            return value;
        }
        throw new IllegalStateException("AI response has invalid value for " + key + ": " + value);
    }

    private String requireEnumOrDefault(Map<String, Object> ai, String key, List<String> allowedValues, String fallback) {
        Object value = ai.get(key);
        if (value instanceof String text && !text.isBlank()) {
            String normalized = text.trim().toUpperCase();
            if (allowedValues.contains(normalized)) {
                return normalized;
            }
        }
        return fallback;
    }

    private List<String> requireStringList(Map<String, Object> ai, String key) {
        Object value = ai.get(key);
        if (value instanceof List<?> list) {
            List<String> converted = list.stream()
                .map(String::valueOf)
                .filter(s -> !s.isBlank())
                .toList();
            if (!converted.isEmpty()) {
                return converted;
            }
        }
        throw new IllegalStateException("AI response missing list field: " + key);
    }

    private List<String> optionalStringList(Map<String, Object> ai, String key) {
        Object value = ai.get(key);
        if (value instanceof List<?> list) {
            List<String> converted = list.stream()
                .map(String::valueOf)
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .toList();
            if (!converted.isEmpty()) {
                return converted;
            }
        }
        if (value instanceof String text && !text.isBlank()) {
            List<String> converted = new ArrayList<>();
            for (String part : text.split("[\\n,;]+")) {
                String item = part.trim();
                if (!item.isBlank()) {
                    converted.add(item);
                }
            }
            if (!converted.isEmpty()) {
                return converted;
            }
        }
        return List.of();
    }

    private void validateInsights(List<Map<String, Object>> insights) {
        if (insights == null || insights.size() != 4) {
            throw new IllegalStateException("AI insights response must contain exactly 4 items");
        }
        for (Map<String, Object> insight : insights) {
            requireInt(insight, "id", Integer.MIN_VALUE, Integer.MAX_VALUE);
            requireEnum(insight, "type", List.of("PREDICTION", "WARNING", "OPPORTUNITY", "INSIGHT"));
            requireText(insight, "title");
            requireText(insight, "body");
            requireText(insight, "action");
        }
    }

    private void validateActions(List<String> actions) {
        if (actions == null || actions.size() != 4 || actions.stream().anyMatch(String::isBlank)) {
            throw new IllegalStateException("AI next-actions response must contain exactly 4 non-empty actions");
        }
    }

    private String extractJsonObject(String input) {
        String trimmed = input == null ? "" : input.trim();
        if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
        Matcher matcher = Pattern.compile("\\{[\\s\\S]*\\}").matcher(trimmed);
        if (matcher.find()) return matcher.group();
        throw new IllegalStateException("No JSON object found in model output");
    }

    private String extractJsonArray(String input) {
        String trimmed = input == null ? "" : input.trim();
        if (trimmed.startsWith("[") && trimmed.endsWith("]")) return trimmed;
        Matcher matcher = Pattern.compile("\\[[\\s\\S]*\\]").matcher(trimmed);
        if (matcher.find()) return matcher.group();
        throw new IllegalStateException("No JSON array found in model output");
    }

    private Map<String, String> resolveTenantOpenAIConfig() {
        if (integrationService == null) {
            return Map.of();
        }
        Map<String, String> config = integrationService.getConfig("openai");
        return config == null ? Map.of() : config;
    }

    // The OPENAI_API_KEY env fallback is only for OpenAI; never send it to another provider.
    private String resolveApiKey(Map<String, String> tenantConfig) {
        String tenantKey = tenantConfig == null ? "" : tenantConfig.get("apiKey");
        if (tenantKey != null && !tenantKey.isBlank()) {
            return tenantKey.trim();
        }
        String provider = AiProviders.providerId(tenantConfig == null ? null : tenantConfig.get("provider"));
        return "openai".equals(provider) ? trim(openaiApiKey) : "";
    }

    // Without a saved model: the OPENAI_MODEL env value for OpenAI, else the provider's default.
    private String resolveModel(Map<String, String> tenantConfig, String provider) {
        String tenantModel = tenantConfig == null ? "" : tenantConfig.get("model");
        if (tenantModel != null && !tenantModel.isBlank()) {
            return tenantModel.trim();
        }
        return "openai".equals(provider) ? trim(model) : AiProviders.preset(provider).defaultModel();
    }

    private boolean hasRealApiKey(String apiKey) {
        String key = apiKey == null ? "" : apiKey.trim();
        return !key.isEmpty();
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            return String.valueOf(value);
        }
    }

    private String buildFallbackCallReview(List<Map<String, Object>> calls, Lead lead) {
        if (calls == null || calls.isEmpty()) {
            return "No call transcript was available, so the AI could not perform a conversation-level review.";
        }

        Map<String, Object> latest = calls.get(0);
        String status = String.valueOf(latest.getOrDefault("status", "")).trim();
        String outcome = String.valueOf(latest.getOrDefault("outcome", "")).trim();
        String summary = String.valueOf(latest.getOrDefault("summary", "")).trim();
        String transcript = String.valueOf(latest.getOrDefault("transcript", "")).trim();

        List<String> parts = new ArrayList<>();
        if (!summary.isBlank()) {
            parts.add("Latest call summary: " + summary);
        }
        if (!transcript.isBlank()) {
            parts.add("Transcript was captured and should be reviewed for objections, intent, and follow-up cues.");
        }
        if (!status.isBlank() || !outcome.isBlank()) {
            parts.add("Latest status/outcome: " + (status.isBlank() ? "unknown" : status) + (outcome.isBlank() ? "" : " · " + outcome));
        }
        if (lead != null && lead.getStatus() != null) {
            parts.add("Current lead status: " + lead.getStatus().name());
        }
        return parts.isEmpty()
            ? "Call history exists, but the AI could not extract a stable conversation summary."
            : String.join(" ", parts);
    }

    private String extractTextContent(Object content) {
        if (content instanceof String text && !text.isBlank()) {
            return text.trim();
        }

        if (content instanceof List<?> chunks) {
            StringBuilder builder = new StringBuilder();
            for (Object chunk : chunks) {
                if (chunk instanceof Map<?, ?> chunkMap) {
                    Object type = chunkMap.get("type");
                    if (!"text".equals(String.valueOf(type))) {
                        continue;
                    }
                    Object text = chunkMap.get("text");
                    if (text instanceof String chunkText && !chunkText.isBlank()) {
                        builder.append(chunkText);
                    }
                }
            }
            if (builder.length() > 0) {
                return builder.toString().trim();
            }
        }

        throw new IllegalStateException("AI response content empty");
    }
}
