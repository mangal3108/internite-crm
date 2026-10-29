package com.nexacrm.config;

import com.nexacrm.repository.UserRepository;
import com.nexacrm.security.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.AuditorAware;
import org.springframework.data.mongodb.config.EnableMongoAuditing;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Configuration
@EnableMongoAuditing(auditorAwareRef = "auditorAware")
@RequiredArgsConstructor
public class AppConfig {

    private final UserRepository userRepository;
    private final Map<String, CachedUserDetails> userDetailsCache = new ConcurrentHashMap<>();

    @Value("${nexacrm.auth.user-cache-ttl-ms:600000}")
    private long userCacheTtlMs;

    @Bean
    public UserDetailsService userDetailsService() {
        return username -> {
            try {
                Long tenantId = TenantContext.currentTenantId();
                String cacheKey = tenantId + ":" + username;
                long now = System.currentTimeMillis();
                CachedUserDetails cached = userDetailsCache.get(cacheKey);
                if (cached != null && cached.expiresAt() > now) {
                    return cached.userDetails();
                }

                UserDetails userDetails = userRepository.findByEmailAndTenantIdAndDeletedFalse(username, tenantId)
                    .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));
                userDetailsCache.put(cacheKey, new CachedUserDetails(userDetails, now + Math.max(1_000, userCacheTtlMs)));
                return userDetails;
            } catch (IllegalStateException ex) {
                throw new UsernameNotFoundException("Tenant context is required for authentication", ex);
            }
        };
    }

    private record CachedUserDetails(UserDetails userDetails, long expiresAt) {
    }

    @Bean
    public AuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userDetailsService());
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        // ponytail: strength 10 is the Spring default and OWASP-recommended minimum.
        // 12 was 4× slower (~300ms/login on VPS) with no meaningful security gain for a CRM.
        return new BCryptPasswordEncoder(10);
    }

    @Bean
    public RestTemplate restTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5000);
        factory.setReadTimeout(8000);
        return new RestTemplate(factory);
    }

    @Bean
    public AuditorAware<String> auditorAware() {
        return () -> Optional.ofNullable(SecurityContextHolder.getContext().getAuthentication())
            .map(auth -> auth.getName());
    }
}
