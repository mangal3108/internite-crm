package com.nexacrm.repository;

import com.nexacrm.model.AppSetting;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface AppSettingRepository extends MongoRepository<AppSetting, String> {
    List<AppSetting> findByTenantIdAndNamespaceAndDeletedFalse(Long tenantId, String namespace);
    Optional<AppSetting> findByTenantIdAndNamespaceAndKeyAndDeletedFalse(Long tenantId, String namespace, String key);
}
