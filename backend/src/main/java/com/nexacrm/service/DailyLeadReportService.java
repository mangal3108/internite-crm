package com.nexacrm.service;

import com.nexacrm.model.User;
import com.nexacrm.repository.TenantRepository;
import com.nexacrm.repository.UserRepository;
import com.nexacrm.security.TenantContext;
import lombok.RequiredArgsConstructor;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.time.*;
import java.util.*;

/** A single authorized snapshot is used by the dashboard and its complete PDF export. */
@Service
@RequiredArgsConstructor
public class DailyLeadReportService {
    private final MongoTemplate mongo;
    private final UserRepository users;
    private final TenantRepository tenants;

    public record Window(LocalDate date, ZoneId zone, Instant start, Instant end) {}
    public record LeadRow(String id, String name, String stage) {}
    public record Distribution(String name, long count, double percentage) {}
    public record Event(String id, String leadId, String leadName, String type, String status,
                        Instant at, String message, String previousStage, String updatedStage, String nextFollowUp) {}
    public record Report(String date, String timezone, Instant generatedAt, Instant pipelineSnapshotAt,
                         Map<String, Long> kpis, List<Distribution> pipeline, List<Distribution> scoring,
                         List<LeadRow> leads, List<Event> timeline, List<String> notes) {}

    public static Window yesterday(Instant now, ZoneId zone) {
        LocalDate date = now.atZone(zone).toLocalDate().minusDays(1);
        return new Window(date, zone, date.atStartOfDay(zone).toInstant(), date.plusDays(1).atStartOfDay(zone).toInstant());
    }

    public Report yesterday() {
        Long tenant = TenantContext.currentTenantId();
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) throw new AccessDeniedException("Authentication required");
        User current = users.findByEmailAndTenantIdAndDeletedFalse(auth.getName(), tenant)
            .orElseThrow(() -> new AccessDeniedException("Active tenant user required"));
        String configured = tenants.findByTenantIdAndDeletedFalse(tenant).map(t -> t.getTimezone()).orElse(null);
        ZoneId zone = configured == null || configured.isBlank() ? ZoneId.of("Asia/Kolkata") : ZoneId.of(configured);
        Instant now = Instant.now();
        Window window = yesterday(now, zone);
        Query query = Query.query(Criteria.where("tenant_id").is(tenant).and("deleted").is(false));
        if (!User.isAdminLike(current.getRole()) && current.getRole() != User.Role.MANAGER)
            query.addCriteria(Criteria.where("assigned_to.$id").is(current.getId()));
        query.fields().include("name").include("status").include("score").include("createdAt");
        List<Document> leads = mongo.find(query, Document.class, "leads");
        Map<String, Document> byId = new LinkedHashMap<>();
        leads.forEach(l -> byId.put(String.valueOf(l.get("_id")), l));
        Map<String, Long> stages = new LinkedHashMap<>();
        for (String stage : List.of("NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST")) stages.put(stage, 0L);
        Map<String, Long> scores = new LinkedHashMap<>();
        for (String score : List.of("HOT", "WARM", "COLD", "UNCLASSIFIED")) scores.put(score, 0L);
        List<LeadRow> leadRows = new ArrayList<>();
        for (Document lead : leads) {
            String stage = text(lead, "status");
            if (stage.isBlank()) stage = "UNCLASSIFIED";
            stages.merge(stage, 1L, Long::sum);
            leadRows.add(new LeadRow(String.valueOf(lead.get("_id")), text(lead, "name"), stage));
            if (inWindow(instant(lead.get("createdAt")), window)) {
                String score = text(lead, "score");
                scores.merge(scores.containsKey(score) ? score : "UNCLASSIFIED", 1L, Long::sum);
            }
        }
        Map<String, Event> events = new LinkedHashMap<>();
        Set<String> countedActions = new HashSet<>();
        Map<String, Long> kpis = new LinkedHashMap<>();
        long received = scores.values().stream().mapToLong(Long::longValue).sum();
        kpis.put("received", received);
        kpis.put("welcome", 0L); kpis.put("followUp", 0L); kpis.put("meeting", 0L);
        List<String> ids = new ArrayList<>(byId.keySet());
        // Bound each $in query; do not use the Task page's capped lead list or timeline mirror.
        for (int offset = 0; offset < ids.size(); offset += 500) {
            List<String> batch = ids.subList(offset, Math.min(offset + 500, ids.size()));
            for (Document row : rows("lead_activities", "lead_id", batch, tenant, window,
                    List.of("$values.completedAt", "$saved_at", "$createdAt"))) {
                Map<String, Object> values = values(row, "values");
                String type = activityType(row);
                String status = first(values, "connectionStatus", "meetingStatus", "status", "callOutcome", "outcome", "remarkStatus");
                Event event = event(row, byId, "lead_activities", type, status,
                    message(row, values), first(values, "previousStage", "previousStatus"), first(values, "updatedStage", "newStatus"),
                    (first(values, "nextFollowUpDate", "followUpDate") + " " + first(values, "nextFollowUpTime", "followUpTime")).trim());
                String externalId = first(values, "externalId", "externalCallId");
                String actionKey = externalId.isBlank() ? event.id() : event.leadId() + ":call:" + externalId;
                String eventKey = externalId.isBlank() ? event.id() : actionKey + ":" + status + ":" + event.message();
                events.putIfAbsent(eventKey, event);
                String outcome = first(values, "callOutcome", "outcome").toLowerCase(Locale.ROOT).replace('_', ' ');
                boolean unsuccessful = Set.of("no answer", "not connected", "busy", "failed", "missed", "cancelled", "canceled", "wrong number").contains(outcome);
                if (!unsuccessful && completed(type, status) && inWindow(instant(row.get("reportAt")), window) && countedActions.add(actionKey)) {
                    String key = switch (type) { case "WELCOME_CALL" -> "welcome"; case "FOLLOW_UP" -> "followUp"; case "MEETING" -> "meeting"; default -> ""; };
                    if (!key.isEmpty()) kpis.merge(key, 1L, Long::sum);
                }
            }
            for (Document row : rows("tasks", "lead_id", batch, tenant, window, List.of("$completed_at", "$createdAt"))) {
                String type = text(row, "type").toUpperCase(Locale.ROOT).replace('-', '_').replace(' ', '_');
                // Generic CALL tasks cannot prove that a welcome call or follow-up occurred.
                if (!List.of("WELCOME_CALL", "FOLLOW_UP", "MEETING").contains(type)) type = "TASK";
                Event event = event(row, byId, "tasks", type, text(row, "status"),
                    text(row, "title") + "\n" + text(row, "description"), "", "", "");
                if (events.putIfAbsent(event.id(), event) == null && row.get("completed_at") != null
                        && "COMPLETED".equalsIgnoreCase(event.status()) && inWindow(instant(row.get("reportAt")), window)) {
                    String key = switch (type) { case "WELCOME_CALL" -> "welcome"; case "FOLLOW_UP" -> "followUp"; case "MEETING" -> "meeting"; default -> ""; };
                    if (!key.isEmpty()) kpis.merge(key, 1L, Long::sum);
                }
            }
            for (Document row : rows("communications", "lead_id", batch, tenant, window, List.of("$created_at"))) {
                Event event = event(row, byId, "communications", text(row, "channel"), text(row, "status"),
                    (text(row, "subject") + "\n" + text(row, "body")).trim(), "", "", "");
                events.putIfAbsent(event.id(), event);
            }
            for (Document row : rows("audit_logs", "entity_id", batch, tenant, window, List.of("$created_at"))) {
                if (!"lead".equalsIgnoreCase(text(row, "entity_type"))) continue;
                row.put("lead_id", row.get("entity_id"));
                Map<String, Object> details = values(row, "details");
                Event event = event(row, byId, "audit_logs", text(row, "action"), "RECORDED",
                    first(details, "message", "description"), first(details, "previousStage"), first(details, "updatedStage"), "");
                events.putIfAbsent(event.id(), event);
            }
        }
        List<Event> timeline = events.values().stream().sorted(Comparator.comparing(Event::at).reversed().thenComparing(Event::id)).toList();
        return new Report(window.date().toString(), zone.getId(), now, now, kpis,
            distributions(stages, leads.size()), distributions(scores, received), leadRows, timeline,
            List.of("Pipeline is the current distribution, not historical conversion performance.",
                "Completion uses explicit recorded outcomes; saved time is used when a completed activity has no separate completion timestamp.",
                "Historical status and score changes are available only where audit records exist. Unlogged work cannot be reconstructed."));
    }

    private List<Document> rows(String collection, String leadField, List<String> ids, Long tenant, Window window, List<String> dates) {
        Document match = new Document("tenant_id", tenant).append(leadField, new Document("$in", ids))
            .append("deleted", new Document("$ne", true));
        Object date = null;
        for (int i = dates.size() - 1; i >= 0; i--) {
            Document converted = new Document("$convert", new Document("input", dates.get(i)).append("to", "date").append("onError", null).append("onNull", null));
            date = new Document("$ifNull", Arrays.asList(converted, date));
        }
        Object logged = collection.equals("lead_activities") ? new Document("$ifNull", List.of("$saved_at", "$createdAt"))
            : collection.equals("tasks") ? "$createdAt" : "$created_at";
        Document range = new Document("$gte", Date.from(window.start())).append("$lt", Date.from(window.end()));
        List<Document> pipeline = List.of(new Document("$match", match),
            new Document("$addFields", new Document("reportAt", date).append("loggedAt", logged)),
            new Document("$match", new Document("$or", List.of(new Document("reportAt", range), new Document("loggedAt", range)))),
            new Document("$project", new Document("raw_payload", 0).append("owner", 0).append("assigned_to", 0)));
        List<Document> result = mongo.getCollection(collection).aggregate(pipeline).into(new ArrayList<>());
        result.forEach(row -> row.put("displayAt", inWindow(instant(row.get("reportAt")), window) ? row.get("reportAt") : row.get("loggedAt")));
        return result;
    }

    static String activityType(Document row) {
        if ("call-recording".equals(text(row, "activity_id"))) return "RECORDING";
        if (text(row, "activity_id").isBlank() && row.get("activity_index") instanceof Number index) {
            return switch (index.intValue()) { case 0 -> "WELCOME_CALL"; case 1 -> "FOLLOW_UP"; case 2 -> "MEETING"; default -> "ACTIVITY"; };
        }
        return switch (text(row, "activity_id")) {
            case "act01" -> "WELCOME_CALL";
            case "act02" -> "FOLLOW_UP";
            case "act03" -> "MEETING";
            default -> text(row, "activity_title").isBlank() ? "ACTIVITY" : text(row, "activity_title");
        };
    }

    static boolean completed(String type, String status) {
        String value = status.trim().toLowerCase(Locale.ROOT);
        return switch (type) {
            case "WELCOME_CALL" -> Set.of("connected", "completed", "answered", "success").contains(value);
            case "FOLLOW_UP" -> Set.of("completed", "connected", "answered", "allowed person for meeting", "allowed person", "allowed_person", "follow up", "follow-up", "followup", "lost").contains(value);
            case "MEETING" -> Set.of("completed", "conducted", "attended", "won", "lost", "negotiation").contains(value);
            default -> false;
        };
    }

    private Event event(Document row, Map<String, Document> leads, String source, String type, String status,
                        String message, String previous, String updated, String next) {
        String leadId = text(row, "lead_id");
        return new Event(source + ":" + row.get("_id"), leadId, text(leads.get(leadId), "name"), type, status,
            instant(row.get("displayAt")), message, previous, updated, next);
    }
    private static String message(Document row, Map<String, Object> values) {
        LinkedHashSet<String> messages = new LinkedHashSet<>();
        for (String key : List.of("remark", "remarks", "note", "notes", "remarkLost", "message", "description")) {
            String value = first(values, key);
            if (!value.isBlank()) messages.add(value);
        }
        String summary = text(row, "summary");
        if (!summary.isBlank()) messages.add(summary);
        return String.join("\n", messages);
    }
    static boolean inWindow(Instant value, Window window) { return value != null && !value.isBefore(window.start()) && value.isBefore(window.end()); }
    static Instant instant(Object value) {
        if (value instanceof Date date) return date.toInstant();
        if (value instanceof Instant date) return date;
        if (value == null) return null;
        try { return Instant.parse(value.toString()); } catch (DateTimeException ignored) {
            try { return LocalDateTime.parse(value.toString()).toInstant(ZoneOffset.UTC); } catch (DateTimeException invalid) { return null; }
        }
    }
    private static List<Distribution> distributions(Map<String, Long> counts, long total) {
        return counts.entrySet().stream().map(e -> new Distribution(e.getKey(), e.getValue(), total == 0 ? 0 : e.getValue() * 100.0 / total)).toList();
    }
    private static String text(Map<String, ?> row, String key) { return row == null || row.get(key) == null ? "" : row.get(key).toString(); }
    private static String first(Map<String, ?> values, String... keys) {
        for (String key : keys) { String value = text(values, key); if (!value.isBlank()) return value; }
        return "";
    }
    @SuppressWarnings("unchecked")
    private static Map<String, Object> values(Document row, String key) {
        return row.get(key) instanceof Map<?, ?> map ? (Map<String, Object>) map : Map.of();
    }
}
