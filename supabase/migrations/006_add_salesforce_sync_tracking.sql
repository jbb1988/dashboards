-- Add Salesforce bidirectional sync tracking to contracts table
-- Tracks local changes that need to be pushed to Salesforce

-- Add sync tracking columns to contracts
ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS sf_sync_status VARCHAR(20) DEFAULT 'synced',
ADD COLUMN IF NOT EXISTS sf_sync_pending_fields JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS sf_last_pushed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS sf_last_pulled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- sf_sync_status values:
--   'synced' - local data matches Salesforce
--   'pending' - local changes need to be pushed
--   'error' - last push failed
--   'conflict' - both local and remote changed

-- sf_sync_pending_fields stores what fields changed locally, e.g.:
-- {"status": "Review & Redlines", "award_date": "2024-03-15"}

-- Create index for finding records that need sync
CREATE INDEX IF NOT EXISTS idx_contracts_sf_sync_status ON contracts(sf_sync_status);

-- Create a table to track sync history/audit log
CREATE TABLE IF NOT EXISTS salesforce_sync_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  salesforce_id VARCHAR(18) NOT NULL,
  action VARCHAR(50) NOT NULL, -- 'push', 'pull', 'push_failed'
  fields_changed JSONB DEFAULT '{}',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(255) -- user who initiated sync
);

-- Index for querying sync history by contract
CREATE INDEX IF NOT EXISTS idx_sync_log_contract_id ON salesforce_sync_log(contract_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_created_at ON salesforce_sync_log(created_at);

-- Enable RLS on sync log
ALTER TABLE salesforce_sync_log ENABLE ROW LEVEL SECURITY;

-- Policies for sync log
CREATE POLICY "Authenticated users can read sync log"
  ON salesforce_sync_log
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage sync log"
  ON salesforce_sync_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to mark a contract as having pending changes
CREATE OR REPLACE FUNCTION mark_contract_pending_sync()
RETURNS TRIGGER AS $$
BEGIN
  -- Only mark as pending if tracking columns weren't the ones changed
  IF TG_OP = 'UPDATE' AND (
    OLD.status IS DISTINCT FROM NEW.status OR
    OLD.award_date IS DISTINCT FROM NEW.award_date OR
    OLD.contract_date IS DISTINCT FROM NEW.contract_date OR
    OLD.install_date IS DISTINCT FROM NEW.install_date OR
    OLD.value IS DISTINCT FROM NEW.value OR
    OLD.probability IS DISTINCT FROM NEW.probability OR
    OLD.budgeted IS DISTINCT FROM NEW.budgeted OR
    OLD.manual_close_probability IS DISTINCT FROM NEW.manual_close_probability
  ) THEN
    -- Build the pending fields object
    NEW.sf_sync_pending_fields = COALESCE(NEW.sf_sync_pending_fields, '{}'::jsonb);

    IF OLD.status IS DISTINCT FROM NEW.status THEN
      NEW.sf_sync_pending_fields = NEW.sf_sync_pending_fields || jsonb_build_object('status', NEW.status);
    END IF;
    IF OLD.award_date IS DISTINCT FROM NEW.award_date THEN
      NEW.sf_sync_pending_fields = NEW.sf_sync_pending_fields || jsonb_build_object('award_date', NEW.award_date);
    END IF;
    IF OLD.contract_date IS DISTINCT FROM NEW.contract_date THEN
      NEW.sf_sync_pending_fields = NEW.sf_sync_pending_fields || jsonb_build_object('contract_date', NEW.contract_date);
    END IF;
    IF OLD.install_date IS DISTINCT FROM NEW.install_date THEN
      NEW.sf_sync_pending_fields = NEW.sf_sync_pending_fields || jsonb_build_object('install_date', NEW.install_date);
    END IF;
    IF OLD.value IS DISTINCT FROM NEW.value THEN
      NEW.sf_sync_pending_fields = NEW.sf_sync_pending_fields || jsonb_build_object('value', NEW.value);
    END IF;
    IF OLD.probability IS DISTINCT FROM NEW.probability THEN
      NEW.sf_sync_pending_fields = NEW.sf_sync_pending_fields || jsonb_build_object('probability', NEW.probability);
    END IF;
    IF OLD.budgeted IS DISTINCT FROM NEW.budgeted THEN
      NEW.sf_sync_pending_fields = NEW.sf_sync_pending_fields || jsonb_build_object('budgeted', NEW.budgeted);
    END IF;
    IF OLD.manual_close_probability IS DISTINCT FROM NEW.manual_close_probability THEN
      NEW.sf_sync_pending_fields = NEW.sf_sync_pending_fields || jsonb_build_object('manual_close_probability', NEW.manual_close_probability);
    END IF;

    NEW.sf_sync_status = 'pending';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically mark contracts as pending sync when edited
DROP TRIGGER IF EXISTS trigger_mark_contract_pending_sync ON contracts;
CREATE TRIGGER trigger_mark_contract_pending_sync
  BEFORE UPDATE ON contracts
  FOR EACH ROW
  EXECUTE FUNCTION mark_contract_pending_sync();

COMMENT ON TABLE salesforce_sync_log IS 'Audit log of all Salesforce sync operations';
COMMENT ON COLUMN contracts.sf_sync_status IS 'Sync status: synced, pending, error, conflict';
COMMENT ON COLUMN contracts.sf_sync_pending_fields IS 'JSON of fields changed locally that need push';
