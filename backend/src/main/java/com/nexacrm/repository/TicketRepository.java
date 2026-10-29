package com.nexacrm.repository;

import com.nexacrm.model.Ticket;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface TicketRepository extends MongoRepository<Ticket, String> {
    List<Ticket> findByTenantIdAndDeletedFalseOrderByCreatedAtDesc(Long tenantId);
    Optional<Ticket> findByIdAndTenantIdAndDeletedFalse(String id, Long tenantId);
    long countByTenantIdAndDeletedFalseAndStatus(Long tenantId, String status);
    long countByTenantIdAndDeletedFalse(Long tenantId);
}
