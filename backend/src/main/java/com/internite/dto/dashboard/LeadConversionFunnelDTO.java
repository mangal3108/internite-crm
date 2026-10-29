package com.internite.dto.dashboard;

import java.io.Serializable;

public record LeadConversionFunnelDTO(
    String key,
    String label,
    long count,
    double dropOffPercent,
    double conversionPercent
) implements Serializable {}
