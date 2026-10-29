package com.nexacrm.controller;

import com.nexacrm.dto.TicketDTO;
import com.nexacrm.service.TicketService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tickets")
@RequiredArgsConstructor
@Tag(name = "Tickets", description = "Ticket / support request management endpoints")
public class TicketController {

    private final TicketService ticketService;

    @GetMapping
    @PreAuthorize("hasAuthority('tickets.read')")
    @Operation(summary = "List all tickets with optional filters")
    public ResponseEntity<List<TicketDTO>> getAll(
        @RequestParam(required = false) String status,
        @RequestParam(required = false) String priority,
        @RequestParam(required = false) String assignedTo,
        @RequestParam(required = false) String category,
        @RequestParam(required = false) String search
    ) {
        return ResponseEntity.ok(ticketService.findAll(status, priority, assignedTo, category, search));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('tickets.read')")
    @Operation(summary = "Get ticket by ID")
    public ResponseEntity<TicketDTO> getById(@PathVariable String id) {
        return ResponseEntity.ok(ticketService.findById(id));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('tickets.create')")
    @Operation(summary = "Create a new ticket")
    public ResponseEntity<TicketDTO> create(@Valid @RequestBody TicketDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ticketService.create(dto));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('tickets.update')")
    @Operation(summary = "Update a ticket")
    public ResponseEntity<TicketDTO> update(@PathVariable String id, @RequestBody TicketDTO dto) {
        return ResponseEntity.ok(ticketService.update(id, dto));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('tickets.delete')")
    @Operation(summary = "Soft-delete a ticket")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        ticketService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}/resolve")
    @PreAuthorize("hasAuthority('tickets.update')")
    @Operation(summary = "Resolve a ticket")
    public ResponseEntity<TicketDTO> resolve(@PathVariable String id) {
        return ResponseEntity.ok(ticketService.resolve(id));
    }

    @PatchMapping("/{id}/close")
    @PreAuthorize("hasAuthority('tickets.update')")
    @Operation(summary = "Close a ticket")
    public ResponseEntity<TicketDTO> close(@PathVariable String id) {
        return ResponseEntity.ok(ticketService.close(id));
    }

    @PatchMapping("/{id}/reopen")
    @PreAuthorize("hasAuthority('tickets.update')")
    @Operation(summary = "Reopen a ticket")
    public ResponseEntity<TicketDTO> reopen(@PathVariable String id) {
        return ResponseEntity.ok(ticketService.reopen(id));
    }

    @PostMapping("/{id}/comments")
    @PreAuthorize("hasAuthority('tickets.update')")
    @Operation(summary = "Add a comment to a ticket")
    public ResponseEntity<TicketDTO> addComment(
        @PathVariable String id,
        @Valid @RequestBody TicketDTO.TicketCommentDTO commentDto
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(ticketService.addComment(id, commentDto.getMessage(), commentDto.getIsInternal()));
    }

    @GetMapping("/stats")
    @PreAuthorize("hasAuthority('tickets.read')")
    @Operation(summary = "Get ticket statistics by status")
    public ResponseEntity<Map<String, Object>> getStats() {
        return ResponseEntity.ok(ticketService.getStats());
    }
}
