package com.nexacrm.controller;

import com.nexacrm.dto.AuthRequest;
import com.nexacrm.dto.AuthResponse;
import com.nexacrm.dto.UserDTO;
import com.nexacrm.security.TenantContext;
import com.nexacrm.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Tag(name = "Authentication", description = "JWT auth endpoints")
public class AuthController {

    private final AuthService authService;

    @Value("${auth.cookie.access.name:access_token}")
    private String accessCookieName;

    @Value("${auth.cookie.refresh.name:refresh_token}")
    private String refreshCookieName;

    @Value("${auth.cookie.domain:}")
    private String cookieDomain;

    @Value("${auth.cookie.secure:false}")
    private boolean cookieSecure;

    @Value("${auth.cookie.same-site:Lax}")
    private String cookieSameSite;

    @Value("${auth.cookie.access.max-age-seconds:86400}")
    private long accessCookieMaxAgeSeconds;

    @Value("${auth.cookie.refresh.max-age-seconds:604800}")
    private long refreshCookieMaxAgeSeconds;

    @PostMapping("/login")
    @Operation(summary = "Login with email & password, returns JWT tokens")
    public ResponseEntity<AuthResponse> login(
            @RequestHeader(value = "X-Tenant-ID", required = false) Long tenantId,
            @Valid @RequestBody AuthRequest request,
            HttpServletResponse response) {
        if (tenantId != null) {
            request.setTenantId(tenantId);
        }
        TenantContext.setCurrentTenantId(request.getTenantId());
        try {
            AuthResponse auth = authService.login(request);
            writeAuthCookies(response, auth.getAccessToken(), auth.getRefreshToken());
            return ResponseEntity.ok(auth);
        } finally {
            TenantContext.clear();
        }
    }

    @PostMapping("/logout")
    @Operation(summary = "Invalidate refresh token")
    public ResponseEntity<Void> logout(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody(required = false) Map<String, String> body,
            HttpServletRequest request,
            HttpServletResponse response) {
        String refreshToken = body != null ? body.get("refreshToken") : null;
        if (refreshToken == null || refreshToken.isBlank()) {
            refreshToken = readCookie(request, refreshCookieName);
        }
        authService.logout(authHeader, refreshToken);
        clearAuthCookies(response);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/refresh")
    @Operation(summary = "Get new access token using refresh token")
    public ResponseEntity<AuthResponse> refresh(
            @RequestBody(required = false) Map<String, String> body,
            HttpServletRequest request,
            HttpServletResponse response) {
        String refreshToken = body != null ? body.get("refreshToken") : null;
        if (refreshToken == null || refreshToken.isBlank()) {
            refreshToken = readCookie(request, refreshCookieName);
        }
        AuthResponse refreshed = authService.refresh(refreshToken);
        writeAuthCookies(response, refreshed.getAccessToken(), refreshed.getRefreshToken());
        return ResponseEntity.ok(refreshed);
    }

    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Get current authenticated user")
    public ResponseEntity<Map<String, Object>> me() {
        return ResponseEntity.ok(authService.getCurrentUser());
    }

    @PutMapping("/me")
    @PreAuthorize("hasAuthority('profile.update')")
    @Operation(summary = "Update current authenticated user's profile")
    public ResponseEntity<UserDTO> updateMe(@RequestBody UserDTO dto) {
        return ResponseEntity.ok(authService.updateCurrentUser(dto));
    }

    private void writeAuthCookies(HttpServletResponse response, String accessToken, String refreshToken) {
        response.addHeader(HttpHeaders.SET_COOKIE, buildCookie(accessCookieName, accessToken, accessCookieMaxAgeSeconds).toString());
        response.addHeader(HttpHeaders.SET_COOKIE, buildCookie(refreshCookieName, refreshToken, refreshCookieMaxAgeSeconds).toString());
    }

    private void clearAuthCookies(HttpServletResponse response) {
        response.addHeader(HttpHeaders.SET_COOKIE, buildCookie(accessCookieName, "", 0).toString());
        response.addHeader(HttpHeaders.SET_COOKIE, buildCookie(refreshCookieName, "", 0).toString());
    }

    private ResponseCookie buildCookie(String name, String value, long maxAgeSeconds) {
        ResponseCookie.ResponseCookieBuilder builder = ResponseCookie.from(name, value == null ? "" : value)
            .httpOnly(true)
            .secure(cookieSecure)
            .sameSite(cookieSameSite)
            .path("/")
            .maxAge(maxAgeSeconds);
        if (cookieDomain != null && !cookieDomain.isBlank()) {
            builder.domain(cookieDomain);
        }
        return builder.build();
    }

    private String readCookie(HttpServletRequest request, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;
        for (Cookie cookie : cookies) {
            if (name.equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }
}
