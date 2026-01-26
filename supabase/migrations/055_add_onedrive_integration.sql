-- Migration: Add OneDrive integration fields to contract_reviews
-- This enables storing OneDrive file references for embedded document editing

-- Add OneDrive file tracking columns to contract_reviews
ALTER TABLE contract_reviews
ADD COLUMN IF NOT EXISTS onedrive_file_id TEXT,
ADD COLUMN IF NOT EXISTS onedrive_web_url TEXT,
ADD COLUMN IF NOT EXISTS onedrive_embed_url TEXT,
ADD COLUMN IF NOT EXISTS document_versions JSONB DEFAULT '[]'::jsonb;

-- Add comments for documentation
COMMENT ON COLUMN contract_reviews.onedrive_file_id IS 'OneDrive file ID for the uploaded document';
COMMENT ON COLUMN contract_reviews.onedrive_web_url IS 'Direct URL to view/download the document in OneDrive';
COMMENT ON COLUMN contract_reviews.onedrive_embed_url IS 'Embeddable URL for editing document in Office Online';
COMMENT ON COLUMN contract_reviews.document_versions IS 'Array of version history entries for the document';

-- Create index for efficient lookups by OneDrive file ID
CREATE INDEX IF NOT EXISTS idx_contract_reviews_onedrive
ON contract_reviews(onedrive_file_id)
WHERE onedrive_file_id IS NOT NULL;

-- Create index for finding reviews with OneDrive documents
CREATE INDEX IF NOT EXISTS idx_contract_reviews_has_onedrive
ON contract_reviews((onedrive_file_id IS NOT NULL))
WHERE onedrive_file_id IS NOT NULL;
