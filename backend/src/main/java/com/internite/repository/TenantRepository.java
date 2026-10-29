package com.internite.repository;

import com.internite.model.Tenant;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface TenantRepository extends MongoRepository<Tenant, String> {
    Optional<Tenant> findBySlugAndDeletedFalse(String slug);
    Optional<Tenant> findByTenantIdAndDeletedFalse(Long tenantId);
}
