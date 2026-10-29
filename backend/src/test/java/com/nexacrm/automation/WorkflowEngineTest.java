package com.nexacrm.automation;

import com.nexacrm.model.Workflow;
import com.nexacrm.model.WorkflowRunLog;
import com.nexacrm.repository.DealRepository;
import com.nexacrm.repository.InvoiceRepository;
import com.nexacrm.repository.LeadRepository;
import com.nexacrm.repository.UserRepository;
import com.nexacrm.repository.WorkflowRepository;
import com.nexacrm.repository.WorkflowRunLogRepository;
import com.nexacrm.service.CommunicationService;
import com.nexacrm.websocket.NotificationPublisher;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WorkflowEngineTest {

    @Mock private WorkflowRepository workflowRepository;
    @Mock private WorkflowRunLogRepository workflowRunLogRepository;
    @Mock private DealRepository dealRepository;
    @Mock private InvoiceRepository invoiceRepository;
    @Mock private LeadRepository leadRepository;
    @Mock private UserRepository userRepository;
    @Mock private CommunicationService communicationService;
    @Mock private NotificationPublisher notificationPublisher;

    @InjectMocks
    private WorkflowEngine workflowEngine;

    @Test
    void processEvent_shouldSkipWhenThenActionIsNotExecutable() {
        Workflow workflow = workflowWithSteps(
            step("IF", "trigger: LEAD_CREATED"),
            step("THEN", "this action does not exist")
        );

        when(workflowRepository.findByTenantIdAndDeletedFalseAndStatus(1L, Workflow.WorkflowStatus.ACTIVE))
            .thenReturn(List.of(workflow));

        workflowEngine.processEvent("LEAD_CREATED", Map.of("leadId", "lead-1"));

        verify(workflowRepository, never()).save(any(Workflow.class));
        ArgumentCaptor<WorkflowRunLog> logCaptor = ArgumentCaptor.forClass(WorkflowRunLog.class);
        verify(workflowRunLogRepository).save(logCaptor.capture());
        assertEquals("SKIPPED", logCaptor.getValue().getStatus());
        assertTrue(logCaptor.getValue().getMessage().contains("No executable action"));
    }

    @Test
    void processEvent_shouldHonorWaitAndExecuteThenAction() {
        Workflow workflow = workflowWithSteps(
            step("IF", "trigger: LEAD_CREATED"),
            step("WAIT", "10 ms"),
            step("THEN", "notify:follow-up now")
        );

        when(workflowRepository.findByTenantIdAndDeletedFalseAndStatus(1L, Workflow.WorkflowStatus.ACTIVE))
            .thenReturn(List.of(workflow));
        when(workflowRepository.save(any(Workflow.class))).thenAnswer(invocation -> invocation.getArgument(0));

        long start = System.currentTimeMillis();
        workflowEngine.processEvent("LEAD_CREATED", Map.of("leadId", "lead-1"));
        long elapsed = System.currentTimeMillis() - start;

        assertTrue(elapsed >= 8, "Expected WAIT step to delay execution");
        verify(workflowRepository).save(any(Workflow.class));
        verify(notificationPublisher).broadcast(any(Map.class));

        ArgumentCaptor<WorkflowRunLog> logCaptor = ArgumentCaptor.forClass(WorkflowRunLog.class);
        verify(workflowRunLogRepository).save(logCaptor.capture());
        assertEquals("EXECUTED", logCaptor.getValue().getStatus());
    }

    @Test
    void processEvent_shouldExecuteSendCallAction() {
        Workflow workflow = workflowWithSteps(
            step("IF", "trigger: LEAD_CREATED"),
            step("THEN", "send_call:+919876543210|Hello from workflow")
        );

        when(workflowRepository.findByTenantIdAndDeletedFalseAndStatus(1L, Workflow.WorkflowStatus.ACTIVE))
            .thenReturn(List.of(workflow));
        when(workflowRepository.save(any(Workflow.class))).thenAnswer(invocation -> invocation.getArgument(0));

        workflowEngine.processEvent("LEAD_CREATED", Map.of("leadId", "lead-1", "leadPhone", "9876543210"));

        verify(communicationService).sendChannelMessage("call", "+919876543210", "", "Hello from workflow");
    }

    private Workflow workflowWithSteps(Workflow.WorkflowStep... steps) {
        Workflow workflow = Workflow.builder()
            .name("Test Workflow")
            .category("Operations")
            .status(Workflow.WorkflowStatus.ACTIVE)
            .runs(0)
            .lastRun("Never")
            .steps(List.of(steps))
            .build();
        workflow.setId("wf-1");
        workflow.setTenantId(1L);
        workflow.setDeleted(false);
        return workflow;
    }

    private Workflow.WorkflowStep step(String type, String text) {
        return Workflow.WorkflowStep.builder().type(type).text(text).build();
    }
}
