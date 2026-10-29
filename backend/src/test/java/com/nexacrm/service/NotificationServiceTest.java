package com.nexacrm.service;

import com.nexacrm.model.Notification;
import com.nexacrm.model.User;
import com.nexacrm.repository.NotificationRepository;
import com.nexacrm.repository.UserRepository;
import com.nexacrm.websocket.NotificationPublisher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {

    @Mock private NotificationRepository notificationRepository;
    @Mock private UserRepository userRepository;
    @Mock private NotificationPublisher notificationPublisher;

    private NotificationService notificationService;

    @BeforeEach
    void setUp() {
        notificationService = new NotificationService(notificationRepository, userRepository, notificationPublisher);
    }

    @Test
    void notifyOutboundMessageCreatesAndPushesNotification() {
        User recipient = User.builder()
            .email("agent@nexacrm.com")
            .name("Agent One")
            .isActive(true)
            .build();
        recipient.setId("user-1");
        recipient.setTenantId(1L);

        when(userRepository.findByTenantIdAndDeletedFalse(1L)).thenReturn(List.of(recipient));
        when(userRepository.findByIdAndTenantIdAndDeletedFalse("user-1", 1L)).thenReturn(Optional.of(recipient));
        when(notificationRepository.save(any(Notification.class))).thenAnswer(invocation -> {
            Notification saved = invocation.getArgument(0);
            saved.setId("notif-1");
            return saved;
        });

        var results = notificationService.notifyOutboundMessage("email", "client@example.com", "Quarterly update");

        assertEquals(1, results.size());
        assertEquals("Email Sent", results.get(0).getTitle());
        assertEquals("Sent to client@example.com: Quarterly update", results.get(0).getMessage());
        assertEquals(Notification.NotificationDirection.OUTBOUND, results.get(0).getDirection());
        assertNotNull(results.get(0).getId());

        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository).save(captor.capture());
        assertEquals("Email Sent", captor.getValue().getTitle());
        assertEquals("Sent to client@example.com: Quarterly update", captor.getValue().getMessage());
        assertEquals(Notification.NotificationDirection.OUTBOUND, captor.getValue().getDirection());
        verify(notificationPublisher).sendToUser("agent@nexacrm.com", results.get(0));
    }
}
