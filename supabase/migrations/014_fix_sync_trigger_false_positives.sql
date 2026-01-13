-- Fix database trigger to prevent false "pending sync" status when pulling FROM Salesforce
-- The issue: Trigger fired on ALL updates, including SF pulls, marking them as "pending to push back"
-- The solution: Check session variable to detect if update is from sync operation

CREATE OR REPLACE FUNCTION mark_contract_pending_sync()
RETURNS TRIGGER AS $$
DECLARE
  is_sync_op text;
BEGIN
  -- Check if this is a sync operation (set by sync API via SET LOCAL)
  -- Using current_setting with 'true' flag returns NULL if not set (no error)
  is_sync_op := current_setting('app.is_sync_operation', true);

  -- Only mark as pending if NOT a sync operation
  IF COALESCE(is_sync_op, 'false') = 'false' THEN

    -- Mark manual status override when status is changed by user (not by SF sync)
    IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
      IF OLD.sf_last_pulled_at = NEW.sf_last_pulled_at OR NEW.sf_last_pulled_at IS NULL THEN
        NEW.manual_status_override = TRUE;
      END IF;
    END IF;

    -- Track DATE field changes (only for user edits, not sync pulls)
    IF TG_OP = 'UPDATE' AND (
      OLD.award_date IS DISTINCT FROM NEW.award_date OR
      OLD.contract_date IS DISTINCT FROM NEW.contract_date OR
      OLD.deliver_date IS DISTINCT FROM NEW.deliver_date OR
      OLD.install_date IS DISTINCT FROM NEW.install_date OR
      OLD.cash_date IS DISTINCT FROM NEW.cash_date
    ) THEN
      NEW.sf_sync_pending_fields = COALESCE(NEW.sf_sync_pending_fields, '{}'::jsonb);

      IF OLD.award_date IS DISTINCT FROM NEW.award_date THEN
        NEW.sf_sync_pending_fields = NEW.sf_sync_pending_fields || jsonb_build_object('award_date', NEW.award_date);
      END IF;
      IF OLD.contract_date IS DISTINCT FROM NEW.contract_date THEN
        NEW.sf_sync_pending_fields = NEW.sf_sync_pending_fields || jsonb_build_object('contract_date', NEW.contract_date);
      END IF;
      IF OLD.deliver_date IS DISTINCT FROM NEW.deliver_date THEN
        NEW.sf_sync_pending_fields = NEW.sf_sync_pending_fields || jsonb_build_object('deliver_date', NEW.deliver_date);
      END IF;
      IF OLD.install_date IS DISTINCT FROM NEW.install_date THEN
        NEW.sf_sync_pending_fields = NEW.sf_sync_pending_fields || jsonb_build_object('install_date', NEW.install_date);
      END IF;
      IF OLD.cash_date IS DISTINCT FROM NEW.cash_date THEN
        NEW.sf_sync_pending_fields = NEW.sf_sync_pending_fields || jsonb_build_object('cash_date', NEW.cash_date);
      END IF;

      NEW.sf_sync_status = 'pending';
    END IF;

  END IF;  -- End of "if not sync operation" check

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Comment explaining the fix
COMMENT ON FUNCTION mark_contract_pending_sync() IS 'Tracks user edits to date fields and status for Salesforce sync. Skips marking as pending when app.is_sync_operation session variable is true (set by SF pull operations).';

-- Helper function to set the sync operation flag
-- This is called by the sync API before performing upserts
CREATE OR REPLACE FUNCTION set_sync_operation_flag()
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.is_sync_operation', 'true', true);  -- true = local to transaction
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION set_sync_operation_flag() IS 'Sets session variable to mark current transaction as a sync operation. Called by SF sync API before upsert.';
