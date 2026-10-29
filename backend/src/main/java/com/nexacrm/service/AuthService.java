package com.nexacrm.service;

import com.nexacrm.dto.AuthRequest;
import com.nexacrm.dto.AuthResponse;
import com.nexacrm.dto.UserDTO;
import com.nexacrm.exception.ResourceNotFoundException;
import com.nexacrm.exception.UnauthorizedException;
import com.nexacrm.model.Tenant;
import com.nexacrm.model.User;
import com.nexacrm.repository.TenantRepository;
import com.nexacrm.repository.UserRepository;
import com.nexacrm.security.TenantContext;
import com.nexacrm.security.JwtService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.Map;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserRepository userRepository;
    private final TenantRepository tenantRepository;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final RefreshTokenService refreshTokenService;

    public AuthResponse login(AuthRequest request) {
        String email = normalizeEmail(request.getEmail());
        Long tenantId = resolveTenantIdForLogin(request);
        TenantContext.setCurrentTenantId(tenantId);
        try {
            // ponytail: authenticate() already loads the user via UserDetailsService,
            // so pull the User from the Authentication principal instead of re-querying.
            var auth = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(email, request.getPassword())
            );

            User user = (User) auth.getPrincipal();

            // FIX #7: Block login if the user's tenant/company is deactivated
            // (Platform admins are exempt — they manage the platform, not a company)
            Tenant tenant = null;
            if (user.getTenantId() != null) {
                tenant = tenantRepository.findByTenantIdAndDeletedFalse(user.getTenantId())
                    .orElse(null);
            }
            if (user.getRole() != User.Role.PLATFORM_ADMIN && tenant != null && !Boolean.TRUE.equals(tenant.getIsActive())) {
                throw new UnauthorizedException("Your company account has been deactivated. Please contact the platform administrator.");
            }

            String accessToken  = jwtService.generateToken(Map.of("tenantId", user.getTenantId()), user);
            String refreshToken = jwtService.generateRefreshToken(user);
            refreshTokenService.issue(user, refreshToken, jwtService.getRefreshExpiration());

            log.info("User logged in: {}", user.getEmail());

            // Reuse tenant fetched above — avoids second lookup in toUserDTO
            String tenantName = tenant != null ? tenant.getName() : null;

            return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .tokenType("Bearer")
                .expiresIn(jwtService.getJwtExpiration())
                .user(UserDTO.builder()
                    .id(user.getId())
                    .name(user.getName())
                    .email(user.getEmail())
                    .role(user.getRole())
                    .phone(user.getPhone())
                    .avatarUrl(user.getAvatarUrl())
                    .isActive(user.getIsActive())
                    .tenantId(user.getTenantId())
                    .tenantName(tenantName)
                    .build())
                .build();
        } finally {
            TenantContext.clear();
        }
    }

    public void logout(String authHeader, String refreshToken) {
        if (refreshToken != null && !refreshToken.isBlank()) {
            try {
                Long tenantId = jwtService.extractTenantId(refreshToken.trim());
                if (tenantId == null) {
                    throw new UnauthorizedException("Refresh token is invalid or missing tenant context");
                }
                refreshTokenService.revokeRawToken(tenantId, refreshToken.trim());
                log.info("Refresh token revoked");
                return;
            } catch (UnauthorizedException ex) {
                throw ex;
            } catch (Exception ex) {
                throw new UnauthorizedException("Refresh token is invalid or revoked");
            }
        }

        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String accessToken = authHeader.substring(7).trim();
            try {
                Long tenantId = jwtService.extractTenantId(accessToken);
                if (tenantId == null) {
                    throw new UnauthorizedException("Access token is invalid or missing tenant context");
                }
                String email = jwtService.extractUsername(accessToken);
                User user = userRepository.findByEmailAndTenantIdAndDeletedFalse(email, tenantId)
                    .orElseThrow(() -> new ResourceNotFoundException("User not found"));
                refreshTokenService.revokeLatestForUser(tenantId, user.getId());
            } catch (Exception e) {
                throw new UnauthorizedException("Invalid logout token");
            }
        }
        log.info("User logged out");
    }

    public AuthResponse refresh(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            throw new UnauthorizedException("Refresh token is required");
        }
        try {
            Long tenantId = jwtService.extractTenantId(refreshToken);
            if (tenantId == null) {
                throw new UnauthorizedException("Refresh token is invalid or missing tenant context");
            }
            String username = jwtService.extractUsername(refreshToken);
            User user = userRepository.findByEmailAndTenantIdAndDeletedFalse(username, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

            if (!jwtService.isTokenValid(refreshToken, user)) {
                throw new UnauthorizedException("Invalid refresh token");
            }

            refreshTokenService.requireActiveToken(tenantId, refreshToken, user);

            String newAccessToken = jwtService.generateToken(Map.of("tenantId", user.getTenantId()), user);
            String newRefreshToken = jwtService.generateRefreshToken(user);
            refreshTokenService.rotate(tenantId, user, refreshToken, newRefreshToken, jwtService.getRefreshExpiration());
            return AuthResponse.builder()
                .accessToken(newAccessToken)
                .refreshToken(newRefreshToken)
                .tokenType("Bearer")
                .expiresIn(jwtService.getJwtExpiration())
                .user(toUserDTO(user))
                .build();
        } catch (UnauthorizedException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new UnauthorizedException("Refresh token is invalid or revoked");
        }
    }

    public Map<String, Object> getCurrentUser() {
        User user = currentAuthenticatedUser();
        String tenantName = null;
        if (user.getTenantId() != null) {
            tenantName = tenantRepository.findByTenantIdAndDeletedFalse(user.getTenantId())
                .map(Tenant::getName)
                .orElse(null);
        }
        java.util.LinkedHashMap<String, Object> result = new java.util.LinkedHashMap<>();
        result.put("id", user.getId());
        result.put("name", user.getName());
        result.put("email", user.getEmail());
        result.put("role", user.getRole());
        result.put("tenantId", user.getTenantId());
        result.put("tenantName", tenantName);
        result.put("isActive", user.getIsActive());
        return result;
    }

    private User currentAuthenticatedUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        Object principal = authentication != null ? authentication.getPrincipal() : null;
        Long tenantId = TenantContext.currentTenantId();
        if (principal instanceof User user
            && user.getTenantId() != null
            && user.getTenantId().equals(tenantId)
            && !Boolean.TRUE.equals(user.getDeleted())) {
            return user;
        }

        String email = authentication != null ? authentication.getName() : null;
        if (email == null || email.isBlank()) {
            throw new ResourceNotFoundException("User not found");
        }
        return userRepository.findByEmailAndTenantIdAndDeletedFalse(email, tenantId)
            .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    public UserDTO updateCurrentUser(UserDTO dto) {
        String currentEmail = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByEmailAndTenantIdAndDeletedFalse(currentEmail, TenantContext.currentTenantId())
            .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        String nextEmail = normalizeEmail(dto.getEmail());
        if (!nextEmail.isBlank() && !nextEmail.equalsIgnoreCase(user.getEmail())) {
            User conflict = userRepository.findByEmailAndTenantIdAndDeletedFalse(nextEmail, user.getTenantId()).orElse(null);
            if (conflict != null && !conflict.getId().equals(user.getId())) {
                throw new IllegalArgumentException("User already exists with email: " + nextEmail);
            }
            user.setEmail(nextEmail);
        }

        if (dto.getName() != null) {
            String name = dto.getName().trim();
            if (name.isBlank()) {
                throw new IllegalArgumentException("Name is required");
            }
            user.setName(name);
        }

        if (dto.getPhone() != null) {
            user.setPhone(dto.getPhone().trim());
        }

        if (dto.getAvatarUrl() != null) {
            user.setAvatarUrl(dto.getAvatarUrl().trim());
        }

        User saved = userRepository.save(user);
        log.info("User profile updated: id={}, email={}", saved.getId(), saved.getEmail());
        return toUserDTO(saved);
    }

    private UserDTO toUserDTO(User user) {
        String tenantName = null;
        if (user.getTenantId() != null) {
            tenantName = tenantRepository.findByTenantIdAndDeletedFalse(user.getTenantId())
                .map(Tenant::getName)
                .orElse(null);
        }
        return UserDTO.builder()
            .id(user.getId())
            .name(user.getName())
            .email(user.getEmail())
            .role(user.getRole())
            .phone(user.getPhone())
            .avatarUrl(user.getAvatarUrl())
            .isActive(user.getIsActive())
            .tenantId(user.getTenantId())
            .tenantName(tenantName)
            .build();
    }

    private String normalizeEmail(String email) {
        if (email == null) return "";
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private Long resolveTenantIdForLogin(AuthRequest request) {
        String email = normalizeEmail(request.getEmail());
        if (request.getTenantId() != null) {
            return request.getTenantId();
        }

        List<User> matches = userRepository.findAllByEmailAndDeletedFalse(email);
        if (matches.isEmpty()) {
            throw new ResourceNotFoundException("User not found");
        }
        if (matches.size() == 1) {
            Long tenantId = matches.get(0).getTenantId();
            if (tenantId == null) {
                throw new UnauthorizedException("Tenant ID is required to sign in to this account");
            }
            return tenantId;
        }

        // Multiple matches — prefer the PLATFORM_ADMIN account so super-admins
        // can log in via /platform/login without specifying a tenant.
        User platformAdmin = matches.stream()
            .filter(u -> u.getRole() == User.Role.PLATFORM_ADMIN)
            .findFirst()
            .orElse(null);
        if (platformAdmin != null && platformAdmin.getTenantId() != null) {
            return platformAdmin.getTenantId();
        }

        throw new UnauthorizedException("Tenant ID is required to sign in to this account");
    }
}
