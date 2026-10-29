ALTER TABLE communications
    ADD COLUMN IF NOT EXISTS contact_identifier VARCHAR(100),
    ADD COLUMN IF NOT EXISTS provider VARCHAR(50),
    ADD COLUMN IF NOT EXISTS raw_payload TEXT;

CREATE INDEX IF NOT EXISTS idx_communications_channel_contact_created
    ON communications(channel, contact_identifier, created_at);
