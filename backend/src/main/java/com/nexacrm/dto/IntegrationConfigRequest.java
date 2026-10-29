package com.nexacrm.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.HashMap;
import java.util.Map;

@Data
public class IntegrationConfigRequest {

    @NotNull(message = "Configuration values are required")
    private Map<String, String> values = new HashMap<>();
}
