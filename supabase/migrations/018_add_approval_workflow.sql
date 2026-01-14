-- Add approval workflow columns to contract_reviews table
-- This enables automated approval workflow where legal team sends AI-analyzed contracts
-- to their boss for approval via email with token-based authentication

ALTER TABLE contract_reviews
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected', 'expired')),
ADD COLUMN IF NOT EXISTS approval_token UUID UNIQUE,
ADD COLUMN IF NOT EXISTS approver_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS approval_feedback TEXT,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS submitted_by_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

-- Add comments for documentation
COMMENT ON COLUMN contract_reviews.approval_status IS 'Approval status: pending (awaiting approval), approved (boss approved), rejected (boss rejected), expired (token expired)';
COMMENT ON COLUMN contract_reviews.approval_token IS 'Secure UUID token for token-based approval (no login required)';
COMMENT ON COLUMN contract_reviews.approver_email IS 'Email of admin who approved/rejected the contract';
COMMENT ON COLUMN contract_reviews.approval_feedback IS 'Optional feedback from approver (required for rejections)';
COMMENT ON COLUMN contract_reviews.approved_at IS 'Timestamp when approval decision was made';
COMMENT ON COLUMN contract_reviews.token_expires_at IS 'Token expiration timestamp (7 days from submission)';
COMMENT ON COLUMN contract_reviews.submitted_by_email IS 'Email of user who submitted for approval';
COMMENT ON COLUMN contract_reviews.submitted_at IS 'Timestamp when submitted for approval';

-- Index for fast token lookups (used in approval page)
CREATE INDEX IF NOT EXISTS idx_contract_reviews_approval_token ON contract_reviews(approval_token) WHERE approval_token IS NOT NULL;

-- Index for queue queries (pending/approved/rejected filters)
CREATE INDEX IF NOT EXISTS idx_contract_reviews_approval_status ON contract_reviews(approval_status, submitted_at DESC NULLS LAST);

-- Index for finding approved contracts (for badges on contract cards)
CREATE INDEX IF NOT EXISTS idx_contract_reviews_approved ON contract_reviews(contract_id, approval_status) WHERE approval_status = 'approved';
