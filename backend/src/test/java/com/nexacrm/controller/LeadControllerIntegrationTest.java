package com.nexacrm.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexacrm.dto.LeadDTO;
import com.nexacrm.exception.GlobalExceptionHandler;
import com.nexacrm.model.Lead;
import com.nexacrm.service.LeadActivityService;
import com.nexacrm.service.LeadService;
import com.nexacrm.security.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = LeadController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(GlobalExceptionHandler.class)
@TestPropertySource(properties = "meta.webhook-token=test-webhook-token")
class LeadControllerIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;

    @MockBean private LeadService leadService;
    @MockBean private LeadActivityService leadActivityService;
    @MockBean private JwtService jwtService;
    @MockBean private UserDetailsService userDetailsService;

    @Test
    void createLead_shouldReturnValidationErrorsThroughSpringMvcStack() throws Exception {
        Map<String, Object> invalidPayload = Map.of(
            "name", "Jane Doe",
            "email", "jane@example.com"
        );

        mockMvc.perform(post("/api/leads")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(invalidPayload)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("Validation Failed"))
            .andExpect(jsonPath("$.fieldErrors.source").value("Source is required"));

        verify(leadService, never()).create(any());
    }

    @Test
    void createFacebookLead_shouldRejectUnauthorizedWebhookToken() throws Exception {
        mockMvc.perform(post("/api/leads/facebook")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                    "name", "FB User",
                    "email", "fb@example.com"
                ))))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.error").value("Unauthorized webhook token"));

        verify(leadService, never()).create(any());
    }

    @Test
    void createFacebookLead_shouldMapPayloadAndReturnLeadId() throws Exception {
        LeadDTO saved = LeadDTO.builder()
            .id("lead-fb-1")
            .name("FB User")
            .email("fb@example.com")
            .source(Lead.LeadSource.META_ADS)
            .build();

        when(leadService.create(any(LeadDTO.class))).thenReturn(saved);

        mockMvc.perform(post("/api/leads/facebook")
                .header("X-Webhook-Token", "test-webhook-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                    "full_name", "FB User",
                    "email", "fb@example.com",
                    "campaign_name", "Summer Campaign",
                    "leadgen_id", "lg-123"
                ))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.message").value("Lead saved successfully"))
            .andExpect(jsonPath("$.leadId").value("lead-fb-1"))
            .andExpect(jsonPath("$.facebookLeadId").value("lg-123"))
            .andExpect(jsonPath("$.receivedKeys").isArray());

        verify(leadService).create(any(LeadDTO.class));
    }
}
