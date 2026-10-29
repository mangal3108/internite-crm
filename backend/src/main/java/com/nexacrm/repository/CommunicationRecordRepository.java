package com.nexacrm.repository;

import com.nexacrm.model.CommunicationRecord;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface CommunicationRecordRepository extends MongoRepository<CommunicationRecord, String> {

    List<CommunicationRecord> findTop500ByChannelIgnoreCaseAndContactIdentifierOrderByCreatedAtAsc(
        String channel,
        String contactIdentifier
    );

    List<CommunicationRecord> findTop500ByTenantIdAndChannelIgnoreCaseAndContactIdentifierOrderByCreatedAtAsc(
        Long tenantId,
        String channel,
        String contactIdentifier
    );

    List<CommunicationRecord> findByChannelIgnoreCaseOrderByCreatedAtDesc(String channel, Pageable pageable);

    List<CommunicationRecord> findByTenantIdAndChannelIgnoreCaseOrderByCreatedAtDesc(Long tenantId, String channel, Pageable pageable);

    boolean existsByChannelIgnoreCaseAndExternalId(String channel, String externalId);

    boolean existsByTenantIdAndChannelIgnoreCaseAndExternalId(Long tenantId, String channel, String externalId);

    Optional<CommunicationRecord> findFirstByChannelIgnoreCaseAndExternalIdOrderByCreatedAtDesc(
        String channel,
        String externalId
    );

    Optional<CommunicationRecord> findFirstByTenantIdAndChannelIgnoreCaseAndExternalIdOrderByCreatedAtDesc(
        Long tenantId,
        String channel,
        String externalId
    );

    List<CommunicationRecord> findTop50ByLeadIdAndChannelIgnoreCaseOrderByCreatedAtDesc(String leadId, String channel);

    List<CommunicationRecord> findTop50ByTenantIdAndLeadIdAndChannelIgnoreCaseOrderByCreatedAtDesc(
        Long tenantId,
        String leadId,
        String channel
    );

    Optional<CommunicationRecord> findByIdAndChannelIgnoreCase(String id, String channel);
}
