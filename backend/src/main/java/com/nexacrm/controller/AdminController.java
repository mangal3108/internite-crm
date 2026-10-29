package com.nexacrm.controller;

import com.nexacrm.repository.*;
import com.nexacrm.security.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('COMPANY_ADMIN', 'ADMIN')")
public class AdminController {

    private final UserRepository userRepository;
    private final LeadRepository leadRepository;
    private final DealRepository dealRepository;
    private final CustomerRepository customerRepository;
    private final InvoiceRepository invoiceRepository;

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats() {
        Long tenantId = TenantContext.currentTenantIdOrNull();
        if (tenantId == null) {
            tenantId = 0L;
        }
        long totalUsers     = userRepository.findByTenantIdAndDeletedFalse(tenantId).size();
        long activeUsers    = userRepository.findByTenantIdAndDeletedFalse(tenantId).stream().filter(u -> Boolean.TRUE.equals(u.getIsActive())).count();
        long totalLeads     = leadRepository.findByTenantIdAndDeletedFalse(tenantId).size();
        long totalDeals     = dealRepository.findByTenantIdAndDeletedFalse(tenantId).size();
        long totalCustomers = customerRepository.countByTenantIdAndDeletedFalse(tenantId);
        long totalInvoices  = invoiceRepository.countByTenantIdAndDeletedFalse(tenantId);

        return ResponseEntity.ok(Map.of(
            "totalUsers",     totalUsers,
            "activeUsers",    activeUsers,
            "totalLeads",     totalLeads,
            "totalDeals",     totalDeals,
            "totalCustomers", totalCustomers,
            "totalInvoices",  totalInvoices,
            "tenantId",       tenantId
        ));
    }
}
