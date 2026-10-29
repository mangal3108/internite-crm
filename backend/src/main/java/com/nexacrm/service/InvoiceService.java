package com.nexacrm.service;

import com.nexacrm.dto.InvoiceDTO;
import com.nexacrm.dto.PageResponse;
import com.nexacrm.dto.EmailSendRequest;
import com.nexacrm.exception.ResourceNotFoundException;
import com.nexacrm.model.Invoice;
import com.nexacrm.model.User;
import com.nexacrm.repository.CustomerRepository;
import com.nexacrm.repository.DealRepository;
import com.nexacrm.repository.InvoiceRepository;
import com.nexacrm.repository.UserRepository;
import com.nexacrm.security.TenantContext;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class InvoiceService {

    private final InvoiceRepository invoiceRepository;
    private final CustomerRepository customerRepository;
    private final DealRepository dealRepository;
    private final UserRepository userRepository;
    private final CommunicationService communicationService;
    private final MongoTemplate mongoTemplate;

    private Long tenantId() {
        return TenantContext.currentTenantId();
    }

    @Transactional(readOnly = true)
    public PageResponse<InvoiceDTO> findAll(String status, String customerId, Pageable pageable) {
        Query query = new Query();
        query.addCriteria(Criteria.where("tenant_id").is(tenantId()));
        query.addCriteria(Criteria.where("deleted").is(false));
        if (status != null && !status.isBlank()) {
            query.addCriteria(Criteria.where("status").is(Invoice.InvoiceStatus.valueOf(status.toUpperCase())));
        }
        if (customerId != null && !customerId.isBlank()) {
            query.addCriteria(Criteria.where("customer.$id").is(customerId));
        }

        User current = currentUser();
        if (current != null && !User.isAdminLike(current.getRole()) && current.getRole() != User.Role.MANAGER) {
            // ponytail: two small lookups to push access filter to DB instead of loading all invoices
            List<String> myCustomerIds = customerRepository
                .findByTenantIdAndDeletedFalseAndAccountManager_Id(tenantId(), current.getId())
                .stream().map(c -> c.getId()).toList();
            List<String> myDealIds = dealRepository
                .findByTenantIdAndDeletedFalseAndOwner_Id(tenantId(), current.getId())
                .stream().map(d -> d.getId()).toList();
            List<Criteria> accessOr = new ArrayList<>();
            if (!myCustomerIds.isEmpty()) {
                accessOr.add(Criteria.where("customer.$id").in(
                    myCustomerIds.stream().map(id -> new org.bson.types.ObjectId(id)).toList()));
            }
            if (!myDealIds.isEmpty()) {
                accessOr.add(Criteria.where("deal.$id").in(
                    myDealIds.stream().map(id -> new org.bson.types.ObjectId(id)).toList()));
            }
            if (accessOr.isEmpty()) {
                return PageResponse.<InvoiceDTO>builder()
                    .content(List.of()).page(pageable.getPageNumber()).size(pageable.getPageSize())
                    .total(0).totalPages(0).first(true).last(true).build();
            }
            query.addCriteria(new Criteria().orOperator(accessOr.toArray(new Criteria[0])));
        }
        return pageInvoiceQuery(query, pageable);
    }

    private PageResponse<InvoiceDTO> pageInvoiceQuery(Query baseQuery, Pageable pageable) {
        Query countQuery = Query.of(baseQuery).limit(-1).skip(-1);
        long total = mongoTemplate.count(countQuery, Invoice.class);
        Query pageQuery = Query.of(baseQuery);
        pageQuery.with(pageable);
        if (pageable.getSort().isUnsorted()) {
            pageQuery.with(Sort.by(Sort.Order.desc("createdAt")));
        }
        Page<Invoice> page = new PageImpl<>(mongoTemplate.find(pageQuery, Invoice.class), pageable, total);
        return toPageResponse(page);
    }

    private PageResponse<InvoiceDTO> toPageResponse(Page<Invoice> page) {
        return PageResponse.<InvoiceDTO>builder()
            .content(page.getContent().stream().map(this::toDTO).collect(Collectors.toList()))
            .page(page.getNumber()).size(page.getSize())
            .total(page.getTotalElements()).totalPages(page.getTotalPages())
            .first(page.isFirst()).last(page.isLast())
            .build();
    }

    @Transactional(readOnly = true)
    public InvoiceDTO findById(String id) {
        Invoice invoice = invoiceRepository.findByIdAndTenantIdAndDeletedFalse(id, tenantId())
            .orElseThrow(() -> new ResourceNotFoundException("Invoice not found: " + id));
        ensureVisible(invoice);
        return toDTO(invoice);
    }

    public InvoiceDTO create(InvoiceDTO dto) {
        Invoice invoice = fromDTO(dto);
        invoice.setTenantId(tenantId());

        boolean autoGeneratedNumber = invoice.getInvoiceNumber() == null || invoice.getInvoiceNumber().isBlank();
        int attempts = autoGeneratedNumber ? 3 : 1;
        for (int attempt = 1; attempt <= attempts; attempt++) {
            if (autoGeneratedNumber) {
                invoice.setInvoiceNumber(generateInvoiceNumber());
            }
            calculateAmounts(invoice);
            try {
                Invoice saved = invoiceRepository.save(invoice);
                log.info("Invoice created: id={}, number={}", saved.getId(), saved.getInvoiceNumber());
                return toDTO(saved);
            } catch (DuplicateKeyException ex) {
                if (!autoGeneratedNumber || attempt == attempts) {
                    throw new IllegalStateException("Invoice number already exists. Please retry.", ex);
                }
                log.warn("Invoice number collision detected, retrying generation (attempt {}/{})", attempt, attempts);
            }
        }
        throw new IllegalStateException("Unable to generate unique invoice number.");
    }

    public InvoiceDTO update(String id, InvoiceDTO dto) {
        Invoice invoice = invoiceRepository.findByIdAndTenantIdAndDeletedFalse(id, tenantId())
            .orElseThrow(() -> new ResourceNotFoundException("Invoice not found: " + id));
        ensureVisible(invoice);

        if (dto.getCustomerId() != null) {
            if (dto.getCustomerId().isBlank()) {
                invoice.setCustomer(null);
            } else {
                customerRepository.findByIdAndTenantIdAndDeletedFalse(dto.getCustomerId(), tenantId())
                    .ifPresent(invoice::setCustomer);
            }
        }
        if (dto.getDealId() != null) {
            if (dto.getDealId().isBlank()) {
                invoice.setDeal(null);
            } else {
                dealRepository.findByIdAndTenantIdAndDeletedFalse(dto.getDealId(), tenantId())
                    .ifPresent(invoice::setDeal);
            }
        }
        if (dto.getStatus() != null) invoice.setStatus(dto.getStatus());
        if (dto.getIssueDate() != null) invoice.setIssueDate(dto.getIssueDate());
        if (dto.getDueDate() != null) invoice.setDueDate(dto.getDueDate());
        if (dto.getSubtotal() != null) invoice.setSubtotal(dto.getSubtotal());
        if (dto.getGstRate() != null) invoice.setGstRate(dto.getGstRate());
        invoice.setNotes(dto.getNotes());
        invoice.setTallyRef(dto.getTallyRef());

        calculateAmounts(invoice);
        return toDTO(invoiceRepository.save(invoice));
    }

    public InvoiceDTO markPaid(String id) {
        Invoice invoice = invoiceRepository.findByIdAndTenantIdAndDeletedFalse(id, tenantId())
            .orElseThrow(() -> new ResourceNotFoundException("Invoice not found: " + id));
        ensureVisible(invoice);
        invoice.setStatus(Invoice.InvoiceStatus.PAID);
        invoice.setPaidDate(LocalDate.now());
        return toDTO(invoiceRepository.save(invoice));
    }

    public void delete(String id) {
        Invoice invoice = invoiceRepository.findByIdAndTenantIdAndDeletedFalse(id, tenantId())
            .orElseThrow(() -> new ResourceNotFoundException("Invoice not found: " + id));
        ensureVisible(invoice);
        invoice.setDeleted(true);
        invoiceRepository.save(invoice);
    }

    @Transactional(readOnly = true)
    public byte[] generatePdf(String id) {
        Invoice invoice = invoiceRepository.findByIdAndTenantIdAndDeletedFalse(id, tenantId())
            .orElseThrow(() -> new ResourceNotFoundException("Invoice not found: " + id));
        ensureVisible(invoice);
        try {
            return buildPdf(invoice);
        } catch (IOException ex) {
            throw new IllegalStateException("Unable to generate invoice PDF", ex);
        }
    }

    public Map<String, Object> sendReminder(String id) {
        Invoice invoice = invoiceRepository.findByIdAndTenantIdAndDeletedFalse(id, tenantId())
            .orElseThrow(() -> new ResourceNotFoundException("Invoice not found: " + id));
        ensureVisible(invoice);

        String recipientEmail = invoice.getCustomer() != null ? invoice.getCustomer().getEmail() : null;
        if (recipientEmail == null || recipientEmail.isBlank()) {
            throw new IllegalStateException("Customer email is required to send a reminder.");
        }

        EmailSendRequest request = new EmailSendRequest();
        request.setTo(recipientEmail);
        request.setSubject("Payment reminder for invoice " + invoice.getInvoiceNumber());
        request.setBody(buildReminderBody(invoice));
        communicationService.sendEmail(request);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("message", "Reminder sent");
        response.put("invoiceId", invoice.getId());
        response.put("invoiceNumber", invoice.getInvoiceNumber());
        response.put("sentTo", recipientEmail);
        return response;
    }

    private void calculateAmounts(Invoice invoice) {
        if (invoice.getSubtotal() == null) return;
        BigDecimal rate = invoice.getGstRate() != null ? invoice.getGstRate() : BigDecimal.valueOf(18);
        BigDecimal gstAmount = invoice.getSubtotal()
            .multiply(rate)
            .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        invoice.setGstRate(rate);
        invoice.setGstAmount(gstAmount);
        invoice.setTotal(invoice.getSubtotal().add(gstAmount));
    }

    private String generateInvoiceNumber() {
        String prefix = "INV-" + DateTimeFormatter.ofPattern("yyyyMM").format(LocalDate.now()) + "-";
        long count = invoiceRepository.countByTenantIdAndDeletedFalse(tenantId()) + 1;
        return prefix + String.format("%04d", count);
    }

    private InvoiceDTO toDTO(Invoice i) {
        return InvoiceDTO.builder()
            .id(i.getId())
            .invoiceNumber(i.getInvoiceNumber())
            .customerId(i.getCustomer() != null ? i.getCustomer().getId() : null)
            .customerName(i.getCustomer() != null ? i.getCustomer().getName() : null)
            .dealId(i.getDeal() != null ? i.getDeal().getId() : null)
            .status(i.getStatus())
            .issueDate(i.getIssueDate())
            .dueDate(i.getDueDate())
            .paidDate(i.getPaidDate())
            .subtotal(i.getSubtotal())
            .gstRate(i.getGstRate())
            .gstAmount(i.getGstAmount())
            .total(i.getTotal())
            .notes(i.getNotes())
            .tallyRef(i.getTallyRef())
            .createdAt(i.getCreatedAt())
            .updatedAt(i.getUpdatedAt())
            .build();
    }

    private Invoice fromDTO(InvoiceDTO dto) {
        Invoice.InvoiceBuilder builder = Invoice.builder()
            .invoiceNumber(dto.getInvoiceNumber())
            .status(dto.getStatus() != null ? dto.getStatus() : Invoice.InvoiceStatus.DRAFT)
            .issueDate(dto.getIssueDate())
            .dueDate(dto.getDueDate())
            .subtotal(dto.getSubtotal())
            .gstRate(dto.getGstRate())
            .notes(dto.getNotes())
            .tallyRef(dto.getTallyRef());

        if (dto.getCustomerId() != null && !dto.getCustomerId().isBlank()) {
            customerRepository.findByIdAndTenantIdAndDeletedFalse(dto.getCustomerId(), tenantId())
                .ifPresent(builder::customer);
        }
        if (dto.getDealId() != null && !dto.getDealId().isBlank()) {
            dealRepository.findByIdAndTenantIdAndDeletedFalse(dto.getDealId(), tenantId())
                .ifPresent(builder::deal);
        }

        return builder.build();
    }

    private void ensureVisible(Invoice invoice) {
        if (!canCurrentUserAccess(invoice)) {
            throw new ResourceNotFoundException("Invoice not found: " + invoice.getId());
        }
    }

    private boolean canCurrentUserAccess(Invoice invoice) {
        return canCurrentUserAccess(invoice, currentUser());
    }

    private boolean canCurrentUserAccess(Invoice invoice, User current) {
        if (current == null || User.isAdminLike(current.getRole()) || current.getRole() == User.Role.MANAGER) {
            return true;
        }
        if (current.getId() == null || current.getId().isBlank() || invoice == null) {
            return false;
        }
        boolean customerMatch = invoice.getCustomer() != null
            && invoice.getCustomer().getAccountManager() != null
            && current.getId().equals(invoice.getCustomer().getAccountManager().getId());
        boolean dealMatch = invoice.getDeal() != null
            && invoice.getDeal().getOwner() != null
            && current.getId().equals(invoice.getDeal().getOwner().getId());
        return customerMatch || dealMatch;
    }

    private byte[] buildPdf(Invoice invoice) throws IOException {
        try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PDPage page = new PDPage(PDRectangle.A4);
            document.addPage(page);

            try (PDPageContentStream content = new PDPageContentStream(document, page)) {
                List<String> lines = buildPdfLines(invoice);
                float x = 50;
                float y = 780;
                float lineHeight = 16;

                content.beginText();
                content.setFont(PDType1Font.HELVETICA_BOLD, 18);
                content.newLineAtOffset(x, y);
                content.showText("Internite CRM Invoice");
                content.endText();

                y -= 28;
                content.beginText();
                content.setFont(PDType1Font.HELVETICA, 11);
                content.newLineAtOffset(x, y);
                for (String line : lines) {
                    content.showText(line);
                    content.newLineAtOffset(0, -lineHeight);
                }
                content.endText();
            }

            document.save(output);
            return output.toByteArray();
        }
    }

    private List<String> buildPdfLines(Invoice invoice) {
        List<String> lines = new ArrayList<>();
        lines.add("Invoice #: " + safe(invoice.getInvoiceNumber()));
        lines.add("Customer: " + safe(invoice.getCustomer() != null ? invoice.getCustomer().getName() : null));
        lines.add("Email: " + safe(invoice.getCustomer() != null ? invoice.getCustomer().getEmail() : null));
        lines.add("Deal ID: " + safe(invoice.getDeal() != null ? invoice.getDeal().getId() : null));
        lines.add("Status: " + safe(invoice.getStatus() != null ? invoice.getStatus().name() : null));
        lines.add("Issue Date: " + safe(invoice.getIssueDate() != null ? invoice.getIssueDate().toString() : null));
        lines.add("Due Date: " + safe(invoice.getDueDate() != null ? invoice.getDueDate().toString() : null));
        lines.add("Subtotal: " + formatMoney(invoice.getSubtotal()));
        lines.add("GST Rate: " + formatRate(invoice.getGstRate()));
        lines.add("GST Amount: " + formatMoney(invoice.getGstAmount()));
        lines.add("Total: " + formatMoney(invoice.getTotal()));
        lines.add(" ");
        lines.add("Notes:");
        if (invoice.getNotes() != null && !invoice.getNotes().isBlank()) {
            for (String paragraph : invoice.getNotes().split("\\r?\\n")) {
                lines.add("  " + paragraph);
            }
        } else {
            lines.add("  No notes provided.");
        }
        lines.add(" ");
        lines.add("Generated by Internite CRM");
        return lines;
    }

    private String buildReminderBody(Invoice invoice) {
        String customerName = invoice.getCustomer() != null && invoice.getCustomer().getName() != null
            ? invoice.getCustomer().getName()
            : "there";
        String total = formatMoney(invoice.getTotal());
        return """
            Hi %s,

            This is a friendly reminder for invoice %s due on %s.
            Outstanding amount: %s

            Please review the invoice and complete payment at your earliest convenience.

            Thanks,
            Internite CRM
            """.formatted(
            customerName,
            safe(invoice.getInvoiceNumber()),
            safe(invoice.getDueDate() != null ? invoice.getDueDate().toString() : null),
            total
        );
    }

    private String safe(String value) {
        if (value == null || value.isBlank()) {
            return "-";
        }
        return value.replaceAll("[^\\p{Print}\\s]", "?");
    }

    private String formatMoney(BigDecimal value) {
        if (value == null) {
            return "INR 0.00";
        }
        return "INR " + value.setScale(2, RoundingMode.HALF_UP);
    }

    private String formatRate(BigDecimal value) {
        if (value == null) {
            return "18%";
        }
        return value.setScale(2, RoundingMode.HALF_UP) + "%";
    }

    private User currentUser() {
        String email = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmailAndTenantIdAndDeletedFalse(email, tenantId())
            .orElseThrow(() -> new ResourceNotFoundException("Authenticated user not found"));
    }
}
