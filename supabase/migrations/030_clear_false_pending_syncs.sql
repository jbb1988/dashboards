-- Clear false "pending sync" status that was created before fix
-- These were incorrectly marked as pending when pulling FROM Salesforce
-- The fix in migration 029 prevents this from happening in the future

-- First, show how many will be cleared
DO $$
DECLARE
  pending_count integer;
BEGIN
  SELECT COUNT(*) INTO pending_count
  FROM contracts
  WHERE sf_sync_status = 'pending';

  RAISE NOTICE 'Found % contracts with pending sync status to clear', pending_count;
END $$;

-- Clear all pending sync statuses
-- These are false positives from before the fix was applied
UPDATE contracts
SET
  sf_sync_status = 'synced',
  sf_sync_pending_fields = '{}'::jsonb
WHERE sf_sync_status = 'pending';
