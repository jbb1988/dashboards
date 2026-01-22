-- Migration: Create PandaDoc Config Table for Token Storage
-- Purpose: Store PandaDoc API token centrally so it can be refreshed automatically

CREATE TABLE IF NOT EXISTS pandadoc_config (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- Only one row allowed
    api_token TEXT NOT NULL,
    token_expires_at TIMESTAMPTZ NOT NULL,
    login_email TEXT NOT NULL,
    last_refreshed_at TIMESTAMPTZ DEFAULT NOW(),
    refresh_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert initial token (will be updated by refresh script)
INSERT INTO pandadoc_config (api_token, token_expires_at, login_email)
VALUES (
    'ee874f2db1f2a8d296e360b0d8ec11b2843b6a29',
    NOW() + INTERVAL '10 days',
    'jbutt@marswater.com'
) ON CONFLICT (id) DO NOTHING;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_pandadoc_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pandadoc_config_updated_at
    BEFORE UPDATE ON pandadoc_config
    FOR EACH ROW
    EXECUTE FUNCTION update_pandadoc_config_updated_at();

-- Enable RLS
ALTER TABLE pandadoc_config ENABLE ROW LEVEL SECURITY;

-- Only service role can access
CREATE POLICY "Service role full access" ON pandadoc_config
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE pandadoc_config IS 'Stores PandaDoc API token - refreshed automatically via cron';
