package com.nexacrm.repository;

import com.nexacrm.model.Invoice;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface InvoiceRepository extends MongoRepository<Invoice, String> {

    Optional<Invoice> findByIdAndTenantIdAndDeletedFalse(String id, Long tenantId);

    List<Invoice> findByTenantIdAndDeletedFalse(Long tenantId);

    List<Invoice> findByTenantIdAndDeletedFalseAndStatus(Long tenantId, Invoice.InvoiceStatus status);

    List<Invoice> findByTenantIdAndDeletedFalseAndCustomer_Id(Long tenantId, String customerId);

    List<Invoice> findByTenantIdAndDeletedFalseAndStatusAndCustomer_Id(
        Long tenantId,
        Invoice.InvoiceStatus status,
        String customerId
    );

    List<Invoice> findByTenantIdAndDeletedFalseAndStatusInAndDueDateBefore(
        Long tenantId,
        List<Invoice.InvoiceStatus> statuses,
        LocalDate today
    );

    boolean existsByInvoiceNumberAndTenantId(String invoiceNumber, Long tenantId);

    long countByTenantIdAndDeletedFalse(Long tenantId);
}
