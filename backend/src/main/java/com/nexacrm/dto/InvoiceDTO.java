package com.nexacrm.dto;

import com.nexacrm.model.Invoice;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class InvoiceDTO {
    private String id;
    private String invoiceNumber;

    @NotNull(message = "Customer is required")
    private String customerId;
    private String customerName;

    private String dealId;

    private Invoice.InvoiceStatus status;

    @NotNull(message = "Issue date is required")
    private LocalDate issueDate;

    @NotNull(message = "Due date is required")
    private LocalDate dueDate;

    private LocalDate paidDate;

    @NotNull(message = "Subtotal is required")
    private BigDecimal subtotal;

    private BigDecimal gstRate;
    private BigDecimal gstAmount;
    private BigDecimal total;

    private String notes;
    private String tallyRef;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
