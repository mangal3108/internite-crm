package com.nexacrm.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;

@Document(collection = "refresh_tokens")
@CompoundIndexes({
    @CompoundIndex(name = "refresh_token_tenant_hash_idx", def = "{'tenant_id':1,'token_hash':1}", unique = true),
    @CompoundIndex(name = "refresh_token_tenant_user_idx", def = "{'tenant_id':1,'user_id':1,'revoked_at':1}")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RefreshToken extends BaseEntity {

    @Field("user_id")
    private String userId;

    @Field("token_hash")
    private String tokenHash;

    @org.springframework.data.mongodb.core.index.Indexed(expireAfterSeconds = 0)
    @Field("expires_at")
    private Instant expiresAt;

    @Field("revoked_at")
    private Instant revokedAt;

    @Field("replaced_by_token_hash")
    private String replacedByTokenHash;
}
