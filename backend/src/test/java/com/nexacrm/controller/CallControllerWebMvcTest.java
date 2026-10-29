package com.nexacrm.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexacrm.exception.GlobalExceptionHandler;
import com.nexacrm.service.CallAgentService;
import com.nexacrm.service.LeadService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class CallControllerWebMvcTest {

    @Mock
    private LeadService leadService;

    @Mock
    private CallAgentService callAgentService;

    @InjectMocks
    private CallController callController;

    private MockMvc mockMvc;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(callController)
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
    }

    @Test
    void triggerLeadCall_shouldDelegateToLeadService() throws Exception {
        when(leadService.callLeadNow("lead-123", "Hello from script"))
            .thenReturn(Map.of("ok", true, "leadId", "lead-123"));

        mockMvc.perform(post("/api/calls/trigger/lead-123")
                .contentType(APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("script", "Hello from script"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.leadId").value("lead-123"));

        verify(leadService).callLeadNow("lead-123", "Hello from script");
    }

    @Test
    void webhook_shouldReturnForbiddenWhenSecretInvalid() throws Exception {
        when(callAgentService.isWebhookAuthorized(any(), any(), anyMap())).thenReturn(false);

        mockMvc.perform(post("/api/calls/webhook")
                .contentType(APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("status", "completed"))))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.ok").value(false));
    }

    @Test
    void webhook_shouldProcessWhenAuthorized() throws Exception {
        when(callAgentService.isWebhookAuthorized(any(), any(), anyMap())).thenReturn(true);
        when(callAgentService.processWebhook(anyMap()))
            .thenReturn(Map.of("ok", true, "status", "COMPLETED"));

        mockMvc.perform(post("/api/calls/webhook")
                .contentType(APPLICATION_JSON)
                .header("X-Call-Agent-Secret", "secret")
                .content(objectMapper.writeValueAsString(Map.of("status", "completed"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ok").value(true))
            .andExpect(jsonPath("$.status").value("COMPLETED"));

        verify(callAgentService).processWebhook(anyMap());
    }

    @Test
    void getLeadCalls_shouldReturnHistory() throws Exception {
        when(callAgentService.getLeadCallHistory("lead-abc"))
            .thenReturn(List.of(
                Map.of("id", "c1", "status", "QUEUED"),
                Map.of("id", "c2", "status", "COMPLETED")
            ));

        mockMvc.perform(get("/api/calls/lead-abc"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].id").value("c1"))
            .andExpect(jsonPath("$[1].status").value("COMPLETED"));
    }

    @Test
    void retryCall_shouldDelegateToService() throws Exception {
        when(callAgentService.retryCall(eq("call-55")))
            .thenReturn(Map.of("ok", true, "callId", "call-55"));

        mockMvc.perform(post("/api/calls/retry/call-55"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ok").value(true))
            .andExpect(jsonPath("$.callId").value("call-55"));
    }
}
