package com.nexacrm.repository;

import com.nexacrm.model.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;
import java.util.List;

public interface NotificationRepository extends MongoRepository<Notification, String> {

    Page<Notification> findByTenantIdAndUser_IdAndDeletedFalseOrderByCreatedAtDesc(Long tenantId, String userId, Pageable pageable);

    long countByTenantIdAndUser_IdAndIsReadFalseAndDeletedFalse(Long tenantId, String userId);

    List<Notification> findByTenantIdAndUser_IdAndIsReadFalseAndDeletedFalse(Long tenantId, String userId);

    Optional<Notification> findByIdAndTenantIdAndUser_IdAndDeletedFalse(String id, Long tenantId, String userId);

    boolean existsByTenantIdAndUser_IdAndEntityTypeAndEntityIdAndTitleAndDeletedFalse(Long tenantId, String userId, String entityType, String entityId, String title);
}
