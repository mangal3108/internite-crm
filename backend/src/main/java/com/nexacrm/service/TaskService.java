package com.nexacrm.service;

import com.nexacrm.dto.TaskDTO;
import com.nexacrm.exception.ResourceNotFoundException;
import com.nexacrm.model.Deal;
import com.nexacrm.model.Lead;
import com.nexacrm.model.Notification;
import com.nexacrm.model.Task;
import com.nexacrm.model.User;
import com.nexacrm.repository.NotificationRepository;
import com.nexacrm.repository.DealRepository;
import com.nexacrm.repository.LeadRepository;
import com.nexacrm.repository.TaskRepository;
import com.nexacrm.repository.UserRepository;
import com.nexacrm.security.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.PageRequest;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class TaskService {

    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final NotificationRepository notificationRepository;
    private final LeadRepository leadRepository;
    private final DealRepository dealRepository;
    private final NotificationService notificationService;
    private final LeadTimelineService leadTimelineService;

    private Long tenantId() {
        return TenantContext.currentTenantId();
    }

    @Transactional(readOnly = true)
    public List<TaskDTO> findAll(String status, String assignedTo, String dueFilter, String search) {
        return findAll(status, assignedTo, dueFilter, search, null);
    }

    @Transactional(readOnly = true)
    public List<TaskDTO> findAll(String status, String assignedTo, String dueFilter, String search, String leadId) {
        Long tenantId = tenantId();
        List<Task> tasks = findCandidateTasks(tenantId, status, assignedTo, leadId);
        User current = currentUser();
        List<Task> visibleTasks = tasks.stream()
            .filter(task -> matchesStatus(task, status))
            .filter(task -> matchesAssignee(task, assignedTo))
            .filter(task -> matchesDueFilter(task, dueFilter))
            .filter(task -> matchesLead(task, leadId))
            .filter(task -> matchesVisibility(task, current))
            .filter(task -> matchesSearch(task, search))
            .sorted(Comparator.comparing(Task::getDueDate, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(Task::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
            .collect(Collectors.toList());
        Map<String, String> userNames = userNamesById(tenantId, visibleTasks);
        return visibleTasks.stream()
            .map(task -> toDTO(task, userNames))
            .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public TaskDTO findById(String id) {
        Task task = taskRepository.findByIdAndTenantIdAndDeletedFalse(id, tenantId())
            .orElseThrow(() -> new ResourceNotFoundException("Task not found: " + id));
        ensureVisibility(task);
        return toDTO(task);
    }

    @Transactional(readOnly = true)
    public List<TaskDTO> findByLeadId(String leadId) {
        return findAll(null, null, null, null, leadId);
    }

    private List<Task> findCandidateTasks(Long tenantId, String status, String assignedTo, String leadId) {
        String normalizedStatus = status == null || status.isBlank() ? null : normalizeStatus(status);
        String normalizedAssignee = blankToNull(assignedTo);
        String normalizedLeadId = blankToNull(leadId);

        if (normalizedLeadId != null && normalizedStatus != null) {
            return taskRepository.findByTenantIdAndLeadIdAndDeletedFalseAndStatusOrderByDueDateAsc(
                tenantId,
                normalizedLeadId,
                normalizedStatus
            );
        }
        if (normalizedLeadId != null) {
            return taskRepository.findByTenantIdAndLeadIdAndDeletedFalseOrderByDueDateAsc(tenantId, normalizedLeadId);
        }
        if (normalizedAssignee != null && normalizedStatus != null) {
            return taskRepository.findByTenantIdAndAssignedToIdAndDeletedFalseAndStatusOrderByDueDateAsc(
                tenantId,
                normalizedAssignee,
                normalizedStatus
            );
        }
        if (normalizedAssignee != null) {
            return taskRepository.findByTenantIdAndAssignedToIdAndDeletedFalseOrderByDueDateAsc(tenantId, normalizedAssignee);
        }
        if (normalizedStatus != null) {
            return taskRepository.findByTenantIdAndDeletedFalseAndStatusOrderByDueDateAsc(tenantId, normalizedStatus);
        }
        return taskRepository.findByTenantIdAndDeletedFalseOrderByDueDateAsc(tenantId);
    }

    public TaskDTO create(TaskDTO dto) {
        Task task = fromDTO(dto);
        task.setTenantId(tenantId());
        task.setStatus(normalizeStatus(task.getStatus()));
        task.setPriority(normalizePriority(task.getPriority()));
        task.setCreatedById(currentUser().getId());

        validateReferences(task);
        Task saved = taskRepository.save(task);
        syncLeadFollowUp(saved, false);
        leadTimelineService.syncTask(saved);
        notifyAssigned(saved, "Task assigned", "A new task has been assigned to you: " + saved.getTitle());
        maybeNotifyDueSoon(saved);
        return toDTO(saved);
    }

    public TaskDTO update(String id, TaskDTO dto) {
        Task task = taskRepository.findByIdAndTenantIdAndDeletedFalse(id, tenantId())
            .orElseThrow(() -> new ResourceNotFoundException("Task not found: " + id));
        ensureVisibility(task);

        String previousAssignee = task.getAssignedToId();

        if (dto.getTitle() != null) task.setTitle(dto.getTitle().trim());
        if (dto.getDescription() != null) task.setDescription(dto.getDescription());
        if (dto.getType() != null) task.setType(dto.getType());
        if (dto.getStatus() != null) task.setStatus(normalizeStatus(dto.getStatus()));
        if (dto.getPriority() != null) task.setPriority(normalizePriority(dto.getPriority()));
        if (dto.getDueDate() != null) task.setDueDate(dto.getDueDate());
        if (dto.getLeadId() != null) task.setLeadId(blankToNull(dto.getLeadId()));
        if (dto.getDealId() != null) task.setDealId(blankToNull(dto.getDealId()));
        if (dto.getAssignedToId() != null) task.setAssignedToId(blankToNull(dto.getAssignedToId()));

        validateReferences(task);
        Task saved = taskRepository.save(task);
        syncLeadFollowUp(saved, false);
        leadTimelineService.syncTask(saved);

        if (!Objects.equals(previousAssignee, saved.getAssignedToId())) {
            notifyAssigned(saved, "Task reassigned", "You have been assigned a task: " + saved.getTitle());
        }
        maybeNotifyDueSoon(saved);
        return toDTO(saved);
    }

    public TaskDTO complete(String id) {
        Task task = taskRepository.findByIdAndTenantIdAndDeletedFalse(id, tenantId())
            .orElseThrow(() -> new ResourceNotFoundException("Task not found: " + id));
        ensureVisibility(task);
        task.setStatus("COMPLETED");
        task.setCompletedAt(LocalDateTime.now());
        Task saved = taskRepository.save(task);
        syncLeadFollowUp(saved, true);
        leadTimelineService.syncTask(saved);

        notifyAssigned(saved, "Task completed", "Task completed: " + saved.getTitle());
        return toDTO(saved);
    }

    public void delete(String id) {
        Task task = taskRepository.findByIdAndTenantIdAndDeletedFalse(id, tenantId())
            .orElseThrow(() -> new ResourceNotFoundException("Task not found: " + id));
        ensureVisibility(task);
        task.setDeleted(true);
        taskRepository.save(task);
        leadTimelineService.markTaskDeleted(task);
    }

    @Transactional(readOnly = true)
    public List<TaskDTO> overdue() {
        return findAll(null, null, "overdue", null, null);
    }

    @Transactional(readOnly = true)
    public List<TaskDTO> dueToday() {
        return findAll(null, null, "today", null, null);
    }

    @Transactional(readOnly = true)
    public List<TaskDTO> dueTomorrow() {
        return findAll(null, null, "tomorrow", null, null);
    }

    @Transactional(readOnly = true)
    public List<TaskDTO> pendingFollowUps() {
        return findAll("PENDING", null, null, null, null);
    }

    @Transactional(readOnly = true)
    public List<TaskDTO> dashboardFollowUps(int limit) {
        Long tenantId = tenantId();
        User current = currentUser();
        int cappedLimit = Math.max(1, Math.min(limit, 20));
        PageRequest page = PageRequest.of(0, cappedLimit);

        List<Task> tasks;
        if (User.isAdminLike(current.getRole()) || current.getRole() == User.Role.MANAGER) {
            tasks = taskRepository.findByTenantIdAndDeletedFalseAndStatusOrderByDueDateAsc(tenantId, "PENDING", page);
        } else {
            List<Task> assigned = taskRepository.findByTenantIdAndAssignedToIdAndDeletedFalseAndStatusOrderByDueDateAsc(
                tenantId,
                current.getId(),
                "PENDING",
                page
            );
            List<Task> created = taskRepository.findByTenantIdAndCreatedByIdAndDeletedFalseAndStatusOrderByDueDateAsc(
                tenantId,
                current.getId(),
                "PENDING",
                page
            );
            Map<String, Task> unique = new HashMap<>();
            assigned.forEach(task -> unique.put(task.getId(), task));
            created.forEach(task -> unique.put(task.getId(), task));
            tasks = unique.values().stream()
                .sorted(Comparator.comparing(Task::getDueDate, Comparator.nullsLast(Comparator.naturalOrder()))
                    .thenComparing(Task::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(cappedLimit)
                .toList();
        }

        Map<String, String> userNames = userNamesById(tenantId, tasks);
        return tasks.stream()
            .map(task -> toDTO(task, userNames))
            .collect(Collectors.toList());
    }

    private void ensureVisibility(Task task) {
        if (!matchesVisibility(task, currentUser())) {
            throw new ResourceNotFoundException("Task not found: " + task.getId());
        }
    }

    private boolean matchesVisibility(Task task, User current) {
        if (current == null || User.isAdminLike(current.getRole()) || current.getRole() == User.Role.MANAGER) {
            return true;
        }
        String currentUserId = current.getId();
        if (currentUserId == null || currentUserId.isBlank()) {
            return false;
        }
        return currentUserId.equals(task.getAssignedToId()) || currentUserId.equals(task.getCreatedById());
    }

    private boolean matchesLead(Task task, String leadId) {
        if (leadId == null || leadId.isBlank()) return true;
        return leadId.equals(task.getLeadId());
    }

    private User currentUser() {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        Object principal = authentication != null ? authentication.getPrincipal() : null;
        Long tenantId = tenantId();
        if (principal instanceof User user
            && user.getTenantId() != null
            && user.getTenantId().equals(tenantId)
            && !Boolean.TRUE.equals(user.getDeleted())) {
            return user;
        }
        String email = authentication != null ? authentication.getName() : null;
        return userRepository.findByEmailAndTenantIdAndDeletedFalse(email, tenantId)
            .orElseThrow(() -> new ResourceNotFoundException("Authenticated user not found"));
    }

    private void validateReferences(Task task) {
        if (task.getAssignedToId() != null && !task.getAssignedToId().isBlank()) {
            userRepository.findByIdAndTenantIdAndDeletedFalse(task.getAssignedToId(), tenantId())
                .orElseThrow(() -> new ResourceNotFoundException("Assigned user not found: " + task.getAssignedToId()));
        }
        if (task.getLeadId() != null && !task.getLeadId().isBlank()) {
            leadRepository.findByIdAndTenantIdAndDeletedFalse(task.getLeadId(), tenantId())
                .orElseThrow(() -> new ResourceNotFoundException("Lead not found: " + task.getLeadId()));
        }
        if (task.getDealId() != null && !task.getDealId().isBlank()) {
            dealRepository.findByIdAndTenantIdAndDeletedFalse(task.getDealId(), tenantId())
                .orElseThrow(() -> new ResourceNotFoundException("Deal not found: " + task.getDealId()));
        }
    }

    private void syncLeadFollowUp(Task task, boolean completed) {
        if (task.getLeadId() == null || task.getLeadId().isBlank()) {
            return;
        }
        leadRepository.findByIdAndTenantIdAndDeletedFalse(task.getLeadId(), tenantId()).ifPresent(lead -> {
            if (completed) {
                lead.setFollowUpDate(null);
            } else if (task.getDueDate() != null) {
                lead.setFollowUpDate(task.getDueDate());
            }
            leadRepository.save(lead);
        });
    }

    private boolean matchesStatus(Task task, String status) {
        if (status == null || status.isBlank()) return true;
        return normalizeStatus(task.getStatus()).equals(normalizeStatus(status));
    }

    private boolean matchesAssignee(Task task, String assignedTo) {
        if (assignedTo == null || assignedTo.isBlank()) return true;
        return assignedTo.equals(task.getAssignedToId());
    }

    private boolean matchesDueFilter(Task task, String dueFilter) {
        if (dueFilter == null || dueFilter.isBlank()) return true;
        if (task.getDueDate() == null) return false;

        LocalDate dueDate = task.getDueDate().toLocalDate();
        LocalDate today = LocalDate.now();
        return switch (dueFilter.trim().toLowerCase(Locale.ROOT)) {
            case "today" -> dueDate.isEqual(today);
            case "tomorrow" -> dueDate.isEqual(today.plusDays(1));
            case "overdue" -> task.getStatus() == null || !task.getStatus().equalsIgnoreCase("COMPLETED")
                ? task.getDueDate().isBefore(LocalDateTime.now())
                : false;
            default -> true;
        };
    }

    private boolean matchesSearch(Task task, String search) {
        if (search == null || search.isBlank()) return true;
        String needle = search.trim().toLowerCase(Locale.ROOT);
        return contains(task.getTitle(), needle)
            || contains(task.getDescription(), needle)
            || contains(task.getType(), needle)
            || contains(task.getStatus(), needle)
            || contains(task.getPriority(), needle);
    }

    private boolean contains(String value, String needle) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(needle);
    }

    private void maybeNotifyDueSoon(Task task) {
        if (task.getAssignedToId() == null || task.getAssignedToId().isBlank() || task.getDueDate() == null) {
            return;
        }

        long hoursUntilDue = java.time.Duration.between(LocalDateTime.now(), task.getDueDate()).toHours();
        if (hoursUntilDue < 0) {
            notifyAssigned(task, "Missed follow-up", "Task is overdue: " + task.getTitle());
        } else if (hoursUntilDue <= 48) {
            notifyAssigned(task, "Task reminder", "Due soon: " + task.getTitle());
        }
    }

    private void notifyAssigned(Task task, String title, String message) {
        if (task.getAssignedToId() == null || task.getAssignedToId().isBlank()) {
            return;
        }
        userRepository.findByIdAndTenantIdAndDeletedFalse(task.getAssignedToId(), tenantId()).ifPresent(user ->
            {
                boolean alreadyNotified = notificationRepository.existsByTenantIdAndUser_IdAndEntityTypeAndEntityIdAndTitleAndDeletedFalse(
                    tenantId(),
                    user.getId(),
                    "task",
                    task.getId(),
                    title
                );
                if (!alreadyNotified) {
                    notificationService.notifyUsers(
                        List.of(user),
                        Notification.NotificationType.TASK,
                        title,
                        message,
                        "/tasks",
                        "task",
                        task.getId(),
                        null
                    );
                }
            }
        );
    }

    private Map<String, String> userNamesById(Long tenantId, List<Task> tasks) {
        Set<String> neededUserIds = tasks.stream()
            .flatMap(task -> java.util.stream.Stream.of(task.getAssignedToId(), task.getCreatedById()))
            .filter(Objects::nonNull)
            .filter(id -> !id.isBlank())
            .collect(Collectors.toSet());
        if (neededUserIds.isEmpty()) {
            return Map.of();
        }
        Map<String, String> names = new HashMap<>();
        userRepository.findAllById(neededUserIds).stream()
            .filter(user -> tenantId.equals(user.getTenantId()) && !Boolean.TRUE.equals(user.getDeleted()))
            .forEach(user -> names.put(user.getId(), user.getName()));
        return names;
    }

    private TaskDTO toDTO(Task task) {
        Long tenantId = tenantId();
        Map<String, String> userNames = new HashMap<>();
        if (task.getAssignedToId() != null) {
            userRepository.findByIdAndTenantIdAndDeletedFalse(task.getAssignedToId(), tenantId)
                .map(User::getName)
                .ifPresent(name -> userNames.put(task.getAssignedToId(), name));
        }
        if (task.getCreatedById() != null) {
            userRepository.findByIdAndTenantIdAndDeletedFalse(task.getCreatedById(), tenantId)
                .map(User::getName)
                .ifPresent(name -> userNames.put(task.getCreatedById(), name));
        }
        return toDTO(task, userNames);
    }

    private TaskDTO toDTO(Task task, Map<String, String> userNames) {
        String assignedName = task.getAssignedToId() != null ? userNames.get(task.getAssignedToId()) : null;
        String createdByName = task.getCreatedById() != null ? userNames.get(task.getCreatedById()) : null;
        return TaskDTO.builder()
            .id(task.getId())
            .title(task.getTitle())
            .description(task.getDescription())
            .type(task.getType())
            .status(task.getStatus())
            .priority(task.getPriority())
            .dueDate(task.getDueDate())
            .leadId(task.getLeadId())
            .dealId(task.getDealId())
            .assignedToId(task.getAssignedToId())
            .assignedToName(assignedName)
            .createdById(task.getCreatedById())
            .createdByName(createdByName)
            .completedAt(task.getCompletedAt())
            .createdAt(task.getCreatedAt())
            .updatedAt(task.getUpdatedAt())
            .build();
    }

    private Task fromDTO(TaskDTO dto) {
        return Task.builder()
            .title(dto.getTitle() != null ? dto.getTitle().trim() : null)
            .description(dto.getDescription())
            .type(dto.getType())
            .status(dto.getStatus() != null ? dto.getStatus() : "PENDING")
            .priority(dto.getPriority() != null ? dto.getPriority() : "MEDIUM")
            .dueDate(dto.getDueDate())
            .leadId(blankToNull(dto.getLeadId()))
            .dealId(blankToNull(dto.getDealId()))
            .assignedToId(blankToNull(dto.getAssignedToId()))
            .build();
    }

    private String normalizeStatus(String status) {
        if (status == null || status.isBlank()) {
            return "PENDING";
        }
        return status.trim().toUpperCase(Locale.ROOT).replace(' ', '_');
    }

    private String normalizePriority(String priority) {
        if (priority == null || priority.isBlank()) {
            return "MEDIUM";
        }
        return priority.trim().toUpperCase(Locale.ROOT).replace(' ', '_');
    }

    private String blankToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isBlank() ? null : trimmed;
    }
}
