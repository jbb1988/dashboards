-- Create contracts table for storing Salesforce opportunity data
-- Run this in the Supabase SQL Editor

CREATE TABLE IF NOT EXISTS contracts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  salesforce_id VARCHAR(18) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  opportunity_name VARCHAR(255),
  account_name VARCHAR(255),
  value DECIMAL(15, 2) DEFAULT 0,
  status VARCHAR(100) DEFAULT 'Discussions Not Started',
  status_group VARCHAR(50) DEFAULT 'gray',
  sales_stage VARCHAR(20),
  contract_type TEXT[] DEFAULT '{}',
  close_date DATE,
  award_date DATE,
  contract_date DATE,
  install_date DATE,
  sales_rep VARCHAR(255) DEFAULT 'Unassigned',
  probability INTEGER DEFAULT 0,
  budgeted BOOLEAN DEFAULT FALSE,
  manual_close_probability DECIMAL(5, 2),
  is_closed BOOLEAN DEFAULT FALSE,
  is_won BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on salesforce_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_contracts_salesforce_id ON contracts(salesforce_id);

-- Create index on close_date for date-based queries
CREATE INDEX IF NOT EXISTS idx_contracts_close_date ON contracts(close_date);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);

-- Create index on is_closed for filtering active contracts
CREATE INDEX IF NOT EXISTS idx_contracts_is_closed ON contracts(is_closed);

-- Enable Row Level Security (RLS)
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to read contracts
CREATE POLICY "Authenticated users can read contracts"
  ON contracts
  FOR SELECT
  TO authenticated
  USING (true);

-- Create policy for service role to manage contracts (for sync operations)
CREATE POLICY "Service role can manage contracts"
  ON contracts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Comment on table
COMMENT ON TABLE contracts IS 'Stores Salesforce opportunity data synced for the contracts dashboard';
