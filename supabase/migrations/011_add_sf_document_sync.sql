-- Add Salesforce Files sync tracking fields to documents table
-- These fields track when documents are pushed to Salesforce

ALTER TABLE documents ADD COLUMN IF NOT EXISTS sf_content_document_id VARCHAR(18);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS sf_synced_at TIMESTAMPTZ;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS sf_sync_error TEXT;

-- Index for quick lookup of synced/unsynced documents
CREATE INDEX IF NOT EXISTS idx_documents_sf_sync ON documents (sf_content_document_id) WHERE sf_content_document_id IS NOT NULL;

-- Comments for documentation
COMMENT ON COLUMN documents.sf_content_document_id IS 'Salesforce ContentDocument ID after file is synced';
COMMENT ON COLUMN documents.sf_synced_at IS 'Timestamp when document was last synced to Salesforce';
COMMENT ON COLUMN documents.sf_sync_error IS 'Error message if last sync attempt failed';
