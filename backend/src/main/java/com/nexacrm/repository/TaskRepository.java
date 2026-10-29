package com.nexacrm.repository;

import com.nexacrm.model.Task;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface TaskRepository extends MongoRepository<Task, String> {
    List<Task> findByTenantIdAndDeletedFalseOrderByDueDateAsc(Long tenantId);
    List<Task> findByTenantIdAndAssignedToIdAndDeletedFalseOrderByDueDateAsc(Long tenantId, String assignedToId);
    List<Task> findByTenantIdAndDeletedFalseAndStatusOrderByDueDateAsc(Long tenantId, String status);
    List<Task> findByTenantIdAndDeletedFalseAndStatusOrderByDueDateAsc(Long tenantId, String status, Pageable pageable);
    List<Task> findByTenantIdAndAssignedToIdAndDeletedFalseAndStatusOrderByDueDateAsc(Long tenantId, String assignedToId, String status);
    List<Task> findByTenantIdAndAssignedToIdAndDeletedFalseAndStatusOrderByDueDateAsc(Long tenantId, String assignedToId, String status, Pageable pageable);
    List<Task> findByTenantIdAndCreatedByIdAndDeletedFalseAndStatusOrderByDueDateAsc(Long tenantId, String createdById, String status, Pageable pageable);
    List<Task> findByTenantIdAndLeadIdAndDeletedFalseOrderByDueDateAsc(Long tenantId, String leadId);
    List<Task> findByTenantIdAndLeadIdAndDeletedFalseAndStatusOrderByDueDateAsc(Long tenantId, String leadId, String status);
    Optional<Task> findByIdAndTenantIdAndDeletedFalse(String id, Long tenantId);
}
