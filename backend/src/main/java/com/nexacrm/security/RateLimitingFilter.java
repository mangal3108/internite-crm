package com.nexacrm.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;

@Component
@Slf4j
public class RateLimitingFilter extends OncePerRequestFilter {

    private static final long WINDOW_MILLIS = 60_000L;
    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    @Value("${nexacrm.rate-limit.api-per-minute:120}")
    private int apiLimitPerMinute;

    @Value("${nexacrm.rate-limit.public-per-minute:30}")
    private int publicLimitPerMinute;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return path == null || !path.startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
        throws ServletException, IOException {
        String key = rateLimitKey(request);
        int limit = isSensitive(request) ? publicLimitPerMinute : apiLimitPerMinute;
        Window window = windows.computeIfAbsent(key, ignored -> new Window());

        synchronized (window) {
            long now = System.currentTimeMillis();
            if (now - window.windowStart >= WINDOW_MILLIS) {
                window.windowStart = now;
                window.count = 0;
            }

            if (window.count >= limit) {
                long retryAfter = Math.max(1L, (WINDOW_MILLIS - (now - window.windowStart)) / 1000L);
                response.setStatus(429);
                response.setHeader("Retry-After", String.valueOf(retryAfter));
                response.setContentType("application/json");
                response.getWriter().write("""
                    {"error":"Too Many Requests","message":"Please slow down and try again."}
                """);
                return;
            }

            window.count++;
        }

        cleanupIfIdle(key);
        filterChain.doFilter(request, response);
    }

    private String rateLimitKey(HttpServletRequest request) {
        String ip = Objects.toString(resolveClientIp(request), "unknown");
        return ip + "|" + request.getMethod() + "|" + request.getRequestURI();
    }

    private boolean isSensitive(HttpServletRequest request) {
        String path = request.getRequestURI();
        return path.startsWith("/api/auth/")
            || path.startsWith("/api/webhooks/")
            || path.equals("/api/calls/webhook")
            || path.startsWith("/api/leads/facebook");
    }

    private String resolveClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }
        return request.getRemoteAddr();
    }

    private void cleanupIfIdle(String currentKey) {
        if (windows.size() < 512 || currentKey == null) {
            return;
        }
        long now = Instant.now().toEpochMilli();
        windows.entrySet().removeIf(entry -> now - entry.getValue().windowStart > WINDOW_MILLIS * 5);
    }

    private static final class Window {
        private long windowStart = System.currentTimeMillis();
        private int count = 0;
    }
}
