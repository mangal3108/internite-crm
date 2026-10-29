package com.nexacrm.service;

import com.nexacrm.exception.UnauthorizedException;
import com.nexacrm.model.RefreshToken;
import com.nexacrm.model.User;
import com.nexacrm.repository.RefreshTokenRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;

@Service
@RequiredArgsConstructor
public class RefreshTokenService {

    private final RefreshTokenRepository refreshTokenRepository;

    @Transactional
    public RefreshToken issue(User user, String refreshToken, long refreshTokenTtlMs) {
        RefreshToken token = RefreshToken.builder()
            .userId(user.getId())
            .tokenHash(hash(refreshToken))
            .expiresAt(Instant.now().plusMillis(refreshTokenTtlMs))
            .revokedAt(null)
            .build();
        token.setTenantId(user.getTenantId() != null ? user.getTenantId() : 1L);
        return refreshTokenRepository.save(token);
    }

    @Transactional(readOnly = true)
    public RefreshToken requireActiveToken(Long tenantId, String refreshToken, User user) {
        String tokenHash = hash(refreshToken);
        RefreshToken token = refreshTokenRepository.findByTenantIdAndTokenHashAndDeletedFalse(tenantId, tokenHash)
            .orElseThrow(() -> new UnauthorizedException("Refresh token is invalid or revoked"));

        if (token.getRevokedAt() != null || token.getExpiresAt() == null || token.getExpiresAt().isBefore(Instant.now())) {
            throw new UnauthorizedException("Refresh token is invalid or revoked");
        }

        if (user != null && user.getId() != null && !user.getId().equals(token.getUserId())) {
            throw new UnauthorizedException("Refresh token does not belong to the authenticated user");
        }

        return token;
    }

    @Transactional
    public void revokeRawToken(Long tenantId, String refreshToken) {
        String tokenHash = hash(refreshToken);
        refreshTokenRepository.findByTenantIdAndTokenHashAndDeletedFalse(tenantId, tokenHash).ifPresent(token -> {
            token.setRevokedAt(Instant.now());
            refreshTokenRepository.save(token);
        });
    }

    @Transactional
    public void revokeLatestForUser(Long tenantId, String userId) {
        refreshTokenRepository.findTopByTenantIdAndUserIdAndRevokedAtIsNullAndDeletedFalseOrderByCreatedAtDesc(tenantId, userId)
            .ifPresent(token -> {
                token.setRevokedAt(Instant.now());
                refreshTokenRepository.save(token);
            });
    }

    @Transactional
    public RefreshToken rotate(Long tenantId, User user, String oldRefreshToken, String newRefreshToken, long refreshTokenTtlMs) {
        RefreshToken current = requireActiveToken(tenantId, oldRefreshToken, user);
        current.setRevokedAt(Instant.now());
        current.setReplacedByTokenHash(hash(newRefreshToken));
        refreshTokenRepository.save(current);
        return issue(user, newRefreshToken, refreshTokenTtlMs);
    }

    private String hash(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(value == null ? new byte[0] : value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(bytes);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("Unable to hash token", e);
        }
    }
}
