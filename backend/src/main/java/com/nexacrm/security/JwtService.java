package com.nexacrm.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Function;

@Service
@Slf4j
public class JwtService {

    @Value("${jwt.secret}")
    private String secretKey;

    @Value("${jwt.expiration}")
    private long jwtExpiration;

    @Value("${jwt.refresh-expiration}")
    private long refreshExpiration;

    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    public <T> T extractClaim(String token, Function<Claims, T> resolver) {
        return resolver.apply(extractAllClaims(token));
    }

    public String generateToken(UserDetails userDetails) {
        Map<String, Object> extra = new HashMap<>();
        Long tenantId = resolveTenantId(userDetails);
        if (tenantId != null) {
            extra.put("tenantId", tenantId);
        }
        return generateToken(extra, userDetails);
    }

    public String generateToken(Map<String, Object> extra, UserDetails userDetails) {
        Map<String, Object> claims = new HashMap<>(extra);
        Long tenantId = resolveTenantId(userDetails);
        if (tenantId != null && !claims.containsKey("tenantId")) {
            claims.put("tenantId", tenantId);
        }
        return buildToken(claims, userDetails, jwtExpiration);
    }

    public String generateRefreshToken(UserDetails userDetails) {
        Map<String, Object> extra = new HashMap<>();
        Long tenantId = resolveTenantId(userDetails);
        if (tenantId != null) {
            extra.put("tenantId", tenantId);
        }
        return buildToken(extra, userDetails, refreshExpiration);
    }

    private String buildToken(Map<String, Object> extra, UserDetails user, long expiration) {
        return Jwts.builder()
                .claims(extra)
                .subject(user.getUsername())
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expiration))
                .signWith(getSignKey())
                .compact();
    }

    public boolean isTokenValid(String token, UserDetails userDetails) {
        final String username = extractUsername(token);
        return username.equals(userDetails.getUsername()) && !isTokenExpired(token);
    }

    public long getJwtExpiration() {
        return jwtExpiration;
    }

    public long getRefreshExpiration() {
        return refreshExpiration;
    }

    public Long extractTenantId(String token) {
        return extractClaim(token, claims -> {
            Object tenantClaim = claims.get("tenantId");
            if (tenantClaim instanceof Number number) {
                return number.longValue();
            }
            if (tenantClaim instanceof String value && !value.isBlank()) {
                try {
                    return Long.parseLong(value.trim());
                } catch (NumberFormatException ignored) {
                    return null;
                }
            }
            return null;
        });
    }

    private boolean isTokenExpired(String token) {
        return extractExpiration(token).before(new Date());
    }

    private Date extractExpiration(String token) {
        return extractClaim(token, Claims::getExpiration);
    }

    private Claims extractAllClaims(String token) {
        return Jwts.parser()
                .verifyWith(getSignKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    private SecretKey getSignKey() {
        byte[] keyBytes = secretKey.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        return Keys.hmacShaKeyFor(keyBytes);
    }

    private Long resolveTenantId(UserDetails userDetails) {
        if (userDetails instanceof com.nexacrm.model.User user && user.getTenantId() != null) {
            return user.getTenantId();
        }
        return null;
    }
}
