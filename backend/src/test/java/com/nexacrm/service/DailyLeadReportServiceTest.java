package com.nexacrm.service;

import com.mongodb.client.AggregateIterable;
import com.mongodb.client.MongoCollection;
import com.nexacrm.model.User;
import com.nexacrm.repository.TenantRepository;
import com.nexacrm.repository.UserRepository;
import com.nexacrm.security.TenantContext;
import org.bson.Document;
import org.junit.jupiter.api.*;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class DailyLeadReportServiceTest {
    MongoTemplate mongo = mock(MongoTemplate.class);
    UserRepository users = mock(UserRepository.class);
    TenantRepository tenants = mock(TenantRepository.class);
    DailyLeadReportService service = new DailyLeadReportService(mongo, users, tenants);

    @BeforeEach void login() {
        TenantContext.setCurrentTenantId(7L);
        User user = User.builder().email("rep@example.test").role(User.Role.SALES_EXEC).build();
        user.setId("rep-7"); user.setTenantId(7L);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities()));
        when(users.findByEmailAndTenantIdAndDeletedFalse("rep@example.test", 7L)).thenReturn(Optional.of(user));
        when(tenants.findByTenantIdAndDeletedFalse(7L)).thenReturn(Optional.empty());
    }
    @AfterEach void cleanup() { SecurityContextHolder.clearContext(); TenantContext.clear(); }

    @Test void calendarBoundaryAndDst() {
        var before = DailyLeadReportService.yesterday(Instant.parse("2026-10-15T18:29:59Z"), ZoneId.of("Asia/Kolkata"));
        var after = DailyLeadReportService.yesterday(Instant.parse("2026-10-15T18:30:00Z"), ZoneId.of("Asia/Kolkata"));
        assertEquals(LocalDate.parse("2026-10-14"), before.date());
        assertEquals(LocalDate.parse("2026-10-15"), after.date());
        assertEquals(Instant.parse("2026-10-14T18:30:00Z"), after.start());
        assertTrue(DailyLeadReportService.inWindow(after.start(), after));
        assertFalse(DailyLeadReportService.inWindow(after.end(), after));
        var dst = DailyLeadReportService.yesterday(Instant.parse("2026-03-09T12:00:00Z"), ZoneId.of("America/New_York"));
        assertEquals(23, Duration.between(dst.start(), dst.end()).toHours());
    }

    @Test void unsuccessfulAndScheduledActionsNeverCount() {
        for (String status : List.of("Not Connected", "Not Completed", "Pending", "Scheduled", "Cancelled", "Missed", "No Answer")) {
            assertFalse(DailyLeadReportService.completed("WELCOME_CALL", status));
            assertFalse(DailyLeadReportService.completed("FOLLOW_UP", status));
            assertFalse(DailyLeadReportService.completed("MEETING", status));
        }
        assertTrue(DailyLeadReportService.completed("WELCOME_CALL", "Connected"));
        assertTrue(DailyLeadReportService.completed("MEETING", "Negotiation"));
        assertFalse(DailyLeadReportService.completed("MEETING", "Allowed Person for Meeting"));
        assertEquals("FOLLOW_UP", DailyLeadReportService.activityType(new Document("activity_id", "act02")));
    }

    @Test void includesOlderLeadsMultipleActivitiesUnclassifiedAndAuditMessagesWithoutMirrorDuplication() {
        Instant yesterday = DailyLeadReportService.yesterday(Instant.now(), ZoneId.of("Asia/Kolkata")).start().plusSeconds(3600);
        when(mongo.find(any(Query.class), eq(Document.class), eq("leads"))).thenAnswer(call -> {
            Query query = call.getArgument(0);
            assertEquals(7L, query.getQueryObject().get("tenant_id"));
            assertEquals("rep-7", query.getQueryObject().get("assigned_to.$id"));
            return List.of(lead("old", yesterday.minusSeconds(40 * 86400L), "HOT"), lead("new", yesterday, "WARM"), lead("quiet", yesterday, null));
        });
        Document welcome = activity("a1", "old", "act01", "Connected", yesterday);
        fixtures("lead_activities", List.of(welcome, welcome, activity("a2", "old", "act02", "Follow Up", yesterday),
            activity("a3", "old", "act02", "Allowed Person for Meeting", yesterday), activity("a4", "new", "act02", "Follow Up", yesterday),
            activity("a5", "old", "act03", "Scheduled", yesterday)));
        fixtures("tasks", List.of()); fixtures("communications", List.of());
        fixtures("audit_logs", List.of(new Document("_id", "audit1").append("entity_id", "old").append("entity_type", "lead")
            .append("action", "STATUS_CHANGED").append("reportAt", Date.from(yesterday))
            .append("details", new Document("previousStage", "NEW").append("updatedStage", "CONTACTED").append("message", "Actual audit message")),
            new Document("_id", "audit2").append("entity_id", "old").append("entity_type", "lead").append("action", "STATUS_CHANGED")
            .append("reportAt", Date.from(yesterday.plusSeconds(1))).append("details", new Document("previousStage", "CONTACTED").append("updatedStage", "QUALIFIED"))));
        var report = service.yesterday();
        assertEquals(Map.of("received", 2L, "welcome", 1L, "followUp", 3L, "meeting", 0L), report.kpis());
        assertEquals(7, report.timeline().size());
        assertEquals(1, report.scoring().stream().filter(s -> s.name().equals("UNCLASSIFIED")).findFirst().orElseThrow().count());
        assertEquals(3, report.pipeline().stream().mapToLong(DailyLeadReportService.Distribution::count).sum());
        assertTrue(report.timeline().stream().anyMatch(e -> e.message().equals("Actual audit message")));
        verify(mongo, never()).getCollection("lead_timeline_events");
    }

    @Test void unknownUserFailsClosed() {
        when(users.findByEmailAndTenantIdAndDeletedFalse(anyString(), anyLong())).thenReturn(Optional.empty());
        assertThrows(AccessDeniedException.class, service::yesterday);
        verifyNoInteractions(mongo);
    }

    @Test void providerRetriesCountOneCallAndUnsuccessfulOutcomeDoesNotCount() {
        Instant at = DailyLeadReportService.yesterday(Instant.now(), ZoneId.of("Asia/Kolkata")).start().plusSeconds(3600);
        when(mongo.find(any(Query.class), eq(Document.class), eq("leads"))).thenReturn(List.of(lead("old", at.minusSeconds(86400), "HOT")));
        Document first = activity("first", "old", "act01", "Completed", at);
        first.put("values", new Document("status", "Completed").append("externalId", "provider-1").append("callOutcome", "interested").append("note", "Actual call"));
        Document retry = new Document(first); retry.put("_id", "retry");
        Document failed = activity("failed", "old", "act01", "Completed", at);
        failed.put("values", new Document("status", "Completed").append("externalId", "provider-2").append("callOutcome", "no_answer"));
        fixtures("lead_activities", List.of(first, retry, failed)); fixtures("tasks", List.of());
        fixtures("communications", List.of()); fixtures("audit_logs", List.of());
        var report = service.yesterday();
        assertEquals(1L, report.kpis().get("welcome"));
        assertEquals(2, report.timeline().size());
    }

    @Test void doesNotCapReportToFirstFiveHundredLeads() {
        Instant at = DailyLeadReportService.yesterday(Instant.now(), ZoneId.of("Asia/Kolkata")).start().plusSeconds(3600);
        List<Document> leads = new ArrayList<>();
        for (int i = 0; i < 1201; i++) leads.add(lead("lead-" + i, at, "HOT"));
        when(mongo.find(any(Query.class), eq(Document.class), eq("leads"))).thenReturn(leads);
        fixtures("lead_activities", List.of()); fixtures("tasks", List.of()); fixtures("communications", List.of()); fixtures("audit_logs", List.of());
        assertEquals(1201L, service.yesterday().kpis().get("received"));
        verify(mongo, times(3)).getCollection("lead_activities");
    }
    private Document lead(String id, Instant created, String score) {
        return new Document("_id", id).append("name", id).append("createdAt", Date.from(created)).append("status", "NEW").append("score", score);
    }
    private Document activity(String id, String lead, String step, String status, Instant at) {
        return new Document("_id", id).append("lead_id", lead).append("activity_id", step).append("reportAt", Date.from(at))
            .append("values", new Document("status", status).append("remark", "Original message " + id));
    }
    @SuppressWarnings("unchecked")
    private void fixtures(String name, List<Document> rows) {
        MongoCollection<Document> collection = mock(MongoCollection.class);
        AggregateIterable<Document> result = mock(AggregateIterable.class);
        when(mongo.getCollection(name)).thenReturn(collection);
        when(collection.aggregate(anyList())).thenAnswer(call -> {
            List<Document> pipeline = call.getArgument(0);
            Document scope = pipeline.get(0).get("$match", Document.class);
            assertEquals(7L, scope.get("tenant_id"));
            assertTrue(scope.containsKey(name.equals("audit_logs") ? "entity_id" : "lead_id"));
            assertTrue(pipeline.get(2).toJson().contains("$lt"));
            return result;
        });
        doAnswer(call -> { Collection<Document> target = call.getArgument(0); target.addAll(rows); return target; }).when(result).into(any());
    }
}
