-- Add reviewer_notes column to contract_reviews table
-- This stores notes added by the contract reviewer when sending for approval

ALTER TABLE contract_reviews
ADD COLUMN IF NOT EXISTS reviewer_notes TEXT;

-- Add a comment explaining the column
COMMENT ON COLUMN contract_reviews.reviewer_notes IS 'Optional notes from the contract reviewer to provide context for the approver';
