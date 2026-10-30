package com.internite.service;

import com.internite.model.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Sarathi as a read-only CRM agent: the model may call {@link CrmAgentTools} as often as it needs
 * (up to {@link #MAX_ROUNDS}), then answers from what the tools returned.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SarathiAgentService {

    private static final int MAX_ROUNDS = 6;
    private static final int MAX_HISTORY = 12;
    // Kept modest so free plans with small per-minute token limits (e.g. Groq ~8k) can run the loop.
    private static final int MAX_REPLY_TOKENS = 1000;
    private static final int MAX_FALLBACK_DATA_CHARS = 9_000;
    private static final ZoneId ZONE = ZoneId.of("Asia/Kolkata");

    private final AIService aiService;
    private final CrmAgentTools tools;

    /** {@code notice} is set when Sarathi had to answer with less data than it wanted, and says why. */
    public record Reply(String response, List<String> toolsUsed, String notice) {}

    public Reply chat(List<Map<String, String>> history) {
        List<Map<String, Object>> messages = new ArrayList<>();
        messages.add(Map.of("role", "system", "content", systemPrompt()));
        List<Map<String, String>> safe = history == null ? List.of() : history;
        for (Map<String, String> m : safe.subList(Math.max(0, safe.size() - MAX_HISTORY), safe.size())) {
            String role = m.get("role");
            if (("user".equals(role) || "assistant".equals(role)) && m.get("content") != null) {
                messages.add(Map.of("role", role, "content", m.get("content")));
            }
        }

        Set<String> used = new LinkedHashSet<>();
        List<String> results = new ArrayList<>();
        try {
            for (int round = 0; round < MAX_ROUNDS; round++) {
                Map<String, ?> reply = aiService.chatCompletion(messages, tools.definitions(), MAX_REPLY_TOKENS, 0.2);
                List<?> calls = reply.get("tool_calls") instanceof List<?> l ? l : List.of();
                if (calls.isEmpty()) {
                    return new Reply(aiService.messageText(reply), List.copyOf(used), null);
                }
                // Echo the assistant turn (with its tool calls), then one tool message per call.
                Map<String, Object> assistant = new LinkedHashMap<>();
                assistant.put("role", "assistant");
                assistant.put("content", reply.get("content") == null ? "" : reply.get("content"));
                assistant.put("tool_calls", calls);
                messages.add(assistant);
                for (Object c : calls) {
                    if (!(c instanceof Map<?, ?> call) || !(call.get("function") instanceof Map<?, ?> fn)) {
                        continue;
                    }
                    String name = String.valueOf(fn.get("name"));
                    String args = fn.get("arguments") == null ? "{}" : String.valueOf(fn.get("arguments"));
                    used.add(name);
                    String result = tools.execute(name, args);
                    results.add(name + ": " + result);
                    messages.add(Map.of(
                        "role", "tool",
                        "tool_call_id", String.valueOf(call.get("id")),
                        "content", result));
                }
            }
            // Out of rounds: answer with what has been gathered so far.
            return answerFromData(question(safe), results, used, "Sarathi stopped looking after " + MAX_ROUNDS + " lookups.");
        } catch (HttpStatusCodeException ex) {
            // The provider refused a step (model without tool support, request too large for the plan's
            // token limit, rate limit, a malformed tool call...). Answer from data we can still give it.
            String reason = providerReason(ex);
            log.warn("Sarathi agent step failed after tools {}: {}", used, reason);
            if (results.isEmpty()) {
                used.add("crm_overview");
                results.add("crm_overview (this month): " + tools.execute("crm_overview", "{\"period\":\"thisMonth\"}"));
            }
            return answerFromData(question(safe), results, used, reason);
        }
    }

    /** One plain request (no tools) with the question and the data gathered so far, kept small. */
    private Reply answerFromData(String question, List<String> results, Set<String> used, String reason) {
        StringBuilder data = new StringBuilder();
        for (String r : results) {
            if (data.length() + r.length() > MAX_FALLBACK_DATA_CHARS) {
                data.append("\n(more data was retrieved but left out to keep the request small)");
                break;
            }
            data.append("\n").append(r);
        }
        List<Map<String, Object>> request = List.of(
            Map.of("role", "system", "content", systemPrompt()
                + "\n\nNo more lookups are possible for this question. Answer only from this CRM data; "
                + "if it is not enough, say what is missing:\n" + data),
            Map.of("role", "user", "content", question));
        Map<String, ?> reply = aiService.chatCompletion(request, null, MAX_REPLY_TOKENS, 0.2);
        return new Reply(aiService.messageText(reply), List.copyOf(used), reason);
    }

    private static String question(List<Map<String, String>> history) {
        for (int i = history.size() - 1; i >= 0; i--) {
            if ("user".equals(history.get(i).get("role")) && history.get(i).get("content") != null) {
                return history.get(i).get("content");
            }
        }
        return "Summarise my CRM.";
    }

    /** Short, user-readable reason from the provider's error body (OpenAI-style {"error":{"message":...}}). */
    private static String providerReason(HttpStatusCodeException ex) {
        String body = ex.getResponseBodyAsString();
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("\"message\"\\s*:\\s*\"((?:[^\"\\\\]|\\\\.)*)\"").matcher(body == null ? "" : body);
        String detail = m.find() ? m.group(1).replace("\\\"", "\"") : ex.getStatusText();
        if (detail != null && detail.length() > 180) {
            detail = detail.substring(0, 180) + "…";
        }
        return "The AI provider refused a lookup step (HTTP " + ex.getStatusCode().value() + ")"
            + (detail == null || detail.isBlank() ? "." : ": " + detail);
    }

    private String systemPrompt() {
        String today = ZonedDateTime.now(ZONE).format(DateTimeFormatter.ofPattern("EEEE, d MMMM yyyy"));
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String who = auth != null && auth.getPrincipal() instanceof User u
            ? u.getName() + " (" + String.valueOf(u.getRole()).replace('_', ' ').toLowerCase() + ")"
            : "the signed-in user";
        return """
            You are Sarathi, the read-only AI agent inside Internite CRM. Today is %s (India time). You are helping %s.

            How to work:
            - Answer from the user's real CRM data. Use the tools to look things up; never invent leads, numbers, names or dates.
            - Call as many tools as needed (e.g. search_leads, then get_lead for details). Prefer narrow filters and small limits.
            - If a tool returns an error or no rows, say so plainly. If the user's role cannot see something, tell them.
            - You are read-only: you cannot create, edit, assign, delete, call or message anything. If asked, explain where in the CRM they can do it.

            How to answer:
            - Lead with the direct answer, then the supporting detail. Be concise and practical; suggest a next step when useful.
            - Use Markdown: short bullet lists, and a table when comparing several records (keep tables to a few columns).
            - Money is in Indian Rupees (₹). Refer to records by name, not internal ids.
            """.formatted(today, who);
    }
}
