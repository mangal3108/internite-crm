package com.nexacrm.repository;

import com.nexacrm.model.RefreshToken;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface RefreshTokenRepository extends MongoRepository<RefreshToken, String> {

    Optional<RefreshToken> findByTenantIdAndTokenHashAndDeletedFalse(Long tenantId, String tokenHash);

    Optional<RefreshToken> findTopByTenantIdAndUserIdAndRevokedAtIsNullAndDeletedFalseOrderByCreatedAtDesc(Long tenantId, String userId);
}
