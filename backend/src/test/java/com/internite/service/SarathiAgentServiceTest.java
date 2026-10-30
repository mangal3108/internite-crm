package com.internite.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.client.HttpClientErrorException;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.ArgumentMatchers.notNull;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SarathiAgentServiceTest {

    @Mock
    private AIService aiService;

    @Mock
    private CrmAgentTools tools;

    private SarathiAgentService agent;

    @BeforeEach
    void setUp() {
        agent = new SarathiAgentService(aiService, tools);
    }

    @Test
    @SuppressWarnings("unchecked")
    void chat_runsRequestedToolsAndAnswersFromTheirResults() {
        Map<String, Object> toolTurn = new HashMap<>();
        toolTurn.put("content", null);
        toolTurn.put("tool_calls", List.of(Map.of(
            "id", "call-1",
            "type", "function",
            "function", Map.of("name", "search_leads", "arguments", "{\"score\":\"HOT\"}"))));
        Map<String, Object> answerTurn = Map.of("content", "You have 2 hot leads.");

        when(tools.definitions()).thenReturn(List.of(Map.of("type", "function")));
        when(tools.execute("search_leads", "{\"score\":\"HOT\"}")).thenReturn("{\"total\":2}");
        when(aiService.chatCompletion(any(), notNull(), anyInt(), anyDouble()))
            .thenReturn((Map) toolTurn, (Map) answerTurn);
        when(aiService.messageText(answerTurn)).thenReturn("You have 2 hot leads.");

        SarathiAgentService.Reply reply = agent.chat(List.of(Map.of("role", "user", "content", "Any hot leads?")));

        assertEquals("You have 2 hot leads.", reply.response());
        assertEquals(List.of("search_leads"), reply.toolsUsed());

        ArgumentCaptor<List<Map<String, ?>>> sent = ArgumentCaptor.forClass(List.class);
        verify(aiService, times(2)).chatCompletion(sent.capture(), notNull(), anyInt(), anyDouble());
        List<Map<String, ?>> secondRound = sent.getAllValues().get(1);
        Map<String, ?> toolMessage = secondRound.get(secondRound.size() - 1);
        assertEquals("tool", toolMessage.get("role"));
        assertEquals("call-1", toolMessage.get("tool_call_id"));
        assertEquals("{\"total\":2}", toolMessage.get("content"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void chat_answersFromFetchedDataWhenProviderRefusesALaterStep() {
        Map<String, Object> toolTurn = new HashMap<>();
        toolTurn.put("tool_calls", List.of(Map.of(
            "id", "call-1",
            "function", Map.of("name", "search_leads", "arguments", "{}"))));
        Map<String, Object> answer = Map.of("content", "You have 1 lead: h.");

        when(tools.definitions()).thenReturn(List.of(Map.of("type", "function")));
        when(tools.execute("search_leads", "{}")).thenReturn("{\"total\":1,\"leads\":[{\"name\":\"h\"}]}");
        when(aiService.chatCompletion(any(), notNull(), anyInt(), anyDouble()))
            .thenReturn((Map) toolTurn)
            .thenThrow(new HttpClientErrorException(HttpStatus.PAYLOAD_TOO_LARGE, "Request Entity Too Large",
                "{\"error\":{\"message\":\"Request too large for model: tokens per minute limit 8000\"}}".getBytes(), null));
        when(aiService.chatCompletion(any(), isNull(), anyInt(), anyDouble())).thenReturn((Map) answer);
        when(aiService.messageText(answer)).thenReturn("You have 1 lead: h.");

        SarathiAgentService.Reply reply = agent.chat(List.of(Map.of("role", "user", "content", "Total leads we have")));

        assertEquals("You have 1 lead: h.", reply.response());
        assertEquals(List.of("search_leads"), reply.toolsUsed());
        assertTrue(reply.notice().contains("HTTP 413") && reply.notice().contains("tokens per minute"), reply.notice());
        ArgumentCaptor<List<Map<String, ?>>> sent = ArgumentCaptor.forClass(List.class);
        verify(aiService).chatCompletion(sent.capture(), isNull(), anyInt(), anyDouble());
        assertTrue(String.valueOf(sent.getValue().get(0).get("content")).contains("\"name\":\"h\""), "fetched leads reach the model");
        assertEquals("Total leads we have", sent.getValue().get(1).get("content"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void chat_fallsBackToOverviewSnapshotWhenModelRejectsTools() {
        Map<String, Object> answer = Map.of("content", "This month you have 40 leads.");
        when(tools.definitions()).thenReturn(List.of(Map.of("type", "function")));
        when(aiService.chatCompletion(any(), notNull(), anyInt(), anyDouble()))
            .thenThrow(new HttpClientErrorException(HttpStatus.BAD_REQUEST, "tools not supported"));
        when(tools.execute(eq("crm_overview"), any())).thenReturn("{\"totalLeads\":40}");
        when(aiService.chatCompletion(any(), isNull(), anyInt(), anyDouble())).thenReturn((Map) answer);
        when(aiService.messageText(answer)).thenReturn("This month you have 40 leads.");

        SarathiAgentService.Reply reply = agent.chat(List.of(Map.of("role", "user", "content", "Summary?")));

        assertEquals("This month you have 40 leads.", reply.response());
        ArgumentCaptor<List<Map<String, ?>>> sent = ArgumentCaptor.forClass(List.class);
        verify(aiService).chatCompletion(sent.capture(), isNull(), anyInt(), anyDouble());
        String system = String.valueOf(sent.getValue().get(0).get("content"));
        assertTrue(system.contains("{\"totalLeads\":40}"), "snapshot is given to the model");
    }
}
