package com.nexacrm.service;

import com.nexacrm.model.Lead;
import com.nexacrm.model.LeadCallAutomation;
import com.nexacrm.repository.LeadCallAutomationRepository;
import com.nexacrm.repository.LeadRepository;
import com.nexacrm.security.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LeadCallAutomationServiceTest {

    @Mock
    private LeadCallAutomationRepository leadCallAutomationRepository;

    @Mock
    private LeadRepository leadRepository;

    @Mock
    private CommunicationService communicationService;

    private LeadCallAutomationService service;

    @BeforeEach
    void setUp() {
        service = new LeadCallAutomationService(
            leadCallAutomationRepository,
            leadRepository,
            communicationService
        );
        ReflectionTestUtils.setField(service, "retryMinutes", 60L);
        TenantContext.setCurrentTenantId(1L);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void processDueWorkflow_shouldQueueRetryWithoutRecheckingOldProviderResult() {
        Lead lead = Lead.builder()
            .name("Retry Lead")
            .phone("+919876543210")
            .source(Lead.LeadSource.WEBSITE)
            .status(Lead.LeadStatus.NEW)
            .build();
        lead.setId("lead-1");
        lead.setTenantId(1L);

        LeadCallAutomation workflow = LeadCallAutomation.builder()
            .leadId("lead-1")
            .leadName("Retry Lead")
            .contactNumber("+919876543210")
            .leadSource("WEBSITE")
            .status(Lead.AutomatedCallingStatus.RETRY_SCHEDULED)
            .attemptCount(1)
            .lastCallStatus("BUSY")
            .nextScheduledAt(LocalDateTime.now().minusMinutes(1))
            .build();
        workflow.setId("workflow-1");
        workflow.setTenantId(1L);

        when(leadCallAutomationRepository.findByTenantIdAndLeadId(1L, "lead-1"))
            .thenReturn(Optional.of(workflow));
        when(leadRepository.findByIdAndTenantIdAndDeletedFalse("lead-1", 1L))
            .thenReturn(Optional.of(lead));
        when(leadCallAutomationRepository.save(any(LeadCallAutomation.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));
        when(leadRepository.save(any(Lead.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));

        service.processDueWorkflow(workflow);

        verify(communicationService, never()).fetchLatestLeadCallProviderResult(any());
        verify(communicationService).sendLeadVoiceCall(
            eq("lead-1"),
            eq("Retry Lead"),
            eq("+919876543210"),
            any(),
            eq("scheduled_retry"),
            anyMap()
        );

        ArgumentCaptor<LeadCallAutomation> workflowCaptor = ArgumentCaptor.forClass(LeadCallAutomation.class);
        verify(leadCallAutomationRepository).save(workflowCaptor.capture());
        LeadCallAutomation saved = workflowCaptor.getValue();
        assertEquals(Lead.AutomatedCallingStatus.CALLING, saved.getStatus());
        assertEquals(2, saved.getAttemptCount());
        assertTrue(saved.getNextScheduledAt().isAfter(LocalDateTime.now()));
    }

    @Test
    void handleCallResult_shouldRetryWhenStatusIsNotConnected() {
        Lead lead = Lead.builder()
            .name("Retry Lead")
            .phone("+919876543210")
            .source(Lead.LeadSource.WEBSITE)
            .status(Lead.LeadStatus.NEW)
            .build();
        lead.setId("lead-1");
        lead.setTenantId(1L);

        LeadCallAutomation workflow = LeadCallAutomation.builder()
            .leadId("lead-1")
            .leadName("Retry Lead")
            .contactNumber("+919876543210")
            .leadSource("WEBSITE")
            .status(Lead.AutomatedCallingStatus.CALLING)
            .attemptCount(1)
            .lastCallStatus("QUEUED")
            .nextScheduledAt(LocalDateTime.now().minusMinutes(1))
            .build();
        workflow.setId("workflow-1");
        workflow.setTenantId(1L);

        when(leadCallAutomationRepository.findByTenantIdAndLeadId(1L, "lead-1"))
            .thenReturn(Optional.of(workflow));
        when(leadRepository.findByIdAndTenantIdAndDeletedFalse("lead-1", 1L))
            .thenReturn(Optional.of(lead));
        when(leadCallAutomationRepository.save(any(LeadCallAutomation.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));
        when(leadRepository.save(any(Lead.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));

        service.handleCallResult("lead-1", "NOT_CONNECTED", "", 0, "ext-1");

        ArgumentCaptor<LeadCallAutomation> workflowCaptor = ArgumentCaptor.forClass(LeadCallAutomation.class);
        verify(leadCallAutomationRepository).save(workflowCaptor.capture());
        LeadCallAutomation saved = workflowCaptor.getValue();
        assertEquals(Lead.AutomatedCallingStatus.RETRY_SCHEDULED, saved.getStatus());
        assertEquals("NOT_CONNECTED", saved.getLastCallStatus());
        assertTrue(saved.getNextScheduledAt().isAfter(LocalDateTime.now()));
    }

    @Test
    void processDueWorkflow_shouldStopWithoutCallingWhenLeadWasDeleted() {
        LeadCallAutomation workflow = LeadCallAutomation.builder()
            .leadId("deleted-lead")
            .leadName("Deleted Lead")
            .contactNumber("+919876543210")
            .leadSource("WEBSITE")
            .status(Lead.AutomatedCallingStatus.RETRY_SCHEDULED)
            .attemptCount(2)
            .lastCallStatus("NO_ANSWER")
            .nextScheduledAt(LocalDateTime.now().minusMinutes(1))
            .build();
        workflow.setId("workflow-1");
        workflow.setTenantId(1L);

        when(leadCallAutomationRepository.findByTenantIdAndLeadId(1L, "deleted-lead"))
            .thenReturn(Optional.of(workflow));
        when(leadRepository.findByIdAndTenantIdAndDeletedFalse("deleted-lead", 1L))
            .thenReturn(Optional.empty());
        when(leadCallAutomationRepository.save(any(LeadCallAutomation.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));

        service.processDueWorkflow(workflow);

        verify(communicationService, never()).sendLeadVoiceCall(any(), any(), any(), any(), any(), anyMap());

        ArgumentCaptor<LeadCallAutomation> workflowCaptor = ArgumentCaptor.forClass(LeadCallAutomation.class);
        verify(leadCallAutomationRepository).save(workflowCaptor.capture());
        LeadCallAutomation saved = workflowCaptor.getValue();
        assertEquals(Lead.AutomatedCallingStatus.STOPPED, saved.getStatus());
        assertEquals("Lead no longer exists", saved.getStopReason());
        assertNull(saved.getNextScheduledAt());
    }
}
