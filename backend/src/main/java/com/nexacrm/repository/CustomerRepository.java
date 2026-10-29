package com.nexacrm.repository;

import com.nexacrm.model.Customer;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface CustomerRepository extends MongoRepository<Customer, String> {

    List<Customer> findByTenantIdAndDeletedFalseAndAccountManager_Id(Long tenantId, String accountManagerId);

    Optional<Customer> findByIdAndTenantIdAndDeletedFalse(String id, Long tenantId);

    Optional<Customer> findByEmailAndTenantIdAndDeletedFalse(String email, Long tenantId);

    Optional<Customer> findByPhoneAndTenantIdAndDeletedFalse(String phone, Long tenantId);

    Optional<Customer> findFirstByPhoneAndTenantIdAndDeletedFalseOrderByUpdatedAtDesc(String phone, Long tenantId);

    boolean existsByEmailAndTenantIdAndDeletedFalse(String email, Long tenantId);

    boolean existsByPhoneAndTenantIdAndDeletedFalse(String phone, Long tenantId);

    long countByTenantIdAndDeletedFalse(Long tenantId);
}
