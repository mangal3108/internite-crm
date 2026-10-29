package com.nexacrm.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexacrm.model.Lead;
import com.nexacrm.repository.LeadRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpEntity;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.any;
import static org.mockito.Mockito.eq;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class AIServiceTest {

    @Mock
    private LeadRepository leadRepository;

    @Mock
    private IntegrationService integrationService;

    @Mock
    private RestTemplate restTemplate;

    private AIService aiService;

    @BeforeEach
    void setUp() {
        aiService = new AIService(leadRepository, integrationService, restTemplate, new ObjectMapper());
    }

    @Test
    void chat_shouldUseTenantOpenAIKeyAndModel() {
        when(integrationService.getConfig("openai"))
            .thenReturn(Map.of("apiKey", "tenant-key", "model", "tenant-model"));
        when(restTemplate.postForObject(
            eq("https://api.openai.com/v1/chat/completions"),
            any(HttpEntity.class),
            eq(Map.class)
        )).thenReturn(Map.of(
            "choices", List.of(Map.of("message", Map.of("content", "Tenant model response")))
        ));

        assertEquals("Tenant model response", aiService.chat(List.of(
            Map.of("role", "user", "content", "Hello")
        )));
        verify(restTemplate).postForObject(
            eq("https://api.openai.com/v1/chat/completions"),
            any(HttpEntity.class),
            eq(Map.class)
        );
    }

    @Test
    void generateInsights_shouldFallbackToLiveCRMDataWhenModelIsUnavailable() {
        Lead qualifiedLead = Lead.builder()
            .name("Qualified Lead")
            .status(Lead.LeadStatus.QUALIFIED)
            .build();
        qualifiedLead.setId("lead-qualified");
        qualifiedLead.setCreatedAt(LocalDateTime.now().minusDays(2));

        Lead wonLead = Lead.builder()
            .name("Won Lead")
            .status(Lead.LeadStatus.WON)
            .build();
        wonLead.setId("lead-won");
        wonLead.setCreatedAt(LocalDateTime.now().minusDays(1));

        Lead staleLead = Lead.builder()
            .name("Stale Lead")
            .status(Lead.LeadStatus.NEW)
            .build();
        staleLead.setId("lead-stale");
        staleLead.setCreatedAt(LocalDateTime.now().minusDays(12));

        when(leadRepository.findByTenantIdAndDeletedFalse(1L))
            .thenReturn(List.of(qualifiedLead, wonLead, staleLead));

        List<Map<String, Object>> insights = aiService.generateInsights();

        assertEquals(4, insights.size());
        assertEquals("prediction", insights.get(0).get("type"));
        assertTrue(String.valueOf(insights.get(0).get("body")).contains("qualified or beyond"));
        assertEquals("warning", insights.get(1).get("type"));
        assertTrue(String.valueOf(insights.get(1).get("body")).contains("at risk of cooling off"));
    }

    @Test
    void analyzeCallIntelligence_shouldFallbackToHeuristicsWhenModelIsUnavailable() {
        Lead lead = Lead.builder()
            .name("Saurabh Kumar")
            .status(Lead.LeadStatus.NEW)
            .build();
        lead.setId("lead-1");
        lead.setTenantId(1L);

        List<Map<String, Object>> calls = List.of(Map.of(
            "status", "COMPLETED",
            "outcome", "connected",
            "summary", "Lead asked for pricing and a demo.",
            "transcript", "Yes, send pricing and demo details. I am interested.",
            "recordingUrl", "https://recordings.example/call-1.mp3"
        ));

        Map<String, Object> analysis = aiService.analyzeCallIntelligence(lead, calls);

        assertEquals("GENUINE", analysis.get("leadVerdict"));
        assertEquals("QUALIFIED", analysis.get("suggestedLeadStatus"));
        assertTrue(((Number) analysis.get("confidence")).intValue() >= 80);
        assertFalse(((List<?>) analysis.get("positiveSignals")).isEmpty());
        assertEquals(0, ((List<?>) analysis.get("riskSignals")).size());
    }

    @Test
    void chat_shouldFallbackToLiveCRMAdviceWhenModelIsUnavailable() {
        Lead lead = Lead.builder()
            .name("Priority Lead")
            .status(Lead.LeadStatus.QUALIFIED)
            .build();
        lead.setId("lead-priority");
        lead.setAiScoreValue(88);
        lead.setTenantId(1L);

        when(leadRepository.findByTenantIdAndDeletedFalse(1L))
            .thenReturn(List.of(lead));

        String response = aiService.chat(List.of(Map.of(
            "role", "user",
            "content", "Which leads should I prioritize today?"
        )));

        assertTrue(response.toLowerCase().contains("prioritize"));
        assertTrue(response.contains("Priority Lead"));
    }
}
