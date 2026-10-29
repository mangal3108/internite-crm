package com.nexacrm.repository;

import com.nexacrm.model.Deal;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface DealRepository extends MongoRepository<Deal, String> {

    List<Deal> findByStageAndTenantIdAndDeletedFalse(Deal.DealStage stage, Long tenantId);

    List<Deal> findByTenantIdAndDeletedFalse(Long tenantId);

    List<Deal> findByTenantIdAndDeletedFalseAndStage(Long tenantId, Deal.DealStage stage);

    List<Deal> findByTenantIdAndDeletedFalseAndOwner_Id(Long tenantId, String ownerId);

    List<Deal> findByTenantIdAndDeletedFalseAndPipelineId(Long tenantId, Long pipelineId);

    List<Deal> findByTenantIdAndDeletedFalseAndStageAndOwner_Id(Long tenantId, Deal.DealStage stage, String ownerId);

    List<Deal> findByTenantIdAndDeletedFalseAndStageAndPipelineId(Long tenantId, Deal.DealStage stage, Long pipelineId);

    List<Deal> findByTenantIdAndDeletedFalseAndOwner_IdAndPipelineId(Long tenantId, String ownerId, Long pipelineId);

    List<Deal> findByTenantIdAndDeletedFalseAndStageAndOwner_IdAndPipelineId(
        Long tenantId, Deal.DealStage stage, String ownerId, Long pipelineId
    );

    Optional<Deal> findByIdAndTenantIdAndDeletedFalse(String id, Long tenantId);

    Optional<Deal> findByLead_IdAndTenantIdAndDeletedFalse(String leadId, Long tenantId);

    long countByTenantIdAndDeletedFalse(Long tenantId);

    long countByTenantIdAndDeletedFalseAndStage(Long tenantId, Deal.DealStage stage);

    List<Deal> findByTenantIdAndStageAndDeletedFalse(Long tenantId, Deal.DealStage stage);
}
