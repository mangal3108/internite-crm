package com.nexacrm.dto.dashboard;

import java.io.Serializable;

import java.time.LocalDateTime;

public record LeadConversionTrendDTO(
    String bucketKey,
    String label,
    LocalDateTime bucketStart,
    long leadCount,
    long newCount,
    long assignedCount,
    long contactedCount,
    long interestedCount,
    long qualifiedCount,
    long proposalSentCount,
    long convertedCount,
    long lostCount,
    long pendingFollowUpsCount,
    double revenueGenerated
) implements Serializable {}
