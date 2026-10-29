package com.nexacrm.websocket;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Publishes real-time notifications to connected WebSocket clients.
 * Supports user-specific and broadcast notifications.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationPublisher {

    private final SimpMessagingTemplate messagingTemplate;

    /**
     * Send notification to a specific user (by their username/email).
     */
    public void sendToUser(String username, Object notification) {
        log.debug("Sending notification to user {}: {}", username, notification);
        messagingTemplate.convertAndSendToUser(username, "/queue/notifications", notification);
    }

    /**
     * Broadcast notification to all connected users.
     */
    public void broadcast(Object notification) {
        log.debug("Broadcasting notification: {}", notification);
        messagingTemplate.convertAndSend("/topic/notifications", notification);
    }

    /**
     * Send a notification payload to a specific user.
     */
    public void notifyUser(String username, String title, String message, String type, String actionUrl) {
        Map<String, Object> payload = Map.of(
            "title", title,
            "message", message,
            "type", type,
            "actionUrl", actionUrl != null ? actionUrl : "",
            "timestamp", System.currentTimeMillis()
        );
        sendToUser(username, payload);
    }

    /**
     * Broadcast a new lead notification to all managers and admins.
     */
    public void notifyNewLead(String leadName, String source) {
        broadcast(Map.of(
            "type", "LEAD",
            "title", "New Lead",
            "message", "New lead from " + source + ": " + leadName,
            "timestamp", System.currentTimeMillis()
        ));
    }

    /**
     * Notify the assigned rep about a new lead assignment.
     */
    public void notifyLeadAssigned(String assigneeEmail, String leadName) {
        notifyUser(
            assigneeEmail,
            "Lead Assigned",
            "You have been assigned a new lead: " + leadName,
            "LEAD",
            "/leads"
        );
    }

    /**
     * Notify about deal stage change.
     */
    public void notifyDealStageChange(String ownerEmail, String dealTitle, String newStage) {
        notifyUser(
            ownerEmail,
            "Deal Updated",
            dealTitle + " moved to " + newStage,
            "DEAL",
            "/pipeline"
        );
    }
}
