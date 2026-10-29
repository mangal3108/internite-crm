package com.nexacrm.service;

import com.nexacrm.dto.TicketDTO;
import com.nexacrm.exception.ResourceNotFoundException;
import com.nexacrm.model.Ticket;
import com.nexacrm.model.TicketComment;
import com.nexacrm.model.User;
import com.nexacrm.repository.TicketRepository;
import com.nexacrm.repository.UserRepository;
import com.nexacrm.security.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class TicketService {

    private final TicketRepository ticketRepository;
    private final UserRepository userRepository;

    private Long tenantId() {
        return TenantContext.currentTenantId();
    }

    private User currentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmailAndTenantIdAndDeletedFalse(email, tenantId())
            .orElseThrow(() -> new ResourceNotFoundException("Authenticated user not found"));
    }

    @Transactional(readOnly = true)
    public List<TicketDTO> findAll(String status, String priority, String assignedTo, String category, String search) {
        List<Ticket> tickets = ticketRepository.findByTenantIdAndDeletedFalseOrderByCreatedAtDesc(tenantId());
        User current = currentUser();
        return tickets.stream()
            .filter(t -> matchesStatus(t, status))
            .filter(t -> matchesPriority(t, priority))
            .filter(t -> matchesAssignee(t, assignedTo))
            .filter(t -> matchesCategory(t, category))
            .filter(t -> matchesVisibility(t, current))
            .filter(t -> matchesSearch(t, search))
            .map(this::toDTO)
            .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public TicketDTO findById(String id) {
        Ticket ticket = ticketRepository.findByIdAndTenantIdAndDeletedFalse(id, tenantId())
            .orElseThrow(() -> new ResourceNotFoundException("Ticket not found: " + id));
        ensureVisibility(ticket);
        return toDTO(ticket);
    }

    public TicketDTO create(TicketDTO dto) {
        Ticket ticket = fromDTO(dto);
        ticket.setTenantId(tenantId());
        ticket.setStatus(normalizeValue(ticket.getStatus(), "OPEN"));
        ticket.setPriority(normalizeValue(ticket.getPriority(), "MEDIUM"));
        ticket.setCategory(normalizeValue(ticket.getCategory(), "OTHER"));

        User current = currentUser();
        ticket.setCreatedById(current.getId());
        ticket.setTicketNumber(generateTicketNumber());

        Ticket saved = ticketRepository.save(ticket);
        return toDTO(saved);
    }

    public TicketDTO update(String id, TicketDTO dto) {
        Ticket ticket = ticketRepository.findByIdAndTenantIdAndDeletedFalse(id, tenantId())
            .orElseThrow(() -> new ResourceNotFoundException("Ticket not found: " + id));
        ensureVisibility(ticket);

        if (dto.getSubject() != null) ticket.setSubject(dto.getSubject().trim());
        if (dto.getDescription() != null) ticket.setDescription(dto.getDescription());
        if (dto.getCategory() != null) ticket.setCategory(normalizeValue(dto.getCategory(), "OTHER"));
        if (dto.getPriority() != null) ticket.setPriority(normalizeValue(dto.getPriority(), "MEDIUM"));
        if (dto.getStatus() != null) ticket.setStatus(normalizeValue(dto.getStatus(), "OPEN"));
        if (dto.getAssignedToId() != null) ticket.setAssignedToId(blankToNull(dto.getAssignedToId()));
        if (dto.getCustomerEmail() != null) ticket.setCustomerEmail(blankToNull(dto.getCustomerEmail()));
        if (dto.getTags() != null) ticket.setTags(dto.getTags());

        Ticket saved = ticketRepository.save(ticket);
        return toDTO(saved);
    }

    public void delete(String id) {
        Ticket ticket = ticketRepository.findByIdAndTenantIdAndDeletedFalse(id, tenantId())
            .orElseThrow(() -> new ResourceNotFoundException("Ticket not found: " + id));
        ensureVisibility(ticket);
        ticket.setDeleted(true);
        ticketRepository.save(ticket);
    }

    public TicketDTO resolve(String id) {
        Ticket ticket = ticketRepository.findByIdAndTenantIdAndDeletedFalse(id, tenantId())
            .orElseThrow(() -> new ResourceNotFoundException("Ticket not found: " + id));
        ensureVisibility(ticket);
        ticket.setStatus("RESOLVED");
        ticket.setResolvedAt(LocalDateTime.now());
        Ticket saved = ticketRepository.save(ticket);
        return toDTO(saved);
    }

    public TicketDTO close(String id) {
        Ticket ticket = ticketRepository.findByIdAndTenantIdAndDeletedFalse(id, tenantId())
            .orElseThrow(() -> new ResourceNotFoundException("Ticket not found: " + id));
        ensureVisibility(ticket);
        ticket.setStatus("CLOSED");
        ticket.setClosedAt(LocalDateTime.now());
        Ticket saved = ticketRepository.save(ticket);
        return toDTO(saved);
    }

    public TicketDTO reopen(String id) {
        Ticket ticket = ticketRepository.findByIdAndTenantIdAndDeletedFalse(id, tenantId())
            .orElseThrow(() -> new ResourceNotFoundException("Ticket not found: " + id));
        ensureVisibility(ticket);
        ticket.setStatus("OPEN");
        ticket.setResolvedAt(null);
        ticket.setClosedAt(null);
        Ticket saved = ticketRepository.save(ticket);
        return toDTO(saved);
    }

    public TicketDTO addComment(String ticketId, String message, Boolean isInternal) {
        Ticket ticket = ticketRepository.findByIdAndTenantIdAndDeletedFalse(ticketId, tenantId())
            .orElseThrow(() -> new ResourceNotFoundException("Ticket not found: " + ticketId));
        ensureVisibility(ticket);

        User current = currentUser();
        TicketComment comment = TicketComment.builder()
            .id(UUID.randomUUID().toString())
            .userId(current.getId())
            .userName(current.getName())
            .message(message)
            .createdAt(LocalDateTime.now())
            .isInternal(isInternal != null ? isInternal : false)
            .build();

        ticket.getComments().add(comment);
        Ticket saved = ticketRepository.save(ticket);
        return toDTO(saved);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getStats() {
        Long tid = tenantId();
        long open = ticketRepository.countByTenantIdAndDeletedFalseAndStatus(tid, "OPEN");
        long inProgress = ticketRepository.countByTenantIdAndDeletedFalseAndStatus(tid, "IN_PROGRESS");
        long resolved = ticketRepository.countByTenantIdAndDeletedFalseAndStatus(tid, "RESOLVED");
        long closed = ticketRepository.countByTenantIdAndDeletedFalseAndStatus(tid, "CLOSED");
        long total = ticketRepository.countByTenantIdAndDeletedFalse(tid);
        return Map.of(
            "open", open,
            "inProgress", inProgress,
            "resolved", resolved,
            "closed", closed,
            "total", total
        );
    }

    // ── Visibility ──────────────────────────────────────────────────

    private void ensureVisibility(Ticket ticket) {
        if (!matchesVisibility(ticket, currentUser())) {
            throw new ResourceNotFoundException("Ticket not found: " + ticket.getId());
        }
    }

    private boolean matchesVisibility(Ticket ticket, User current) {
        if (current == null || User.isAdminLike(current.getRole()) || current.getRole() == User.Role.MANAGER) {
            return true;
        }
        String currentUserId = current.getId();
        if (currentUserId == null || currentUserId.isBlank()) {
            return false;
        }
        return currentUserId.equals(ticket.getAssignedToId()) || currentUserId.equals(ticket.getCreatedById());
    }

    // ── Filters ─────────────────────────────────────────────────────

    private boolean matchesStatus(Ticket ticket, String status) {
        if (status == null || status.isBlank()) return true;
        return normalizeValue(ticket.getStatus(), "OPEN").equals(normalizeValue(status, "OPEN"));
    }

    private boolean matchesPriority(Ticket ticket, String priority) {
        if (priority == null || priority.isBlank()) return true;
        return normalizeValue(ticket.getPriority(), "MEDIUM").equals(normalizeValue(priority, "MEDIUM"));
    }

    private boolean matchesAssignee(Ticket ticket, String assignedTo) {
        if (assignedTo == null || assignedTo.isBlank()) return true;
        return assignedTo.equals(ticket.getAssignedToId());
    }

    private boolean matchesCategory(Ticket ticket, String category) {
        if (category == null || category.isBlank()) return true;
        return normalizeValue(ticket.getCategory(), "OTHER").equals(normalizeValue(category, "OTHER"));
    }

    private boolean matchesSearch(Ticket ticket, String search) {
        if (search == null || search.isBlank()) return true;
        String needle = search.trim().toLowerCase(Locale.ROOT);
        return contains(ticket.getSubject(), needle)
            || contains(ticket.getDescription(), needle)
            || contains(ticket.getTicketNumber(), needle)
            || contains(ticket.getCustomerEmail(), needle);
    }

    private boolean contains(String value, String needle) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(needle);
    }

    // ── Ticket number generation ────────────────────────────────────

    private String generateTicketNumber() {
        long count = ticketRepository.countByTenantIdAndDeletedFalse(tenantId());
        // Also count deleted tickets for unique numbering
        long totalCount = ticketRepository.count();
        long next = Math.max(count, totalCount) + 1;
        return String.format("TKT-%04d", next);
    }

    // ── DTO mapping ─────────────────────────────────────────────────

    private TicketDTO toDTO(Ticket ticket) {
        String assignedName = ticket.getAssignedToId() != null
            ? userRepository.findByIdAndTenantIdAndDeletedFalse(ticket.getAssignedToId(), tenantId())
                .map(User::getName)
                .orElse(null)
            : null;
        String createdByName = ticket.getCreatedById() != null
            ? userRepository.findByIdAndTenantIdAndDeletedFalse(ticket.getCreatedById(), tenantId())
                .map(User::getName)
                .orElse(null)
            : null;

        List<TicketDTO.TicketCommentDTO> commentDTOs = ticket.getComments() != null
            ? ticket.getComments().stream().map(this::toCommentDTO).collect(Collectors.toList())
            : List.of();

        return TicketDTO.builder()
            .id(ticket.getId())
            .ticketNumber(ticket.getTicketNumber())
            .subject(ticket.getSubject())
            .description(ticket.getDescription())
            .category(ticket.getCategory())
            .priority(ticket.getPriority())
            .status(ticket.getStatus())
            .assignedToId(ticket.getAssignedToId())
            .assignedToName(assignedName)
            .createdById(ticket.getCreatedById())
            .createdByName(createdByName)
            .customerEmail(ticket.getCustomerEmail())
            .tags(ticket.getTags())
            .resolvedAt(ticket.getResolvedAt())
            .closedAt(ticket.getClosedAt())
            .comments(commentDTOs)
            .createdAt(ticket.getCreatedAt())
            .updatedAt(ticket.getUpdatedAt())
            .build();
    }

    private TicketDTO.TicketCommentDTO toCommentDTO(TicketComment comment) {
        return TicketDTO.TicketCommentDTO.builder()
            .id(comment.getId())
            .userId(comment.getUserId())
            .userName(comment.getUserName())
            .message(comment.getMessage())
            .createdAt(comment.getCreatedAt())
            .isInternal(comment.getIsInternal())
            .build();
    }

    private Ticket fromDTO(TicketDTO dto) {
        return Ticket.builder()
            .subject(dto.getSubject() != null ? dto.getSubject().trim() : null)
            .description(dto.getDescription())
            .category(dto.getCategory())
            .priority(dto.getPriority() != null ? dto.getPriority() : "MEDIUM")
            .status(dto.getStatus() != null ? dto.getStatus() : "OPEN")
            .assignedToId(blankToNull(dto.getAssignedToId()))
            .customerEmail(blankToNull(dto.getCustomerEmail()))
            .tags(dto.getTags() != null ? dto.getTags() : List.of())
            .build();
    }

    private String normalizeValue(String value, String defaultValue) {
        if (value == null || value.isBlank()) {
            return defaultValue;
        }
        return value.trim().toUpperCase(Locale.ROOT).replace(' ', '_');
    }

    private String blankToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isBlank() ? null : trimmed;
    }
}
