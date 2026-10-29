package com.nexacrm.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.CachingConfigurer;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.cache.interceptor.CacheErrorHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import java.time.Duration;

@Configuration
@EnableCaching
public class CacheConfig implements CachingConfigurer {

    private static final Logger log = LoggerFactory.getLogger(CacheConfig.class);

    @Value("${nexacrm.cache.dashboard-ttl-seconds:30}")
    private long dashboardTtlSeconds;

    @Value("${nexacrm.cache.pipeline-board-ttl-seconds:10}")
    private long pipelineBoardTtlSeconds;

    @Value("${nexacrm.cache.leads-list-ttl-seconds:15}")
    private long leadsListTtlSeconds;

    @Bean
    public CacheManager cacheManager(RedisConnectionFactory connectionFactory) {
        try {
            // Verify Redis is reachable before building the Redis cache manager
            connectionFactory.getConnection().close();
            log.info("Redis is available — using RedisCacheManager");
            return buildRedisCacheManager(connectionFactory);
        } catch (Exception e) {
            log.warn("Redis is not available ({}). Falling back to in-memory cache.", e.getMessage());
            return new ConcurrentMapCacheManager();
        }
    }

    private RedisCacheManager buildRedisCacheManager(RedisConnectionFactory connectionFactory) {
        // Use JDK serialization for cache values — Java records support it natively
        // and it avoids the Jackson polymorphic-type / record-deserialization issues
        // that plague GenericJackson2JsonRedisSerializer with DTO records.
        RedisCacheConfiguration defaultConfig = RedisCacheConfiguration.defaultCacheConfig()
                .serializeKeysWith(RedisSerializationContext.SerializationPair.fromSerializer(new StringRedisSerializer()))
                .disableCachingNullValues();

        RedisCacheConfiguration dashboardConfig = defaultConfig
                .entryTtl(Duration.ofSeconds(dashboardTtlSeconds));
        RedisCacheConfiguration pipelineBoardConfig = defaultConfig
                .entryTtl(Duration.ofSeconds(pipelineBoardTtlSeconds));
        RedisCacheConfiguration leadsListConfig = defaultConfig
                .entryTtl(Duration.ofSeconds(leadsListTtlSeconds));

        return RedisCacheManager.builder(connectionFactory)
                .cacheDefaults(defaultConfig.entryTtl(Duration.ofMinutes(5)))
                .withCacheConfiguration("leads-list", leadsListConfig)
                .withCacheConfiguration("pipeline-board", pipelineBoardConfig)
                .withCacheConfiguration("dashboard-summary", dashboardConfig)
                .withCacheConfiguration("dashboard-funnel", dashboardConfig)
                .withCacheConfiguration("dashboard-employees", dashboardConfig)
                .withCacheConfiguration("dashboard-sources", dashboardConfig)
                .withCacheConfiguration("dashboard-activities", dashboardConfig)
                .withCacheConfiguration("dashboard-trend", dashboardConfig)
                .withCacheConfiguration("dashboard-widgets", dashboardConfig)
                .withCacheConfiguration("dashboard-overview", dashboardConfig)
                .build();
    }

    @Override
    public CacheErrorHandler errorHandler() {
        return new CacheErrorHandler() {
            @Override
            public void handleCacheGetError(RuntimeException e, Cache cache, Object key) {
                log.warn("Cache GET failed [{}]: {}", cache.getName(), e.getMessage());
            }

            @Override
            public void handleCachePutError(RuntimeException e, Cache cache, Object key, Object value) {
                log.warn("Cache PUT failed [{}]: {}", cache.getName(), e.getMessage());
            }

            @Override
            public void handleCacheEvictError(RuntimeException e, Cache cache, Object key) {
                log.warn("Cache EVICT failed [{}]: {}", cache.getName(), e.getMessage());
            }

            @Override
            public void handleCacheClearError(RuntimeException e, Cache cache) {
                log.warn("Cache CLEAR failed [{}]: {}", cache.getName(), e.getMessage());
            }
        };
    }
}
