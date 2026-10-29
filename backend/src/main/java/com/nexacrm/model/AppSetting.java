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

@Document(collection = "settings")
@CompoundIndexes({
    @CompoundIndex(name = "setting_tenant_namespace_key_idx", def = "{'tenant_id': 1, 'namespace': 1, 'setting_key': 1}", unique = true)
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AppSetting extends BaseEntity {

    @Field("namespace")
    private String namespace;

    @Field("setting_key")
    private String key;

    @Field("setting_value")
    private String value;

    @Field("encrypted")
    private Boolean encrypted = false;

    @Field("description")
    private String description;
}
