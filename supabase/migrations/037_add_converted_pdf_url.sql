-- Add converted_pdf_url column to documents table for caching Word document conversions
-- This allows us to store converted PDF URLs and avoid re-converting the same document

ALTER TABLE documents ADD COLUMN IF NOT EXISTS converted_pdf_url TEXT;

-- Add comment explaining the purpose
COMMENT ON COLUMN documents.converted_pdf_url IS 'Cached URL of DOCX converted to PDF with tracked changes visible. Used to avoid re-converting documents.';

-- Index for faster lookups when checking if document has been converted
CREATE INDEX IF NOT EXISTS idx_documents_converted_pdf ON documents(converted_pdf_url) WHERE converted_pdf_url IS NOT NULL;
