package com.nexacrm.websocket;

import com.nexacrm.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.web.socket.config.annotation.*;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Value("${cors.allowed-origins:}")
    private String allowedOrigins;

    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // Simple in-memory broker for topics and user queues
        config.enableSimpleBroker("/topic", "/queue");
        config.setApplicationDestinationPrefixes("/app");
        config.setUserDestinationPrefix("/user");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
                if (accessor == null || accessor.getCommand() != StompCommand.CONNECT) {
                    return message;
                }

                String token = extractBearerToken(accessor.getFirstNativeHeader("Authorization"));
                if (token == null) {
                    token = extractBearerToken(accessor.getFirstNativeHeader("authorization"));
                }
                if (token == null) {
                    return message;
                }

                try {
                    String username = jwtService.extractUsername(token);
                    if (username == null || username.isBlank()) {
                        return message;
                    }

                    var userDetails = userDetailsService.loadUserByUsername(username);
                    if (!jwtService.isTokenValid(token, userDetails)) {
                        return message;
                    }

                    Authentication authentication = new UsernamePasswordAuthenticationToken(
                        userDetails,
                        null,
                        userDetails.getAuthorities()
                    );
                    accessor.setUser(authentication);
                } catch (Exception ignored) {
                    // Let the connection proceed without a principal; user-specific delivery will simply no-op.
                }
                return message;
            }
        });
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        String[] origins = splitCsv(allowedOrigins).toArray(String[]::new);
        JwtHandshakeInterceptor jwtInterceptor = new JwtHandshakeInterceptor(jwtService, userDetailsService);

        // Native WebSocket endpoint (used by @stomp/stompjs)
        registry.addEndpoint("/ws")
                .addInterceptors(jwtInterceptor)
                .setAllowedOriginPatterns(origins);

        // SockJS fallback endpoint for legacy clients
        registry.addEndpoint("/ws-sockjs")
                .addInterceptors(jwtInterceptor)
                .setAllowedOriginPatterns(origins)
                .withSockJS();
    }

    private List<String> splitCsv(String csv) {
        if (csv == null || csv.isBlank()) {
            return List.of("http://localhost:5173", "http://127.0.0.1:5173");
        }
        return Arrays.stream(csv.split(","))
            .map(String::trim)
            .filter(s -> !s.isBlank())
            .collect(Collectors.toList());
    }

    private String extractBearerToken(String rawHeader) {
        if (rawHeader == null) {
            return null;
        }
        String trimmed = rawHeader.trim();
        if (trimmed.isBlank()) {
            return null;
        }
        if (trimmed.regionMatches(true, 0, "Bearer ", 0, 7)) {
            String token = trimmed.substring(7).trim();
            return token.isBlank() ? null : token;
        }
        return trimmed;
    }
}
