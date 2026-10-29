package com.nexacrm.repository;

import com.nexacrm.model.Workflow;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;







public interface WorkflowRepository extends MongoRepository<Workflow, String> {
    List<Workflow> findByTenantIdAndDeletedFalse(Long tenantId);
    long countByTenantIdAndDeletedFalse(Long tenantId);
    List<Workflow> findByTenantIdAndDeletedFalseAndStatus(Long tenantId, Workflow.WorkflowStatus status);
    Optional<Workflow> findByIdAndTenantIdAndDeletedFalse(String id, Long tenantId);
}
