package com.nexacrm.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

import com.nexacrm.security.TenantContext;

@Component
@RequiredArgsConstructor
@Slf4j
public class FacebookLeadLiveSyncScheduler {

    private final LeadService leadService;
    private final MongoTemplate mongoTemplate;
    private final AtomicBoolean running = new AtomicBoolean(false);
    private final AtomicLong expiredTokenCooldownUntilEpochMs = new AtomicLong(0L);
    private final AtomicBoolean cooldownNoticeLogged = new AtomicBoolean(false);

    @Value("${nexacrm.facebook.live-sync.enabled:false}")
    private boolean enabled;

    @Value("${nexacrm.facebook.live-sync.include-archived:true}")
    private boolean includeArchived;

    @Value("${nexacrm.facebook.live-sync.lead-page-size:100}")
    private int leadPageSize;

    @Value("${nexacrm.facebook.live-sync.expired-token-cooldown-ms:21600000}")
    private long expiredTokenCooldownMs;

    @Scheduled(fixedDelayString = "${nexacrm.facebook.live-sync.fixed-delay-ms:60000}")
    public void runLiveSync() {
        if (!enabled) return;
        if (isInExpiredTokenCooldown()) return;
        if (!running.compareAndSet(false, true)) {
            log.debug("Facebook live sync skipped: previous run still in progress");
            return;
        }

        try {
            List<Long> tenantIds = resolveTenantIds();
            if (tenantIds.isEmpty()) {
                log.warn("Facebook live sync skipped: no tenants found in any collection");
                return;
            }

            Map<String, String> options = Map.of(
                "includeArchived", String.valueOf(includeArchived),
                "leadPageSize", String.valueOf(leadPageSize)
            );

            for (Long tenant : tenantIds) {
                TenantContext.setCurrentTenantId(tenant);
                try {
                    Map<String, Object> result = leadService.syncFacebookLeadAds(options);
                    clearCooldownIfPresent();
                    log.info(
                        "Facebook live sync completed for tenant {}: formsProcessed={}, fetched={}, imported={}, merged={}, skipped={}, errors={}",
                        tenant,
                        result.get("formsProcessed"),
                        result.get("fetched"),
                        result.get("imported"),
                        result.get("merged"),
                        result.get("skipped"),
                        result.get("errors")
                    );
                } catch (Exception ex) {
                    if (isExpiredTokenError(ex)) {
                        long cooldown = Math.max(60_000L, expiredTokenCooldownMs);
                        long until = System.currentTimeMillis() + cooldown;
                        expiredTokenCooldownUntilEpochMs.set(until);
                        cooldownNoticeLogged.set(false);
                        log.warn(
                            "Facebook live sync paused for {} ms because Meta access token is expired (code 190/subcode 463). "
                                + "Refresh token in Integrations > Facebook or META_PAGE_ACCESS_TOKEN.",
                            cooldown
                        );
                        return;
                    }
                    if (isPageAccessTokenRequiredError(ex)) {
                        long cooldown = Math.max(60_000L, Math.min(expiredTokenCooldownMs, 300_000L));
                        long until = System.currentTimeMillis() + cooldown;
                        expiredTokenCooldownUntilEpochMs.set(until);
                        cooldownNoticeLogged.set(false);
                        log.warn(
                            "Facebook live sync paused for {} ms because configured token is not a Page Access Token. "
                                + "Set Integrations > Facebook accessToken to the selected page token or META_PAGE_ACCESS_TOKEN.",
                            cooldown
                        );
                        return;
                    }
                    log.warn("Facebook live sync failed for tenant {}: {}", tenant, ex.getMessage());
                }
            }
        } finally {
            TenantContext.clear();
            running.set(false);
        }
    }

    private List<Long> resolveTenantIds() {
        LinkedHashSet<Long> tenantIds = new LinkedHashSet<>();
        tenantIds.addAll(distinctTenantIds("users"));
        tenantIds.addAll(distinctTenantIds("integration_configs"));
        tenantIds.addAll(distinctTenantIds("leads"));
        tenantIds.addAll(distinctTenantIds("app_settings"));
        return tenantIds.stream().filter(Objects::nonNull).distinct().toList();
    }

    private List<Long> distinctTenantIds(String collectionName) {
        try {
            return mongoTemplate.findDistinct(
                new Query(Criteria.where("deleted").is(false)),
                "tenant_id",
                collectionName,
                Long.class
            );
        } catch (Exception ex) {
            log.warn("Unable to enumerate tenant ids from {}: {}", collectionName, ex.getMessage());
            return List.of();
        }
    }

    private boolean isInExpiredTokenCooldown() {
        long now = System.currentTimeMillis();
        long until = expiredTokenCooldownUntilEpochMs.get();
        if (until <= now) {
            if (until > 0 && expiredTokenCooldownUntilEpochMs.compareAndSet(until, 0L)) {
                cooldownNoticeLogged.set(false);
                log.info("Facebook live sync cooldown ended; retries resumed.");
            }
            return false;
        }

        if (cooldownNoticeLogged.compareAndSet(false, true)) {
            log.warn(
                "Skipping Facebook live sync until epochMs={} due to expired Meta access token.",
                until
            );
        }
        return true;
    }

    private void clearCooldownIfPresent() {
        if (expiredTokenCooldownUntilEpochMs.getAndSet(0L) > 0L) {
            cooldownNoticeLogged.set(false);
            log.info("Facebook live sync recovered after token refresh.");
        }
    }

    private boolean isExpiredTokenError(Exception ex) {
        String message = ex.getMessage();
        if (message == null || message.isBlank()) {
            return false;
        }
        String normalized = message.toLowerCase();
        return normalized.contains("code\":190")
            && normalized.contains("error_subcode\":463");
    }

    private boolean isPageAccessTokenRequiredError(Exception ex) {
        String message = ex.getMessage();
        if (message == null || message.isBlank()) {
            return false;
        }
        String normalized = message.toLowerCase();
        return normalized.contains("code\":190")
            && normalized.contains("must be called with a page access token");
    }
}
