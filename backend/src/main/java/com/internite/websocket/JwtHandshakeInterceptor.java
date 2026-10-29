package com.internite.websocket;

import com.internite.model.User;
import com.internite.security.JwtService;
import com.internite.security.TenantContext;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;

@RequiredArgsConstructor
public class JwtHandshakeInterceptor implements HandshakeInterceptor {

    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler wsHandler, Map<String, Object> attributes) {
        if (!(request instanceof ServletServerHttpRequest servletRequest)) {
            return false;
        }

        HttpServletRequest httpRequest = servletRequest.getServletRequest();
        String token = firstNonBlank(
            httpRequest.getParameter("access_token"),
            httpRequest.getHeader("Authorization"),
            readCookie(httpRequest, "access_token")
        );

        if (token == null || token.isBlank()) {
            return false;
        }

        String normalized = token.trim();
        if (normalized.regionMatches(true, 0, "Bearer ", 0, 7)) {
            normalized = normalized.substring(7).trim();
        }

        // User lookup is tenant-scoped, and the handshake does not pass through JwtAuthFilter.
        boolean tenantSet = false;
        try {
            Long tenantId = jwtService.extractTenantId(normalized);
            if (tenantId != null && TenantContext.currentTenantIdOrNull() == null) {
                TenantContext.setCurrentTenantId(tenantId);
                tenantSet = true;
            }
            String username = jwtService.extractUsername(normalized);
            if (username == null || username.isBlank()) {
                return false;
            }
            var userDetails = userDetailsService.loadUserByUsername(username);
            if (!jwtService.isTokenValid(normalized, userDetails)) {
                return false;
            }
            attributes.put("principal", userDetails);
            attributes.put("tenantId", tenantId);
            return true;
        } catch (Exception ignored) {
            return false;
        } finally {
            if (tenantSet) {
                TenantContext.clear();
            }
        }
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler wsHandler, Exception exception) {
        // no-op
    }

    private String readCookie(HttpServletRequest request, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }
        for (Cookie cookie : cookies) {
            if (name.equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return null;
    }
}
