-- Clear all pending sync status that were created by SF pulls (not user edits)
-- These are false positives from before we fixed the trigger in migration 014
-- Run this AFTER deploying migration 014 and the code changes

UPDATE contracts
SET
  sf_sync_status = 'synced',
  sf_sync_pending_fields = NULL
WHERE sf_sync_status = 'pending';

-- Log how many were cleared
DO $$
DECLARE
  cleared_count integer;
BEGIN
  GET DIAGNOSTICS cleared_count = ROW_COUNT;
  RAISE NOTICE 'Cleared % false pending sync statuses', cleared_count;
END $$;
