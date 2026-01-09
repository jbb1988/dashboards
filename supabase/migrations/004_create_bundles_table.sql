-- Contract Bundles: Groups related contracts that share documents
-- Example: M3 + MCC + Hardware renewals that share the same master agreement

-- Create the bundles table
CREATE TABLE IF NOT EXISTS contract_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  account_name VARCHAR(255),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create the junction table for bundle-contract relationships
CREATE TABLE IF NOT EXISTS bundle_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id UUID NOT NULL REFERENCES contract_bundles(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT FALSE,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(bundle_id, contract_id)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_contract_bundles_account ON contract_bundles(account_name);
CREATE INDEX IF NOT EXISTS idx_bundle_contracts_bundle ON bundle_contracts(bundle_id);
CREATE INDEX IF NOT EXISTS idx_bundle_contracts_contract ON bundle_contracts(contract_id);

-- Enable RLS (Row Level Security)
ALTER TABLE contract_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundle_contracts ENABLE ROW LEVEL SECURITY;

-- Create policies for read access (allow all authenticated reads for now)
CREATE POLICY "Allow read access to contract_bundles" ON contract_bundles
  FOR SELECT USING (true);

CREATE POLICY "Allow read access to bundle_contracts" ON bundle_contracts
  FOR SELECT USING (true);

-- Create policies for write access
CREATE POLICY "Allow insert to contract_bundles" ON contract_bundles
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update to contract_bundles" ON contract_bundles
  FOR UPDATE USING (true);

CREATE POLICY "Allow delete from contract_bundles" ON contract_bundles
  FOR DELETE USING (true);

CREATE POLICY "Allow insert to bundle_contracts" ON bundle_contracts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update to bundle_contracts" ON bundle_contracts
  FOR UPDATE USING (true);

CREATE POLICY "Allow delete from bundle_contracts" ON bundle_contracts
  FOR DELETE USING (true);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_contract_bundles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_contract_bundles_timestamp
  BEFORE UPDATE ON contract_bundles
  FOR EACH ROW
  EXECUTE FUNCTION update_contract_bundles_updated_at();

-- Comment on tables
COMMENT ON TABLE contract_bundles IS 'Groups related contracts that share documents (e.g., M3 + MCC renewals)';
COMMENT ON TABLE bundle_contracts IS 'Junction table linking contracts to bundles';
COMMENT ON COLUMN bundle_contracts.is_primary IS 'Primary contract in the bundle - documents uploaded here are the "source of truth"';
