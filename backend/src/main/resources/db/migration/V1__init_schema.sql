-- Flyway Migration V1 — Initial Schema
-- This file is managed by Flyway. Do not edit manually.
-- The full schema is in database/schema.sql for reference.
-- Flyway will run this automatically on first startup.

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Tenants
CREATE TABLE IF NOT EXISTS tenants (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(100) UNIQUE NOT NULL,
    plan            VARCHAR(50) NOT NULL DEFAULT 'FREE',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    max_users       INT NOT NULL DEFAULT 5,
    logo_url        TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users
CREATE TABLE IF NOT EXISTS users (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    email           VARCHAR(255) NOT NULL,
    password        VARCHAR(512) NOT NULL,
    role            VARCHAR(30) NOT NULL,
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

-- Pipelines
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

-- Leads
CREATE TABLE IF NOT EXISTS leads (
    id                  BIGSERIAL PRIMARY KEY,
    tenant_id           BIGINT NOT NULL REFERENCES tenants(id),
    name                VARCHAR(255) NOT NULL,
    email               VARCHAR(255) NOT NULL,
    phone               VARCHAR(20),
    company             VARCHAR(255),
    website             VARCHAR(512),
    designation         VARCHAR(255),
    source              VARCHAR(50) NOT NULL,
    status              VARCHAR(30) NOT NULL DEFAULT 'NEW',
    score               VARCHAR(10) NOT NULL DEFAULT 'COLD',
    priority            VARCHAR(10) DEFAULT 'MEDIUM',
    deal_value          NUMERIC(15,2),
    utm_source          VARCHAR(100),
    utm_medium          VARCHAR(100),
    utm_campaign        VARCHAR(255),
    ai_score_value      INT,
    ai_next_action      TEXT,
    assigned_to         BIGINT REFERENCES users(id) ON DELETE SET NULL,
    tags                TEXT,
    notes               TEXT,
    last_contacted_at   TIMESTAMPTZ,
    deleted             BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by          VARCHAR(255),
    updated_by          VARCHAR(255)
);

CREATE INDEX idx_lead_tenant   ON leads(tenant_id);
CREATE INDEX idx_lead_status   ON leads(status);
CREATE INDEX idx_lead_score    ON leads(score);
CREATE INDEX idx_lead_assigned ON leads(assigned_to);
CREATE INDEX idx_lead_email    ON leads(email);

-- Deals
CREATE TABLE IF NOT EXISTS deals (
    id                  BIGSERIAL PRIMARY KEY,
    tenant_id           BIGINT NOT NULL REFERENCES tenants(id),
    title               VARCHAR(255) NOT NULL,
    description         TEXT,
    stage               VARCHAR(30) NOT NULL DEFAULT 'NEW',
    priority            VARCHAR(10) DEFAULT 'MEDIUM',
    deal_value          NUMERIC(15,2) NOT NULL DEFAULT 0,
    expected_close_date DATE,
    actual_close_date   DATE,
    win_probability     INT,
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

CREATE INDEX idx_deal_tenant   ON deals(tenant_id);
CREATE INDEX idx_deal_stage    ON deals(stage);
CREATE INDEX idx_deal_pipeline ON deals(pipeline_id);
CREATE INDEX idx_deal_owner    ON deals(owner_id);

-- Deal Activities
CREATE TABLE IF NOT EXISTS deal_activities (
    id          BIGSERIAL PRIMARY KEY,
    deal_id     BIGINT NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    user_id     BIGINT REFERENCES users(id),
    type        VARCHAR(50) NOT NULL,
    title       VARCHAR(255) NOT NULL,
    description TEXT,
    outcome     VARCHAR(100),
    duration_min INT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Customers
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
    health_score    INT,
    status          VARCHAR(20) DEFAULT 'ACTIVE',
    gstin           VARCHAR(20),
    notes           TEXT,
    avatar_url      TEXT,
    deleted         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      VARCHAR(255),
    updated_by      VARCHAR(255)
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       BIGINT NOT NULL REFERENCES tenants(id),
    invoice_number  VARCHAR(50) NOT NULL,
    customer_id     BIGINT REFERENCES customers(id) ON DELETE SET NULL,
    deal_id         BIGINT REFERENCES deals(id) ON DELETE SET NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
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

-- Workflows
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

-- Communications
CREATE TABLE IF NOT EXISTS communications (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   BIGINT NOT NULL REFERENCES tenants(id),
    lead_id     BIGINT REFERENCES leads(id) ON DELETE CASCADE,
    customer_id BIGINT REFERENCES customers(id) ON DELETE CASCADE,
    channel     VARCHAR(30) NOT NULL,
    direction   VARCHAR(10) NOT NULL,
    subject     VARCHAR(500),
    body        TEXT NOT NULL,
    sender_id   BIGINT REFERENCES users(id),
    is_ai_reply BOOLEAN DEFAULT FALSE,
    external_id VARCHAR(255),
    status      VARCHAR(20) DEFAULT 'SENT',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   BIGINT NOT NULL REFERENCES tenants(id),
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(255) NOT NULL,
    message     TEXT NOT NULL,
    type        VARCHAR(30) NOT NULL,
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

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       BIGINT NOT NULL REFERENCES tenants(id),
    title           VARCHAR(500) NOT NULL,
    description     TEXT,
    type            VARCHAR(50),
    status          VARCHAR(20) DEFAULT 'PENDING',
    priority        VARCHAR(10) DEFAULT 'MEDIUM',
    due_date        TIMESTAMPTZ,
    lead_id         BIGINT REFERENCES leads(id) ON DELETE CASCADE,
    deal_id         BIGINT REFERENCES deals(id) ON DELETE CASCADE,
    assigned_to     BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_by_id   BIGINT REFERENCES users(id),
    completed_at    TIMESTAMPTZ,
    deleted         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Refresh Tokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token       TEXT NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit Logs
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

-- Seed: Default tenant
INSERT INTO tenants (id, name, slug, plan, is_active, max_users)
VALUES (1, 'Internite CRM Demo Co.', 'internite-demo', 'ENTERPRISE', TRUE, 50)
ON CONFLICT DO NOTHING;

-- Seed: Default pipeline
INSERT INTO pipelines (tenant_id, name, is_default, currency)
VALUES (1, 'Main Sales Pipeline', TRUE, 'INR')
ON CONFLICT DO NOTHING;
