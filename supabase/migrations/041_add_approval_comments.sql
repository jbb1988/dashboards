-- Create approval_comments table for threaded comments on contract review approvals
-- This enables back-and-forth conversation between submitter and approver

CREATE TABLE IF NOT EXISTS approval_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id UUID NOT NULL REFERENCES contract_reviews(id) ON DELETE CASCADE,
  author_email VARCHAR(255) NOT NULL,
  author_name VARCHAR(255),
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by review_id
CREATE INDEX IF NOT EXISTS idx_approval_comments_review_id ON approval_comments(review_id);

-- Index for sorting by created_at
CREATE INDEX IF NOT EXISTS idx_approval_comments_created_at ON approval_comments(created_at ASC);

-- Comments for documentation
COMMENT ON TABLE approval_comments IS 'Stores threaded comments on contract review approvals for discussion between submitter and approver';
COMMENT ON COLUMN approval_comments.review_id IS 'Reference to the contract review being discussed';
COMMENT ON COLUMN approval_comments.author_email IS 'Email of the person who wrote the comment';
COMMENT ON COLUMN approval_comments.author_name IS 'Display name of the comment author';
COMMENT ON COLUMN approval_comments.comment IS 'The comment text';
COMMENT ON COLUMN approval_comments.created_at IS 'Timestamp when the comment was created';
