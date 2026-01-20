-- Migration: Add project budgets table
-- Purpose: Store budget data from NetSuite Budget vs Actuals report

CREATE TABLE IF NOT EXISTS netsuite_project_budgets (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Project Information
  project_name VARCHAR(255) NOT NULL,
  project_year INTEGER NOT NULL,
  customer_id VARCHAR(50),
  customer_name VARCHAR(255),

  -- Budget Amounts (4xxx accounts = Revenue)
  budget_revenue DECIMAL(15,2) DEFAULT 0,
  budget_revenue_detail JSONB, -- Breakdown by account

  -- Budget Costs (5xxx accounts = COGS)
  budget_cost DECIMAL(15,2) DEFAULT 0,
  budget_cost_detail JSONB, -- Breakdown by account

  -- Calculated Fields
  budget_gross_profit DECIMAL(15,2) GENERATED ALWAYS AS (budget_revenue - budget_cost) STORED,
  budget_gross_margin_pct DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE WHEN budget_revenue > 0
    THEN ((budget_revenue - budget_cost) / budget_revenue * 100)
    ELSE 0 END
  ) STORED,

  -- Metadata
  source_report VARCHAR(100) DEFAULT 'Budget vs Actuals (cr=492)',
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one budget per project per year
  UNIQUE(project_name, project_year)
);

-- Indexes
CREATE INDEX idx_project_budgets_name ON netsuite_project_budgets(project_name);
CREATE INDEX idx_project_budgets_year ON netsuite_project_budgets(project_year);
CREATE INDEX idx_project_budgets_name_year ON netsuite_project_budgets(project_name, project_year);

-- Enable Row Level Security
ALTER TABLE netsuite_project_budgets ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow authenticated users to read
CREATE POLICY "Allow authenticated users to read project budgets"
  ON netsuite_project_budgets FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policy: Allow service role full access
CREATE POLICY "Allow service role full access to project budgets"
  ON netsuite_project_budgets FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Comments
COMMENT ON TABLE netsuite_project_budgets IS 'Project budget data from NetSuite Budget vs Actuals report';
COMMENT ON COLUMN netsuite_project_budgets.budget_revenue IS 'Budget revenue from 4xxx accounts';
COMMENT ON COLUMN netsuite_project_budgets.budget_cost IS 'Budget cost from 5xxx accounts (COGS)';
COMMENT ON COLUMN netsuite_project_budgets.budget_revenue_detail IS 'JSON breakdown of revenue by account number';
COMMENT ON COLUMN netsuite_project_budgets.budget_cost_detail IS 'JSON breakdown of costs by account number';
