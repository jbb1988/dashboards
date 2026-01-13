-- Fix document duplication issue by adding unique constraint
-- This prevents multiple documents of the same type from being marked as current for the same contract

-- Add a unique partial index to ensure only one current version per document type per contract
-- This works for both contract_id and salesforce_id
CREATE UNIQUE INDEX idx_documents_unique_current_version_contract
  ON documents(contract_id, document_type)
  WHERE is_current_version = TRUE AND contract_id IS NOT NULL;

CREATE UNIQUE INDEX idx_documents_unique_current_version_salesforce
  ON documents(salesforce_id, document_type)
  WHERE is_current_version = TRUE AND salesforce_id IS NOT NULL;

-- Add comment explaining the constraint
COMMENT ON INDEX idx_documents_unique_current_version_contract IS
  'Ensures only one current version per document type per contract_id';
COMMENT ON INDEX idx_documents_unique_current_version_salesforce IS
  'Ensures only one current version per document type per salesforce_id';
