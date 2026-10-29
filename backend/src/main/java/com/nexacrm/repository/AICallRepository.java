package com.nexacrm.repository;

import com.nexacrm.model.AICall;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface AICallRepository extends MongoRepository<AICall, String> {
    List<AICall> findByTenantIdAndLeadIdAndDeletedFalseOrderByCreatedAtDesc(Long tenantId, String leadId);
    List<AICall> findByTenantIdAndStatusAndDeletedFalseOrderByCreatedAtDesc(Long tenantId, String status);
    Optional<AICall> findByTenantIdAndProviderAndExternalCallIdAndDeletedFalse(Long tenantId, String provider, String externalCallId);
}
