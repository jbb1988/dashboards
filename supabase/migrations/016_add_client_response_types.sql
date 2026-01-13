-- Add new Client Response document types to document_type enum
-- Run this in Supabase SQL Editor or through migration

-- Add the new document type values to the enum
-- Note: PostgreSQL doesn't support removing enum values, only adding

-- Add Client Response - MARS STD WTC
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'Client Response - MARS STD WTC';

-- Add Client Response - MARS MCC TC
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'Client Response - MARS MCC TC';

-- Add Client Response - MARS EULA
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'Client Response - MARS EULA';

-- Note: 'Other' already exists in the enum from the initial migration
-- Note: The old 'Client Response' value will remain in the enum for backwards compatibility
-- Existing documents with 'Client Response' will continue to work
