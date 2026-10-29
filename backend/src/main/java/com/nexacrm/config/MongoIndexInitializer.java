package com.nexacrm.config;

import com.mongodb.MongoCommandException;
import com.nexacrm.model.CommunicationRecord;
import com.nexacrm.model.Deal;
import com.nexacrm.model.LeadActivity;
import com.nexacrm.model.Invoice;
import com.nexacrm.model.Lead;
import com.nexacrm.model.LeadTimelineEvent;
import com.nexacrm.model.Notification;
import com.nexacrm.model.RefreshToken;
import com.nexacrm.model.Task;
import com.nexacrm.model.Tenant;
import com.nexacrm.model.User;
import com.nexacrm.service.TenantAdminService;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class MongoIndexInitializer {

    private final MongoTemplate mongoTemplate;
    private final TenantAdminService tenantAdminService;

    @PostConstruct
    public void ensureOperationalIndexes() {
        ensureIndex(LeadActivity.class,
            new Index()
                .on("tenant_id", Sort.Direction.ASC)
                .on("deleted", Sort.Direction.ASC)
                .on("lead_id", Sort.Direction.ASC)
                .on("saved_at", Sort.Direction.DESC)
                .background()
                .named("lead_activity_tenant_deleted_lead_saved_idx")
        );

        ensureIndex(LeadActivity.class,
            new Index()
                .on("tenant_id", Sort.Direction.ASC)
                .on("deleted", Sort.Direction.ASC)
                .on("lead_id", Sort.Direction.ASC)
                .on("activity_index", Sort.Direction.ASC)
                .on("saved_at", Sort.Direction.DESC)
                .background()
                .named("lead_activity_bulk_stage_preview_idx")
        );

        ensureIndex(LeadTimelineEvent.class,
            new Index()
                .on("tenant_id", Sort.Direction.ASC)
                .on("lead_id", Sort.Direction.ASC)
                .on("deleted", Sort.Direction.ASC)
                .on("event_at", Sort.Direction.DESC)
                .background()
                .named("lead_timeline_feed_idx")
        );

        ensureIndex(LeadTimelineEvent.class,
            new Index()
                .on("tenant_id", Sort.Direction.ASC)
                .on("source_type", Sort.Direction.ASC)
                .on("source_id", Sort.Direction.ASC)
                .unique()
                .background()
                .named("lead_timeline_source_uidx")
        );

        ensureIndex(Invoice.class,
            new Index()
                .on("tenant_id", Sort.Direction.ASC)
                .on("deleted", Sort.Direction.ASC)
                .on("createdAt", Sort.Direction.DESC)
                .background()
                .named("invoice_tenant_deleted_created_idx")
        );

        ensureIndex(Lead.class,
            new Index()
                .on("tenant_id", Sort.Direction.ASC)
                .on("deleted", Sort.Direction.ASC)
                .on("assigned_to.$id", Sort.Direction.ASC)
                .on("createdAt", Sort.Direction.DESC)
                .background()
                .named("lead_tenant_deleted_assigned_created_idx")
        );

        // Dashboard count queries: status and source grouping
        ensureIndex(Lead.class,
            new Index()
                .on("tenant_id", Sort.Direction.ASC)
                .on("deleted", Sort.Direction.ASC)
                .on("status", Sort.Direction.ASC)
                .background()
                .named("lead_tenant_deleted_status_idx")
        );

        ensureIndex(Lead.class,
            new Index()
                .on("tenant_id", Sort.Direction.ASC)
                .on("deleted", Sort.Direction.ASC)
                .on("source", Sort.Direction.ASC)
                .background()
                .named("lead_tenant_deleted_source_idx")
        );

        // Leads list default sort
        ensureIndex(Lead.class,
            new Index()
                .on("tenant_id", Sort.Direction.ASC)
                .on("deleted", Sort.Direction.ASC)
                .on("createdAt", Sort.Direction.DESC)
                .background()
                .named("lead_tenant_deleted_created_idx")
        );

        // Deals: pipeline/kanban queries
        ensureIndex(Deal.class,
            new Index()
                .on("tenant_id", Sort.Direction.ASC)
                .on("deleted", Sort.Direction.ASC)
                .on("stage", Sort.Direction.ASC)
                .on("createdAt", Sort.Direction.DESC)
                .background()
                .named("deal_tenant_deleted_stage_created_idx")
        );

        ensureIndex(Task.class,
            new Index()
                .on("tenant_id", Sort.Direction.ASC)
                .on("deleted", Sort.Direction.ASC)
                .on("status", Sort.Direction.ASC)
                .on("due_date", Sort.Direction.ASC)
                .background()
                .named("task_tenant_deleted_status_due_idx")
        );

        ensureIndex(Task.class,
            new Index()
                .on("tenant_id", Sort.Direction.ASC)
                .on("deleted", Sort.Direction.ASC)
                .on("assigned_to", Sort.Direction.ASC)
                .on("status", Sort.Direction.ASC)
                .on("due_date", Sort.Direction.ASC)
                .background()
                .named("task_tenant_deleted_assigned_status_due_idx")
        );

        ensureIndex(Task.class,
            new Index()
                .on("tenant_id", Sort.Direction.ASC)
                .on("deleted", Sort.Direction.ASC)
                .on("created_by_id", Sort.Direction.ASC)
                .on("status", Sort.Direction.ASC)
                .on("due_date", Sort.Direction.ASC)
                .background()
                .named("task_tenant_deleted_created_by_status_due_idx")
        );

        ensureIndex(User.class,
            new Index()
                .on("tenant_id", Sort.Direction.ASC)
                .on("deleted", Sort.Direction.ASC)
                .on("email", Sort.Direction.ASC)
                .background()
                .named("user_tenant_deleted_email_lookup_idx")
        );

        ensureIndex(User.class,
            new Index()
                .on("email", Sort.Direction.ASC)
                .on("deleted", Sort.Direction.ASC)
                .background()
                .named("user_email_deleted_login_lookup_idx")
        );

        ensureIndex(Tenant.class,
            new Index()
                .on("tenant_id", Sort.Direction.ASC)
                .on("deleted", Sort.Direction.ASC)
                .background()
                .named("tenant_tenant_id_deleted_lookup_idx")
        );

        ensureIndex(Notification.class,
            new Index()
                .on("tenant_id", Sort.Direction.ASC)
                .on("deleted", Sort.Direction.ASC)
                .on("user.$id", Sort.Direction.ASC)
                .on("createdAt", Sort.Direction.DESC)
                .background()
                .named("notification_tenant_deleted_user_created_idx")
        );

        ensureIndex(Notification.class,
            new Index()
                .on("tenant_id", Sort.Direction.ASC)
                .on("deleted", Sort.Direction.ASC)
                .on("user.$id", Sort.Direction.ASC)
                .on("is_read", Sort.Direction.ASC)
                .background()
                .named("notification_tenant_deleted_user_read_idx")
        );

        ensureIndex(RefreshToken.class,
            new Index()
                .on("tenant_id", Sort.Direction.ASC)
                .on("deleted", Sort.Direction.ASC)
                .on("token_hash", Sort.Direction.ASC)
                .background()
                .named("refresh_token_tenant_deleted_hash_idx")
        );

        // Communications: dashboard call snapshots
        ensureIndex(CommunicationRecord.class,
            new Index()
                .on("tenant_id", Sort.Direction.ASC)
                .on("channel", Sort.Direction.ASC)
                .on("created_at", Sort.Direction.DESC)
                .background()
                .named("comm_tenant_channel_created_idx")
        );

        ensureIndex(com.nexacrm.model.AuditLog.class,
            new Index().on("tenant_id", Sort.Direction.ASC).on("entity_id", Sort.Direction.ASC)
                .on("created_at", Sort.Direction.DESC).background().named("audit_lead_daily_report_idx"));

        log.info("Mongo operational indexes verified");

        try {
            tenantAdminService.backfillTenantIds();
            log.info("Tenant tenantId backfill complete");
        } catch (Exception e) {
            log.warn("Tenant backfill skipped: {}", e.getMessage());
        }
    }

    private void ensureIndex(Class<?> entityClass, Index index) {
        try {
            mongoTemplate.indexOps(entityClass).ensureIndex(index);
        } catch (DataAccessException e) {
            if (isEquivalentIndexNameConflict(e)) {
                log.info("Mongo index already exists for {} with a different name; keeping existing index",
                    entityClass.getSimpleName());
                return;
            }
            throw e;
        }
    }

    private boolean isEquivalentIndexNameConflict(Throwable throwable) {
        Throwable current = throwable;
        while (current != null) {
            if (current instanceof MongoCommandException mongoException
                && mongoException.getErrorCode() == 85
                && mongoException.getErrorMessage() != null
                && mongoException.getErrorMessage().contains("Index already exists with a different name")) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }
}
