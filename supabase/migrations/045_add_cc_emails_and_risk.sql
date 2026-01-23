-- Add cc_emails column to contract_reviews table for CC/Copy Others feature
-- CC'd parties receive notification emails and can view (read-only) but not approve

ALTER TABLE contract_reviews
ADD COLUMN IF NOT EXISTS cc_emails TEXT[];

-- Add cc_token column for read-only access links
ALTER TABLE contract_reviews
ADD COLUMN IF NOT EXISTS cc_token TEXT;

-- Add cc_viewed_at to track when CC'd parties view the document
ALTER TABLE contract_reviews
ADD COLUMN IF NOT EXISTS cc_viewed_at TIMESTAMPTZ;

-- Add cc_viewed_by to track which CC'd parties have viewed
ALTER TABLE contract_reviews
ADD COLUMN IF NOT EXISTS cc_viewed_by TEXT[];

-- Add risk_scores JSONB column to store risk classification for each section
-- Format: { sections: [{ sectionTitle: string, riskLevel: 'high' | 'medium' | 'low' }], summary: { high: number, medium: number, low: number } }
ALTER TABLE contract_reviews
ADD COLUMN IF NOT EXISTS risk_scores JSONB;

-- Add comments for documentation
COMMENT ON COLUMN contract_reviews.cc_emails IS 'Array of email addresses to CC on approval notifications (read-only access)';
COMMENT ON COLUMN contract_reviews.cc_token IS 'Token for CC recipients to access read-only view';
COMMENT ON COLUMN contract_reviews.cc_viewed_at IS 'Timestamp when a CC recipient first viewed the document';
COMMENT ON COLUMN contract_reviews.cc_viewed_by IS 'Array of CC email addresses that have viewed the document';
COMMENT ON COLUMN contract_reviews.risk_scores IS 'Risk classification for AI-suggested changes (high/medium/low)';

-- Create index for cc_token lookups
CREATE INDEX IF NOT EXISTS idx_contract_reviews_cc_token ON contract_reviews(cc_token);
