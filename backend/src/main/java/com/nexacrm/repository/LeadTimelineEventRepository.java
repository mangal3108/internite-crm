package com.nexacrm.repository;

import com.nexacrm.model.LeadTimelineEvent;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface LeadTimelineEventRepository extends MongoRepository<LeadTimelineEvent, String> {
    Page<LeadTimelineEvent> findByTenantIdAndLeadIdAndDeletedFalseOrderByEventAtDesc(Long tenantId, String leadId, Pageable pageable);
    Optional<LeadTimelineEvent> findByTenantIdAndSourceTypeAndSourceId(Long tenantId, String sourceType, String sourceId);
    long countByTenantIdAndLeadIdAndDeletedFalse(Long tenantId, String leadId);
}
