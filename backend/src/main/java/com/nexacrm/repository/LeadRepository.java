package com.nexacrm.repository;

import com.nexacrm.model.Lead;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface LeadRepository extends MongoRepository<Lead, String> {

    Optional<Lead> findByIdAndTenantIdAndDeletedFalse(String id, Long tenantId);

    Optional<Lead> findByEmailAndTenantIdAndDeletedFalse(String email, Long tenantId);

    Optional<Lead> findByPhoneAndTenantIdAndDeletedFalse(String phone, Long tenantId);

    Optional<Lead> findFirstByPhoneAndTenantIdAndDeletedFalseOrderByUpdatedAtDesc(String phone, Long tenantId);

    Optional<Lead> findByFacebookLeadIdAndTenantIdAndDeletedFalse(String facebookLeadId, Long tenantId);

    Optional<Lead> findByFacebookLeadIdAndDeletedFalse(String facebookLeadId);

    List<Lead> findByIdInAndTenantIdAndDeletedFalse(Collection<String> ids, Long tenantId);

    List<Lead> findByAssignedTo_IdAndDeletedFalse(String userId);

    List<Lead> findByTenantIdAndDeletedFalse(Long tenantId);

    List<Lead> findByTenantIdAndDeletedFalseAndStatus(Long tenantId, Lead.LeadStatus status);

    List<Lead> findByTenantIdAndDeletedFalseAndScore(Long tenantId, Lead.LeadScore score);

    long countByTenantIdAndDeletedFalse(Long tenantId);

    long countByTenantIdAndDeletedFalseAndScore(Long tenantId, Lead.LeadScore score);

    long countByTenantIdAndDeletedFalseAndStatus(Long tenantId, Lead.LeadStatus status);
}
