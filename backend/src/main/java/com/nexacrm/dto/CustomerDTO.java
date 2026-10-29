package com.nexacrm.dto;

import com.nexacrm.model.Customer;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.*;

import java.time.LocalDateTime;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class CustomerDTO {
    private String id;

    @NotBlank(message = "Name is required")
    private String name;

    @Email(message = "Valid email required")
    @NotBlank(message = "Email is required")
    private String email;

    private String phone;
    private String company;
    private String industry;
    private String website;
    private String primaryContact;
    private String accountManagerId;
    private String accountManagerName;
    private Integer healthScore;
    private Customer.CustomerStatus status;
    private String gstin;
    private String notes;
    private String avatarUrl;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
