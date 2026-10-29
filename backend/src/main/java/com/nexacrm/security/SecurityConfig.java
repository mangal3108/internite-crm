package com.nexacrm.security;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.http.HttpStatus;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final RateLimitingFilter rateLimitingFilter;
    private final AuthenticationProvider authenticationProvider;

    @Value("${cors.allowed-origins}")
    private String allowedOrigins;

    @Value("${cors.allowed-methods:GET,POST,PUT,PATCH,DELETE,OPTIONS}")
    private String allowedMethods;

    @Value("${cors.allowed-headers:*}")
    private String allowedHeaders;

    @Value("${cors.allow-credentials:true}")
    private boolean allowCredentials;

    @Value("${cors.exposed-headers:}")
    private String exposedHeaders;

    @Value("${cors.max-age:3600}")
    private long corsMaxAge;

    @Value("${api.docs.public-enabled:false}")
    private boolean swaggerPublicEnabled;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(publicEndpoints()).permitAll()
                .requestMatchers(HttpMethod.GET, "/api/public/**").permitAll()
                // Role-based access
                .requestMatchers("/api/admin/**").hasAnyRole("PLATFORM_ADMIN", "COMPANY_ADMIN", "ADMIN")
                .requestMatchers(HttpMethod.GET, "/api/users/**").authenticated()
                .requestMatchers("/api/users/**").hasAnyRole("PLATFORM_ADMIN", "COMPANY_ADMIN", "ADMIN", "MANAGER")
                .requestMatchers(HttpMethod.DELETE, "/api/**").hasAnyRole("PLATFORM_ADMIN", "COMPANY_ADMIN", "ADMIN", "MANAGER")
                .anyRequest().authenticated()
            )
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED))
            )
            .authenticationProvider(authenticationProvider)
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(rateLimitingFilter, JwtAuthFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOriginPatterns(
            splitCsv(allowedOrigins)
        );
        config.setAllowedMethods(splitCsv(allowedMethods));
        config.setAllowedHeaders(splitCsv(allowedHeaders));
        config.setAllowCredentials(allowCredentials);
        List<String> exposed = splitCsv(exposedHeaders);
        if (!exposed.isEmpty()) {
            config.setExposedHeaders(exposed);
        }
        config.setMaxAge(corsMaxAge);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    private String[] publicEndpoints() {
        return swaggerPublicEnabled
            ? new String[] {
                "/api/auth/login",
                "/api/auth/refresh",
                "/api/webhooks/**",
                "/api/calls/webhook",
                "/api/calls/twilio/status",
                "/api/calls/twilio/voice",
                "/api/leads/facebook",
                "/api/leads/facebook/**",
                "/ws/**",
                "/ws-sockjs/**",
                "/swagger-ui/**",
                "/v3/api-docs/**",
                "/actuator/health",
                "/actuator/health/**",
            }
            : new String[] {
                "/api/auth/login",
                "/api/auth/refresh",
                "/api/webhooks/**",
                "/api/calls/webhook",
                "/api/calls/twilio/status",
                "/api/calls/twilio/voice",
                "/api/leads/facebook",
                "/api/leads/facebook/**",
                "/ws/**",
                "/ws-sockjs/**",
                "/actuator/health",
                "/actuator/health/**",
            };
    }

    private List<String> splitCsv(String csv) {
        if (csv == null || csv.isBlank()) return List.of();
        return Arrays.stream(csv.split(","))
            .map(String::trim)
            .filter(s -> !s.isBlank())
            .collect(Collectors.toList());
    }
}
