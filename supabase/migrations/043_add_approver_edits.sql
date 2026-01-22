-- Add approver editing capabilities and activity log to contract_reviews table
-- This enables approvers to make inline edits and maintain an audit trail

-- Add column for storing approver's edited version of redlined text
ALTER TABLE contract_reviews
ADD COLUMN IF NOT EXISTS approver_edited_text TEXT;

-- Add column for activity log (JSONB array of timestamped events)
ALTER TABLE contract_reviews
ADD COLUMN IF NOT EXISTS activity_log JSONB DEFAULT '[]'::jsonb;

-- Comments for documentation
COMMENT ON COLUMN contract_reviews.approver_edited_text IS 'The redlined text after approver edits (null if no edits made)';
COMMENT ON COLUMN contract_reviews.activity_log IS 'JSON array of timestamped activity events for audit trail';

-- Example activity_log structure:
-- [
--   {
--     "action": "submitted",
--     "by": "legal@marswater.com",
--     "at": "2026-01-22T10:30:00Z"
--   },
--   {
--     "action": "edited",
--     "by": "jbutt@marswater.com",
--     "at": "2026-01-22T14:15:00Z",
--     "note": "Modified indemnity clause"
--   },
--   {
--     "action": "approved",
--     "by": "jbutt@marswater.com",
--     "at": "2026-01-22T14:20:00Z",
--     "feedback": "Looks good with my changes"
--   }
-- ]
