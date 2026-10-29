package com.nexacrm.service;

import com.nexacrm.dto.TaskDTO;
import com.nexacrm.model.Task;
import com.nexacrm.model.User;
import com.nexacrm.repository.DealRepository;
import com.nexacrm.repository.LeadRepository;
import com.nexacrm.repository.NotificationRepository;
import com.nexacrm.repository.TaskRepository;
import com.nexacrm.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TaskServiceTest {

    @Mock private TaskRepository taskRepository;
    @Mock private UserRepository userRepository;
    @Mock private NotificationRepository notificationRepository;
    @Mock private LeadRepository leadRepository;
    @Mock private DealRepository dealRepository;
    @Mock private NotificationService notificationService;

    @InjectMocks
    private TaskService taskService;

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void findAll_shouldRestrictNormalUsersToAssignedOrCreatedTasks() {
        User employee = User.builder()
            .name("Employee")
            .email("employee@example.com")
            .role(User.Role.NORMAL_USER)
            .build();
        employee.setId("u-1");

        Task assignedTask = Task.builder()
            .title("Assigned Task")
            .assignedToId("u-1")
            .createdById("u-9")
            .dueDate(LocalDateTime.now().plusDays(1))
            .status("PENDING")
            .build();
        assignedTask.setId("task-1");

        Task createdTask = Task.builder()
            .title("Created Task")
            .assignedToId("u-9")
            .createdById("u-1")
            .dueDate(LocalDateTime.now().plusDays(2))
            .status("PENDING")
            .build();
        createdTask.setId("task-2");

        Task hiddenTask = Task.builder()
            .title("Hidden Task")
            .assignedToId("u-2")
            .createdById("u-3")
            .dueDate(LocalDateTime.now().plusDays(3))
            .status("PENDING")
            .build();
        hiddenTask.setId("task-3");

        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken("employee@example.com", "n/a")
        );
        when(userRepository.findByEmailAndTenantIdAndDeletedFalse("employee@example.com", 1L))
            .thenReturn(Optional.of(employee));
        when(taskRepository.findByTenantIdAndDeletedFalseOrderByDueDateAsc(1L))
            .thenReturn(List.of(assignedTask, createdTask, hiddenTask));

        List<TaskDTO> visibleTasks = taskService.findAll(null, null, null, null);

        assertEquals(2, visibleTasks.size());
        assertEquals("Assigned Task", visibleTasks.get(0).getTitle());
        assertEquals("Created Task", visibleTasks.get(1).getTitle());
    }

    @Test
    void findAll_shouldUseStatusFilteredRepositoryForPendingTasks() {
        User manager = User.builder()
            .name("Manager")
            .email("manager@example.com")
            .role(User.Role.MANAGER)
            .build();
        manager.setId("u-1");

        Task pendingTask = Task.builder()
            .title("Pending Follow-up")
            .assignedToId("u-1")
            .createdById("u-1")
            .dueDate(LocalDateTime.now().plusHours(1))
            .status("PENDING")
            .build();
        pendingTask.setId("task-1");

        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken("manager@example.com", "n/a")
        );
        when(userRepository.findByEmailAndTenantIdAndDeletedFalse("manager@example.com", 1L))
            .thenReturn(Optional.of(manager));
        when(taskRepository.findByTenantIdAndDeletedFalseAndStatusOrderByDueDateAsc(1L, "PENDING"))
            .thenReturn(List.of(pendingTask));

        List<TaskDTO> visibleTasks = taskService.findAll("PENDING", null, null, null);

        assertEquals(1, visibleTasks.size());
        assertEquals("Pending Follow-up", visibleTasks.get(0).getTitle());
        verify(taskRepository).findByTenantIdAndDeletedFalseAndStatusOrderByDueDateAsc(1L, "PENDING");
        verify(taskRepository, never()).findByTenantIdAndDeletedFalseOrderByDueDateAsc(1L);
    }
}
