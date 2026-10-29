package com.nexacrm.model;

import lombok.*;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Document(collection = "invoices")
@CompoundIndexes({
    @CompoundIndex(name = "invoice_tenant_number_idx", def = "{'tenant_id': 1, 'invoice_number': 1}", unique = true),
    @CompoundIndex(name = "invoice_tenant_status_due_idx", def = "{'tenant_id': 1, 'deleted': 1, 'status': 1, 'due_date': 1}"),
    @CompoundIndex(name = "invoice_tenant_customer_status_idx", def = "{'tenant_id': 1, 'deleted': 1, 'customer': 1, 'status': 1}")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Invoice extends BaseEntity {

    @Field("invoice_number")
    private String invoiceNumber;

    @DBRef(lazy = true)
    @Field("customer")
    private Customer customer;

    @DBRef(lazy = true)
    @Field("deal")
    private Deal deal;

    @Field("status")
    private InvoiceStatus status = InvoiceStatus.DRAFT;

    @Field("issue_date")
    private LocalDate issueDate;

    @Field("due_date")
    private LocalDate dueDate;

    @Field("paid_date")
    private LocalDate paidDate;

    // Amounts
    @Field("subtotal")
    private BigDecimal subtotal;

    @Field("gst_rate")
    private BigDecimal gstRate = BigDecimal.valueOf(18);

    @Field("gst_amount")
    private BigDecimal gstAmount;

    @Field("total")
    private BigDecimal total;

    @Field("notes")
    private String notes;

    @Field("tally_ref")
    private String tallyRef;

    public enum InvoiceStatus { DRAFT, SENT, PENDING, PAID, OVERDUE, CANCELLED }
}
