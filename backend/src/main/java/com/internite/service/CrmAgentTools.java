package com.internite.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.internite.model.Deal;
import com.internite.model.Lead;
import com.internite.service.dashboard.LeadConversionDashboardService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Read-only CRM tools for the Sarathi agent. Every tool goes through the normal services, so tenant and
 * role scoping apply (a sales exec only sees their own leads), and checks the same authority as the
 * matching REST endpoint. Nothing here creates, changes or deletes data.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CrmAgentTools {

    private static final int MAX_RESULT_CHARS = 14_000;
    private static final int MAX_TEXT_CHARS = 300;
    private static final Set<String> HIDDEN_FIELDS = Set.of(
        "password", "tenantId", "tenant_id", "deleted", "rawPayload", "avatarUrl", "createdBy", "updatedBy",
        "authorities", "accountNonExpired", "accountNonLocked", "credentialsNonExpired", "enabled", "username");
    private static final List<String> PERIODS = List.of("today", "yesterday", "thisWeek", "thisMonth", "lastMonth");

    private final LeadService leadService;
    private final LeadActivityService leadActivityService;
    private final DealService dealService;
    private final TaskService taskService;
    private final CustomerService customerService;
    private final InvoiceService invoiceService;
    private final UserService userService;
    private final CallAgentService callAgentService;
    private final LeadConversionDashboardService dashboardService;
    private final ObjectMapper objectMapper;

    /** OpenAI-style tool definitions offered to the model. */
    public List<Map<String, Object>> definitions() {
        return List.of(
            tool("crm_overview", "Headline numbers for a period: total/new/contacted/qualified/converted/lost leads, conversion rate, revenue, pending follow-ups and change vs the previous period. Start here for summaries.",
                props(periodProp())),
            tool("search_leads", "Find leads. Filter by free-text query (name, phone, email, company), status, score or source. Returns up to `limit` leads with owner, value and AI score.",
                props(
                    prop("query", "string", "Text to match against name, phone, email or company", null),
                    prop("status", "string", "Lead status", enumNames(Lead.LeadStatus.values())),
                    prop("score", "string", "Lead temperature", enumNames(Lead.LeadScore.values())),
                    prop("source", "string", "Where the lead came from", enumNames(Lead.LeadSource.values())),
                    limitProp())),
            tool("get_lead", "Full details for one lead by id: profile, notes, recent activity timeline and its tasks.",
                props(prop("leadId", "string", "Lead id from search_leads", null)), "leadId"),
            tool("list_tasks", "Tasks and follow-ups. `due` narrows to overdue, today or tomorrow.",
                props(
                    prop("due", "string", "Due-date window", List.of("overdue", "today", "tomorrow", "all")),
                    prop("status", "string", "Task status, e.g. PENDING or COMPLETED", null),
                    prop("query", "string", "Text to match in the task", null),
                    limitProp())),
            tool("list_deals", "Deals in the pipeline, optionally for one stage, with value and owner.",
                props(prop("stage", "string", "Deal stage", enumNames(Deal.DealStage.values())), limitProp())),
            tool("list_customers", "Customers (converted accounts), optionally matching a text query.",
                props(prop("query", "string", "Name, email, phone or company", null), limitProp())),
            tool("list_invoices", "Invoices with amounts and payment status.",
                props(prop("status", "string", "Invoice status, e.g. PAID, PENDING, OVERDUE", null), limitProp())),
            tool("team_performance", "Per-employee lead numbers for a period: assigned, contacted, converted, lost, pending, conversion rate, response time, revenue.",
                props(periodProp())),
            tool("lead_sources", "Leads, conversions and revenue per source (Facebook, Website, ...) for a period.",
                props(periodProp())),
            tool("recent_calls", "Most recent phone and AI calls with status, duration and lead.",
                props(limitProp())),
            tool("list_team_members", "Users in this company with role and contact details.",
                props())
        );
    }

    /** Runs one tool and returns its result as compact JSON (or a JSON error the model can read). */
    public String execute(String name, String argumentsJson) {
        Map<String, Object> args;
        try {
            args = argumentsJson == null || argumentsJson.isBlank()
                ? Map.of()
                : objectMapper.readValue(argumentsJson, new TypeReference<Map<String, Object>>() {});
        } catch (Exception ex) {
            return error("Arguments were not valid JSON.");
        }
        try {
            Object result = switch (name) {
                case "crm_overview" -> {
                    require("dashboard.view");
                    yield dashboardService.summary(period(args), null, null, null, null);
                }
                case "search_leads" -> {
                    require("leads.read");
                    var page = leadService.findAll(text(args, "query"), upper(args, "status"), upper(args, "score"),
                        upper(args, "source"), null, PageRequest.of(0, limit(args)));
                    yield Map.of("total", page.getTotal(), "leads", page.getContent());
                }
                case "get_lead" -> {
                    require("leads.read");
                    String id = text(args, "leadId");
                    if (id == null) {
                        yield Map.of("error", "leadId is required; find it with search_leads.");
                    }
                    Map<String, Object> detail = new LinkedHashMap<>();
                    detail.put("lead", leadService.findById(id));
                    detail.put("recentActivity", lastN(leadActivityService.listByLeadId(id), 15));
                    if (hasAuthority("tasks.read")) {
                        detail.put("tasks", lastN(taskService.findAll(null, null, null, null, id), 15));
                    }
                    yield detail;
                }
                case "list_tasks" -> {
                    require("tasks.read");
                    String due = text(args, "due");
                    var tasks = taskService.findAll(upper(args, "status"), null,
                        "all".equalsIgnoreCase(due) ? null : due, text(args, "query"));
                    yield Map.of("total", tasks.size(), "tasks", tasks.stream().limit(limit(args)).toList());
                }
                case "list_deals" -> {
                    require("deals.read");
                    var page = dealService.findAll(upper(args, "stage"), null, null, PageRequest.of(0, limit(args)));
                    yield Map.of("total", page.getTotal(), "deals", page.getContent());
                }
                case "list_customers" -> {
                    require("customers.read");
                    var page = customerService.findAll(text(args, "query"), null, PageRequest.of(0, limit(args)));
                    yield Map.of("total", page.getTotal(), "customers", page.getContent());
                }
                case "list_invoices" -> {
                    require("invoices.read");
                    var page = invoiceService.findAll(upper(args, "status"), null, PageRequest.of(0, limit(args)));
                    yield Map.of("total", page.getTotal(), "invoices", page.getContent());
                }
                case "team_performance" -> {
                    require("dashboard.view");
                    yield dashboardService.employees(period(args), null, null, null, null, "conversion", "desc");
                }
                case "lead_sources" -> {
                    require("dashboard.view");
                    yield dashboardService.sources(period(args), null, null, null, null);
                }
                case "recent_calls" -> {
                    if (!hasAuthority("leads.read") && !hasAuthority("communications.read")) {
                        throw new SecurityException("leads.read");
                    }
                    yield lastN(callAgentService.getRecentCalls(), limit(args));
                }
                case "list_team_members" -> {
                    require("team.read");
                    yield userService.findAll();
                }
                default -> Map.of("error", "Unknown tool: " + name);
            };
            return toCompactJson(result);
        } catch (SecurityException ex) {
            return error("Your role cannot view this data (needs " + ex.getMessage() + "). Tell the user it is not available to them.");
        } catch (Exception ex) {
            log.warn("Sarathi tool {} failed: {}", name, ex.getMessage());
            return error(ex.getMessage() == null ? "The lookup failed." : ex.getMessage());
        }
    }

    // ── Result shaping: drop nulls and internal fields, shorten long text, cap size ──

    private String toCompactJson(Object value) throws Exception {
        Object tree = compact(objectMapper.convertValue(value, Object.class));
        String json = objectMapper.writeValueAsString(tree);
        if (json.length() > MAX_RESULT_CHARS) {
            json = json.substring(0, MAX_RESULT_CHARS) + "…(truncated: ask for a smaller limit or a narrower filter)";
        }
        return json;
    }

    private Object compact(Object node) {
        if (node instanceof Map<?, ?> map) {
            Map<String, Object> out = new LinkedHashMap<>();
            map.forEach((k, v) -> {
                String key = String.valueOf(k);
                Object value = compact(v);
                boolean empty = value == null
                    || (value instanceof String s && s.isBlank())
                    || (value instanceof Collection<?> c && c.isEmpty())
                    || (value instanceof Map<?, ?> m && m.isEmpty());
                if (!empty && !HIDDEN_FIELDS.contains(key)) {
                    out.put(key, value);
                }
            });
            return out;
        }
        if (node instanceof List<?> list) {
            return list.stream().map(this::compact).toList();
        }
        if (node instanceof String s && s.length() > MAX_TEXT_CHARS) {
            return s.substring(0, MAX_TEXT_CHARS) + "…";
        }
        return node;
    }

    private String error(String message) {
        try {
            return objectMapper.writeValueAsString(Map.of("error", message));
        } catch (Exception ex) {
            return "{\"error\":\"lookup failed\"}";
        }
    }

    // ── Permissions ──

    private void require(String authority) {
        if (!hasAuthority(authority)) {
            throw new SecurityException(authority);
        }
    }

    private boolean hasAuthority(String authority) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) {
            return false;
        }
        return auth.getAuthorities().stream().map(GrantedAuthority::getAuthority).anyMatch(authority::equals);
    }

    // ── Argument helpers ──

    private static String text(Map<String, Object> args, String key) {
        Object value = args.get(key);
        String s = value == null ? "" : String.valueOf(value).trim();
        return s.isEmpty() ? null : s;
    }

    private static String upper(Map<String, Object> args, String key) {
        String s = text(args, key);
        return s == null ? null : s.toUpperCase(Locale.ROOT);
    }

    private static int limit(Map<String, Object> args) {
        try {
            int n = Integer.parseInt(String.valueOf(args.getOrDefault("limit", 20)));
            return Math.max(1, Math.min(n, 50));
        } catch (NumberFormatException ex) {
            return 20;
        }
    }

    private static String period(Map<String, Object> args) {
        String p = text(args, "period");
        return p == null ? "thisMonth" : p;
    }

    private static <T> List<T> lastN(List<T> list, int n) {
        if (list == null) {
            return List.of();
        }
        return list.size() <= n ? list : list.subList(0, n);
    }

    // ── Schema helpers ──

    private static Map<String, Object> tool(String name, String description, Map<String, Object> properties, String... required) {
        Map<String, Object> parameters = new LinkedHashMap<>();
        parameters.put("type", "object");
        parameters.put("properties", properties);
        if (required.length > 0) {
            parameters.put("required", List.of(required));
        }
        return Map.of("type", "function", "function", Map.of(
            "name", name, "description", description, "parameters", parameters));
    }

    @SafeVarargs
    private static Map<String, Object> props(Map.Entry<String, Object>... entries) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (Map.Entry<String, Object> e : entries) {
            map.put(e.getKey(), e.getValue());
        }
        return map;
    }

    private static Map.Entry<String, Object> prop(String name, String type, String description, List<String> values) {
        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("type", type);
        schema.put("description", description);
        if (values != null) {
            schema.put("enum", values);
        }
        return Map.entry(name, schema);
    }

    private static Map.Entry<String, Object> periodProp() {
        return prop("period", "string", "Time window (default thisMonth)", PERIODS);
    }

    private static Map.Entry<String, Object> limitProp() {
        return Map.entry("limit", Map.of("type", "integer", "description", "Max rows, 1-50 (default 20)"));
    }

    private static List<String> enumNames(Enum<?>[] values) {
        return Arrays.stream(values).map(Enum::name).toList();
    }
}
