package com.internite.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.internite.dto.LeadDTO;
import com.internite.dto.PageResponse;
import com.internite.service.dashboard.LeadConversionDashboardService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CrmAgentToolsTest {

    @Mock private LeadService leadService;
    @Mock private LeadActivityService leadActivityService;
    @Mock private DealService dealService;
    @Mock private TaskService taskService;
    @Mock private CustomerService customerService;
    @Mock private InvoiceService invoiceService;
    @Mock private UserService userService;
    @Mock private CallAgentService callAgentService;
    @Mock private LeadConversionDashboardService dashboardService;

    private CrmAgentTools tools;

    @BeforeEach
    void setUp() {
        tools = new CrmAgentTools(leadService, leadActivityService, dealService, taskService, customerService,
            invoiceService, userService, callAgentService, dashboardService, new ObjectMapper().findAndRegisterModules());
    }

    @AfterEach
    void clearAuth() {
        SecurityContextHolder.clearContext();
    }

    private void signInWith(String... authorities) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
            "rahul@internite.com", null, Arrays.stream(authorities).map(SimpleGrantedAuthority::new).toList()));
    }

    @Test
    void execute_refusesDataTheRoleCannotRead() {
        signInWith("leads.read");

        String result = tools.execute("list_invoices", "{}");

        assertTrue(result.contains("cannot view"), result);
        verifyNoInteractions(invoiceService);
    }

    @Test
    void searchLeads_passesFiltersCapsLimitAndDropsEmptyFields() {
        signInWith("leads.read");
        LeadDTO lead = new LeadDTO();
        lead.setName("Asha Rao");
        lead.setCompany("");
        when(leadService.findAll(any(), any(), any(), any(), any(), any()))
            .thenReturn(PageResponse.<LeadDTO>builder().content(List.of(lead)).total(1).build());

        String result = tools.execute("search_leads", "{\"score\":\"hot\",\"limit\":500}");

        verify(leadService).findAll(null, null, "HOT", null, null, PageRequest.of(0, 50));
        assertTrue(result.contains("Asha Rao"), result);
        assertFalse(result.contains("company"), "empty fields are dropped: " + result);
    }

    @Test
    void definitions_offerOnlyReadOnlyTools() {
        List<String> names = tools.definitions().stream()
            .map(t -> String.valueOf(((java.util.Map<?, ?>) t.get("function")).get("name")))
            .toList();

        assertTrue(names.contains("search_leads"));
        assertTrue(names.stream().noneMatch(n -> n.matches("(?i).*(create|update|delete|assign|send|call_lead).*")), names.toString());
    }
}
