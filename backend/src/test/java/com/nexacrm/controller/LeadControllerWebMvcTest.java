package com.nexacrm.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexacrm.dto.LeadActivityDTO;
import com.nexacrm.dto.LeadDTO;
import com.nexacrm.dto.PageResponse;
import com.nexacrm.exception.GlobalExceptionHandler;
import com.nexacrm.model.Lead;
import com.nexacrm.service.LeadActivityService;
import com.nexacrm.service.LeadService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableHandlerMethodArgumentResolver;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class LeadControllerWebMvcTest {

    @Mock
    private LeadService leadService;

    @Mock
    private LeadActivityService leadActivityService;

    @Spy
    private ObjectMapper controllerObjectMapper = new ObjectMapper();

    @InjectMocks
    private LeadController leadController;

    private MockMvc mockMvc;
    private final ObjectMapper testObjectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();
        ReflectionTestUtils.setField(leadController, "facebookIngestionToken", "test-webhook-token");

        mockMvc = MockMvcBuilders.standaloneSetup(leadController)
            .setControllerAdvice(new GlobalExceptionHandler())
            .setCustomArgumentResolvers(new PageableHandlerMethodArgumentResolver())
            .setValidator(validator)
            .build();
    }

    @Test
    void createLead_shouldReturnCreated() throws Exception {
        LeadDTO request = LeadDTO.builder()
            .name("Jane Doe")
            .email("jane@example.com")
            .source(Lead.LeadSource.WEBSITE)
            .build();
        LeadDTO saved = LeadDTO.builder()
            .id("lead-123")
            .name("Jane Doe")
            .email("jane@example.com")
            .source(Lead.LeadSource.WEBSITE)
            .build();

        when(leadService.create(any(LeadDTO.class))).thenReturn(saved);

        mockMvc.perform(post("/api/leads")
                .contentType(MediaType.APPLICATION_JSON)
                .content(testObjectMapper.writeValueAsString(request)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").value("lead-123"))
            .andExpect(jsonPath("$.email").value("jane@example.com"));
    }

    @Test
    void createLead_shouldFailValidationWhenSourceMissing() throws Exception {
        Map<String, Object> body = Map.of(
            "name", "Jane Doe",
            "email", "jane@example.com"
        );

        mockMvc.perform(post("/api/leads")
                .contentType(MediaType.APPLICATION_JSON)
                .content(testObjectMapper.writeValueAsString(body)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("Validation Failed"))
            .andExpect(jsonPath("$.fieldErrors.source").exists());
    }

    @Test
    void createFacebookLead_shouldRejectMissingNameOrEmail() throws Exception {
        Map<String, Object> body = Map.of("phone", "9999999999");

        mockMvc.perform(post("/api/leads/facebook")
                .header("X-Webhook-Token", "test-webhook-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(testObjectMapper.writeValueAsString(body)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("name and email are required"));
    }

    @Test
    void createFacebookLead_shouldMapPayloadAndReturnLeadId() throws Exception {
        LeadDTO saved = LeadDTO.builder().id("lead-fb-1").build();
        when(leadService.create(any(LeadDTO.class))).thenReturn(saved);

        Map<String, Object> body = Map.of(
            "full_name", "FB User",
            "email", "fb@example.com",
            "phone_number", "8888888888",
            "form_name", "Demo Form",
            "campaign_name", "Summer Campaign"
        );

        mockMvc.perform(post("/api/leads/facebook")
                .header("X-Webhook-Token", "test-webhook-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(testObjectMapper.writeValueAsString(body)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.leadId").value("lead-fb-1"))
            .andExpect(jsonPath("$.message").value("Lead saved successfully"));

        ArgumentCaptor<LeadDTO> captor = ArgumentCaptor.forClass(LeadDTO.class);
        verify(leadService).create(captor.capture());
        LeadDTO mapped = captor.getValue();
        assertEquals("FB User", mapped.getName());
        assertEquals("fb@example.com", mapped.getEmail());
        assertEquals("8888888888", mapped.getPhone());
        assertEquals(Lead.LeadSource.META_ADS, mapped.getSource());
        assertEquals(Lead.LeadStatus.NEW, mapped.getStatus());
        assertTrue(mapped.getNotes().contains("Demo Form"));
    }

    @Test
    void getLeads_shouldPassFiltersAndPageable() throws Exception {
        PageResponse<LeadDTO> response = PageResponse.<LeadDTO>builder()
            .content(List.of())
            .page(2)
            .size(50)
            .total(0)
            .totalPages(0)
            .first(false)
            .last(true)
            .build();
        when(leadService.findAll(eq("john"), eq("NEW"), eq("HOT"), eq("WEBSITE"), eq("u-1"), any(Pageable.class)))
            .thenReturn(response);

        mockMvc.perform(get("/api/leads")
                .param("search", "john")
                .param("status", "NEW")
                .param("score", "HOT")
                .param("source", "WEBSITE")
                .param("assignedTo", "u-1")
                .param("page", "2")
                .param("size", "50"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.page").value(2))
            .andExpect(jsonPath("$.size").value(50));

        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(leadService).findAll(eq("john"), eq("NEW"), eq("HOT"), eq("WEBSITE"), eq("u-1"), pageableCaptor.capture());
        Pageable pageable = pageableCaptor.getValue();
        assertEquals(2, pageable.getPageNumber());
        assertEquals(50, pageable.getPageSize());
    }

    @Test
    void addLeadActivity_shouldAllowServiceDefaultWhenAssignedToMissing() throws Exception {
        Map<String, Object> body = Map.of(
            "activityIndex", 0,
            "activityId", "act01",
            "activityLabel", "Activity 01",
            "activityTitle", "Welcome Call",
            "summary", "No assignee"
        );
        LeadActivityDTO saved = LeadActivityDTO.builder()
            .id("activity-1")
            .leadId("lead-1")
            .activityIndex(0)
            .activityId("act01")
            .activityLabel("Activity 01")
            .activityTitle("Welcome Call")
            .summary("No assignee")
            .assignedTo("Sales Team")
            .build();
        when(leadActivityService.create(eq("lead-1"), any(LeadActivityDTO.class))).thenReturn(saved);

        mockMvc.perform(post("/api/leads/lead-1/activities")
                .contentType(MediaType.APPLICATION_JSON)
                .content(testObjectMapper.writeValueAsString(body)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.assignedTo").value("Sales Team"));

        verify(leadActivityService).create(eq("lead-1"), any(LeadActivityDTO.class));
    }

    @Test
    void addLeadActivity_shouldFailWhenActivityIndexOutOfRange() throws Exception {
        Map<String, Object> body = Map.of(
            "activityIndex", 9,
            "activityId", "act09",
            "activityLabel", "Activity 09",
            "activityTitle", "Invalid",
            "assignedTo", "QA User",
            "summary", "Invalid index"
        );

        mockMvc.perform(post("/api/leads/lead-1/activities")
                .contentType(MediaType.APPLICATION_JSON)
                .content(testObjectMapper.writeValueAsString(body)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("Validation Failed"))
            .andExpect(jsonPath("$.fieldErrors.activityIndex").exists());

        verify(leadActivityService, never()).create(any(), any());
    }

    @Test
    void updateLeadActivity_shouldDelegateToService() throws Exception {
        Map<String, Object> body = Map.of(
            "activityIndex", 1,
            "activityId", "act02",
            "activityLabel", "Activity 02",
            "activityTitle", "Follow Up for Meeting",
            "assignedTo", "Sales Team",
            "summary", "Edited follow-up"
        );
        LeadActivityDTO updated = LeadActivityDTO.builder()
            .id("activity-1")
            .leadId("lead-1")
            .activityIndex(1)
            .activityId("act02")
            .activityLabel("Activity 02")
            .activityTitle("Follow Up for Meeting")
            .summary("Edited follow-up")
            .assignedTo("Sales Team")
            .build();
        when(leadActivityService.update(eq("lead-1"), eq("activity-1"), any(LeadActivityDTO.class))).thenReturn(updated);

        mockMvc.perform(put("/api/leads/lead-1/activities/activity-1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(testObjectMapper.writeValueAsString(body)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value("activity-1"))
            .andExpect(jsonPath("$.summary").value("Edited follow-up"));

        verify(leadActivityService).update(eq("lead-1"), eq("activity-1"), any(LeadActivityDTO.class));
    }

    @Test
    void callLead_shouldQueueCall() throws Exception {
        when(leadService.callLeadNow(eq("lead-1"), eq("Please call now")))
            .thenReturn(Map.of(
                "message", "Call queued successfully",
                "leadId", "lead-1",
                "phone", "9876543210"
            ));

        mockMvc.perform(post("/api/leads/lead-1/call")
                .contentType(MediaType.APPLICATION_JSON)
                .content(testObjectMapper.writeValueAsString(Map.of("script", "Please call now"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.leadId").value("lead-1"))
            .andExpect(jsonPath("$.message").value("Call queued successfully"));

        verify(leadService).callLeadNow("lead-1", "Please call now");
    }

    @Test
    void findDuplicates_shouldDelegateToService() throws Exception {
        when(leadService.findDuplicates(eq("dup@example.com"), eq("9999999999"), eq("lead-1")))
            .thenReturn(List.of(LeadDTO.builder().id("lead-2").build()));

        mockMvc.perform(get("/api/leads/duplicates")
                .param("email", "dup@example.com")
                .param("phone", "9999999999")
                .param("excludeId", "lead-1"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].id").value("lead-2"));

        verify(leadService).findDuplicates("dup@example.com", "9999999999", "lead-1");
    }

    @Test
    void mergeLead_shouldDelegateToService() throws Exception {
        when(leadService.merge(eq("lead-primary"), eq("lead-dup")))
            .thenReturn(LeadDTO.builder().id("lead-primary").build());

        mockMvc.perform(post("/api/leads/lead-primary/merge")
                .contentType(MediaType.APPLICATION_JSON)
                .content(testObjectMapper.writeValueAsString(Map.of("duplicateId", "lead-dup"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value("lead-primary"));

        verify(leadService).merge("lead-primary", "lead-dup");
    }

    @Test
    void reopenLead_shouldDelegateToService() throws Exception {
        when(leadService.reopen(eq("lead-lost"), any()))
            .thenReturn(LeadDTO.builder().id("lead-lost").status(Lead.LeadStatus.NEW).build());

        mockMvc.perform(post("/api/leads/lead-lost/reopen")
                .contentType(MediaType.APPLICATION_JSON)
                .content(testObjectMapper.writeValueAsString(Map.of("note", "Re-opened for follow-up"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("NEW"));

        verify(leadService).reopen(eq("lead-lost"), any());
    }

    @Test
    void leadAging_shouldDelegateToService() throws Exception {
        when(leadService.leadAging("lead-aging"))
            .thenReturn(Map.of("slaState", "BREACHED", "stale", true));

        mockMvc.perform(get("/api/leads/lead-aging/aging"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.slaState").value("BREACHED"));

        verify(leadService).leadAging("lead-aging");
    }
}
