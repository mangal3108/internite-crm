package com.nexacrm.repository;

import com.nexacrm.model.IntegrationConfig;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface IntegrationConfigRepository extends MongoRepository<IntegrationConfig, String> {
    Optional<IntegrationConfig> findByTenantIdAndIntegrationIdAndDeletedFalse(Long tenantId, String integrationId);
    List<IntegrationConfig> findByTenantIdAndDeletedFalse(Long tenantId);
    long countByTenantIdAndDeletedFalse(Long tenantId);
}
