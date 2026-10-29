package com.internite.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.internite.model.CommunicationRecord;
import com.internite.model.Deal;
import com.internite.model.Lead;
import com.internite.repository.CommunicationRecordRepository;
import com.internite.repository.DealRepository;
import com.internite.repository.LeadActivityRepository;
import com.internite.repository.LeadRepository;
import com.internite.repository.UserRepository;
import com.internite.websocket.NotificationPublisher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.client.RestTemplate;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CallAgentServiceTest {

    @Mock
    private CommunicationRecordRepository communicationRecordRepository;

    @Mock
    private DealRepository dealRepository;

    @Mock
    private LeadRepository leadRepository;

    @Mock
    private com.internite.repository.TenantRepository tenantRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private LeadActivityRepository leadActivityRepository;

    @Mock
    private CommunicationService communicationService;

    @Mock
    private LeadCallAutomationService leadCallAutomationService;

    @Mock
    private IntegrationService integrationService;

    @Mock
    private AIService aiService;

    @Mock
    private NotificationPublisher notificationPublisher;

    @Mock
    private RestTemplate restTemplate;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private CallAgentService callAgentService;

    @BeforeEach
    void setUp() {
        callAgentService = new CallAgentService(
            communicationRecordRepository,
            dealRepository,
            leadRepository,
            new LeadChangeAuditService(leadRepository, org.mockito.Mockito.mock(org.springframework.data.mongodb.core.MongoTemplate.class)),
            tenantRepository,
            userRepository,
            leadActivityRepository,
            communicationService,
            leadCallAutomationService,
            integrationService,
            aiService,
            notificationPublisher,
            objectMapper,
            restTemplate
        );
        org.mockito.Mockito.lenient().when(leadCallAutomationService.findForLead(any())).thenReturn(Optional.empty());
    }

    @Test
    void getLeadCallHistory_shouldExtractNestedTranscriptAndRecording() throws Exception {
        Lead lead = Lead.builder()
            .name("Saurabh Kumar")
            .status(Lead.LeadStatus.NEW)
            .build();
        lead.setId("lead-1");
        lead.setTenantId(1L);

        CommunicationRecord record = new CommunicationRecord();
        record.setId("call-1");
        record.setLeadId("lead-1");
        record.setChannel("CALL");
        record.setStatus("COMPLETED");
        record.setExternalId("call-ext-1");
        record.setContactIdentifier("+91-9999999999");
        record.setProvider("bolna");
        record.setCreatedAt(Instant.parse("2026-06-02T10:00:00Z"));
        record.setRawPayload(objectMapper.writeValueAsString(Map.of(
            "response", Map.of(
                "data", Map.of(
                    "outcome", "connected",
                    "recordingUrl", "https://recordings.example/call-1.mp3",
                    "transcripts", List.of(
                        Map.of("speaker", "agent", "text", "Hi, this is Internite CRM."),
                        Map.of("speaker", "user", "text", "Yes, I am interested in the demo.")
                    )
                )
            )
        )));

        when(leadRepository.findByIdAndTenantIdAndDeletedFalse("lead-1", 1L))
            .thenReturn(Optional.of(lead));
        when(communicationRecordRepository.findTop50ByLeadIdAndChannelIgnoreCaseOrderByCreatedAtDesc("lead-1", "CALL"))
            .thenReturn(List.of(record));

        List<Map<String, Object>> history = callAgentService.getLeadCallHistory("lead-1");

        assertEquals(1, history.size());
        assertTrue(String.valueOf(history.get(0).get("transcript")).contains("Internite CRM"));
        assertTrue(String.valueOf(history.get(0).get("transcript")).contains("interested in the demo"));
        assertEquals("https://recordings.example/call-1.mp3", history.get(0).get("recordingUrl"));
        assertEquals("connected", history.get(0).get("outcome"));
    }

    @Test
    void processWebhook_shouldPromoteGenuineLeadWhenTranscriptEvidenceExists() throws Exception {
        Lead lead = Lead.builder()
            .name("Saurabh Kumar")
            .status(Lead.LeadStatus.NEW)
            .build();
        lead.setId("lead-1");
        lead.setTenantId(1L);

        when(leadRepository.findByIdAndTenantIdAndDeletedFalse("lead-1", 1L))
            .thenReturn(Optional.of(lead));
        when(communicationRecordRepository.findFirstByChannelIgnoreCaseAndExternalIdOrderByCreatedAtDesc(eq("CALL"), eq("call-123")))
            .thenReturn(Optional.empty());
        when(communicationRecordRepository.findTop50ByLeadIdAndChannelIgnoreCaseOrderByCreatedAtDesc("lead-1", "CALL"))
            .thenReturn(List.of());
        when(dealRepository.findByLead_IdAndTenantIdAndDeletedFalse("lead-1", 1L))
            .thenReturn(Optional.empty());
        when(dealRepository.save(any(Deal.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(leadRepository.save(any(Lead.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(leadActivityRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(aiService.analyzeCallIntelligence(eq(lead), anyList()))
            .thenReturn(Map.of(
                "leadVerdict", "GENUINE",
                "suggestedLeadStatus", "QUALIFIED",
                "confidence", 95,
                "summary", "The lead answered, asked about pricing, and requested a callback.",
                "reasoning", "Clear buying intent was expressed.",
                "positiveSignals", List.of("Asked about pricing", "Requested a callback"),
                "riskSignals", List.of(),
                "nextBestAction", "Schedule the demo and send pricing."
            ));

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("externalId", "call-123");
        payload.put("leadId", "lead-1");
        payload.put("status", "completed");
        payload.put("outcome", "connected");
        payload.put("summary", "Lead asked for demo and pricing");
        payload.put("response", Map.of(
            "data", Map.of(
                "transcripts", List.of(
                    Map.of("speaker", "agent", "text", "Hello, are you available for a quick product demo?"),
                    Map.of("speaker", "user", "text", "Yes, I would like to see the demo and pricing.")
                )
            )
        ));

        Map<String, Object> result = callAgentService.processWebhook(payload);

        assertEquals(true, result.get("ok"));
        assertEquals("lead-1", result.get("leadId"));
        assertEquals("COMPLETED", result.get("status"));
        assertTrue(String.valueOf(result.get("transcript")).contains("pricing"));
        assertEquals(Lead.LeadStatus.QUALIFIED, lead.getStatus());
        assertEquals(95, lead.getAiScoreValue());
        assertEquals("Schedule the demo and send pricing.", lead.getAiNextAction());
        verify(dealRepository).save(any(Deal.class));

        ArgumentCaptor<List<Map<String, Object>>> analysisCaptor = ArgumentCaptor.forClass(List.class);
        verify(aiService).analyzeCallIntelligence(eq(lead), analysisCaptor.capture());
        assertFalse(analysisCaptor.getValue().isEmpty());
        assertTrue(String.valueOf(analysisCaptor.getValue().get(0).get("transcript")).contains("demo"));
    }

    @Test
    void getLeadCallIntelligence_shouldPreferTranscriptBearingCallsOverNoAnswerAttempts() {
        Lead lead = Lead.builder()
            .name("Saurabh Kumar")
            .status(Lead.LeadStatus.NEW)
            .build();
        lead.setId("lead-1");
        lead.setTenantId(1L);

        CommunicationRecord noAnswer1 = buildCall("call-1", "no_answer", "", "queued", Instant.parse("2026-06-02T12:00:00Z"));
        CommunicationRecord noAnswer2 = buildCall("call-2", "no_answer", "", "queued", Instant.parse("2026-06-02T11:30:00Z"));
        CommunicationRecord noAnswer3 = buildCall("call-3", "no_answer", "", "queued", Instant.parse("2026-06-02T11:00:00Z"));
        CommunicationRecord transcriptCall = buildCall(
            "call-4",
            "connected",
            "[agent] Hello, let's discuss your requirements.\n[user] Yes, I want pricing and demo.",
            "completed",
            Instant.parse("2026-06-02T10:00:00Z")
        );

        when(leadRepository.findByIdAndTenantIdAndDeletedFalse("lead-1", 1L))
            .thenReturn(Optional.of(lead));
        when(communicationRecordRepository.findTop50ByLeadIdAndChannelIgnoreCaseOrderByCreatedAtDesc("lead-1", "CALL"))
            .thenReturn(List.of(noAnswer1, noAnswer2, noAnswer3, transcriptCall));
        when(aiService.analyzeCallIntelligence(eq(lead), anyList()))
            .thenReturn(Map.of(
                "leadVerdict", "GENUINE",
                "suggestedLeadStatus", "QUALIFIED",
                "confidence", 91,
                "summary", "Transcript shows genuine interest.",
                "reasoning", "The lead asked for pricing and demo details.",
                "positiveSignals", List.of("Asked for pricing", "Requested a demo"),
                "riskSignals", List.of(),
                "nextBestAction", "Send the demo slot."
            ));

        Map<String, Object> result = callAgentService.getLeadCallIntelligence("lead-1");

        assertEquals("lead-1", ((Map<?, ?>) result.get("lead")).get("id"));
        ArgumentCaptor<List<Map<String, Object>>> analysisCaptor = ArgumentCaptor.forClass(List.class);
        verify(aiService).analyzeCallIntelligence(eq(lead), analysisCaptor.capture());
        List<Map<String, Object>> analyzedCalls = analysisCaptor.getValue();
        assertFalse(analyzedCalls.isEmpty());
        assertTrue(String.valueOf(analyzedCalls.get(0).get("transcript")).contains("pricing"));
    }

    private CommunicationRecord buildCall(String id, String outcome, String transcript, String status, Instant createdAt) {
        CommunicationRecord record = new CommunicationRecord();
        record.setId(id);
        record.setLeadId("lead-1");
        record.setChannel("CALL");
        record.setStatus(status.toUpperCase());
        record.setExternalId(id + "-ext");
        record.setContactIdentifier("+91-9999999999");
        record.setProvider("bolna");
        record.setCreatedAt(createdAt);
        record.setRawPayload(transcriptPayload(transcript, outcome));
        return record;
    }

    private String transcriptPayload(String transcript) {
        return transcriptPayload(transcript, "connected");
    }

    private String transcriptPayload(String transcript, String outcome) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("outcome", outcome);
        payload.put("response", Map.of(
            "data", Map.of(
                "transcript", transcript
            )
        ));
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
