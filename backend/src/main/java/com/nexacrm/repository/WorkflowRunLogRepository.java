package com.nexacrm.repository;

import com.nexacrm.model.WorkflowRunLog;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface WorkflowRunLogRepository extends MongoRepository<WorkflowRunLog, String> {
    List<WorkflowRunLog> findTop100ByWorkflowIdAndTenantIdAndDeletedFalseOrderByRunAtDesc(String workflowId, Long tenantId);
}
