-- Add Current Situation and Next Steps columns to contracts table
-- These fields sync to Salesforce's Current_Situation__c and Next_Steps__c
-- Both fields receive the same value from the single "CS/NS" UI field

-- Add columns to contracts table
ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS current_situation TEXT,
ADD COLUMN IF NOT EXISTS next_steps TEXT;

-- Add comments for documentation
COMMENT ON COLUMN contracts.current_situation IS 'Current situation for Salesforce sync (Current_Situation__c). Populated from CS/NS field in UI. Max 255 chars.';
COMMENT ON COLUMN contracts.next_steps IS 'Next steps for Salesforce sync (Next_Steps__c). Populated from CS/NS field in UI. Max 255 chars.';

-- Update the mark_contract_pending_sync() trigger function to track these new fields
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

    -- Track DATE field changes AND text field changes (current_situation, next_steps)
    IF TG_OP = 'UPDATE' AND (
      OLD.award_date IS DISTINCT FROM NEW.award_date OR
      OLD.contract_date IS DISTINCT FROM NEW.contract_date OR
      OLD.deliver_date IS DISTINCT FROM NEW.deliver_date OR
      OLD.install_date IS DISTINCT FROM NEW.install_date OR
      OLD.cash_date IS DISTINCT FROM NEW.cash_date OR
      OLD.current_situation IS DISTINCT FROM NEW.current_situation OR
      OLD.next_steps IS DISTINCT FROM NEW.next_steps
    ) THEN
      NEW.sf_sync_pending_fields = COALESCE(NEW.sf_sync_pending_fields, '{}'::jsonb);

      -- Track date fields
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

      -- Track current_situation and next_steps fields
      IF OLD.current_situation IS DISTINCT FROM NEW.current_situation THEN
        NEW.sf_sync_pending_fields = NEW.sf_sync_pending_fields || jsonb_build_object('current_situation', NEW.current_situation);
      END IF;
      IF OLD.next_steps IS DISTINCT FROM NEW.next_steps THEN
        NEW.sf_sync_pending_fields = NEW.sf_sync_pending_fields || jsonb_build_object('next_steps', NEW.next_steps);
      END IF;

      NEW.sf_sync_status = 'pending';
    END IF;

  END IF;  -- End of "if not sync operation" check

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update function comment
COMMENT ON FUNCTION mark_contract_pending_sync() IS 'Tracks user edits to date fields, status, current_situation, and next_steps for Salesforce sync. Skips marking as pending when app.is_sync_operation session variable is true (set by SF pull operations).';
