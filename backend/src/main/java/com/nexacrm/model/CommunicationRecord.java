package com.nexacrm.model;

import lombok.Getter;
import lombok.Setter;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;

@Document(collection = "communications")
@CompoundIndexes({
    @CompoundIndex(name = "comm_tenant_channel_contact_created_idx", def = "{'tenant_id': 1, 'channel': 1, 'contact_identifier': 1, 'created_at': -1}"),
    @CompoundIndex(name = "comm_tenant_channel_external_idx", def = "{'tenant_id': 1, 'channel': 1, 'external_id': 1}", unique = true, partialFilter = "{ 'external_id': { '$type': 'string', '$gt': '' } }"),
    @CompoundIndex(name = "comm_tenant_lead_channel_created_idx", def = "{'tenant_id': 1, 'lead_id': 1, 'channel': 1, 'created_at': -1}")
})
@Getter
@Setter
public class CommunicationRecord {

    @Id
    private String id;

    @Field("tenant_id")
    private Long tenantId = 1L;

    @Field("lead_id")
    private String leadId;

    @Field("customer_id")
    private String customerId;

    @Field("channel")
    private String channel;

    @Field("direction")
    private String direction;

    @Field("subject")
    private String subject;

    @Field("body")
    private String body;

    @Field("sender_id")
    private String senderId;

    @Field("is_ai_reply")
    private Boolean isAiReply = false;

    @Field("external_id")
    private String externalId;

    @Field("status")
    private String status = "SENT";

    @Field("created_at")
    private Instant createdAt;

    @Field("contact_identifier")
    private String contactIdentifier;

    @Field("contact_name")
    private String contactName;

    @Field("provider")
    private String provider;

    @Field("raw_payload")
    private String rawPayload;
}
