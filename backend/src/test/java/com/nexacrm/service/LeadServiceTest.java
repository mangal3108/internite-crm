package com.nexacrm.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexacrm.automation.WorkflowEngine;
import com.nexacrm.dto.LeadDTO;
import com.nexacrm.model.Lead;
import com.nexacrm.model.User;
import com.nexacrm.repository.CustomerRepository;
import com.nexacrm.repository.DealRepository;
import com.nexacrm.repository.LeadRepository;
import com.nexacrm.repository.UserRepository;
import org.bson.Document;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.ArgumentCaptor;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LeadServiceTest {

    private static final String TEST_USER_EMAIL = "test.user@example.com";

    @Mock private LeadRepository leadRepository;
    @Mock private LeadChangeAuditService leadChangeAuditService;
    @Mock private CustomerRepository customerRepository;
    @Mock private DealRepository dealRepository;
    @Mock private UserRepository userRepository;
    @Mock private MongoTemplate mongoTemplate;
    @Mock private NotificationService notificationService;
    @Mock private WorkflowEngine workflowEngine;
    @Mock private CommunicationService communicationService;
    @Mock private LeadCallAutomationService leadCallAutomationService;
    @Mock private IntegrationService integrationService;
    @Mock private LeadAutoAssignService leadAutoAssignService;
    @Mock private LeadActivityService leadActivityService;
    @Mock private RestTemplate restTemplate;
    @Mock private ObjectMapper objectMapper;

    @InjectMocks
    private LeadService leadService;

    @BeforeEach
    void setDefaultSecurityContext() {
        lenient().when(leadChangeAuditService.save(any(Lead.class))).thenAnswer(invocation -> leadRepository.save(invocation.getArgument(0)));
        User currentUser = User.builder()
            .name("Test User")
            .email(TEST_USER_EMAIL)
            .role(User.Role.MANAGER)
            .build();
        currentUser.setId("u-test");
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(TEST_USER_EMAIL, "n/a")
        );
        lenient().when(userRepository.findByEmailAndTenantIdAndDeletedFalse(TEST_USER_EMAIL, 1L))
            .thenReturn(Optional.of(currentUser));
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void create_shouldBlockDuplicateEmail() {
        Lead existing = Lead.builder()
            .name("Existing")
            .email("duplicate@example.com")
            .source(Lead.LeadSource.WEBSITE)
            .build();
        when(leadRepository.findByEmailAndTenantIdAndDeletedFalse("duplicate@example.com", 1L))
            .thenReturn(Optional.of(existing));

        LeadDTO dto = LeadDTO.builder()
            .name("New Lead")
            .email("  DUPLICATE@example.com ")
            .source(Lead.LeadSource.WEBSITE)
            .build();

        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> leadService.create(dto));
        assertTrue(ex.getMessage().contains("already exists"));
        verify(leadRepository, never()).save(any(Lead.class));
        verify(notificationService, never()).notifyLeadCreated(any(), any(), any());
        verify(leadCallAutomationService, never()).startForNewLeadAsync(any(), any());
    }

    @Test
    void create_shouldTriggerAutoCallAndWorkflowWithPhone() {
        LeadDTO dto = LeadDTO.builder()
            .name("New Lead")
            .email("newlead@example.com")
            .phone("9876543210")
            .source(Lead.LeadSource.WEBSITE)
            .build();

        when(leadRepository.findByEmailAndTenantIdAndDeletedFalse("newlead@example.com", 1L))
            .thenReturn(Optional.empty());
        when(leadRepository.save(any(Lead.class))).thenAnswer(invocation -> {
            Lead saved = invocation.getArgument(0);
            saved.setId("lead-100");
            return saved;
        });

        LeadDTO created = leadService.create(dto);

        assertEquals("lead-100", created.getId());
        ArgumentCaptor<Map<String, Object>> contextCaptor = ArgumentCaptor.forClass(Map.class);
        verify(workflowEngine).processEvent(eq("LEAD_CREATED"), contextCaptor.capture());
        assertEquals("9876543210", contextCaptor.getValue().get("leadPhone"));
        verify(leadCallAutomationService).startForNewLeadAsync(any(Lead.class), eq(1L));
    }

    @Test
    void delete_shouldCancelPendingBolnaCallsBeforeDeletingLead() {
        Lead lead = Lead.builder()
            .name("Delete Me")
            .email("delete@example.com")
            .phone("+919876543210")
            .source(Lead.LeadSource.WEBSITE)
            .build();
        lead.setId("lead-delete");
        lead.setTenantId(1L);

        when(leadRepository.findByIdAndTenantIdAndDeletedFalse("lead-delete", 1L))
            .thenReturn(Optional.of(lead));

        leadService.delete("lead-delete");

        var ordered = inOrder(communicationService, leadRepository);
        ordered.verify(communicationService).cancelPendingLeadVoiceCalls("lead-delete");
        ordered.verify(leadRepository).deleteAll(List.of(lead));
    }

    @Test
    void findAll_shouldReturnPageWithoutBlockingOnActivityStages() {
        List<Document> docs = java.util.stream.IntStream.rangeClosed(1, 11)
            .mapToObj(i -> new Document("_id", "lead-" + i)
                .append("name", "Lead " + i)
                .append("email", "lead" + i + "@example.com")
                .append("source", "WEBSITE")
                .append("status", "NEW")
                .append("score", "COLD"))
            .toList();
        when(mongoTemplate.find(any(Query.class), eq(Document.class), eq("leads"))).thenReturn(docs);

        var page = leadService.findAll(null, null, null, null, null, PageRequest.of(0, 10));

        assertEquals(10, page.getContent().size());
        assertEquals(11, page.getTotal());
        assertEquals(false, page.isLast());
        assertEquals(null, page.getContent().get(0).getActivityStageIndex());
        verify(leadActivityService, never()).getMaxStageByLeadIds(any());

        ArgumentCaptor<Query> queryCaptor = ArgumentCaptor.forClass(Query.class);
        verify(mongoTemplate).find(queryCaptor.capture(), eq(Document.class), eq("leads"));
        assertEquals(11, queryCaptor.getValue().getLimit());
        assertEquals(-1, queryCaptor.getValue().getSortObject().getInteger("createdAt"));
    }

    @Test
    void update_shouldBlockEmailChangeToExistingLead() {
        Lead current = Lead.builder()
            .name("Current")
            .email("current@example.com")
            .source(Lead.LeadSource.WEBSITE)
            .build();
        current.setId("lead-1");

        Lead another = Lead.builder()
            .name("Another")
            .email("taken@example.com")
            .source(Lead.LeadSource.WEBSITE)
            .build();

        when(leadRepository.findByIdAndTenantIdAndDeletedFalse("lead-1", 1L)).thenReturn(Optional.of(current));
        when(leadRepository.findByEmailAndTenantIdAndDeletedFalse("taken@example.com", 1L))
            .thenReturn(Optional.of(another));

        LeadDTO dto = LeadDTO.builder()
            .name("Current")
            .email("taken@example.com")
            .source(Lead.LeadSource.WEBSITE)
            .build();

        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> leadService.update("lead-1", dto));
        assertTrue(ex.getMessage().contains("already exists"));
        verify(leadRepository, never()).save(any(Lead.class));
    }

    @Test
    void update_shouldPreservePhoneAndCustomSourceLabelWhenPatchOmitsThem() {
        Lead current = Lead.builder()
            .name("Current")
            .email("current@example.com")
            .phone("9876543210")
            .source(Lead.LeadSource.OTHER)
            .sourceLabel("Fire exhibition")
            .status(Lead.LeadStatus.NEW)
            .build();
        current.setId("lead-1");

        when(leadRepository.findByIdAndTenantIdAndDeletedFalse("lead-1", 1L)).thenReturn(Optional.of(current));
        when(leadRepository.save(any(Lead.class))).thenAnswer(invocation -> invocation.getArgument(0));

        LeadDTO dto = LeadDTO.builder()
            .name("Current")
            .email("current@example.com")
            .source(Lead.LeadSource.OTHER)
            .reminder15SentAt(LocalDateTime.now())
            .build();

        LeadDTO updated = leadService.update("lead-1", dto);

        assertEquals("9876543210", current.getPhone());
        assertEquals("Fire exhibition", current.getSourceLabel());
        assertEquals("9876543210", updated.getPhone());
        assertEquals("Fire exhibition", updated.getSourceLabel());
    }

    @Test
    void scoreWithAI_shouldPersistComputedHotScore() {
        User owner = User.builder().name("Owner").build();
        owner.setId("u-1");
        Lead lead = Lead.builder()
            .name("Priority Lead")
            .email("priority@example.com")
            .phone("9999999999")
            .company("Acme")
            .source(Lead.LeadSource.REFERRAL)
            .status(Lead.LeadStatus.QUALIFIED)
            .priority(Lead.LeadPriority.HIGH)
            .dealValue(BigDecimal.valueOf(500_000))
            .assignedTo(owner)
            .lastContactedAt(LocalDateTime.now().minusDays(1))
            .build();
        lead.setId("lead-hot");

        when(leadRepository.findByIdAndTenantIdAndDeletedFalse("lead-hot", 1L)).thenReturn(Optional.of(lead));
        when(leadRepository.save(any(Lead.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Map<String, Object> result = leadService.scoreWithAI("lead-hot");

        assertEquals("HOT", result.get("score"));
        assertEquals(100, result.get("scoreValue"));
        assertEquals(Lead.LeadScore.HOT, lead.getScore());
        assertEquals(100, lead.getAiScoreValue());
        assertTrue(lead.getAiNextAction().toLowerCase().contains("decision-maker"));
        verify(leadRepository).save(eq(lead));
    }

    @Test
    void convertToCustomer_shouldCreateCustomerAndDealAndMarkLeadWon() {
        Lead lead = Lead.builder()
            .name("Lead One")
            .email("lead1@example.com")
            .phone("9999999999")
            .company("Acme")
            .source(Lead.LeadSource.WEBSITE)
            .status(Lead.LeadStatus.NEW)
            .dealValue(BigDecimal.valueOf(250_000))
            .build();
        lead.setId("lead-1");

        when(leadRepository.findByIdAndTenantIdAndDeletedFalse("lead-1", 1L)).thenReturn(Optional.of(lead));
        when(customerRepository.findByEmailAndTenantIdAndDeletedFalse("lead1@example.com", 1L))
            .thenReturn(Optional.empty());
        when(dealRepository.findByLead_IdAndTenantIdAndDeletedFalse("lead-1", 1L))
            .thenReturn(Optional.empty());
        when(customerRepository.save(any())).thenAnswer(invocation -> {
            com.nexacrm.model.Customer c = invocation.getArgument(0);
            c.setId("cust-1");
            return c;
        });
        when(dealRepository.save(any())).thenAnswer(invocation -> {
            com.nexacrm.model.Deal d = invocation.getArgument(0);
            d.setId("deal-1");
            return d;
        });
        when(leadRepository.save(any(Lead.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Map<String, Object> result = leadService.convertToCustomer("lead-1", Map.of());

        assertEquals("lead-1", result.get("leadId"));
        assertEquals("cust-1", result.get("customerId"));
        assertEquals("deal-1", result.get("dealId"));
        assertEquals(Lead.LeadStatus.WON, lead.getStatus());
        assertTrue(lead.getLastContactedAt() != null);
        verify(customerRepository).save(any());
        verify(dealRepository).save(any());
        verify(leadRepository, atLeastOnce()).save(eq(lead));
    }

    @Test
    void convertToCustomer_shouldReuseExistingCustomerAndDeal() {
        Lead lead = Lead.builder()
            .name("Lead Two")
            .email("lead2@example.com")
            .source(Lead.LeadSource.WEBSITE)
            .status(Lead.LeadStatus.QUALIFIED)
            .build();
        lead.setId("lead-2");

        com.nexacrm.model.Customer existingCustomer = com.nexacrm.model.Customer.builder()
            .name("Existing Customer")
            .email("lead2@example.com")
            .build();
        existingCustomer.setId("cust-existing");

        com.nexacrm.model.Deal existingDeal = com.nexacrm.model.Deal.builder()
            .title("Existing Deal")
            .lead(lead)
            .build();
        existingDeal.setId("deal-existing");

        when(leadRepository.findByIdAndTenantIdAndDeletedFalse("lead-2", 1L)).thenReturn(Optional.of(lead));
        when(customerRepository.findByEmailAndTenantIdAndDeletedFalse("lead2@example.com", 1L))
            .thenReturn(Optional.of(existingCustomer));
        when(dealRepository.findByLead_IdAndTenantIdAndDeletedFalse("lead-2", 1L))
            .thenReturn(Optional.of(existingDeal));
        when(leadRepository.save(any(Lead.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Map<String, Object> result = leadService.convertToCustomer("lead-2", Map.of());

        assertEquals("cust-existing", result.get("customerId"));
        assertEquals("deal-existing", result.get("dealId"));
        assertEquals(Lead.LeadStatus.WON, lead.getStatus());
        verify(customerRepository, never()).save(any());
        verify(dealRepository, never()).save(any());
        verify(leadRepository, atLeastOnce()).save(eq(lead));
    }

    @Test
    void callLeadNow_shouldQueueCallAndUpdateLastContactedAt() {
        Lead lead = Lead.builder()
            .name("Call Target")
            .email("call@example.com")
            .phone("9876543210")
            .source(Lead.LeadSource.WEBSITE)
            .status(Lead.LeadStatus.NEW)
            .build();
        lead.setId("lead-call-1");

        when(leadRepository.findByIdAndTenantIdAndDeletedFalse("lead-call-1", 1L)).thenReturn(Optional.of(lead));
        when(leadRepository.save(any(Lead.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Map<String, Object> result = leadService.callLeadNow("lead-call-1", null);

        assertEquals("lead-call-1", result.get("leadId"));
        assertNotNull(lead.getLastContactedAt());
        verify(communicationService).sendLeadVoiceCall(
            eq("lead-call-1"),
            eq("Call Target"),
            eq("9876543210"),
            any(String.class),
            eq("manual_lead_call"),
            any(Map.class)
        );
        verify(leadRepository).save(eq(lead));
    }

    @Test
    void callLeadNow_shouldFailWhenPhoneMissing() {
        Lead lead = Lead.builder()
            .name("No Phone")
            .email("nophone@example.com")
            .source(Lead.LeadSource.WEBSITE)
            .status(Lead.LeadStatus.NEW)
            .build();
        lead.setId("lead-call-2");

        when(leadRepository.findByIdAndTenantIdAndDeletedFalse("lead-call-2", 1L)).thenReturn(Optional.of(lead));

        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> leadService.callLeadNow("lead-call-2", null));
        assertTrue(ex.getMessage().toLowerCase().contains("phone"));
        verify(communicationService, never()).sendLeadVoiceCall(any(), any(), any(), any(), any(), any());
    }

    @Test
    void create_shouldRequireLostReasonWhenMarkedLost() {
        when(leadRepository.findByEmailAndTenantIdAndDeletedFalse("lost@example.com", 1L))
            .thenReturn(Optional.empty());

        LeadDTO dto = LeadDTO.builder()
            .name("Lost Lead")
            .email("lost@example.com")
            .source(Lead.LeadSource.WEBSITE)
            .status(Lead.LeadStatus.LOST)
            .build();

        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> leadService.create(dto));
        assertTrue(ex.getMessage().toLowerCase().contains("lost reason"));
        verify(leadRepository, never()).save(any(Lead.class));
    }

    @Test
    void findDuplicates_shouldReturnMatchingEmailAndPhoneLeads() {
        Lead emailMatch = Lead.builder()
            .name("Email Match")
            .email("dup@example.com")
            .source(Lead.LeadSource.WEBSITE)
            .build();
        emailMatch.setId("lead-email");
        Lead phoneMatch = Lead.builder()
            .name("Phone Match")
            .phone("9999999999")
            .source(Lead.LeadSource.WEBSITE)
            .build();
        phoneMatch.setId("lead-phone");

        when(mongoTemplate.find(any(Query.class), eq(Lead.class))).thenReturn(java.util.List.of(emailMatch, phoneMatch));

        var duplicates = leadService.findDuplicates("dup@example.com", "9999999999", null);

        assertEquals(2, duplicates.size());
    }

    @Test
    void reopen_shouldResetLostLeadAndClearLostReason() {
        User manager = User.builder()
            .name("Manager")
            .email("manager@example.com")
            .role(User.Role.MANAGER)
            .build();
        manager.setId("u-1");

        Lead lead = Lead.builder()
            .name("Closed Lead")
            .email("closed@example.com")
            .source(Lead.LeadSource.WEBSITE)
            .status(Lead.LeadStatus.LOST)
            .lostReason("Budget")
            .build();
        lead.setId("lead-lost");

        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken("manager@example.com", "n/a")
        );
        when(userRepository.findByEmailAndTenantIdAndDeletedFalse("manager@example.com", 1L))
            .thenReturn(Optional.of(manager));
        when(leadRepository.findByIdAndTenantIdAndDeletedFalse("lead-lost", 1L))
            .thenReturn(Optional.of(lead));
        when(leadRepository.save(any(Lead.class))).thenAnswer(invocation -> invocation.getArgument(0));

        LeadDTO reopened = leadService.reopen("lead-lost", Map.of("note", "Follow up immediately"));

        assertEquals(Lead.LeadStatus.NEW, reopened.getStatus());
        assertEquals(null, reopened.getLostReason());
        assertTrue(reopened.getNotes().contains("Reopened Lead"));
    }

    @Test
    void leadAging_shouldReturnSlaState() {
        User manager = User.builder()
            .name("Manager")
            .email("manager@example.com")
            .role(User.Role.MANAGER)
            .build();
        manager.setId("u-1");

        Lead lead = Lead.builder()
            .name("Stale Lead")
            .email("stale@example.com")
            .source(Lead.LeadSource.WEBSITE)
            .followUpDate(LocalDateTime.now().minusMinutes(10))
            .build();
        lead.setId("lead-stale");
        lead.setCreatedAt(LocalDateTime.now().minusHours(5));
        lead.setLastContactedAt(LocalDateTime.now().minusHours(3));

        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken("manager@example.com", "n/a")
        );
        when(userRepository.findByEmailAndTenantIdAndDeletedFalse("manager@example.com", 1L))
            .thenReturn(Optional.of(manager));
        when(leadRepository.findByIdAndTenantIdAndDeletedFalse("lead-stale", 1L))
            .thenReturn(Optional.of(lead));

        Map<String, Object> aging = leadService.leadAging("lead-stale");

        assertEquals("BREACHED", aging.get("slaState"));
        assertEquals(true, aging.get("stale"));
        assertEquals(true, aging.get("overdueFollowUp"));
    }
}
