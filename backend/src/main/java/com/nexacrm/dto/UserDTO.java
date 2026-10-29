package com.nexacrm.dto;

import com.nexacrm.model.User;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class UserDTO {
    private String id;
    private String name;
    private String email;
    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private String password;
    private User.Role role;
    private String phone;
    private String avatarUrl;
    private Boolean isActive;
    private Long tenantId;
    private String tenantName;
}
