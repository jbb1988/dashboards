-- Protect manual status updates from being overwritten by Salesforce sync
-- Adds a flag to track when status has been manually overridden

-- Add column to track manual status overrides
ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS manual_status_override BOOLEAN DEFAULT FALSE;

-- Create index for filtering contracts with manual overrides
CREATE INDEX IF NOT EXISTS idx_contracts_manual_status_override ON contracts(manual_status_override);

-- Update the sync tracking trigger to preserve manual status overrides
CREATE OR REPLACE FUNCTION mark_contract_pending_sync()
RETURNS TRIGGER AS $$
BEGIN
  -- Mark manual status override when status is changed
  -- (not from a Salesforce sync operation)
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    -- If this is a user edit (not a sync pull), mark it as manual override
    -- We detect sync pulls by checking if sf_last_pulled_at is being updated
    IF OLD.sf_last_pulled_at = NEW.sf_last_pulled_at OR NEW.sf_last_pulled_at IS NULL THEN
      NEW.manual_status_override = TRUE;
    END IF;
  END IF;

  -- Track DATE field changes for Salesforce push (existing logic)
  IF TG_OP = 'UPDATE' AND (
    OLD.award_date IS DISTINCT FROM NEW.award_date OR
    OLD.contract_date IS DISTINCT FROM NEW.contract_date OR
    OLD.deliver_date IS DISTINCT FROM NEW.deliver_date OR
    OLD.install_date IS DISTINCT FROM NEW.install_date OR
    OLD.cash_date IS DISTINCT FROM NEW.cash_date
  ) THEN
    -- Build the pending fields object
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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger with updated function
DROP TRIGGER IF EXISTS trigger_mark_contract_pending_sync ON contracts;
CREATE TRIGGER trigger_mark_contract_pending_sync
  BEFORE UPDATE ON contracts
  FOR EACH ROW
  EXECUTE FUNCTION mark_contract_pending_sync();

COMMENT ON COLUMN contracts.manual_status_override IS 'TRUE when status has been manually set by user and should not be overwritten by Salesforce sync';
