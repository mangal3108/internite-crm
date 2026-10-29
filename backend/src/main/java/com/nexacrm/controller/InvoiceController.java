package com.nexacrm.controller;

import com.nexacrm.dto.InvoiceDTO;
import com.nexacrm.dto.PageResponse;
import com.nexacrm.service.InvoiceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/invoices")
@RequiredArgsConstructor
@Tag(name = "Invoices", description = "Invoice management endpoints")
public class InvoiceController {

    private final InvoiceService invoiceService;

    @GetMapping
    @PreAuthorize("hasAuthority('invoices.read')")
    @Operation(summary = "Get all invoices with pagination and filters")
    public ResponseEntity<PageResponse<InvoiceDTO>> getInvoices(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String customerId,
            @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(invoiceService.findAll(status, customerId, pageable));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('invoices.read')")
    @Operation(summary = "Get invoice by ID")
    public ResponseEntity<InvoiceDTO> getInvoiceById(@PathVariable String id) {
        return ResponseEntity.ok(invoiceService.findById(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('invoices.create')")
    @Operation(summary = "Create a new invoice")
    public ResponseEntity<InvoiceDTO> createInvoice(@Valid @RequestBody InvoiceDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(invoiceService.create(dto));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('invoices.update')")
    @Operation(summary = "Update invoice")
    public ResponseEntity<InvoiceDTO> updateInvoice(@PathVariable String id, @RequestBody InvoiceDTO dto) {
        return ResponseEntity.ok(invoiceService.update(id, dto));
    }

    @PatchMapping("/{id}/mark-paid")
    @PreAuthorize("hasAuthority('invoices.mark_paid')")
    @Operation(summary = "Mark invoice as paid")
    public ResponseEntity<InvoiceDTO> markPaid(@PathVariable String id) {
        return ResponseEntity.ok(invoiceService.markPaid(id));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('invoices.delete')")
    @Operation(summary = "Delete invoice")
    public ResponseEntity<Void> deleteInvoice(@PathVariable String id) {
        invoiceService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/pdf")
    @PreAuthorize("hasAuthority('invoices.read')")
    @Operation(summary = "Download invoice as PDF")
    public ResponseEntity<byte[]> downloadPdf(@PathVariable String id) {
        byte[] pdf = invoiceService.generatePdf(id);
        String filename = "invoice-" + id + ".pdf";
        return ResponseEntity.ok()
            .contentType(MediaType.APPLICATION_PDF)
            .header("Content-Disposition", "attachment; filename=\"" + filename + "\"")
            .body(pdf);
    }

    @PostMapping("/{id}/reminder")
    @PreAuthorize("hasAuthority('invoices.reminder')")
    @Operation(summary = "Send payment reminder")
    public ResponseEntity<Map<String, Object>> sendReminder(@PathVariable String id) {
        return ResponseEntity.ok(invoiceService.sendReminder(id));
    }
}
