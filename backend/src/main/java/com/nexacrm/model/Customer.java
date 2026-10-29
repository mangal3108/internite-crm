package com.nexacrm.model;

import lombok.*;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.TextIndexed;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

@Document(collection = "customers")
@CompoundIndexes({
    @CompoundIndex(name = "customer_tenant_email_idx", def = "{'tenant_id': 1, 'email': 1}", unique = true),
    @CompoundIndex(name = "customer_tenant_phone_idx", def = "{'tenant_id': 1, 'phone': 1}", unique = true, partialFilter = "{ 'phone': { '$type': 'string', '$gt': '' } }"),
    @CompoundIndex(name = "customer_tenant_status_created_idx", def = "{'tenant_id': 1, 'deleted': 1, 'status': 1, 'createdAt': -1}")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Customer extends BaseEntity {

    @TextIndexed
    @Field("name")
    private String name;

    @TextIndexed
    @Field("email")
    private String email;

    @TextIndexed
    @Field("phone")
    private String phone;
    @TextIndexed
    @Field("company")
    private String company;
    @Field("industry")
    private String industry;
    @Field("website")
    private String website;

    @Field("primary_contact")
    private String primaryContact;

    @DBRef(lazy = true)
    @Field("account_manager")
    private User accountManager;

    @Field("health_score")
    private Integer healthScore;

    @Field("status")
    private CustomerStatus status = CustomerStatus.ACTIVE;

    @Field("gstin")
    private String gstin;

    @Field("notes")
    private String notes;

    @Field("avatar_url")
    private String avatarUrl;

    public enum CustomerStatus { ACTIVE, INACTIVE, AT_RISK, CHURNED }
}
