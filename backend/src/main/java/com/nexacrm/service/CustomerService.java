package com.nexacrm.service;

import com.nexacrm.dto.CustomerDTO;
import com.nexacrm.dto.PageResponse;
import com.nexacrm.exception.ConflictException;
import com.nexacrm.exception.ResourceNotFoundException;
import com.nexacrm.model.Customer;
import com.nexacrm.model.User;
import com.nexacrm.repository.CustomerRepository;
import com.nexacrm.repository.UserRepository;
import com.nexacrm.security.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class CustomerService {

    private final CustomerRepository customerRepository;
    private final UserRepository userRepository;
    private final MongoTemplate mongoTemplate;

    private Long tenantId() {
        return TenantContext.currentTenantId();
    }

    @Transactional(readOnly = true)
    public PageResponse<CustomerDTO> findAll(String search, String status, Pageable pageable) {
        Query query = new Query();
        query.addCriteria(Criteria.where("tenant_id").is(tenantId()));
        query.addCriteria(Criteria.where("deleted").is(false));
        User current = currentUser();
        if (!User.isAdminLike(current.getRole()) && current.getRole() != User.Role.MANAGER) {
            query.addCriteria(Criteria.where("account_manager.$id").is(current.getId()));
        }

        if (search != null && !search.isBlank()) {
            query.addCriteria(buildCustomerSearchCriteria(search.trim()));
        }
        if (status != null && !status.isBlank()) {
            query.addCriteria(Criteria.where("status").is(Customer.CustomerStatus.valueOf(status.toUpperCase(Locale.ROOT))));
        }

        long total = mongoTemplate.count(query, Customer.class);
        query.with(pageable);
        Page<Customer> page = new PageImpl<>(mongoTemplate.find(query, Customer.class), pageable, total);

        return PageResponse.<CustomerDTO>builder()
            .content(page.getContent().stream().map(this::toDTO).collect(Collectors.toList()))
            .page(page.getNumber()).size(page.getSize())
            .total(page.getTotalElements()).totalPages(page.getTotalPages())
            .first(page.isFirst()).last(page.isLast())
            .build();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> findOptions(int size) {
        int safeSize = Math.max(1, Math.min(size, 100));
        Query query = new Query();
        query.addCriteria(Criteria.where("tenant_id").is(tenantId()));
        query.addCriteria(Criteria.where("deleted").is(false));
        User current = currentUser();
        if (!User.isAdminLike(current.getRole()) && current.getRole() != User.Role.MANAGER) {
            query.addCriteria(Criteria.where("account_manager.$id").is(current.getId()));
        }
        query.with(Sort.by(Sort.Order.desc("updatedAt"), Sort.Order.desc("createdAt")));
        query.limit(safeSize);
        query.fields()
            .include("name")
            .include("company")
            .include("primary_contact")
            .include("status");

        return mongoTemplate.find(query, Customer.class).stream()
            .map(customer -> {
                Map<String, Object> option = new LinkedHashMap<>();
                option.put("id", customer.getId());
                option.put("name", firstNonBlank(customer.getPrimaryContact(), customer.getName(), customer.getCompany(), "Customer"));
                option.put("company", firstNonBlank(customer.getCompany(), customer.getName(), "Company"));
                option.put("status", customer.getStatus() != null ? customer.getStatus().name().toLowerCase(Locale.ROOT) : "active");
                option.put("source", "CRM");
                option.put("value", BigDecimal.ZERO);
                return option;
            })
            .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public CustomerDTO findById(String id) {
        Customer customer = customerRepository.findByIdAndTenantIdAndDeletedFalse(id, tenantId())
            .orElseThrow(() -> new ResourceNotFoundException("Customer not found: " + id));
        ensureVisible(customer);
        return toDTO(customer);
    }

    public CustomerDTO create(CustomerDTO dto) {
        Customer customer = fromDTO(dto);
        customer.setTenantId(tenantId());
        validateUnique(customer, null);
        Customer saved;
        try {
            saved = customerRepository.save(customer);
        } catch (DuplicateKeyException ex) {
            throw new ConflictException("Customer already exists with that email or phone");
        }
        log.info("Customer created: id={}, name={}", saved.getId(), saved.getName());
        return toDTO(saved);
    }

    public CustomerDTO update(String id, CustomerDTO dto) {
        Customer customer = customerRepository.findByIdAndTenantIdAndDeletedFalse(id, tenantId())
            .orElseThrow(() -> new ResourceNotFoundException("Customer not found: " + id));
        ensureVisible(customer);

        String nextEmail = normalizeEmail(dto.getEmail());
        String nextPhone = normalizePhone(dto.getPhone());
        validateUnique(dto, customer.getId());

        if (!nextEmail.isBlank()) customer.setEmail(nextEmail);
        customer.setPhone(nextPhone);
        customer.setName(dto.getName());
        customer.setCompany(dto.getCompany());
        customer.setIndustry(dto.getIndustry());
        customer.setWebsite(dto.getWebsite());
        customer.setPrimaryContact(dto.getPrimaryContact());
        if (dto.getAccountManagerId() != null) {
            if (dto.getAccountManagerId().isBlank()) {
                customer.setAccountManager(null);
            } else {
                userRepository.findByIdAndTenantIdAndDeletedFalse(dto.getAccountManagerId(), tenantId())
                    .ifPresent(customer::setAccountManager);
            }
        }
        if (dto.getHealthScore() != null) customer.setHealthScore(dto.getHealthScore());
        if (dto.getStatus() != null) customer.setStatus(dto.getStatus());
        customer.setGstin(dto.getGstin());
        customer.setNotes(dto.getNotes());
        customer.setAvatarUrl(dto.getAvatarUrl());

        try {
            return toDTO(customerRepository.save(customer));
        } catch (DuplicateKeyException ex) {
            throw new ConflictException("Customer already exists with that email or phone");
        }
    }

    public void delete(String id) {
        Customer customer = customerRepository.findByIdAndTenantIdAndDeletedFalse(id, tenantId())
            .orElseThrow(() -> new ResourceNotFoundException("Customer not found: " + id));
        ensureVisible(customer);
        customer.setDeleted(true);
        customerRepository.save(customer);
    }

    private void validateUnique(CustomerDTO dto, String currentId) {
        validateUnique(Customer.builder()
            .email(normalizeEmail(dto.getEmail()))
            .phone(normalizePhone(dto.getPhone()))
            .build(), currentId);
    }

    private void validateUnique(Customer customer, String currentId) {
        String email = normalizeEmail(customer.getEmail());
        if (!email.isBlank()) {
            if (customerRepository.existsByEmailAndTenantIdAndDeletedFalse(email, tenantId())) {
                customerRepository.findByEmailAndTenantIdAndDeletedFalse(email, tenantId())
                    .filter(existing -> currentId == null || !existing.getId().equals(currentId))
                    .ifPresent(existing -> {
                        throw new ConflictException("Customer already exists with email: " + email);
                    });
            }
        }

        String phone = normalizePhone(customer.getPhone());
        if (phone != null && !phone.isBlank()) {
            if (customerRepository.existsByPhoneAndTenantIdAndDeletedFalse(phone, tenantId())) {
                customerRepository.findByPhoneAndTenantIdAndDeletedFalse(phone, tenantId())
                    .filter(existing -> currentId == null || !existing.getId().equals(currentId))
                    .ifPresent(existing -> {
                        throw new ConflictException("Customer already exists with phone: " + phone);
                    });
            }
        }
    }

    private CustomerDTO toDTO(Customer c) {
        return CustomerDTO.builder()
            .id(c.getId())
            .name(c.getName())
            .email(c.getEmail())
            .phone(c.getPhone())
            .company(c.getCompany())
            .industry(c.getIndustry())
            .website(c.getWebsite())
            .primaryContact(c.getPrimaryContact())
            .accountManagerId(c.getAccountManager() != null ? c.getAccountManager().getId() : null)
            .accountManagerName(c.getAccountManager() != null ? c.getAccountManager().getName() : null)
            .healthScore(c.getHealthScore())
            .status(c.getStatus())
            .gstin(c.getGstin())
            .notes(c.getNotes())
            .avatarUrl(c.getAvatarUrl())
            .createdAt(c.getCreatedAt())
            .updatedAt(c.getUpdatedAt())
            .build();
    }

    private Customer fromDTO(CustomerDTO dto) {
        Customer.CustomerBuilder builder = Customer.builder()
            .name(dto.getName())
            .email(normalizeEmail(dto.getEmail()))
            .phone(normalizePhone(dto.getPhone()))
            .company(dto.getCompany())
            .industry(dto.getIndustry())
            .website(dto.getWebsite())
            .primaryContact(dto.getPrimaryContact())
            .healthScore(dto.getHealthScore() != null ? dto.getHealthScore() : 100)
            .status(dto.getStatus() != null ? dto.getStatus() : Customer.CustomerStatus.ACTIVE)
            .gstin(dto.getGstin())
            .notes(dto.getNotes())
            .avatarUrl(dto.getAvatarUrl());

        if (dto.getAccountManagerId() != null && !dto.getAccountManagerId().isBlank()) {
            userRepository.findByIdAndTenantIdAndDeletedFalse(dto.getAccountManagerId(), tenantId())
                .ifPresent(builder::accountManager);
        }

        return builder.build();
    }

    private String normalizeEmail(String email) {
        if (email == null) return "";
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private String normalizePhone(String phone) {
        if (phone == null) return null;
        String normalized = phone.trim();
        return normalized.isBlank() ? null : normalized;
    }

    private Criteria buildCustomerSearchCriteria(String rawSearch) {
        Pattern textPattern = Pattern.compile(Pattern.quote(rawSearch), Pattern.CASE_INSENSITIVE);
        return new Criteria().orOperator(
            Criteria.where("name").regex(textPattern),
            Criteria.where("company").regex(textPattern),
            Criteria.where("email").regex(textPattern),
            Criteria.where("primary_contact").regex(textPattern),
            Criteria.where("phone").regex(phoneSearchPattern(rawSearch))
        );
    }

    private Pattern phoneSearchPattern(String rawSearch) {
        String digits = rawSearch.replaceAll("\\D", "");
        if (digits.length() >= 3) {
            StringBuilder expression = new StringBuilder();
            for (int i = 0; i < digits.length(); i++) {
                if (i > 0) expression.append("\\D*");
                expression.append(Pattern.quote(String.valueOf(digits.charAt(i))));
            }
            return Pattern.compile(expression.toString(), Pattern.CASE_INSENSITIVE);
        }
        return Pattern.compile(Pattern.quote(rawSearch), Pattern.CASE_INSENSITIVE);
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return "";
    }

    private void ensureVisible(Customer customer) {
        if (!canCurrentUserAccess(customer)) {
            throw new ResourceNotFoundException("Customer not found: " + customer.getId());
        }
    }

    private boolean canCurrentUserAccess(Customer customer) {
        User current = currentUser();
        if (current == null || User.isAdminLike(current.getRole()) || current.getRole() == User.Role.MANAGER) {
            return true;
        }
        if (current.getId() == null || current.getId().isBlank() || customer == null) {
            return false;
        }
        return customer.getAccountManager() != null && current.getId().equals(customer.getAccountManager().getId());
    }

    private User currentUser() {
        String email = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmailAndTenantIdAndDeletedFalse(email, tenantId())
            .orElseThrow(() -> new ResourceNotFoundException("Authenticated user not found"));
    }
}
