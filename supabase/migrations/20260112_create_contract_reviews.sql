-- Create contract_reviews table for storing AI contract analysis history
-- Run this migration in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS contract_reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    contract_id TEXT,
    contract_name TEXT,
    provision_name TEXT NOT NULL,
    original_text TEXT NOT NULL,
    redlined_text TEXT NOT NULL,
    modified_text TEXT,
    summary JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent_to_boss', 'sent_to_client', 'approved')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries by contract_id
CREATE INDEX IF NOT EXISTS idx_contract_reviews_contract_id ON contract_reviews(contract_id);

-- Create index for sorting by created_at
CREATE INDEX IF NOT EXISTS idx_contract_reviews_created_at ON contract_reviews(created_at DESC);

-- Enable Row Level Security (optional - disable if using service role key)
-- ALTER TABLE contract_reviews ENABLE ROW LEVEL SECURITY;

-- Grant access to authenticated users (if using RLS)
-- CREATE POLICY "Allow authenticated access" ON contract_reviews
--     FOR ALL
--     TO authenticated
--     USING (true)
--     WITH CHECK (true);

COMMENT ON TABLE contract_reviews IS 'Stores AI contract analysis history for the contract review feature';
COMMENT ON COLUMN contract_reviews.provision_name IS 'Name or identifier for the contract provision being reviewed';
COMMENT ON COLUMN contract_reviews.original_text IS 'The original contract text submitted for analysis';
COMMENT ON COLUMN contract_reviews.redlined_text IS 'The AI-generated redlined version with suggested changes';
COMMENT ON COLUMN contract_reviews.modified_text IS 'The clean modified text without markup';
COMMENT ON COLUMN contract_reviews.summary IS 'JSON array of summary points from the AI analysis';
COMMENT ON COLUMN contract_reviews.status IS 'Workflow status: draft, sent_to_boss, sent_to_client, or approved';
