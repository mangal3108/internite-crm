package com.nexacrm.dto.dashboard;

import java.io.Serializable;

public record LeadConversionMetricDTO(
    double value,
    double previousValue,
    double changePercent
) implements Serializable {}
