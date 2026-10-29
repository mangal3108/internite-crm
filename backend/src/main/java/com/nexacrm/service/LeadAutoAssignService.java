package com.nexacrm.service;

import com.nexacrm.model.AppSetting;
import com.nexacrm.model.Notification;
import com.nexacrm.model.Task;
import com.nexacrm.model.User;
import com.nexacrm.model.Lead;
import com.nexacrm.repository.AppSettingRepository;
import com.nexacrm.repository.TaskRepository;
import com.nexacrm.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class LeadAutoAssignService {

    private static final String NAMESPACE = "lead_automation";
    private static final String RR_INDEX_KEY = "round_robin_index";
    private static final int FOLLOW_UP_MINUTES = 30;
    private static final Set<User.Role> ELIGIBLE_ROLES = Set.of(
        User.Role.SALES_EXEC, User.Role.NORMAL_USER, User.Role.MANAGER
    );

    private final UserRepository userRepository;
    private final TaskRepository taskRepository;
    private final AppSettingRepository appSettingRepository;
    private final NotificationService notificationService;

    public User autoAssignAndCreateTask(Lead lead, Long tenantId) {
        List<User> eligible = userRepository.findByTenantIdAndDeletedFalse(tenantId).stream()
            .filter(u -> Boolean.TRUE.equals(u.getIsActive()))
            .filter(u -> u.getRole() != null && ELIGIBLE_ROLES.contains(u.getRole()))
            .sorted((a, b) -> {
                int ra = roleOrder(a.getRole());
                int rb = roleOrder(b.getRole());
                if (ra != rb) return Integer.compare(ra, rb);
                if (a.getCreatedAt() != null && b.getCreatedAt() != null) {
                    return a.getCreatedAt().compareTo(b.getCreatedAt());
                }
                return 0;
            })
            .toList();

        if (eligible.isEmpty()) {
            log.warn("No eligible employees for round-robin assignment (tenant={})", tenantId);
            return null;
        }

        int index = nextRoundRobinIndex(tenantId, eligible.size());
        User assignee = eligible.get(index);

        log.info("Auto-assigning lead '{}' to {} (index={}/{})",
            lead.getName(), assignee.getName(), index, eligible.size());

        createFollowUpTask(lead, assignee, tenantId);

        notificationService.notifyUsers(
            List.of(assignee),
            Notification.NotificationType.LEAD,
            "New Lead Assigned",
            "Lead \"" + lead.getName() + "\" has been assigned to you. Follow up within " + FOLLOW_UP_MINUTES + " minutes.",
            "/leads",
            "lead",
            lead.getId(),
            null
        );

        return assignee;
    }

    private void createFollowUpTask(Lead lead, User assignee, Long tenantId) {
        Task task = Task.builder()
            .title("Follow up with " + lead.getName())
            .description("New lead from " + (lead.getSource() != null ? lead.getSource().name() : "unknown")
                + ". Contact and qualify within " + FOLLOW_UP_MINUTES + " minutes.")
            .type("Follow-up")
            .status("PENDING")
            .priority("HIGH")
            .dueDate(LocalDateTime.now().plusMinutes(FOLLOW_UP_MINUTES))
            .leadId(lead.getId())
            .assignedToId(assignee.getId())
            .createdById(assignee.getId())
            .build();
        task.setTenantId(tenantId);
        taskRepository.save(task);

        log.info("Auto-created follow-up task for lead '{}' assigned to {}, due in {} min",
            lead.getName(), assignee.getName(), FOLLOW_UP_MINUTES);
    }

    private int nextRoundRobinIndex(Long tenantId, int poolSize) {
        AppSetting setting = appSettingRepository
            .findByTenantIdAndNamespaceAndKeyAndDeletedFalse(tenantId, NAMESPACE, RR_INDEX_KEY)
            .orElse(null);

        int current;
        if (setting == null) {
            setting = AppSetting.builder()
                .namespace(NAMESPACE)
                .key(RR_INDEX_KEY)
                .value("0")
                .description("Round-robin index for auto-assigning leads to employees")
                .build();
            setting.setTenantId(tenantId);
            current = 0;
        } else {
            try {
                current = Integer.parseInt(setting.getValue());
            } catch (NumberFormatException e) {
                current = 0;
            }
        }

        int index = current % poolSize;
        setting.setValue(String.valueOf(current + 1));
        appSettingRepository.save(setting);
        return index;
    }

    private int roleOrder(User.Role role) {
        return switch (role) {
            case SALES_EXEC -> 0;
            case NORMAL_USER -> 1;
            case MANAGER -> 2;
            default -> 3;
        };
    }
}
