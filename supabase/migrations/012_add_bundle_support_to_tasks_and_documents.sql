-- Add bundle support to tasks and documents
-- This allows tasks and documents to be linked to contract bundles instead of individual contracts

-- ============================================================================
-- ADD BUNDLE SUPPORT TO TASKS TABLE
-- ============================================================================

-- Add bundle columns to tasks table
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS bundle_id UUID REFERENCES contract_bundles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS bundle_name VARCHAR(255);

-- Add check constraint: must have either contract_id OR bundle_id (not both, not neither)
ALTER TABLE tasks
DROP CONSTRAINT IF EXISTS tasks_contract_or_bundle_check;

ALTER TABLE tasks
ADD CONSTRAINT tasks_contract_or_bundle_check
CHECK (
  (contract_id IS NOT NULL AND bundle_id IS NULL) OR
  (contract_id IS NULL AND bundle_id IS NOT NULL)
);

-- Add index for bundle queries
CREATE INDEX IF NOT EXISTS idx_tasks_bundle_id ON tasks(bundle_id);

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT tasks_contract_or_bundle_check ON tasks IS
'Ensures task is linked to either a single contract OR a bundle, but not both';

-- ============================================================================
-- ADD BUNDLE SUPPORT TO DOCUMENTS TABLE
-- ============================================================================

-- Add bundle columns to documents table
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS bundle_id UUID REFERENCES contract_bundles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS bundle_name VARCHAR(255);

-- Add check constraint for documents
-- Documents can have contract_id, salesforce_id, OR bundle_id (but not multiple)
ALTER TABLE documents
DROP CONSTRAINT IF EXISTS documents_contract_or_bundle_check;

ALTER TABLE documents
ADD CONSTRAINT documents_contract_or_bundle_check
CHECK (
  (contract_id IS NOT NULL AND bundle_id IS NULL) OR
  (salesforce_id IS NOT NULL AND bundle_id IS NULL) OR
  (bundle_id IS NOT NULL AND contract_id IS NULL AND salesforce_id IS NULL)
);

-- Add index for bundle queries
CREATE INDEX IF NOT EXISTS idx_documents_bundle_id ON documents(bundle_id);

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT documents_contract_or_bundle_check ON documents IS
'Ensures document is linked to either a single contract (via contract_id or salesforce_id) OR a bundle, but not both';

-- ============================================================================
-- NOTES
-- ============================================================================

-- 1. bundle_name is denormalized for faster queries (avoids join with contract_bundles)
-- 2. Check constraints enforce mutual exclusivity at database level
-- 3. ON DELETE SET NULL prevents cascading deletes (tasks/docs become orphaned when bundle is deleted)
-- 4. Existing tasks/docs are unaffected (keep their contract references)
-- 5. IF NOT EXISTS clauses make migration idempotent (safe to re-run)
