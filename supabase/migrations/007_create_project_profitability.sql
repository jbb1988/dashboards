-- Project Profitability Dashboard Tables
-- Stores transaction-level profitability data from NetSuite for TB/MCC projects
-- Replaces Excel-based closeout dashboard with live NetSuite data

-- =====================================================
-- Table: project_profitability
-- Purpose: Store transaction-level revenue and COGS for project profitability analysis
-- =====================================================
CREATE TABLE IF NOT EXISTS project_profitability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- NetSuite identifiers
  netsuite_transaction_id VARCHAR(50) NOT NULL,
  netsuite_line_id VARCHAR(50),
  transaction_number VARCHAR(50),
  transaction_type VARCHAR(50),              -- Invoice, Bill, Credit Memo, etc.

  -- Date fields
  transaction_date DATE NOT NULL,
  posting_period VARCHAR(20),                -- e.g., "Jan 2025"
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,

  -- Project (Customer = Project in this context)
  customer_id VARCHAR(50),
  customer_name VARCHAR(255) NOT NULL,

  -- Classification (TB, MCC, TBEN, etc.)
  class_id VARCHAR(50),
  class_name VARCHAR(255),
  project_type VARCHAR(50),                  -- MCC, TBEN, TB, etc. (parsed from class)

  -- Account (determines Revenue vs COGS)
  account_id VARCHAR(50),
  account_number VARCHAR(20),
  account_name VARCHAR(255),
  account_type VARCHAR(50),
  is_revenue BOOLEAN DEFAULT FALSE,          -- Account 4xxx = revenue
  is_cogs BOOLEAN DEFAULT FALSE,             -- Account 5xxx = COGS

  -- Amounts
  amount DECIMAL(15,2) DEFAULT 0,
  quantity DECIMAL(15,4) DEFAULT 0,

  -- Item details
  item_id VARCHAR(50),
  item_name VARCHAR(255),
  item_description TEXT,

  -- Audit timestamps
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint on transaction + line
  UNIQUE(netsuite_transaction_id, netsuite_line_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pp_transaction_date ON project_profitability(transaction_date);
CREATE INDEX IF NOT EXISTS idx_pp_year_month ON project_profitability(year, month);
CREATE INDEX IF NOT EXISTS idx_pp_customer_id ON project_profitability(customer_id);
CREATE INDEX IF NOT EXISTS idx_pp_customer_name ON project_profitability(customer_name);
CREATE INDEX IF NOT EXISTS idx_pp_project_type ON project_profitability(project_type);
CREATE INDEX IF NOT EXISTS idx_pp_class_name ON project_profitability(class_name);
CREATE INDEX IF NOT EXISTS idx_pp_account_number ON project_profitability(account_number);

-- Partial indexes for common filters
CREATE INDEX IF NOT EXISTS idx_pp_revenue ON project_profitability(year, month, customer_name) WHERE is_revenue = TRUE;
CREATE INDEX IF NOT EXISTS idx_pp_cogs ON project_profitability(year, month, customer_name) WHERE is_cogs = TRUE;

-- Composite indexes for aggregation queries
CREATE INDEX IF NOT EXISTS idx_pp_year_customer_type ON project_profitability(year, customer_name, project_type);
CREATE INDEX IF NOT EXISTS idx_pp_year_type ON project_profitability(year, project_type);

-- =====================================================
-- Table: project_budgets
-- Purpose: Store budget data for variance analysis
-- =====================================================
CREATE TABLE IF NOT EXISTS project_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Budget period
  year INTEGER NOT NULL,

  -- Project
  customer_name VARCHAR(255) NOT NULL,
  project_type VARCHAR(100),

  -- Budget metrics
  budget_revenue DECIMAL(15,2) DEFAULT 0,
  budget_cogs DECIMAL(15,2) DEFAULT 0,
  budget_gp DECIMAL(15,2) DEFAULT 0,

  -- Notes and metadata
  notes TEXT,

  -- Audit timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by VARCHAR(255),

  -- Unique constraint: one budget per project per year
  UNIQUE(year, customer_name)
);

-- Indexes for budget queries
CREATE INDEX IF NOT EXISTS idx_pb_year ON project_budgets(year);
CREATE INDEX IF NOT EXISTS idx_pb_customer ON project_budgets(customer_name);
CREATE INDEX IF NOT EXISTS idx_pb_type ON project_budgets(project_type);

-- =====================================================
-- Table: project_profitability_sync_log
-- Purpose: Track sync history for auditing and debugging
-- =====================================================
CREATE TABLE IF NOT EXISTS project_profitability_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type VARCHAR(20) NOT NULL,            -- 'full', 'delta'
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'running',      -- 'running', 'completed', 'failed'
  records_fetched INTEGER DEFAULT 0,
  records_upserted INTEGER DEFAULT 0,
  records_deleted INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB
);

-- Index for recent syncs
CREATE INDEX IF NOT EXISTS idx_sync_log_started ON project_profitability_sync_log(started_at DESC);

-- =====================================================
-- Trigger: Auto-update updated_at timestamp
-- =====================================================
CREATE OR REPLACE FUNCTION update_project_profitability_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_project_profitability_updated_at
  BEFORE UPDATE ON project_profitability
  FOR EACH ROW
  EXECUTE FUNCTION update_project_profitability_updated_at();

CREATE TRIGGER trigger_project_budgets_updated_at
  BEFORE UPDATE ON project_budgets
  FOR EACH ROW
  EXECUTE FUNCTION update_project_profitability_updated_at();

-- =====================================================
-- Row Level Security (RLS)
-- =====================================================
ALTER TABLE project_profitability ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_profitability_sync_log ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all data
CREATE POLICY "Authenticated users can read project_profitability"
  ON project_profitability FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read project_budgets"
  ON project_budgets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read sync_log"
  ON project_profitability_sync_log FOR SELECT
  TO authenticated
  USING (true);

-- Service role has full access
CREATE POLICY "Service role has full access to project_profitability"
  ON project_profitability FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to project_budgets"
  ON project_budgets FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to sync_log"
  ON project_profitability_sync_log FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to manage budgets (for manual entry)
CREATE POLICY "Authenticated users can manage project_budgets"
  ON project_budgets FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- Materialized View: project_profitability_summary
-- Purpose: Pre-aggregated data for fast dashboard loading
-- =====================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS project_profitability_summary AS
SELECT
  year,
  month,
  customer_name,
  project_type,
  class_name,
  SUM(CASE WHEN is_revenue THEN amount ELSE 0 END) as total_revenue,
  SUM(CASE WHEN is_cogs THEN ABS(amount) ELSE 0 END) as total_cogs,
  SUM(CASE WHEN is_revenue THEN amount ELSE 0 END) -
    SUM(CASE WHEN is_cogs THEN ABS(amount) ELSE 0 END) as gross_profit,
  COUNT(DISTINCT netsuite_transaction_id) as transaction_count,
  MAX(synced_at) as last_synced
FROM project_profitability
GROUP BY year, month, customer_name, project_type, class_name;

-- Index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_pps_unique
  ON project_profitability_summary(year, month, customer_name, COALESCE(project_type, ''), COALESCE(class_name, ''));

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_project_profitability_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY project_profitability_summary;
END;
$$ LANGUAGE plpgsql;
