-- ═══════════════════════════════════════════════════════════════════════════
--  Internite CRM — PostgreSQL Database Schema
--  Version: 1.0.0
--  Encoding: UTF-8
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- for fast text search

-- ─────────────────────────────────────────────────────────────────
--  TENANTS (Multi-tenant SaaS)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(100) UNIQUE NOT NULL,
    plan            VARCHAR(50) NOT NULL DEFAULT 'FREE' CHECK (plan IN ('FREE','STARTER','PROFESSIONAL','ENTERPRISE')),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    max_users       INT NOT NULL DEFAULT 5,
    logo_url        TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────
--  USERS
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    email           VARCHAR(255) NOT NULL,
    password        VARCHAR(512) NOT NULL,
    role            VARCHAR(30) NOT NULL CHECK (role IN ('PLATFORM_ADMIN','COMPANY_ADMIN','ADMIN','MANAGER','SALES_EXEC','NORMAL_USER')),
    phone           VARCHAR(20),
    avatar_url      TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    two_fa_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
    two_fa_secret   VARCHAR(255),
    last_login_at   TIMESTAMPTZ,
    deleted         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      VARCHAR(255),
    updated_by      VARCHAR(255),
    UNIQUE(email, tenant_id)
);

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_email  ON users(email);

-- ─────────────────────────────────────────────────────────────────
--  LEADS
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
    id                  BIGSERIAL PRIMARY KEY,
    tenant_id           BIGINT NOT NULL REFERENCES tenants(id),
    name                VARCHAR(255) NOT NULL,
    email               VARCHAR(255) NOT NULL,
    phone               VARCHAR(20),
    company             VARCHAR(255),
    website             VARCHAR(512),
    designation         VARCHAR(255),
    source              VARCHAR(50) NOT NULL CHECK (source IN ('FACEBOOK','INSTAGRAM','LINKEDIN','WEBSITE','WHATSAPP','GOOGLE_ADS','META_ADS','REFERRAL','EMAIL','OTHER')),
    status              VARCHAR(30) NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW','CONTACTED','QUALIFIED','PROPOSAL','NEGOTIATION','WON','LOST')),
    score               VARCHAR(10) NOT NULL DEFAULT 'COLD' CHECK (score IN ('HOT','WARM','COLD')),
    priority            VARCHAR(10) DEFAULT 'MEDIUM' CHECK (priority IN ('HIGH','MEDIUM','LOW')),
    deal_value          NUMERIC(15,2),
    -- UTM tracking
    utm_source          VARCHAR(100),
    utm_medium          VARCHAR(100),
    utm_campaign        VARCHAR(255),
    -- AI fields
    ai_score_value      INT,
    ai_next_action      TEXT,
    -- Relations
    assigned_to         BIGINT REFERENCES users(id) ON DELETE SET NULL,
    tags                TEXT,               -- comma-separated tags
    notes               TEXT,
    last_contacted_at   TIMESTAMPTZ,
    -- Audit
    deleted             BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by          VARCHAR(255),
    updated_by          VARCHAR(255)
);

CREATE INDEX idx_lead_tenant    ON leads(tenant_id);
CREATE INDEX idx_lead_status    ON leads(status);
CREATE INDEX idx_lead_score     ON leads(score);
CREATE INDEX idx_lead_source    ON leads(source);
CREATE INDEX idx_lead_assigned  ON leads(assigned_to);
CREATE INDEX idx_lead_email     ON leads(email);
CREATE INDEX idx_lead_search    ON leads USING GIN (to_tsvector('english', name || ' ' || COALESCE(company,'') || ' ' || COALESCE(email,'')));

-- ─────────────────────────────────────────────────────────────────
--  PIPELINES
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pipelines (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   BIGINT NOT NULL REFERENCES tenants(id),
    name        VARCHAR(255) NOT NULL,
    is_default  BOOLEAN NOT NULL DEFAULT FALSE,
    currency    VARCHAR(10) DEFAULT 'INR',
    deleted     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────
--  DEALS
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deals (
    id                  BIGSERIAL PRIMARY KEY,
    tenant_id           BIGINT NOT NULL REFERENCES tenants(id),
    title               VARCHAR(255) NOT NULL,
    description         TEXT,
    stage               VARCHAR(30) NOT NULL DEFAULT 'NEW' CHECK (stage IN ('NEW','CONTACTED','QUALIFIED','PROPOSAL','NEGOTIATION','WON','LOST')),
    priority            VARCHAR(10) DEFAULT 'MEDIUM' CHECK (priority IN ('HIGH','MEDIUM','LOW')),
    deal_value          NUMERIC(15,2) NOT NULL DEFAULT 0,
    expected_close_date DATE,
    actual_close_date   DATE,
    win_probability     INT CHECK (win_probability BETWEEN 0 AND 100),
    pipeline_id         BIGINT REFERENCES pipelines(id) ON DELETE SET NULL,
    lead_id             BIGINT REFERENCES leads(id) ON DELETE SET NULL,
    owner_id            BIGINT REFERENCES users(id) ON DELETE SET NULL,
    ai_score            VARCHAR(20),
    tags                TEXT,
    notes               TEXT,
    deleted             BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by          VARCHAR(255),
    updated_by          VARCHAR(255)
);

CREATE INDEX idx_deal_tenant    ON deals(tenant_id);
CREATE INDEX idx_deal_stage     ON deals(stage);
CREATE INDEX idx_deal_pipeline  ON deals(pipeline_id);
CREATE INDEX idx_deal_owner     ON deals(owner_id);
CREATE INDEX idx_deal_lead      ON deals(lead_id);

-- ─────────────────────────────────────────────────────────────────
--  DEAL ACTIVITIES
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deal_activities (
    id          BIGSERIAL PRIMARY KEY,
    deal_id     BIGINT NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    user_id     BIGINT REFERENCES users(id),
    type        VARCHAR(50) NOT NULL CHECK (type IN ('CALL','EMAIL','MEETING','NOTE','TASK','STAGE_CHANGE','DEMO')),
    title       VARCHAR(255) NOT NULL,
    description TEXT,
    outcome     VARCHAR(100),
    duration_min INT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_deal ON deal_activities(deal_id);

-- ─────────────────────────────────────────────────────────────────
--  CUSTOMERS
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       BIGINT NOT NULL REFERENCES tenants(id),
    name            VARCHAR(255) NOT NULL,
    email           VARCHAR(255) NOT NULL,
    phone           VARCHAR(20),
    company         VARCHAR(255),
    industry        VARCHAR(100),
    website         VARCHAR(512),
    primary_contact VARCHAR(255),
    account_manager_id BIGINT REFERENCES users(id),
    health_score    INT CHECK (health_score BETWEEN 0 AND 100),
    status          VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE','AT_RISK','CHURNED')),
    gstin           VARCHAR(20),
    notes           TEXT,
    avatar_url      TEXT,
    deleted         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      VARCHAR(255),
    updated_by      VARCHAR(255)
);

CREATE INDEX idx_customer_tenant ON customers(tenant_id);

-- ─────────────────────────────────────────────────────────────────
--  INVOICES
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       BIGINT NOT NULL REFERENCES tenants(id),
    invoice_number  VARCHAR(50) NOT NULL,
    customer_id     BIGINT REFERENCES customers(id) ON DELETE SET NULL,
    deal_id         BIGINT REFERENCES deals(id) ON DELETE SET NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SENT','PENDING','PAID','OVERDUE','CANCELLED')),
    issue_date      DATE NOT NULL,
    due_date        DATE NOT NULL,
    paid_date       DATE,
    subtotal        NUMERIC(15,2) NOT NULL DEFAULT 0,
    gst_rate        NUMERIC(5,2) NOT NULL DEFAULT 18,
    gst_amount      NUMERIC(15,2) NOT NULL DEFAULT 0,
    total           NUMERIC(15,2) NOT NULL DEFAULT 0,
    notes           TEXT,
    tally_ref       VARCHAR(100),
    deleted         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      VARCHAR(255),
    updated_by      VARCHAR(255),
    UNIQUE(invoice_number, tenant_id)
);

CREATE INDEX idx_invoice_tenant   ON invoices(tenant_id);
CREATE INDEX idx_invoice_customer ON invoices(customer_id);
CREATE INDEX idx_invoice_status   ON invoices(status);

-- ─────────────────────────────────────────────────────────────────
--  INVOICE LINE ITEMS
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_items (
    id          BIGSERIAL PRIMARY KEY,
    invoice_id  BIGINT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description VARCHAR(500) NOT NULL,
    quantity    NUMERIC(10,2) NOT NULL DEFAULT 1,
    unit_price  NUMERIC(15,2) NOT NULL,
    total       NUMERIC(15,2) NOT NULL,
    hsn_code    VARCHAR(20)
);

-- ─────────────────────────────────────────────────────────────────
--  WORKFLOWS (Automation)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflows (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   BIGINT NOT NULL REFERENCES tenants(id),
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    trigger     VARCHAR(100) NOT NULL,
    conditions  JSONB,
    actions     JSONB NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    run_count   INT NOT NULL DEFAULT 0,
    last_run_at TIMESTAMPTZ,
    deleted     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by  VARCHAR(255)
);

CREATE INDEX idx_workflow_tenant  ON workflows(tenant_id);
CREATE INDEX idx_workflow_trigger ON workflows(trigger);

-- ─────────────────────────────────────────────────────────────────
--  WORKFLOW EXECUTION LOGS
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflow_logs (
    id          BIGSERIAL PRIMARY KEY,
    workflow_id BIGINT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    trigger     VARCHAR(100),
    entity_type VARCHAR(50),
    entity_id   BIGINT,
    status      VARCHAR(20) CHECK (status IN ('SUCCESS','FAILED','SKIPPED')),
    error_msg   TEXT,
    duration_ms INT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────
--  COMMUNICATIONS
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS communications (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   BIGINT NOT NULL REFERENCES tenants(id),
    lead_id     BIGINT REFERENCES leads(id) ON DELETE CASCADE,
    customer_id BIGINT REFERENCES customers(id) ON DELETE CASCADE,
    channel     VARCHAR(30) NOT NULL CHECK (channel IN ('EMAIL','WHATSAPP','INSTAGRAM','FACEBOOK','LINKEDIN','SMS','CALL')),
    direction   VARCHAR(10) NOT NULL CHECK (direction IN ('INBOUND','OUTBOUND')),
    subject     VARCHAR(500),
    body        TEXT NOT NULL,
    sender_id   BIGINT REFERENCES users(id),
    is_ai_reply BOOLEAN DEFAULT FALSE,
    external_id VARCHAR(255),   -- message ID from external platform
    status      VARCHAR(20) DEFAULT 'SENT' CHECK (status IN ('DRAFT','SENT','DELIVERED','READ','FAILED')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comm_lead ON communications(lead_id);
CREATE INDEX idx_comm_tenant ON communications(tenant_id);

-- ─────────────────────────────────────────────────────────────────
--  NOTIFICATIONS
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   BIGINT NOT NULL REFERENCES tenants(id),
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(255) NOT NULL,
    message     TEXT NOT NULL,
    type        VARCHAR(30) NOT NULL CHECK (type IN ('LEAD','DEAL','TASK','INVOICE','AI','SYSTEM','AUTOMATION')),
    is_read     BOOLEAN NOT NULL DEFAULT FALSE,
    action_url  VARCHAR(512),
    entity_type VARCHAR(50),
    entity_id   BIGINT,
    deleted     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by  VARCHAR(255),
    updated_by  VARCHAR(255)
);

CREATE INDEX idx_notif_user   ON notifications(user_id);
CREATE INDEX idx_notif_tenant ON notifications(tenant_id);
CREATE INDEX idx_notif_read   ON notifications(is_read);

-- ─────────────────────────────────────────────────────────────────
--  AUDIT LOGS
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   BIGINT NOT NULL,
    user_id     BIGINT NOT NULL,
    action      VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id   BIGINT,
    old_values  JSONB,
    new_values  JSONB,
    ip_address  VARCHAR(45),
    user_agent  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_user   ON audit_logs(user_id);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);

-- ─────────────────────────────────────────────────────────────────
--  TASKS
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   BIGINT NOT NULL REFERENCES tenants(id),
    title       VARCHAR(500) NOT NULL,
    description TEXT,
    type        VARCHAR(50) CHECK (type IN ('CALL','EMAIL','MEETING','FOLLOW_UP','DEMO','OTHER')),
    status      VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING','IN_PROGRESS','COMPLETED','CANCELLED')),
    priority    VARCHAR(10) DEFAULT 'MEDIUM' CHECK (priority IN ('HIGH','MEDIUM','LOW')),
    due_date    TIMESTAMPTZ,
    lead_id     BIGINT REFERENCES leads(id) ON DELETE CASCADE,
    deal_id     BIGINT REFERENCES deals(id) ON DELETE CASCADE,
    assigned_to BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_by_id BIGINT REFERENCES users(id),
    completed_at TIMESTAMPTZ,
    deleted     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_task_tenant    ON tasks(tenant_id);
CREATE INDEX idx_task_assigned  ON tasks(assigned_to);
CREATE INDEX idx_task_due       ON tasks(due_date);
CREATE INDEX idx_task_status    ON tasks(status);

-- ─────────────────────────────────────────────────────────────────
--  REFRESH TOKENS
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token       TEXT NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_token ON refresh_tokens(token);
CREATE INDEX idx_refresh_user  ON refresh_tokens(user_id);
