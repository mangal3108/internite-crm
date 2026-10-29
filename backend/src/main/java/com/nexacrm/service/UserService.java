package com.nexacrm.service;

import com.nexacrm.dto.UserDTO;
import com.nexacrm.exception.ResourceNotFoundException;
import com.nexacrm.model.User;
import com.nexacrm.repository.UserRepository;
import com.nexacrm.security.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.dao.DuplicateKeyException;

import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    private Long tenantId() {
        return TenantContext.currentTenantId();
    }

    @Transactional(readOnly = true)
    public List<UserDTO> findAll() {
        return findAll(false);
    }

    @Transactional(readOnly = true)
    public List<UserDTO> findAll(boolean includeInactive) {
        return userRepository.findByTenantIdAndDeletedFalse(tenantId()).stream()
            .filter(u -> includeInactive || !Boolean.FALSE.equals(u.getIsActive()) || u.getIsActive() == null)
            .map(this::toDTO)
            .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public UserDTO findById(String id) {
        return userRepository.findByIdAndTenantIdAndDeletedFalse(id, tenantId())
            .map(this::toDTO)
            .orElseThrow(() -> new ResourceNotFoundException("User not found: " + id));
    }

    public UserDTO invite(UserDTO dto) {
        String email = normalizeEmail(dto.getEmail());
        if (email.isBlank()) {
            throw new IllegalArgumentException("Email is required");
        }
        if (userRepository.existsByEmailAndTenantId(email, tenantId())) {
            throw new IllegalArgumentException("User already exists with email: " + email);
        }

        String phone = normalizePhone(dto.getPhone());
        if (!phone.isBlank() && userRepository.existsByPhoneAndTenantIdAndDeletedFalse(phone, tenantId())) {
            throw new IllegalArgumentException("User already exists with phone: " + phone);
        }

        String rawPassword = dto.getPassword();
        if (rawPassword == null || rawPassword.isBlank()) {
            throw new IllegalArgumentException("Password is required");
        }
        User.Role requestedRole = dto.getRole() != null ? dto.getRole() : User.Role.SALES_EXEC;
        validateRoleAssignmentAllowed(requestedRole);

        User user = User.builder()
            .name(dto.getName())
            .email(email)
            .password(passwordEncoder.encode(rawPassword.trim()))
            .role(requestedRole)
            .phone(phone.isBlank() ? null : phone)
            .avatarUrl(dto.getAvatarUrl())
            .isActive(dto.getIsActive() != null ? dto.getIsActive() : true)
            .build();
        user.setTenantId(tenantId());
        User saved;
        try {
            saved = userRepository.save(user);
        } catch (DuplicateKeyException ex) {
            throw new IllegalStateException("User already exists with that email or phone", ex);
        }
        log.info("User invited: id={}, email={}", saved.getId(), saved.getEmail());
        return toDTO(saved);
    }

    public UserDTO update(String id, UserDTO dto) {
        User user = userRepository.findByIdAndTenantIdAndDeletedFalse(id, tenantId())
            .orElseThrow(() -> new ResourceNotFoundException("User not found: " + id));

        User.Role actorRole = getCurrentActorRole();
        if (actorRole == User.Role.MANAGER && User.isAdminLike(user.getRole())) {
            throw new IllegalArgumentException("Managers cannot edit admin users");
        }

        String nextEmail = normalizeEmail(dto.getEmail());
        if (!nextEmail.isBlank() && !nextEmail.equalsIgnoreCase(user.getEmail())) {
            if (userRepository.existsByEmailAndTenantId(nextEmail, tenantId())) {
                throw new IllegalArgumentException("User already exists with email: " + nextEmail);
            }
            user.setEmail(nextEmail);
        }

        String nextPhone = normalizePhone(dto.getPhone());
        if (!nextPhone.isBlank() && !nextPhone.equals(user.getPhone())) {
            if (userRepository.existsByPhoneAndTenantIdAndDeletedFalse(nextPhone, tenantId())) {
                throw new IllegalArgumentException("User already exists with phone: " + nextPhone);
            }
        }
        user.setPhone(nextPhone.isBlank() ? null : nextPhone);

        user.setName(dto.getName());
        user.setAvatarUrl(dto.getAvatarUrl());
        if (dto.getRole() != null) {
            if (!User.isAdminLike(actorRole) && dto.getRole() != user.getRole()) {
                throw new IllegalArgumentException("Only admin can change user role");
            }
            validateRoleAssignmentAllowed(dto.getRole());
            user.setRole(dto.getRole());
        }
        if (dto.getIsActive() != null) {
            if (!User.isAdminLike(actorRole) && !dto.getIsActive().equals(user.getIsActive())) {
                throw new IllegalArgumentException("Only admin can change user status");
            }
            user.setIsActive(dto.getIsActive());
        }
        if (dto.getPassword() != null && !dto.getPassword().isBlank()) {
            user.setPassword(passwordEncoder.encode(dto.getPassword().trim()));
        }
        try {
            return toDTO(userRepository.save(user));
        } catch (DuplicateKeyException ex) {
            throw new IllegalStateException("User already exists with that email or phone", ex);
        }
    }

    public void deactivate(String id) {
        User user = userRepository.findByIdAndTenantIdAndDeletedFalse(id, tenantId())
            .orElseThrow(() -> new ResourceNotFoundException("User not found: " + id));
        user.setIsActive(false);
        userRepository.save(user);
    }

    private UserDTO toDTO(User u) {
        return UserDTO.builder()
            .id(u.getId())
            .name(u.getName())
            .email(u.getEmail())
            .role(u.getRole())
            .phone(u.getPhone())
            .avatarUrl(u.getAvatarUrl())
            .isActive(u.getIsActive())
            .tenantId(u.getTenantId())
            .build();
    }

    private String normalizeEmail(String email) {
        if (email == null) return "";
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private String normalizePhone(String phone) {
        if (phone == null) return "";
        return phone.trim();
    }

    private void validateRoleAssignmentAllowed(User.Role targetRole) {
        User.Role actorRole = getCurrentActorRole();
        if (actorRole == User.Role.MANAGER && User.isAdminLike(targetRole)) {
            throw new IllegalArgumentException("Managers can invite or assign only Manager or Sales Executive roles");
        }
    }

    private User.Role getCurrentActorRole() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User actor = userRepository.findByEmailAndTenantIdAndDeletedFalse(email, tenantId())
            .orElseThrow(() -> new ResourceNotFoundException("Authenticated user not found"));
        return actor.getRole() != null ? actor.getRole() : User.Role.SALES_EXEC;
    }
}
