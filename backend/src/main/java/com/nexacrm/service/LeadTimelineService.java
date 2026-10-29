package com.nexacrm.service;

import com.nexacrm.dto.LeadTimelineEventDTO;
import com.nexacrm.dto.PageResponse;
import com.nexacrm.exception.ResourceNotFoundException;
import com.nexacrm.model.Lead;
import com.nexacrm.model.LeadActivity;
import com.nexacrm.model.LeadTimelineEvent;
import com.nexacrm.model.Task;
import com.nexacrm.model.User;
import com.nexacrm.repository.LeadActivityRepository;
import com.nexacrm.repository.LeadRepository;
import com.nexacrm.repository.LeadTimelineEventRepository;
import com.nexacrm.repository.TaskRepository;
import com.nexacrm.repository.UserRepository;
import com.nexacrm.security.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class LeadTimelineService {

    private static final String SOURCE_TASK = "TASK";
    private static final String SOURCE_ACTIVITY = "ACTIVITY";

    private final LeadTimelineEventRepository timelineRepository;
    private final LeadRepository leadRepository;
    private final LeadActivityRepository leadActivityRepository;
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;

    private Long tenantId() {
        return TenantContext.currentTenantId();
    }

    @Transactional(readOnly = true)
    public PageResponse<LeadTimelineEventDTO> findByLeadId(String leadId, int page, int size) {
        Lead lead = leadRepository.findByIdAndTenantIdAndDeletedFalse(leadId, tenantId())
            .orElseThrow(() -> new ResourceNotFoundException("Lead not found: " + leadId));
        ensureLeadVisible(lead);

        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(size, 50));
        PageRequest pageRequest = PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "eventAt"));
        Page<LeadTimelineEvent> events = timelineRepository
            .findByTenantIdAndLeadIdAndDeletedFalseOrderByEventAtDesc(tenantId(), leadId, pageRequest);

        return PageResponse.<LeadTimelineEventDTO>builder()
            .content(events.getContent().stream().map(this::toDTO).toList())
            .page(events.getNumber())
            .size(events.getSize())
            .total(events.getTotalElements())
            .totalPages(events.getTotalPages())
            .first(events.isFirst())
            .last(events.isLast())
            .build();
    }

    public void syncTask(Task task) {
        try {
            syncTaskInternal(task);
        } catch (RuntimeException ex) {
            log.warn("Lead timeline task sync failed for task {}: {}", task != null ? task.getId() : null, ex.getMessage());
        }
    }

    public void markTaskDeleted(Task task) {
        try {
            if (task == null || isBlank(task.getId())) return;
            timelineRepository.findByTenantIdAndSourceTypeAndSourceId(tenantId(), SOURCE_TASK, task.getId())
                .ifPresent(event -> {
                    event.setDeleted(true);
                    timelineRepository.save(event);
                });
        } catch (RuntimeException ex) {
            log.warn("Lead timeline task delete sync failed for task {}: {}", task != null ? task.getId() : null, ex.getMessage());
        }
    }

    public void syncActivity(LeadActivity activity) {
        try {
            syncActivityInternal(activity);
        } catch (RuntimeException ex) {
            log.warn("Lead timeline activity sync failed for activity {}: {}", activity != null ? activity.getId() : null, ex.getMessage());
        }
    }

    @Transactional
    public void rebuildLead(String leadId) {
        Lead lead = leadRepository.findByIdAndTenantIdAndDeletedFalse(leadId, tenantId())
            .orElseThrow(() -> new ResourceNotFoundException("Lead not found: " + leadId));
        ensureLeadVisible(lead);

        taskRepository.findByTenantIdAndLeadIdAndDeletedFalseOrderByDueDateAsc(tenantId(), leadId)
            .forEach(this::syncTaskInternal);
        leadActivityRepository.findByLeadIdAndTenantIdAndDeletedFalseOrderBySavedAtDesc(leadId, tenantId())
            .forEach(this::syncActivityInternal);
    }

    @Transactional
    protected void syncTaskInternal(Task task) {
        if (task == null || isBlank(task.getId()) || isBlank(task.getLeadId())) {
            return;
        }
        LeadTimelineEvent event = timelineRepository
            .findByTenantIdAndSourceTypeAndSourceId(tenantId(), SOURCE_TASK, task.getId())
            .orElseGet(LeadTimelineEvent::new);

        event.setTenantId(tenantId());
        event.setDeleted(Boolean.TRUE.equals(task.getDeleted()));
        event.setLeadId(task.getLeadId());
        event.setEventType("TASK");
        event.setSourceType(SOURCE_TASK);
        event.setSourceId(task.getId());
        event.setSourceCollection("tasks");
        event.setTitle(nonBlank(task.getTitle(), "Follow-up task"));
        event.setDescription(nonBlank(task.getDescription(), ""));
        event.setStatus(nonBlank(task.getStatus(), "PENDING"));
        event.setOwner(resolveUserName(task.getAssignedToId(), task.getCreatedById(), "Unassigned"));
        event.setEventAt(resolveTaskEventAt(task));
        event.setMetadata(taskMetadata(task));
        timelineRepository.save(event);
    }

    @Transactional
    protected void syncActivityInternal(LeadActivity activity) {
        if (activity == null || isBlank(activity.getId()) || isBlank(activity.getLeadId())) {
            return;
        }
        LeadTimelineEvent event = timelineRepository
            .findByTenantIdAndSourceTypeAndSourceId(tenantId(), SOURCE_ACTIVITY, activity.getId())
            .orElseGet(LeadTimelineEvent::new);

        event.setTenantId(tenantId());
        event.setDeleted(Boolean.TRUE.equals(activity.getDeleted()));
        event.setLeadId(activity.getLeadId());
        event.setEventType("ACTIVITY");
        event.setSourceType(SOURCE_ACTIVITY);
        event.setSourceId(activity.getId());
        event.setSourceCollection("lead_activities");
        event.setTitle(nonBlank(activity.getActivityTitle(), activity.getActivityLabel(), "Lead activity"));
        event.setDescription(nonBlank(activity.getSummary(), ""));
        event.setStatus(nonBlank(activity.getActivityLabel(), activityStatus(activity), "Activity"));
        event.setOwner(nonBlank(activity.getAssignedTo(), "Unassigned"));
        event.setEventAt(firstTime(activity.getSavedAt(), activity.getCreatedAt(), activity.getUpdatedAt(), LocalDateTime.now()));
        event.setMetadata(activityMetadata(activity));
        timelineRepository.save(event);
    }

    private void ensureLeadVisible(Lead lead) {
        User current = currentUser();
        if (current == null || User.isAdminLike(current.getRole()) || current.getRole() == User.Role.MANAGER) {
            return;
        }
        if (lead.getAssignedTo() == null || !current.getId().equals(lead.getAssignedTo().getId())) {
            throw new ResourceNotFoundException("Lead not found: " + lead.getId());
        }
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
        return userRepository.findByEmailAndTenantIdAndDeletedFalse(email, tenantId).orElse(null);
    }

    private String resolveUserName(String primaryUserId, String fallbackUserId, String fallback) {
        String userId = !isBlank(primaryUserId) ? primaryUserId : fallbackUserId;
        if (isBlank(userId)) return fallback;
        return userRepository.findByIdAndTenantIdAndDeletedFalse(userId, tenantId())
            .map(user -> nonBlank(user.getName(), user.getEmail(), fallback))
            .orElse(fallback);
    }

    private LocalDateTime resolveTaskEventAt(Task task) {
        if ("COMPLETED".equalsIgnoreCase(task.getStatus())) {
            return firstTime(task.getCompletedAt(), task.getUpdatedAt(), task.getDueDate(), task.getCreatedAt(), LocalDateTime.now());
        }
        return firstTime(task.getDueDate(), task.getCreatedAt(), task.getUpdatedAt(), LocalDateTime.now());
    }

    private Map<String, Object> taskMetadata(Task task) {
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("priority", nonBlank(task.getPriority(), "MEDIUM"));
        metadata.put("type", nonBlank(task.getType(), ""));
        metadata.put("assignedToId", nonBlank(task.getAssignedToId(), ""));
        metadata.put("createdById", nonBlank(task.getCreatedById(), ""));
        metadata.put("completedAt", task.getCompletedAt());
        metadata.put("dueDate", task.getDueDate());
        return metadata;
    }

    private Map<String, Object> activityMetadata(LeadActivity activity) {
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("activityIndex", activity.getActivityIndex());
        metadata.put("activityId", nonBlank(activity.getActivityId(), ""));
        metadata.put("activityLabel", nonBlank(activity.getActivityLabel(), ""));
        metadata.put("activityTitle", nonBlank(activity.getActivityTitle(), ""));
        Map<String, Object> values = activity.getValues();
        if (values != null && Boolean.parseBoolean(String.valueOf(values.getOrDefault("recording", "false")))) {
            metadata.put("recording", true);
            metadata.put("recordingActivityId", nonBlank(activity.getId(), ""));
            metadata.put("recordingOriginalName", nonBlank(stringValue(values.get("recordingOriginalName")), "Call recording"));
            metadata.put("recordingContentType", nonBlank(stringValue(values.get("recordingContentType")), "audio/mpeg"));
            metadata.put("recordingSize", values.get("recordingSize"));
        }
        return metadata;
    }

    private String activityStatus(LeadActivity activity) {
        Object status = activity.getValues() != null
            ? firstPresent(activity.getValues(), List.of("status", "connectionStatus", "callOutcome", "outcome"))
            : null;
        return status != null ? String.valueOf(status) : null;
    }

    private Object firstPresent(Map<String, Object> values, List<String> keys) {
        for (String key : keys) {
            Object value = values.get(key);
            if (value != null && !String.valueOf(value).isBlank()) return value;
        }
        return null;
    }

    private LocalDateTime firstTime(LocalDateTime... values) {
        if (values == null) return null;
        for (LocalDateTime value : values) {
            if (value != null) return value;
        }
        return null;
    }

    private LeadTimelineEventDTO toDTO(LeadTimelineEvent event) {
        return LeadTimelineEventDTO.builder()
            .id(event.getId())
            .leadId(event.getLeadId())
            .eventType(event.getEventType())
            .sourceType(event.getSourceType())
            .sourceId(event.getSourceId())
            .sourceCollection(event.getSourceCollection())
            .title(event.getTitle())
            .description(event.getDescription())
            .status(event.getStatus())
            .owner(event.getOwner())
            .eventAt(event.getEventAt())
            .metadata(event.getMetadata())
            .build();
    }

    private String nonBlank(String... values) {
        if (values == null) return "";
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return "";
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isBlank();
    }

    private String stringValue(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }
}
