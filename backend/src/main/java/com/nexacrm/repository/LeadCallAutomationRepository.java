package com.nexacrm.repository;

import com.nexacrm.model.Lead;
import com.nexacrm.model.LeadCallAutomation;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface LeadCallAutomationRepository extends MongoRepository<LeadCallAutomation, String> {

    Optional<LeadCallAutomation> findByTenantIdAndLeadId(Long tenantId, String leadId);

    List<LeadCallAutomation> findTop100ByStatusInAndNextScheduledAtLessThanEqualOrderByNextScheduledAtAsc(
        Collection<Lead.AutomatedCallingStatus> statuses,
        LocalDateTime dueAt
    );

    List<LeadCallAutomation> findByTenantIdAndLeadIdIn(Long tenantId, Collection<String> leadIds);
}
