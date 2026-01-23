-- Add @mentions support to approval_comments table
-- This allows users to @mention other users in discussion comments

ALTER TABLE approval_comments
ADD COLUMN IF NOT EXISTS mentioned_emails TEXT[];

-- Index for efficient queries on mentioned emails (GIN index for array containment queries)
CREATE INDEX IF NOT EXISTS idx_comments_mentioned
ON approval_comments USING GIN (mentioned_emails);

-- Add comments for documentation
COMMENT ON COLUMN approval_comments.mentioned_emails IS 'Array of email addresses mentioned in this comment using @email syntax';
