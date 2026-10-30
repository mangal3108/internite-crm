package com.internite.service;

import com.internite.model.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;

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
    private static final int MAX_HISTORY = 20;
    private static final ZoneId ZONE = ZoneId.of("Asia/Kolkata");

    private final AIService aiService;
    private final CrmAgentTools tools;

    public record Reply(String response, List<String> toolsUsed) {}

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
        try {
            for (int round = 0; round < MAX_ROUNDS; round++) {
                Map<String, ?> reply = aiService.chatCompletion(messages, tools.definitions(), 1500, 0.2);
                List<?> calls = reply.get("tool_calls") instanceof List<?> l ? l : List.of();
                if (calls.isEmpty()) {
                    return new Reply(aiService.messageText(reply), List.copyOf(used));
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
                    messages.add(Map.of(
                        "role", "tool",
                        "tool_call_id", String.valueOf(call.get("id")),
                        "content", tools.execute(name, args)));
                }
            }
            // Out of rounds: ask for an answer with what has been gathered so far.
            messages.add(Map.of("role", "user", "content",
                "Answer now using only the data already retrieved above. Do not call more tools."));
            Map<String, ?> last = aiService.chatCompletion(messages, null, 1500, 0.2);
            return new Reply(aiService.messageText(last), List.copyOf(used));
        } catch (HttpClientErrorException ex) {
            // Some models reject the `tools` field; answer from an overview snapshot instead.
            if (used.isEmpty() && ex.getStatusCode().value() == 400) {
                log.info("Model rejected tool calling, answering from a CRM snapshot: {}", ex.getStatusText());
                return snapshotAnswer(messages);
            }
            throw ex;
        }
    }

    private Reply snapshotAnswer(List<Map<String, Object>> messages) {
        String snapshot = tools.execute("crm_overview", "{\"period\":\"thisMonth\"}");
        List<Map<String, Object>> withData = new ArrayList<>(messages);
        withData.set(0, Map.of("role", "system", "content", systemPrompt()
            + "\n\nThis model cannot look data up, so only this month's overview is available:\n" + snapshot
            + "\nIf the question needs other data, say so and suggest switching to a model that supports tool calling."));
        Map<String, ?> reply = aiService.chatCompletion(withData, null, 1500, 0.2);
        return new Reply(aiService.messageText(reply), List.of("crm_overview"));
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
