package com.nexacrm.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SubscriptionInvoice {

    @Field("id")
    @Builder.Default
    private String id = UUID.randomUUID().toString();

    @Field("invoice_number")
    private String invoiceNumber;

    @Field("amount")
    private Double amount;

    @Field("currency")
    @Builder.Default
    private String currency = "INR";

    @Field("status")
    @Builder.Default
    private String status = "PENDING";

    @Field("paid_at")
    private LocalDateTime paidAt;

    @Field("created_at")
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Field("description")
    private String description;
}
