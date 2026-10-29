package com.nexacrm.controller;

import com.nexacrm.dto.UserDTO;
import com.nexacrm.model.User;
import com.nexacrm.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping
    @PreAuthorize("hasAuthority('team.read')")
    public ResponseEntity<List<UserDTO>> getAll(
            @RequestParam(defaultValue = "false") boolean includeInactive) {
        return ResponseEntity.ok(userService.findAll(includeInactive));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('team.read')")
    public ResponseEntity<UserDTO> getById(@PathVariable String id) {
        return ResponseEntity.ok(userService.findById(id));
    }

    @PostMapping("/invite")
    @PreAuthorize("hasAuthority('team.create')")
    public ResponseEntity<UserDTO> invite(@RequestBody UserDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(userService.invite(dto));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('team.update')")
    public ResponseEntity<UserDTO> update(@PathVariable String id, @RequestBody UserDTO dto) {
        return ResponseEntity.ok(userService.update(id, dto));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('team.delete')")
    public ResponseEntity<Map<String, String>> deactivate(@PathVariable String id) {
        userService.deactivate(id);
        return ResponseEntity.ok(Map.of("message", "User deactivated", "id", id));
    }

    @GetMapping("/roles")
    @PreAuthorize("hasAuthority('team.read')")
    public ResponseEntity<List<Map<String, Object>>> getRoles() {
        List<Map<String, Object>> roles = Arrays.stream(User.Role.values())
            .map(r -> {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("value", r.name());
                row.put("label", formatRoleLabel(r));
                row.put("permissions", User.getPermissionsForRole(r));
                return row;
            })
            .collect(Collectors.toList());
        return ResponseEntity.ok(roles);
    }

    private String formatRoleLabel(User.Role role) {
        return User.getDisplayLabel(role);
    }
}
