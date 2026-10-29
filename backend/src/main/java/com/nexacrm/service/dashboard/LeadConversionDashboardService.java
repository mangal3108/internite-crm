package com.nexacrm.service.dashboard;

import com.nexacrm.dto.dashboard.LeadConversionActivityDTO;
import com.nexacrm.dto.dashboard.LeadConversionEmployeeDTO;
import com.nexacrm.dto.dashboard.LeadConversionFunnelDTO;
import com.nexacrm.dto.dashboard.LeadConversionMetricDTO;
import com.nexacrm.dto.dashboard.LeadConversionSourceDTO;
import com.nexacrm.dto.dashboard.LeadConversionStatusCountDTO;
import com.nexacrm.dto.dashboard.LeadConversionSummaryDTO;
import com.nexacrm.dto.dashboard.LeadConversionTrendDTO;
import com.nexacrm.exception.ResourceNotFoundException;
import com.nexacrm.model.Lead;
import com.nexacrm.model.LeadActivity;
import com.nexacrm.model.User;
import com.nexacrm.repository.LeadActivityRepository;
import com.nexacrm.repository.LeadRepository;
import com.nexacrm.repository.UserRepository;
import com.nexacrm.security.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class LeadConversionDashboardService {
    private static final String CACHE_KEY_PREFIX =
        "T(com.nexacrm.security.TenantContext).currentTenantId() + ':' + " +
        "T(org.springframework.security.core.context.SecurityContextHolder).getContext().getAuthentication().getName() + ':'";

    private static final List<StageDefinition> STAGES = List.of(
        new StageDefinition("NEW", "New Leads"),
        new StageDefinition("ASSIGNED", "Assigned Leads"),
        new StageDefinition("CONTACTED", "Contacted"),
        new StageDefinition("INTERESTED", "Interested"),
        new StageDefinition("QUALIFIED", "Qualified"),
        new StageDefinition("PROPOSAL_SENT", "Proposal Sent"),
        new StageDefinition("CONVERTED", "Converted"),
        new StageDefinition("LOST", "Lost")
    );

    private static final List<String> SOURCE_ORDER = List.of(
        "Facebook",
        "Instagram",
        "LinkedIn",
        "WhatsApp",
        "Website",
        "Google Sheet",
        "Manual Entry",
        "Google Ads",
        "Meta Ads",
        "Referral",
        "Email",
        "Other"
    );

    private final MongoTemplate mongoTemplate;
    private final LeadRepository leadRepository;
    private final LeadActivityRepository leadActivityRepository;
    private final UserRepository userRepository;

    private Long tenantId() {
        return TenantContext.currentTenantId();
    }

    @Cacheable(value = "dashboard-summary", key = CACHE_KEY_PREFIX + " + #filter + ':' + #startDate + ':' + #endDate + ':' + #employeeId + ':' + #status")
    public LeadConversionSummaryDTO summary(String filter, String startDate, String endDate, String employeeId, String status) {
        ResolvedScope scope = resolveScope(employeeId);
        TimeRange range = resolveRange(filter, startDate, endDate);
        TimeRange previousRange = previousRange(range);

        List<Lead> currentLeads = fetchScopedLeads(range, scope, status);
        List<Lead> previousLeads = fetchScopedLeads(previousRange, scope, status);

        Map<String, Long> currentStageCounts = stageCounts(currentLeads);
        Map<String, Long> previousStageCounts = stageCounts(previousLeads);

        long currentTotal = currentLeads.size();
        long previousTotal = previousLeads.size();
        long currentNew = rawNewCount(currentLeads);
        long previousNew = rawNewCount(previousLeads);
        long currentAssigned = assignedCount(currentLeads);
        long previousAssigned = assignedCount(previousLeads);
        long currentContacted = currentStageCounts.getOrDefault("CONTACTED", 0L);
        long previousContacted = previousStageCounts.getOrDefault("CONTACTED", 0L);
        long currentInterested = currentStageCounts.getOrDefault("INTERESTED", 0L);
        long previousInterested = previousStageCounts.getOrDefault("INTERESTED", 0L);
        long currentQualified = currentStageCounts.getOrDefault("QUALIFIED", 0L);
        long previousQualified = previousStageCounts.getOrDefault("QUALIFIED", 0L);
        long currentProposalSent = currentStageCounts.getOrDefault("PROPOSAL_SENT", 0L);
        long previousProposalSent = previousStageCounts.getOrDefault("PROPOSAL_SENT", 0L);
        long currentConverted = currentStageCounts.getOrDefault("CONVERTED", 0L);
        long previousConverted = previousStageCounts.getOrDefault("CONVERTED", 0L);
        long currentLost = currentStageCounts.getOrDefault("LOST", 0L);
        long previousLost = previousStageCounts.getOrDefault("LOST", 0L);
        long currentPending = pendingFollowUpsCount(currentLeads);
        long previousPending = pendingFollowUpsCount(previousLeads);

        BigDecimal currentRevenue = revenueFromConverted(currentLeads);
        BigDecimal previousRevenue = revenueFromConverted(previousLeads);
        double currentConversionRate = currentTotal > 0 ? (currentConverted * 100.0) / currentTotal : 0.0;
        double previousConversionRate = previousTotal > 0 ? (previousConverted * 100.0) / previousTotal : 0.0;

        return new LeadConversionSummaryDTO(
            metric(currentTotal, previousTotal),
            metric(currentNew, previousNew),
            metric(currentAssigned, previousAssigned),
            metric(currentContacted, previousContacted),
            metric(currentInterested, previousInterested),
            metric(currentQualified, previousQualified),
            metric(currentProposalSent, previousProposalSent),
            metric(currentConverted, previousConverted),
            metric(currentLost, previousLost),
            metric(currentPending, previousPending),
            metric(currentConversionRate, previousConversionRate),
            metric(currentRevenue.doubleValue(), previousRevenue.doubleValue()),
            range.label(),
            previousRange.label(),
            STAGES.stream()
                .map(stage -> new LeadConversionStatusCountDTO(
                    stage.key(),
                    stage.label(),
                    currentStageCounts.getOrDefault(stage.key(), 0L)
                ))
                .toList()
        );
    }

    @Cacheable(value = "dashboard-funnel", key = CACHE_KEY_PREFIX + " + #filter + ':' + #startDate + ':' + #endDate + ':' + #employeeId + ':' + #status")
    public List<LeadConversionFunnelDTO> funnel(String filter, String startDate, String endDate, String employeeId, String status) {
        ResolvedScope scope = resolveScope(employeeId);
        TimeRange range = resolveRange(filter, startDate, endDate);
        List<Lead> leads = fetchScopedLeads(range, scope, status);
        Map<String, Long> counts = stageCounts(leads);
        long total = Math.max(1L, leads.size());

        List<LeadConversionFunnelDTO> funnel = new ArrayList<>();
        long previousCount = Math.max(1L, counts.getOrDefault("NEW", 0L));
        for (StageDefinition stage : STAGES) {
            long count = counts.getOrDefault(stage.key(), 0L);
            double dropOff = stage == STAGES.get(0)
                ? 0.0
                : previousCount > 0 ? Math.max(0.0, ((previousCount - count) * 100.0) / previousCount) : 0.0;
            double conversion = (count * 100.0) / total;
            funnel.add(new LeadConversionFunnelDTO(stage.key(), stage.label(), count, round(dropOff), round(conversion)));
            previousCount = Math.max(1L, count);
        }
        return funnel;
    }

    @Cacheable(value = "dashboard-employees", key = CACHE_KEY_PREFIX + " + #filter + ':' + #startDate + ':' + #endDate + ':' + #employeeId + ':' + #status + ':' + #sortBy + ':' + #sortDir")
    public List<LeadConversionEmployeeDTO> employees(
        String filter,
        String startDate,
        String endDate,
        String employeeId,
        String status,
        String sortBy,
        String sortDir
    ) {
        ResolvedScope scope = resolveScope(employeeId);
        TimeRange range = resolveRange(filter, startDate, endDate);

        List<User> visibleUsers = visibleUsers(scope);
        List<Lead> leads = fetchScopedLeads(range, scope, status);
        List<LeadActivity> activities = fetchActivities(range, leads);

        Map<String, List<Lead>> leadsByUser = leads.stream()
            .filter(lead -> lead.getAssignedTo() != null && StringUtils.hasText(lead.getAssignedTo().getId()))
            .collect(Collectors.groupingBy(lead -> lead.getAssignedTo().getId()));

        Map<String, List<LeadActivity>> activitiesByLead = activities.stream()
            .collect(Collectors.groupingBy(LeadActivity::getLeadId));

        Map<String, List<User>> usersByName = new LinkedHashMap<>();
        for (User user : visibleUsers) {
            String name = user.getName() != null ? user.getName().trim() : "Unnamed";
            usersByName.computeIfAbsent(name, k -> new ArrayList<>()).add(user);
        }

        List<LeadConversionEmployeeDTO> rows = new ArrayList<>();
        for (Map.Entry<String, List<User>> entry : usersByName.entrySet()) {
            String name = entry.getKey();
            List<User> usersWithSameName = entry.getValue();
            User primaryUser = usersWithSameName.get(0);

            List<Lead> assignedLeads = new ArrayList<>();
            for (User u : usersWithSameName) {
                assignedLeads.addAll(leadsByUser.getOrDefault(u.getId(), List.of()));
            }

            long assigned = assignedLeads.size();
            long contacted = countStage(assignedLeads, "CONTACTED");
            long converted = countStage(assignedLeads, "CONVERTED");
            long lost = countStage(assignedLeads, "LOST");
            long pending = Math.max(0L, assigned - converted - lost);
            long followUpsDone = 0;
            for (User u : usersWithSameName) {
                followUpsDone += countFollowUpsDone(assignedLeads, activitiesByLead, u);
            }
            double conversionRate = assigned > 0 ? (converted * 100.0) / assigned : 0.0;
            double responseMinutes = averageResponseMinutes(assignedLeads, activitiesByLead);
            double revenueGenerated = revenueFromConverted(assignedLeads).doubleValue();

            rows.add(new LeadConversionEmployeeDTO(
                primaryUser.getId(),
                name,
                assigned,
                contacted,
                converted,
                lost,
                pending,
                followUpsDone,
                round(conversionRate),
                round(responseMinutes),
                round(revenueGenerated)
            ));
        }

        Comparator<LeadConversionEmployeeDTO> comparator = switch (normalize(sortBy)) {
            case "pending" -> Comparator.comparingLong(LeadConversionEmployeeDTO::pendingLeads);
            case "revenue" -> Comparator.comparingDouble(LeadConversionEmployeeDTO::revenueGenerated);
            case "name" -> Comparator.comparing(LeadConversionEmployeeDTO::employeeName, String.CASE_INSENSITIVE_ORDER);
            default -> Comparator.comparingDouble(LeadConversionEmployeeDTO::conversionRate);
        };
        if (normalize(sortDir).equals("asc")) {
            rows.sort(comparator);
        } else {
            rows.sort(comparator.reversed());
        }
        return rows;
    }

    @Cacheable(value = "dashboard-sources", key = CACHE_KEY_PREFIX + " + #filter + ':' + #startDate + ':' + #endDate + ':' + #employeeId + ':' + #status")
    public List<LeadConversionSourceDTO> sources(String filter, String startDate, String endDate, String employeeId, String status) {
        ResolvedScope scope = resolveScope(employeeId);
        TimeRange range = resolveRange(filter, startDate, endDate);
        List<Lead> leads = fetchScopedLeads(range, scope, status);
        Map<String, List<Lead>> bySource = leads.stream().collect(Collectors.groupingBy(this::sourceLabel));

        List<LeadConversionSourceDTO> rows = new ArrayList<>();
        String bestSource = null;
        double bestRate = -1.0;
        for (String source : SOURCE_ORDER) {
            List<Lead> sourceLeads = bySource.getOrDefault(source, List.of());
            long total = sourceLeads.size();
            long converted = countStage(sourceLeads, "CONVERTED");
            long lost = countStage(sourceLeads, "LOST");
            BigDecimal revenue = revenueFromConverted(sourceLeads);
            double conversionRate = total > 0 ? (converted * 100.0) / total : 0.0;
            if (converted > 0 && conversionRate > bestRate) {
                bestRate = conversionRate;
                bestSource = source;
            }
            rows.add(new LeadConversionSourceDTO(
                normalizeSourceKey(source),
                source,
                total,
                converted,
                lost,
                round(conversionRate),
                round(revenue.doubleValue()),
                false
            ));
        }

        final String bestSourceLabel = bestSource;
        return rows.stream()
            .map(row -> new LeadConversionSourceDTO(
                row.sourceKey(),
                row.sourceLabel(),
                row.totalLeads(),
                row.convertedLeads(),
                row.lostLeads(),
                row.conversionRate(),
                row.revenueGenerated(),
                row.sourceLabel().equals(bestSourceLabel)
            ))
            .toList();
    }

    @Cacheable(value = "dashboard-activities", key = CACHE_KEY_PREFIX + " + #filter + ':' + #startDate + ':' + #endDate + ':' + #employeeId + ':' + #status + ':' + #limit")
    public List<LeadConversionActivityDTO> activities(
        String filter,
        String startDate,
        String endDate,
        String employeeId,
        String status,
        Integer limit
    ) {
        ResolvedScope scope = resolveScope(employeeId);
        TimeRange range = resolveRange(filter, startDate, endDate);
        List<Lead> leads = fetchScopedLeads(range, scope, status);
        List<LeadActivity> leadActivities = fetchActivities(range, leads);

        Map<String, Lead> leadById = leads.stream().collect(Collectors.toMap(Lead::getId, lead -> lead, (left, right) -> left));
        List<LeadConversionActivityDTO> rows = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();

        for (LeadActivity activity : leadActivities) {
            Lead lead = leadById.get(activity.getLeadId());
            if (lead == null) continue;
            LocalDateTime occurredAt = activity.getSavedAt() != null ? activity.getSavedAt() : activity.getCreatedAt();
            String key = "ACT:" + activity.getId();
            if (!seen.add(key)) continue;
            rows.add(new LeadConversionActivityDTO(
                activity.getId(),
                lead.getId(),
                lead.getName(),
                lead.getAssignedTo() != null ? lead.getAssignedTo().getId() : null,
                lead.getAssignedTo() != null ? lead.getAssignedTo().getName() : null,
                detectActivityType(activity, lead),
                activityStatusBefore(activity, lead),
                activityStatusAfter(activity, lead),
                activity.getSummary(),
                sourceLabel(lead),
                occurredAt
            ));
        }

        for (Lead lead : leads) {
            addLifecycleActivity(rows, seen, lead, "CONVERTED", lead.getConvertedAt(), "QUALIFIED", "CONVERTED", lead.getRevenueValue() != null
                ? "Converted lead revenue: " + lead.getRevenueValue()
                : "Lead converted");
            addLifecycleActivity(rows, seen, lead, "LOST", lead.getUpdatedAt(), "NEW", "LOST", StringUtils.hasText(lead.getLostReason()) ? lead.getLostReason() : "Lead marked as lost");
            addLifecycleActivity(rows, seen, lead, "CONTACTED", lead.getLastContactedAt(), "NEW", "CONTACTED", "Lead contacted");
            addLifecycleActivity(rows, seen, lead, "FOLLOW_UP", lead.getFollowUpDate(), "CONTACTED", "FOLLOW_UP", "Follow-up scheduled");
        }

        return rows.stream()
            .sorted(Comparator.comparing(LeadConversionActivityDTO::occurredAt, Comparator.nullsLast(Comparator.naturalOrder())).reversed())
            .limit(limit != null && limit > 0 ? limit : 50)
            .toList();
    }

    @Cacheable(value = "dashboard-trend", key = CACHE_KEY_PREFIX + " + #filter + ':' + #startDate + ':' + #endDate + ':' + #employeeId + ':' + #status + ':' + #granularity")
    public List<LeadConversionTrendDTO> trend(
        String filter,
        String startDate,
        String endDate,
        String employeeId,
        String status,
        String granularity
    ) {
        ResolvedScope scope = resolveScope(employeeId);
        TimeRange range = resolveRange(filter, startDate, endDate);
        String bucketType = normalize(granularity);
        if (!List.of("day", "week", "month").contains(bucketType)) {
            bucketType = trendGranularity(range);
        }

        List<Lead> leads = fetchScopedLeads(range, scope, status);
        Map<LocalDateTime, BucketAccumulator> buckets = initializeBuckets(range, bucketType);
        for (Lead lead : leads) {
            LocalDateTime createdBucket = bucketStart(lead.getCreatedAt(), bucketType);
            BucketAccumulator bucket = buckets.get(createdBucket);
            if (bucket != null) {
                bucket.leadCount++;
                if (isRawNew(lead)) bucket.newCount++;
                if (isAssigned(lead)) bucket.assignedCount++;
                if (isStage(lead, "CONTACTED")) bucket.contactedCount++;
                if (isStage(lead, "INTERESTED")) bucket.interestedCount++;
                if (isStage(lead, "QUALIFIED")) bucket.qualifiedCount++;
                if (isStage(lead, "PROPOSAL_SENT")) bucket.proposalSentCount++;
                if (isStage(lead, "LOST")) bucket.lostCount++;
                if (isPendingFollowUp(lead)) bucket.pendingFollowUpsCount++;
            }

            if (lead.getConvertedAt() != null) {
                LocalDateTime convertedBucket = bucketStart(lead.getConvertedAt(), bucketType);
                BucketAccumulator converted = buckets.get(convertedBucket);
                if (converted != null) {
                    converted.revenueGenerated += revenueValue(lead).doubleValue();
                    converted.convertedCount++;
                }
            }
        }

        final String finalBucketType = bucketType;
        return buckets.entrySet().stream()
            .sorted(Map.Entry.comparingByKey())
            .map(entry -> new LeadConversionTrendDTO(
                bucketKey(entry.getKey(), finalBucketType),
                bucketLabel(entry.getKey(), finalBucketType),
                entry.getKey(),
                entry.getValue().leadCount,
                entry.getValue().newCount,
                entry.getValue().assignedCount,
                entry.getValue().contactedCount,
                entry.getValue().interestedCount,
                entry.getValue().qualifiedCount,
                entry.getValue().proposalSentCount,
                entry.getValue().convertedCount,
                entry.getValue().lostCount,
                entry.getValue().pendingFollowUpsCount,
                round(entry.getValue().revenueGenerated)
            ))
            .toList();
    }

    private List<Lead> fetchScopedLeads(TimeRange range, ResolvedScope scope, String statusFilter) {
        Query query = new Query();
        query.addCriteria(Criteria.where("tenant_id").is(tenantId()));
        query.addCriteria(Criteria.where("deleted").is(false));
        query.addCriteria(Criteria.where("createdAt").gte(range.start()).lt(range.end()));
        if (scope.employeeId() != null) {
            query.addCriteria(Criteria.where("assigned_to.$id").is(scope.employeeId()));
        }
        query.with(Sort.by(Sort.Direction.DESC, "createdAt"));
        query.fields()
            .exclude("notes")
            .exclude("activity_logs");
        List<Lead> leads = mongoTemplate.find(query, Lead.class);
        if (StringUtils.hasText(statusFilter)) {
            String normalized = normalize(statusFilter);
            leads = leads.stream()
                .filter(lead -> matchesStatusFilter(lead, normalized))
                .toList();
        }
        return leads;
    }

    private List<LeadActivity> fetchActivities(TimeRange range, List<Lead> leads) {
        if (leads == null || leads.isEmpty()) {
            return List.of();
        }

        Set<String> leadIds = leads.stream()
            .map(Lead::getId)
            .filter(StringUtils::hasText)
            .collect(Collectors.toCollection(LinkedHashSet::new));
        if (leadIds.isEmpty()) {
            return List.of();
        }

        Criteria savedAtInRange = Criteria.where("saved_at").gte(range.start()).lt(range.end());
        Criteria createdAtInRange = Criteria.where("saved_at").exists(false)
            .and("createdAt").gte(range.start()).lt(range.end());
        Query query = new Query();
        query.addCriteria(Criteria.where("tenant_id").is(tenantId()).and("deleted").is(false));
        query.addCriteria(Criteria.where("lead_id").in(leadIds));
        query.addCriteria(new Criteria().orOperator(savedAtInRange, createdAtInRange));
        query.with(Sort.by(Sort.Direction.DESC, "saved_at"));
        query.limit(1000);
        query.fields()
            .include("lead_id")
            .include("activity_index")
            .include("activity_id")
            .include("activity_label")
            .include("activity_title")
            .include("assigned_to")
            .include("summary")
            .include("values")
            .include("saved_at")
            .include("createdAt");
        return mongoTemplate.find(query, LeadActivity.class, "lead_activities");
    }

    private List<User> visibleUsers(ResolvedScope scope) {
        if (scope.employeeId() != null) {
            return userRepository.findByIdAndTenantIdAndDeletedFalse(scope.employeeId(), tenantId())
                .map(List::of)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found: " + scope.employeeId()));
        }
        if (!scope.fullAccess()) {
            return List.of(scope.currentUser());
        }
        Set<String> seenIds = new LinkedHashSet<>();
        Set<String> seenNames = new LinkedHashSet<>();
        return userRepository.findByTenantIdAndDeletedFalse(tenantId()).stream()
            .filter(user -> !Boolean.FALSE.equals(user.getIsActive()))
            .filter(user -> user.getId() != null && seenIds.add(user.getId()))
            .filter(user -> {
                String name = user.getName() != null ? user.getName().trim().toLowerCase(Locale.ROOT) : "";
                return name.isEmpty() || seenNames.add(name);
            })
            .sorted(Comparator.comparing(User::getName, String.CASE_INSENSITIVE_ORDER))
            .toList();
    }

    private ResolvedScope resolveScope(String requestedEmployeeId) {
        User current = currentUser();
        boolean fullAccess = User.isAdminLike(current.getRole()) || current.getRole() == User.Role.MANAGER;
        String employeeId = StringUtils.hasText(requestedEmployeeId) ? requestedEmployeeId.trim() : null;
        if (!fullAccess) {
            employeeId = current.getId();
        } else if (employeeId != null) {
            final String validatedEmployeeId = employeeId;
            userRepository.findByIdAndTenantIdAndDeletedFalse(validatedEmployeeId, tenantId())
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found: " + validatedEmployeeId));
        }
        return new ResolvedScope(current, fullAccess, employeeId);
    }

    private TimeRange resolveRange(String filter, String startDate, String endDate) {
        String normalized = normalize(filter);
        LocalDateTime now = LocalDateTime.now();
        LocalDate today = now.toLocalDate();

        return switch (normalized) {
            case "yesterday" -> new TimeRange(today.minusDays(1).atStartOfDay(), today.atStartOfDay(), "Yesterday", "Day before yesterday");
            case "thisweek" -> {
                LocalDate weekStart = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
                yield new TimeRange(weekStart.atStartOfDay(), now, "This Week", "Previous Week");
            }
            case "lastmonth" -> {
                LocalDate thisMonthStart = today.withDayOfMonth(1);
                LocalDate lastMonthStart = thisMonthStart.minusMonths(1);
                yield new TimeRange(lastMonthStart.atStartOfDay(), thisMonthStart.atStartOfDay(), "Last Month", "Month Before Last");
            }
            case "custom" -> resolveCustomRange(startDate, endDate, now);
            case "today" -> new TimeRange(today.atStartOfDay(), now, "Today", "Yesterday");
            default -> new TimeRange(today.withDayOfMonth(1).atStartOfDay(), now, "This Month", "Last Month");
        };
    }

    private TimeRange resolveCustomRange(String startDate, String endDate, LocalDateTime fallbackNow) {
        LocalDate start = StringUtils.hasText(startDate) ? LocalDate.parse(startDate.trim()) : fallbackNow.toLocalDate().withDayOfMonth(1);
        LocalDate end = StringUtils.hasText(endDate) ? LocalDate.parse(endDate.trim()) : fallbackNow.toLocalDate();
        LocalDateTime startDateTime = start.atStartOfDay();
        LocalDateTime endDateTime = end.plusDays(1).atStartOfDay();
        return new TimeRange(startDateTime, endDateTime, start + " to " + end, "Previous comparable period");
    }

    private TimeRange previousRange(TimeRange range) {
        Duration duration = Duration.between(range.start(), range.end());
        LocalDateTime previousEnd = range.start();
        LocalDateTime previousStart = previousEnd.minus(duration);
        return new TimeRange(previousStart, previousEnd, range.previousLabel(), range.label());
    }

    private Map<String, Long> stageCounts(List<Lead> leads) {
        Map<String, Long> counts = new LinkedHashMap<>();
        for (StageDefinition stage : STAGES) {
            counts.put(stage.key(), 0L);
        }
        for (Lead lead : leads) {
            counts.computeIfPresent(normalizeStage(lead), (k, v) -> v + 1);
        }
        return counts;
    }

    private long countStage(List<Lead> leads, String key) {
        return leads.stream().filter(lead -> key.equals(normalizeStage(lead))).count();
    }

    private long rawNewCount(List<Lead> leads) {
        return leads.stream().filter(this::isRawNew).count();
    }

    private long assignedCount(List<Lead> leads) {
        return leads.stream().filter(this::isAssigned).count();
    }

    private long pendingFollowUpsCount(List<Lead> leads) {
        return leads.stream()
            .filter(this::isPendingFollowUp)
            .count();
    }

    private BigDecimal revenueFromConverted(List<Lead> leads) {
        return leads.stream()
            .filter(lead -> "CONVERTED".equals(normalizeStage(lead)))
            .map(this::revenueValue)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private double averageResponseMinutes(List<Lead> leads, Map<String, List<LeadActivity>> activitiesByLead) {
        List<Double> samples = new ArrayList<>();
        for (Lead lead : leads) {
            LocalDateTime firstResponse = null;
            List<LeadActivity> activities = activitiesByLead.getOrDefault(lead.getId(), List.of());
            for (LeadActivity activity : activities) {
                LocalDateTime timestamp = activity.getSavedAt() != null ? activity.getSavedAt() : activity.getCreatedAt();
                if (timestamp != null && (firstResponse == null || timestamp.isBefore(firstResponse))) {
                    firstResponse = timestamp;
                }
            }
            if (firstResponse == null) {
                firstResponse = lead.getLastContactedAt();
            }
            if (lead.getCreatedAt() != null && firstResponse != null && !firstResponse.isBefore(lead.getCreatedAt())) {
                samples.add(Duration.between(lead.getCreatedAt(), firstResponse).toMinutes() * 1.0);
            }
        }
        if (samples.isEmpty()) {
            return 0.0;
        }
        return samples.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
    }

    private long countFollowUpsDone(List<Lead> leads, Map<String, List<LeadActivity>> activitiesByLead, User user) {
        String userName = normalize(user.getName());
        String userEmail = normalize(user.getEmail());
        long count = 0;
        for (Lead lead : leads) {
            for (LeadActivity activity : activitiesByLead.getOrDefault(lead.getId(), List.of())) {
                String assigned = normalize(activity.getAssignedTo());
                if (!assigned.isBlank() && !assigned.equals(userName) && !assigned.equals(userEmail)) {
                    continue;
                }
                if (isFollowUpActivity(activity)) {
                    count++;
                }
            }
        }
        return count;
    }

    private boolean isFollowUpActivity(LeadActivity activity) {
        String haystack = normalize(activity.getActivityTitle()) + " " + normalize(activity.getActivityLabel()) + " " + normalize(activity.getSummary());
        return haystack.contains("follow") || haystack.contains("callback") || haystack.contains("reminder");
    }

    private String detectActivityType(LeadActivity activity, Lead lead) {
        String text = normalize(activity.getActivityTitle()) + " " + normalize(activity.getActivityLabel()) + " " + normalize(activity.getSummary());
        if (text.contains("convert")) return "CONVERTED";
        if (text.contains("lost")) return "LOST";
        if (text.contains("follow") || text.contains("callback")) return "FOLLOW_UP";
        if (text.contains("assign")) return "ASSIGNED";
        if (text.contains("contact") || text.contains("call")) return "CONTACTED";
        if (isStage(lead, "QUALIFIED")) return "QUALIFIED";
        return "ACTIVITY";
    }

    private String activityStatusBefore(LeadActivity activity, Lead lead) {
        Map<String, Object> values = activity.getValues();
        String fromValues = firstText(values, "oldStatus", "fromStatus", "statusFrom");
        if (StringUtils.hasText(fromValues)) {
            return fromValues;
        }
        return switch (detectActivityType(activity, lead)) {
            case "CONVERTED" -> "QUALIFIED";
            case "LOST" -> "NEW";
            case "CONTACTED" -> "NEW";
            case "ASSIGNED" -> "NEW";
            default -> normalizeStage(lead);
        };
    }

    private String activityStatusAfter(LeadActivity activity, Lead lead) {
        Map<String, Object> values = activity.getValues();
        String toValues = firstText(values, "newStatus", "toStatus", "statusTo");
        if (StringUtils.hasText(toValues)) {
            return toValues;
        }
        return switch (detectActivityType(activity, lead)) {
            case "CONVERTED" -> "CONVERTED";
            case "LOST" -> "LOST";
            case "CONTACTED" -> "CONTACTED";
            case "ASSIGNED" -> "ASSIGNED";
            default -> normalizeStage(lead);
        };
    }

    private void addLifecycleActivity(
        List<LeadConversionActivityDTO> rows,
        Set<String> seen,
        Lead lead,
        String type,
        LocalDateTime timestamp,
        String oldStatus,
        String newStatus,
        String notes
    ) {
        if (timestamp == null) return;
        String key = lead.getId() + ":" + type + ":" + timestamp.toString();
        if (!seen.add(key)) return;
        rows.add(new LeadConversionActivityDTO(
            key,
            lead.getId(),
            lead.getName(),
            lead.getAssignedTo() != null ? lead.getAssignedTo().getId() : null,
            lead.getAssignedTo() != null ? lead.getAssignedTo().getName() : null,
            type,
            oldStatus,
            newStatus,
            notes,
            sourceLabel(lead),
            timestamp
        ));
    }

    private String sourceLabel(Lead lead) {
        if (lead == null || lead.getSource() == null) {
            return "Manual Entry";
        }
        return switch (lead.getSource()) {
            case FACEBOOK -> "Facebook";
            case INSTAGRAM -> "Instagram";
            case WHATSAPP -> "WhatsApp";
            case WEBSITE -> "Website";
            case GOOGLE_ADS -> "Google Ads";
            case META_ADS -> "Meta Ads";
            case REFERRAL -> {
                String custom = lead.getSourceLabel() == null ? "" : lead.getSourceLabel().trim();
                yield custom.isBlank() || custom.equalsIgnoreCase("referral") ? "Referral" : "Referral: " + custom;
            }
            case EMAIL -> "Email";
            case LINKEDIN -> "LinkedIn";
            case OTHER -> inferOtherSource(lead);
        };
    }

    private String inferOtherSource(Lead lead) {
        String custom = lead == null ? "" : normalize(lead.getSourceLabel());
        if (!custom.isBlank() && !custom.equals("other")) {
            return lead.getSourceLabel().trim();
        }
        String utmMedium = normalize(lead.getUtmMedium());
        String utmCampaign = normalize(lead.getUtmCampaign());
        String notes = normalize(lead.getNotes());
        if (utmMedium.contains("google_sheet") || utmCampaign.contains("sheet") || notes.contains("sheet")) {
            return "Google Sheet";
        }
        return "Manual Entry";
    }

    private String normalizeSourceKey(String sourceLabel) {
        return switch (sourceLabel) {
            case "Google Sheet" -> "google_sheet";
            case "Manual Entry" -> "manual_entry";
            case "Google Ads" -> "google_ads";
            case "Meta Ads" -> "meta_ads";
            default -> sourceLabel.toLowerCase(Locale.ROOT).replace(" ", "_");
        };
    }

    private String normalizeStage(Lead lead) {
        if (lead == null || lead.getStatus() == null) {
            return lead != null && lead.getAssignedTo() != null ? "ASSIGNED" : "NEW";
        }
        return switch (lead.getStatus()) {
            case NEW -> lead.getAssignedTo() != null ? "ASSIGNED" : "NEW";
            case CONTACTED -> "CONTACTED";
            case QUALIFIED -> "QUALIFIED";
            case PROPOSAL -> "PROPOSAL_SENT";
            case NEGOTIATION -> "INTERESTED";
            case WON -> "CONVERTED";
            case LOST -> "LOST";
        };
    }

    private boolean isRawNew(Lead lead) {
        return lead == null || lead.getStatus() == null || lead.getStatus() == Lead.LeadStatus.NEW;
    }

    private boolean isAssigned(Lead lead) {
        return lead != null && lead.getAssignedTo() != null;
    }

    private boolean isPendingFollowUp(Lead lead) {
        return lead != null
            && lead.getFollowUpDate() != null
            && !isFinalStage(normalizeStage(lead));
    }

    private boolean matchesStatusFilter(Lead lead, String normalizedFilter) {
        if (!StringUtils.hasText(normalizedFilter)) {
            return true;
        }
        return normalizeStage(lead).equalsIgnoreCase(normalizedFilter)
            || leadStatusMatches(lead, normalizedFilter);
    }

    private boolean leadStatusMatches(Lead lead, String normalizedFilter) {
        if (lead == null || lead.getStatus() == null) return false;
        String status = lead.getStatus().name();
        return switch (normalizedFilter) {
            case "CONVERTED" -> "WON".equals(status);
            case "PROPOSAL_SENT" -> "PROPOSAL".equals(status);
            case "INTERESTED" -> "NEGOTIATION".equals(status);
            case "ASSIGNED" -> lead.getAssignedTo() != null && "NEW".equals(status);
            default -> status.equalsIgnoreCase(normalizedFilter);
        };
    }

    private boolean isStage(Lead lead, String stage) {
        return stage.equalsIgnoreCase(normalizeStage(lead));
    }

    private boolean isFinalStage(String stage) {
        return "CONVERTED".equals(stage) || "LOST".equals(stage);
    }

    private BigDecimal revenueValue(Lead lead) {
        BigDecimal revenue = lead.getRevenueValue();
        if (revenue != null) return revenue;
        if (lead.getDealValue() != null) return lead.getDealValue();
        return BigDecimal.ZERO;
    }

    private LeadConversionMetricDTO metric(double current, double previous) {
        return new LeadConversionMetricDTO(round(current), round(previous), round(percentChange(current, previous)));
    }

    private double percentChange(double current, double previous) {
        if (Double.isNaN(current) || Double.isInfinite(current)) return 0.0;
        if (previous == 0.0) return current > 0.0 ? 100.0 : 0.0;
        return ((current - previous) / previous) * 100.0;
    }

    private double round(double value) {
        return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private String firstText(Map<String, Object> values, String... keys) {
        if (values == null || values.isEmpty()) return null;
        for (String key : keys) {
            Object value = values.get(key);
            if (value != null) {
                String text = String.valueOf(value).trim();
                if (StringUtils.hasText(text)) {
                    return text;
                }
            }
        }
        return null;
    }

    private LocalDateTime bucketStart(LocalDateTime dateTime, String granularity) {
        if (dateTime == null) return null;
        return switch (granularity) {
            case "week" -> dateTime.toLocalDate().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).atStartOfDay();
            case "month" -> dateTime.toLocalDate().withDayOfMonth(1).atStartOfDay();
            default -> dateTime.toLocalDate().atStartOfDay();
        };
    }

    private String bucketKey(LocalDateTime bucketStart, String granularity) {
        return switch (granularity) {
            case "week" -> bucketStart.toLocalDate().toString();
            case "month" -> bucketStart.toLocalDate().withDayOfMonth(1).toString();
            default -> bucketStart.toLocalDate().toString();
        };
    }

    private String bucketLabel(LocalDateTime bucketStart, String granularity) {
        return switch (granularity) {
            case "week" -> "Week of " + bucketStart.toLocalDate();
            case "month" -> bucketStart.toLocalDate().getMonth().name().substring(0, 1) + bucketStart.toLocalDate().getMonth().name().substring(1).toLowerCase(Locale.ROOT) + " " + bucketStart.getYear();
            default -> bucketStart.toLocalDate().toString();
        };
    }

    private String trendGranularity(TimeRange range) {
        long days = Math.max(1, Duration.between(range.start(), range.end()).toDays());
        if (days <= 31) return "day";
        if (days <= 120) return "week";
        return "month";
    }

    private Map<LocalDateTime, BucketAccumulator> initializeBuckets(TimeRange range, String granularity) {
        Map<LocalDateTime, BucketAccumulator> buckets = new LinkedHashMap<>();
        LocalDateTime cursor = bucketStart(range.start(), granularity);
        LocalDateTime end = bucketStart(range.end().minusSeconds(1), granularity);
        if (cursor == null || end == null) return buckets;
        while (!cursor.isAfter(end)) {
            buckets.put(cursor, new BucketAccumulator());
            cursor = switch (granularity) {
                case "week" -> cursor.plusWeeks(1);
                case "month" -> cursor.plusMonths(1);
                default -> cursor.plusDays(1);
            };
        }
        return buckets;
    }

    private User currentUser() {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        Object principal = authentication != null ? authentication.getPrincipal() : null;
        Long tenantId = tenantId();
        if (principal instanceof User user
            && user.getTenantId() != null
            && user.getTenantId().equals(tenantId)
            && !Boolean.TRUE.equals(user.getDeleted())) {
            return user;
        }
        String email = authentication != null ? authentication.getName() : null;
        return userRepository.findByEmailAndTenantIdAndDeletedFalse(email, tenantId)
            .orElseThrow(() -> new ResourceNotFoundException("Authenticated user not found"));
    }

    private record TimeRange(LocalDateTime start, LocalDateTime end, String label, String previousLabel) {}

    private record ResolvedScope(User currentUser, boolean fullAccess, String employeeId) {}

    private record StageDefinition(String key, String label) {}

    private static final class BucketAccumulator {
        long leadCount;
        long newCount;
        long assignedCount;
        long contactedCount;
        long interestedCount;
        long qualifiedCount;
        long proposalSentCount;
        long convertedCount;
        long lostCount;
        long pendingFollowUpsCount;
        double revenueGenerated;
    }
}
