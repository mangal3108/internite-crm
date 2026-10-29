package com.nexacrm.dto.dashboard;

import java.io.Serializable;

public record LeadConversionStatusCountDTO(
    String key,
    String label,
    long count
) implements Serializable {}
