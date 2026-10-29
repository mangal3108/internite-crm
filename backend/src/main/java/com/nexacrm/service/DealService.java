package com.nexacrm.service;

import com.nexacrm.automation.WorkflowEngine;
import com.nexacrm.dto.DealDTO;
import com.nexacrm.dto.PageResponse;
import com.nexacrm.exception.ResourceNotFoundException;
import com.nexacrm.model.CommunicationRecord;
import com.nexacrm.model.Deal;
import com.nexacrm.model.User;
import com.nexacrm.repository.LeadRepository;
import com.nexacrm.repository.DealRepository;
import com.nexacrm.repository.CommunicationRecordRepository;
import com.nexacrm.repository.UserRepository;
import com.nexacrm.security.TenantContext;
import com.nexacrm.websocket.NotificationPublisher;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mongodb.DBRef;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.bson.types.Decimal128;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class DealService {

    private final DealRepository dealRepository;
    private final LeadRepository leadRepository;
    private final CommunicationRecordRepository communicationRecordRepository;
    private final UserRepository userRepository;
    private final MongoTemplate mongoTemplate;
    private final NotificationPublisher notificationPublisher;
    private final WorkflowEngine workflowEngine;
    private final ObjectMapper objectMapper;

    private Long tenantId() {
        return TenantContext.currentTenantId();
    }

    @Transactional(readOnly = true)
    public PageResponse<DealDTO> findAll(String stage, String ownerId, Long pipelineId, Pageable pageable) {
        Query query = new Query();
        query.addCriteria(Criteria.where("tenant_id").is(tenantId()));
        query.addCriteria(Criteria.where("deleted").ne(true));
        User current = currentUser();
        if (!User.isAdminLike(current.getRole()) && current.getRole() != User.Role.MANAGER) {
            query.addCriteria(Criteria.where("owner.$id").is(current.getId()));
        }

        Deal.DealStage stageEnum = parseStage(stage);
        if (stageEnum != null) {
            query.addCriteria(Criteria.where("stage").is(stageEnum));
        }
        if (ownerId != null && !ownerId.isBlank()) {
            query.addCriteria(Criteria.where("owner.$id").is(ownerId));
        }
        if (pipelineId != null) {
            query.addCriteria(new Criteria().orOperator(
                Criteria.where("pipeline_id").is(pipelineId),
                Criteria.where("pipeline_id").is(null),
                Criteria.where("pipeline_id").exists(false)
            ));
        }

        long total = mongoTemplate.count(query, Deal.class);
        query.with(pageable);
        List<Deal> content = mongoTemplate.find(query, Deal.class);
        Page<Deal> page = new PageImpl<>(content, pageable, total);

        Map<String, String> ownerNameById = buildOwnerNameById(content);
        Map<String, String> companyByLeadId = buildCompanyByLeadId(content);
        Map<String, CallSummary> latestCallByLeadId = buildLatestCallByLeadId(content);

        return PageResponse.<DealDTO>builder()
            .content(page.getContent().stream()
                .map(deal -> toDTO(deal, ownerNameById, companyByLeadId, latestCallByLeadId))
                .collect(Collectors.toList()))
            .page(page.getNumber()).size(page.getSize())
            .total(page.getTotalElements()).totalPages(page.getTotalPages())
            .first(page.isFirst()).last(page.isLast())
            .build();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> findOptions(int size) {
        int safeSize = Math.max(1, Math.min(size, 100));
        Query query = new Query();
        query.addCriteria(Criteria.where("tenant_id").is(tenantId()));
        query.addCriteria(Criteria.where("deleted").ne(true));
        User current = currentUser();
        if (!User.isAdminLike(current.getRole()) && current.getRole() != User.Role.MANAGER) {
            query.addCriteria(Criteria.where("owner.$id").is(current.getId()));
        }
        query.with(Sort.by(Sort.Order.desc("createdAt")));
        query.limit(safeSize);
        query.fields()
            .include("_id")
            .include("title")
            .include("deal_value")
            .include("lead");

        List<Document> deals = mongoTemplate.find(query, Document.class, "deals");
        Set<String> leadIds = deals.stream()
            .map(deal -> extractDbRefId(deal.get("lead")))
            .filter(id -> !id.isBlank())
            .collect(Collectors.toCollection(LinkedHashSet::new));
        Map<String, String> companyByLeadId = buildCompanyByLeadId(leadIds);

        return deals.stream()
            .map(deal -> {
                String leadId = extractDbRefId(deal.get("lead"));
                Map<String, Object> option = new LinkedHashMap<>();
                option.put("id", String.valueOf(deal.get("_id")));
                option.put("title", firstNonBlank(deal.getString("title"), "Deal"));
                option.put("company", firstNonBlank(companyByLeadId.get(leadId), "Company"));
                option.put("value", toBigDecimal(deal.get("deal_value")));
                return option;
            })
            .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Map<String, List<DealDTO>> getBoardView(Long pipelineId) {
        Map<String, List<DealDTO>> board = new LinkedHashMap<>();
        for (Deal.DealStage stage : Deal.DealStage.values()) {
            board.put(stage.name().toLowerCase(), new ArrayList<>());
        }

        Query query = new Query();
        query.addCriteria(Criteria.where("tenant_id").is(tenantId()));
        query.addCriteria(Criteria.where("deleted").ne(true));
        User current = currentUser();
        if (!User.isAdminLike(current.getRole()) && current.getRole() != User.Role.MANAGER) {
            query.addCriteria(Criteria.where("owner.$id").is(current.getId()));
        }
        if (pipelineId != null) {
            query.addCriteria(new Criteria().orOperator(
                Criteria.where("pipeline_id").is(pipelineId),
                Criteria.where("pipeline_id").is(null),
                Criteria.where("pipeline_id").exists(false)
            ));
        }
        List<Deal> deals = mongoTemplate.find(query, Deal.class);

        Map<String, String> ownerNameById = Map.of();
        Map<String, String> companyByLeadId = Map.of();
        Map<String, CallSummary> latestCallByLeadId = Map.of();

        try {
            ownerNameById = buildOwnerNameById(deals);
        } catch (Exception ex) {
            log.warn("Failed to enrich board owners: {}", ex.getMessage());
        }
        try {
            companyByLeadId = buildCompanyByLeadId(deals);
        } catch (Exception ex) {
            log.warn("Failed to enrich board companies: {}", ex.getMessage());
        }
        try {
            latestCallByLeadId = buildLatestCallByLeadId(deals);
        } catch (Exception ex) {
            log.warn("Failed to enrich board call intelligence: {}", ex.getMessage());
        }

        for (Deal deal : deals) {
            String stageKey = (deal.getStage() != null ? deal.getStage() : Deal.DealStage.NEW).name().toLowerCase();
            List<DealDTO> bucket = board.computeIfAbsent(stageKey, key -> new ArrayList<>());
            bucket.add(toDTO(deal, ownerNameById, companyByLeadId, latestCallByLeadId));
        }

        return board;
    }

    @Transactional(readOnly = true)
    public DealDTO findById(String id) {
        Deal deal = dealRepository.findByIdAndTenantIdAndDeletedFalse(id, tenantId())
            .orElseThrow(() -> new ResourceNotFoundException("Deal not found: " + id));
        ensureDealVisible(deal);
        return toDTO(deal);
    }

    public DealDTO create(DealDTO dto) {
        Deal deal = fromDTO(dto);
        deal.setTenantId(tenantId());
        Deal saved = dealRepository.save(deal);
        workflowEngine.processEvent("DEAL_CREATED", Map.of(
            "dealId", saved.getId(),
            "stage", saved.getStage() != null ? saved.getStage().name() : "UNKNOWN"
        ));
        return toDTO(saved);
    }

    public DealDTO update(String id, DealDTO dto) {
        Deal deal = dealRepository.findByIdAndTenantIdAndDeletedFalse(id, tenantId())
            .orElseThrow(() -> new ResourceNotFoundException("Deal not found: " + id));
        ensureDealVisible(deal);

        deal.setTitle(dto.getTitle());
        deal.setDescription(dto.getDescription());
        if (dto.getDealValue() != null) deal.setDealValue(dto.getDealValue());
        if (dto.getPriority() != null)  deal.setPriority(dto.getPriority());
        if (dto.getExpectedCloseDate() != null) deal.setExpectedCloseDate(dto.getExpectedCloseDate());
        if (dto.getPipelineId() != null) deal.setPipelineId(dto.getPipelineId());
        if (dto.getLeadId() != null) {
            if (dto.getLeadId().isBlank()) {
                deal.setLead(null);
            } else {
                leadRepository.findByIdAndTenantIdAndDeletedFalse(dto.getLeadId(), tenantId())
                    .ifPresent(deal::setLead);
            }
        }
        if (dto.getOwnerId() != null) {
            if (dto.getOwnerId().isBlank()) {
                deal.setOwner(null);
            } else {
                userRepository.findByIdAndTenantIdAndDeletedFalse(dto.getOwnerId(), tenantId())
                    .ifPresent(deal::setOwner);
            }
        }
        deal.setNotes(dto.getNotes());

        return toDTO(dealRepository.save(deal));
    }

    public DealDTO moveStage(String id, String stageName) {
        Deal deal = dealRepository.findByIdAndTenantIdAndDeletedFalse(id, tenantId())
            .orElseThrow(() -> new ResourceNotFoundException("Deal not found: " + id));
        ensureDealVisible(deal);

        Deal.DealStage newStage;
        try {
            newStage = Deal.DealStage.valueOf(stageName.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid stage: " + stageName + ". Valid values: " +
                java.util.Arrays.toString(Deal.DealStage.values()));
        }
        String prevStage = deal.getStage() != null ? deal.getStage().name() : "UNKNOWN";
        deal.setStage(newStage);
        Deal saved = dealRepository.save(deal);

        // Notify deal owner if owner email exists. Notification failures should never block a stage move.
        String ownerEmail = saved.getOwner() != null ? saved.getOwner().getEmail() : null;
        if (StringUtils.hasText(ownerEmail)) {
            try {
                notificationPublisher.notifyDealStageChange(ownerEmail, saved.getTitle(), newStage.name());
            } catch (Exception ex) {
                log.warn("Failed to publish deal stage notification for deal {}: {}", id, ex.getMessage());
            }
        } else if (saved.getOwner() != null) {
            log.warn("Skipping deal stage notification for deal {} because owner email is missing", id);
        }

        log.info("Deal {} moved from {} to {}", id, prevStage, newStage);
        workflowEngine.processEvent("DEAL_STAGE_CHANGED", Map.of(
            "dealId", saved.getId(),
            "fromStage", prevStage,
            "toStage", newStage.name()
        ));
        return toDTO(saved);
    }

    public void delete(String id) {
        Deal deal = dealRepository.findByIdAndTenantIdAndDeletedFalse(id, tenantId())
            .orElseThrow(() -> new ResourceNotFoundException("Deal not found: " + id));
        ensureDealVisible(deal);
        deal.setDeleted(true);
        dealRepository.save(deal);
    }

    public List<Map<String, Object>> getActivities(String dealId) {
        // In production: query deal_activities table
        return List.of(
            Map.of("type", "CALL",  "title", "Discovery call", "time", "2 days ago"),
            Map.of("type", "EMAIL", "title", "Sent proposal",  "time", "1 day ago")
        );
    }

    public Map<String, Object> addActivity(String dealId, Map<String, Object> activity) {
        // In production: insert into deal_activities
        return Map.of("id", System.currentTimeMillis(), "dealId", dealId, "status", "logged");
    }

    // ── Mapping ───────────────────────────────────────────────────

    private Map<String, String> buildOwnerNameById(List<Deal> deals) {
        Set<String> ownerIds = deals.stream()
            .map(deal -> deal.getOwner() != null ? deal.getOwner().getId() : null)
            .filter(id -> id != null && !id.isBlank())
            .collect(Collectors.toCollection(LinkedHashSet::new));

        if (ownerIds.isEmpty()) return Map.of();

        Map<String, String> result = new LinkedHashMap<>();
        for (var user : userRepository.findAllById(ownerIds)) {
            if (user == null || user.getId() == null || user.getId().isBlank()) continue;
            result.putIfAbsent(user.getId(), user.getName() != null ? user.getName() : "");
        }
        return result;
    }

    private Map<String, String> buildCompanyByLeadId(List<Deal> deals) {
        Set<String> leadIds = deals.stream()
            .map(deal -> deal.getLead() != null ? deal.getLead().getId() : null)
            .filter(id -> id != null && !id.isBlank())
            .collect(Collectors.toCollection(LinkedHashSet::new));

        if (leadIds.isEmpty()) return Map.of();

        Map<String, String> result = new LinkedHashMap<>();
        for (var lead : leadRepository.findAllById(leadIds)) {
            if (lead == null || lead.getId() == null || lead.getId().isBlank()) continue;
            result.putIfAbsent(lead.getId(), lead.getCompany() != null ? lead.getCompany() : "");
        }
        return result;
    }

    private Map<String, String> buildCompanyByLeadId(Set<String> leadIds) {
        if (leadIds.isEmpty()) return Map.of();

        Query query = new Query();
        query.addCriteria(Criteria.where("_id").in(leadIds));
        query.addCriteria(Criteria.where("tenant_id").is(tenantId()));
        query.addCriteria(Criteria.where("deleted").ne(true));
        query.fields()
            .include("_id")
            .include("company")
            .include("name");

        Map<String, String> result = new LinkedHashMap<>();
        for (Document lead : mongoTemplate.find(query, Document.class, "leads")) {
            String id = String.valueOf(lead.get("_id"));
            result.putIfAbsent(id, firstNonBlank(lead.getString("company"), lead.getString("name")));
        }
        return result;
    }

    private Deal.DealStage parseStage(String stage) {
        if (stage == null || stage.isBlank()) return null;
        return Deal.DealStage.valueOf(stage.toUpperCase());
    }

    private DealDTO toDTO(Deal d, Map<String, String> ownerNameById, Map<String, String> companyByLeadId) {
        return toDTO(d, ownerNameById, companyByLeadId, Map.of());
    }

    private DealDTO toDTO(
        Deal d,
        Map<String, String> ownerNameById,
        Map<String, String> companyByLeadId,
        Map<String, CallSummary> latestCallByLeadId
    ) {
        String ownerId = d.getOwner() != null ? d.getOwner().getId() : null;
        String leadId = d.getLead() != null ? d.getLead().getId() : null;
        String ownerName = ownerId != null ? ownerNameById.get(ownerId) : null;
        String company = leadId != null ? companyByLeadId.get(leadId) : null;
        CallSummary latestCall = leadId != null ? latestCallByLeadId.get(leadId) : null;

        return DealDTO.builder()
            .id(d.getId())
            .title(d.getTitle())
            .description(d.getDescription())
            .stage(d.getStage())
            .priority(d.getPriority())
            .dealValue(d.getDealValue())
            .expectedCloseDate(d.getExpectedCloseDate())
            .actualCloseDate(d.getActualCloseDate())
            .winProbability(d.getWinProbability())
            .pipelineId(d.getPipelineId())
            .leadId(leadId)
            .company(company)
            .ownerId(ownerId)
            .ownerName(ownerName)
            .aiScore(d.getAiScore())
            .tags(d.getTags())
            .notes(d.getNotes())
            .latestCallRecordingUrl(latestCall != null ? latestCall.recordingUrl() : null)
            .latestCallSummary(latestCall != null ? latestCall.summary() : null)
            .latestCallAt(latestCall != null ? latestCall.createdAt() : null)
            .createdAt(d.getCreatedAt())
            .updatedAt(d.getUpdatedAt())
            .build();
    }

    private DealDTO toDTO(Deal d) {
        return toDTO(d, Map.of(), Map.of(), Map.of());
    }

    private Map<String, CallSummary> buildLatestCallByLeadId(List<Deal> deals) {
        Set<String> leadIds = deals.stream()
            .map(deal -> deal.getLead() != null ? deal.getLead().getId() : null)
            .filter(Objects::nonNull)
            .collect(Collectors.toCollection(LinkedHashSet::new));
        if (leadIds.isEmpty()) {
            return Map.of();
        }

        Query query = new Query();
        query.addCriteria(Criteria.where("tenant_id").is(tenantId()));
        query.addCriteria(Criteria.where("deleted").ne(true));
        query.addCriteria(Criteria.where("lead_id").in(leadIds));
        query.addCriteria(Criteria.where("channel").regex("^CALL$", "i"));
        query.with(org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "created_at"));
        query.fields()
            .include("lead_id")
            .include("created_at")
            .include("raw_payload")
            .include("body");

        List<CommunicationRecord> calls = mongoTemplate.find(query, CommunicationRecord.class);
        Map<String, CallSummary> latest = new LinkedHashMap<>();
        for (CommunicationRecord call : calls) {
            String leadId = trim(call.getLeadId());
            if (leadId.isBlank() || latest.containsKey(leadId)) {
                continue;
            }
            latest.put(leadId, new CallSummary(
                trim(extractRecordingUrl(call.getRawPayload())),
                trim(extractSummary(call.getRawPayload(), call.getBody(), extractTranscript(call.getRawPayload()))),
                call.getCreatedAt() != null ? call.getCreatedAt().atZone(java.time.ZoneId.systemDefault()).toLocalDateTime() : null
            ));
        }
        return latest;
    }

    private String extractTranscript(String rawPayload) {
        String raw = trim(rawPayload);
        if (raw.isBlank()) {
            return "";
        }
        try {
            Object node = objectMapper.readValue(raw, Object.class);
            String transcript = findFirstValue(node, List.of(
                "transcript",
                "finalTranscript",
                "final_transcript",
                "fullTranscript",
                "full_transcript"
            ));
            if (!transcript.isBlank()) {
                return transcript;
            }
            transcript = mergeTranscriptRows(node);
            if (!transcript.isBlank()) {
                return transcript;
            }
        } catch (Exception ignored) {
            // fall through
        }
        return "";
    }

    private String extractRecordingUrl(String rawPayload) {
        String raw = trim(rawPayload);
        if (raw.isBlank()) {
            return "";
        }
        try {
            Object node = objectMapper.readValue(raw, Object.class);
            return findFirstValue(node, List.of("recordingUrl", "recording_url", "recording"));
        } catch (Exception ignored) {
            // fall through
        }
        return "";
    }

    private String extractSummary(String rawPayload, String fallbackBody, String transcript) {
        String raw = trim(rawPayload);
        if (!raw.isBlank()) {
            try {
                Object node = objectMapper.readValue(raw, Object.class);
                String summary = findFirstValue(node, List.of("summary", "note", "message", "description"));
                if (!summary.isBlank()) {
                    return summary;
                }
            } catch (Exception ignored) {
                // fall through
            }
        }
        if (!trim(transcript).isBlank()) {
            String text = trim(transcript);
            return text.length() > 240 ? text.substring(0, 240) + "..." : text;
        }
        return trim(fallbackBody);
    }

    private String trim(String value) {
        return value == null ? "" : value.trim();
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            String text = trim(value);
            if (!text.isBlank()) {
                return text;
            }
        }
        return "";
    }

    private String extractDbRefId(Object value) {
        if (value instanceof DBRef dbRef && dbRef.getId() != null) {
            return trim(String.valueOf(dbRef.getId()));
        }
        if (value instanceof Document document) {
            Object id = document.get("$id");
            return id != null ? trim(String.valueOf(id)) : "";
        }
        if (value instanceof Map<?, ?> map) {
            Object id = map.get("$id");
            return id != null ? trim(String.valueOf(id)) : "";
        }
        return "";
    }

    private BigDecimal toBigDecimal(Object value) {
        if (value instanceof BigDecimal decimal) {
            return decimal;
        }
        if (value instanceof Decimal128 decimal) {
            return decimal.bigDecimalValue();
        }
        if (value instanceof Number number) {
            return BigDecimal.valueOf(number.doubleValue());
        }
        if (value != null) {
            try {
                return new BigDecimal(String.valueOf(value));
            } catch (NumberFormatException ignored) {
                // fall through
            }
        }
        return BigDecimal.ZERO;
    }

    private String findFirstValue(Object node, List<String> keys) {
        if (node instanceof Map<?, ?> map) {
            for (String key : keys) {
                Object value = map.get(key);
                String text = trim(value == null ? "" : String.valueOf(value));
                if (!text.isBlank()) {
                    return text;
                }
            }
            for (Object value : map.values()) {
                if (value instanceof Map<?, ?> || value instanceof List<?>) {
                    String nested = findFirstValue(value, keys);
                    if (!nested.isBlank()) {
                        return nested;
                    }
                }
            }
        } else if (node instanceof List<?> list) {
            for (Object item : list) {
                String nested = findFirstValue(item, keys);
                if (!nested.isBlank()) {
                    return nested;
                }
            }
        }
        return "";
    }

    private String mergeTranscriptRows(Object node) {
        if (!(node instanceof Map<?, ?> map)) {
            return "";
        }
        Object rows = map.get("transcripts");
        if (!(rows instanceof List<?> list)) {
            return "";
        }
        StringBuilder merged = new StringBuilder();
        for (Object row : list) {
            if (!(row instanceof Map<?, ?> rowMap)) {
                continue;
            }
            String speaker = trim(rowMap.get("speaker") == null ? "" : String.valueOf(rowMap.get("speaker")));
            String text = findFirstValue(rowMap, List.of("text", "transcript", "message", "content", "utterance", "reply"));
            if (text.isBlank()) {
                continue;
            }
            if (!merged.isEmpty()) {
                merged.append('\n');
            }
            if (!speaker.isBlank()) {
                merged.append('[').append(speaker).append("] ");
            }
            merged.append(text);
        }
        return merged.toString();
    }

    private record CallSummary(String recordingUrl, String summary, LocalDateTime createdAt) {}

    private Deal fromDTO(DealDTO dto) {
        Deal.DealBuilder builder = Deal.builder()
            .title(dto.getTitle())
            .description(dto.getDescription())
            .stage(dto.getStage() != null ? dto.getStage() : Deal.DealStage.NEW)
            .priority(dto.getPriority() != null ? dto.getPriority() : Deal.DealPriority.MEDIUM)
            .dealValue(dto.getDealValue())
            .expectedCloseDate(dto.getExpectedCloseDate())
            .pipelineId(dto.getPipelineId() != null ? dto.getPipelineId() : 1L)
            .notes(dto.getNotes());

        if (dto.getLeadId() != null && !dto.getLeadId().isBlank()) {
            leadRepository.findByIdAndTenantIdAndDeletedFalse(dto.getLeadId(), tenantId())
                .ifPresent(builder::lead);
        }
        if (dto.getOwnerId() != null && !dto.getOwnerId().isBlank()) {
            userRepository.findByIdAndTenantIdAndDeletedFalse(dto.getOwnerId(), tenantId())
                .ifPresent(builder::owner);
        }

        return builder.build();
    }

    private void ensureDealVisible(Deal deal) {
        if (!canCurrentUserAccess(deal)) {
            throw new ResourceNotFoundException("Deal not found: " + deal.getId());
        }
    }

    private boolean canCurrentUserAccess(Deal deal) {
        User current = currentUser();
        if (current == null || User.isAdminLike(current.getRole()) || current.getRole() == User.Role.MANAGER) {
            return true;
        }
        if (current.getId() == null || current.getId().isBlank() || deal == null) {
            return false;
        }
        return deal.getOwner() != null && current.getId().equals(deal.getOwner().getId());
    }

    private User currentUser() {
        String email = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmailAndTenantIdAndDeletedFalse(email, tenantId())
            .orElseThrow(() -> new ResourceNotFoundException("Authenticated user not found"));
    }
}
