-- Add reminder tracking columns to contract_reviews table
-- This enables automated reminder emails for pending approvals

ALTER TABLE contract_reviews
ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reminder_count INTEGER DEFAULT 0;

-- Add comments for documentation
COMMENT ON COLUMN contract_reviews.reminder_sent_at IS 'Timestamp when the last reminder email was sent';
COMMENT ON COLUMN contract_reviews.reminder_count IS 'Number of reminder emails sent for this review';

-- Index for efficient queries on pending reviews that need reminders
CREATE INDEX IF NOT EXISTS idx_contract_reviews_pending_reminders
ON contract_reviews(approval_status, created_at, reminder_sent_at)
WHERE approval_status = 'pending';
