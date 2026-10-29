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

import java.util.LinkedHashMap;
import java.util.Map;

@Document(collection = "integration_configs")
@CompoundIndexes({
    @CompoundIndex(name = "uk_tenant_integration", def = "{'tenant_id':1,'integration_id':1}", unique = true)
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class IntegrationConfig extends BaseEntity {

    @Field("integration_id")
    private String integrationId;

    @Field("connected")
    private Boolean connected = false;

    @Field("values")
    @Builder.Default
    private Map<String, String> values = new LinkedHashMap<>();
}
