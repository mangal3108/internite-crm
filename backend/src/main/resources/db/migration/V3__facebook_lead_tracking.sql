-- Facebook Lead Ads tracking columns on leads table
ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS facebook_lead_id  VARCHAR(64),
    ADD COLUMN IF NOT EXISTS facebook_form_id  VARCHAR(64),
    ADD COLUMN IF NOT EXISTS facebook_ad_id    VARCHAR(64);

-- Unique index prevents duplicate ingestion of the same Facebook lead
CREATE UNIQUE INDEX IF NOT EXISTS uidx_lead_facebook_lead_id
    ON leads (facebook_lead_id)
    WHERE facebook_lead_id IS NOT NULL;

-- Index for fast form-level analytics
CREATE INDEX IF NOT EXISTS idx_lead_facebook_form_id
    ON leads (facebook_form_id)
    WHERE facebook_form_id IS NOT NULL;
