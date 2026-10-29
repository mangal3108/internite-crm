package com.nexacrm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IntegrationConfigResponse {
    private String id;
    private boolean connected;
    private List<String> requiredFields;
    private Map<String, String> values;
}
