package com.nexacrm.repository;

import com.nexacrm.model.Subscription;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface SubscriptionRepository extends MongoRepository<Subscription, String> {
    Optional<Subscription> findByTenantIdAndDeletedFalse(Long tenantId);
    List<Subscription> findByTenantId(Long tenantId);
    List<Subscription> findAllByDeletedFalse();
    List<Subscription> findByStatusAndDeletedFalse(String status);
}
