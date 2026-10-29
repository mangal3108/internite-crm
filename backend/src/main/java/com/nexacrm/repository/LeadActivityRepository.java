package com.nexacrm.repository;

import com.nexacrm.model.LeadActivity;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Collection;
import java.util.List;

public interface LeadActivityRepository extends MongoRepository<LeadActivity, String> {
    List<LeadActivity> findByLeadIdAndTenantIdAndDeletedFalseOrderBySavedAtDesc(String leadId, Long tenantId);
    List<LeadActivity> findByLeadIdInAndTenantIdAndDeletedFalseOrderBySavedAtDesc(Collection<String> leadIds, Long tenantId);
    java.util.Optional<LeadActivity> findByIdAndTenantIdAndDeletedFalse(String id, Long tenantId);
}
