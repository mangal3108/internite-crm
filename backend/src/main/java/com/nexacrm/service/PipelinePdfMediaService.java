package com.nexacrm.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
@Slf4j
public class PipelinePdfMediaService {

    private static final Duration MEDIA_TTL = Duration.ofMinutes(15);
    private static final int MAX_MEDIA_ITEMS = 32;

    private final Map<String, PublishedPdf> media = new ConcurrentHashMap<>();

    public String publish(byte[] content, String fileName) {
        if (content == null || content.length == 0) {
            throw new IllegalArgumentException("Pipeline PDF is empty.");
        }
        cleanupExpired();
        if (media.size() >= MAX_MEDIA_ITEMS) {
            throw new IllegalStateException("Temporary PDF storage is busy. Please try again shortly.");
        }

        String token = UUID.randomUUID().toString();
        media.put(token, new PublishedPdf(content.clone(), fileName, Instant.now().plus(MEDIA_TTL)));
        return token;
    }

    public Optional<PublishedPdf> get(String token) {
        if (token == null || token.isBlank()) {
            return Optional.empty();
        }
        PublishedPdf item = media.get(token);
        if (item == null || item.expiresAt().isBefore(Instant.now())) {
            if (item != null) media.remove(token, item);
            return Optional.empty();
        }
        return Optional.of(item);
    }

    @Scheduled(fixedDelay = 60_000L)
    public void cleanupExpired() {
        Instant now = Instant.now();
        media.entrySet().removeIf(entry -> entry.getValue().expiresAt().isBefore(now));
    }

    public record PublishedPdf(byte[] content, String fileName, Instant expiresAt) {}
}
