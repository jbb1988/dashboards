-- Migration: Create PandaDoc Documents Table
-- Purpose: Store approved proposals and order forms from PandaDoc

CREATE TABLE IF NOT EXISTS pandadoc_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pandadoc_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    document_type TEXT NOT NULL CHECK (document_type IN ('proposal', 'order_form')),
    status TEXT NOT NULL,
    date_created TIMESTAMPTZ,
    date_modified TIMESTAMPTZ,
    date_completed TIMESTAMPTZ,
    expiration_date TIMESTAMPTZ,

    -- Recipient info
    recipient_email TEXT,
    recipient_name TEXT,
    recipient_company TEXT,

    -- PDF storage
    pdf_url TEXT,
    pdf_storage_path TEXT,

    -- Metadata from PandaDoc
    template_id TEXT,
    template_name TEXT,
    folder_uuid TEXT,
    metadata JSONB DEFAULT '{}',

    -- Slack notification tracking
    slack_notified_at TIMESTAMPTZ,
    slack_message_ts TEXT,

    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX idx_pandadoc_documents_type ON pandadoc_documents(document_type);
CREATE INDEX idx_pandadoc_documents_status ON pandadoc_documents(status);
CREATE INDEX idx_pandadoc_documents_pandadoc_id ON pandadoc_documents(pandadoc_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_pandadoc_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pandadoc_documents_updated_at
    BEFORE UPDATE ON pandadoc_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_pandadoc_documents_updated_at();

-- Enable RLS
ALTER TABLE pandadoc_documents ENABLE ROW LEVEL SECURITY;

-- Policy for service role (edge functions)
CREATE POLICY "Service role full access" ON pandadoc_documents
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Policy for authenticated users to read
CREATE POLICY "Authenticated users can read" ON pandadoc_documents
    FOR SELECT
    USING (auth.role() = 'authenticated');

COMMENT ON TABLE pandadoc_documents IS 'Stores approved proposals and order forms from PandaDoc for contract pipeline';
