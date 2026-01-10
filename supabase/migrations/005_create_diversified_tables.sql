-- Diversified Sales Dashboard Tables
-- Stores transaction-level sales data from NetSuite for Diversified Products

-- =====================================================
-- Table: diversified_sales
-- Purpose: Store transaction-level sales data for diversified products
-- =====================================================
CREATE TABLE IF NOT EXISTS diversified_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- NetSuite identifiers
  netsuite_transaction_id VARCHAR(50) NOT NULL,
  netsuite_line_id VARCHAR(50),
  transaction_type VARCHAR(50),           -- Invoice, Credit Memo, etc.
  transaction_number VARCHAR(50),

  -- Date fields
  transaction_date DATE NOT NULL,
  posting_period VARCHAR(20),             -- e.g., "Jan 2025"
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,

  -- Class hierarchy
  class_id VARCHAR(50),
  class_name VARCHAR(255) NOT NULL,       -- "Diversified Products : Strainers"
  class_category VARCHAR(100),            -- "Strainers" (parsed from class_name)
  parent_class VARCHAR(100),              -- "Diversified Products"

  -- Customer
  customer_id VARCHAR(50),
  customer_name VARCHAR(255),

  -- Account
  account_id VARCHAR(50),
  account_name VARCHAR(255),              -- "4140 Diversified Products"

  -- Metrics
  quantity INTEGER DEFAULT 0,
  revenue DECIMAL(15,2) DEFAULT 0,
  cost DECIMAL(15,2) DEFAULT 0,
  gross_profit DECIMAL(15,2) DEFAULT 0,
  gross_profit_pct DECIMAL(5,2) DEFAULT 0,

  -- Item details (optional, for deep drill-down)
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

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_diversified_transaction_date ON diversified_sales(transaction_date);
CREATE INDEX IF NOT EXISTS idx_diversified_year_month ON diversified_sales(year, month);
CREATE INDEX IF NOT EXISTS idx_diversified_class_name ON diversified_sales(class_name);
CREATE INDEX IF NOT EXISTS idx_diversified_class_category ON diversified_sales(class_category);
CREATE INDEX IF NOT EXISTS idx_diversified_customer_id ON diversified_sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_diversified_customer_name ON diversified_sales(customer_name);
CREATE INDEX IF NOT EXISTS idx_diversified_account_id ON diversified_sales(account_id);
CREATE INDEX IF NOT EXISTS idx_diversified_parent_class ON diversified_sales(parent_class);

-- Composite index for common aggregation queries
CREATE INDEX IF NOT EXISTS idx_diversified_year_class ON diversified_sales(year, class_name);
CREATE INDEX IF NOT EXISTS idx_diversified_year_customer ON diversified_sales(year, customer_id);

-- =====================================================
-- Table: diversified_budgets
-- Purpose: Store budget data for variance analysis
-- =====================================================
CREATE TABLE IF NOT EXISTS diversified_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Budget period
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,

  -- Class (matches diversified_sales.class_name)
  class_name VARCHAR(255) NOT NULL,
  class_category VARCHAR(100),

  -- Budget metrics
  budget_revenue DECIMAL(15,2) DEFAULT 0,
  budget_units INTEGER DEFAULT 0,
  budget_cost DECIMAL(15,2) DEFAULT 0,
  budget_gross_profit DECIMAL(15,2) DEFAULT 0,

  -- Notes and metadata
  notes TEXT,

  -- Audit timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by VARCHAR(255),

  -- Unique constraint: one budget per class per month
  UNIQUE(year, month, class_name)
);

-- Indexes for budget queries
CREATE INDEX IF NOT EXISTS idx_budget_year_month ON diversified_budgets(year, month);
CREATE INDEX IF NOT EXISTS idx_budget_class ON diversified_budgets(class_name);

-- =====================================================
-- Trigger: Auto-update updated_at timestamp
-- =====================================================
CREATE OR REPLACE FUNCTION update_diversified_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_diversified_sales_updated_at
  BEFORE UPDATE ON diversified_sales
  FOR EACH ROW
  EXECUTE FUNCTION update_diversified_updated_at();

CREATE TRIGGER trigger_diversified_budgets_updated_at
  BEFORE UPDATE ON diversified_budgets
  FOR EACH ROW
  EXECUTE FUNCTION update_diversified_updated_at();

-- =====================================================
-- Row Level Security (RLS)
-- =====================================================
ALTER TABLE diversified_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE diversified_budgets ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all data
CREATE POLICY "Authenticated users can read diversified_sales"
  ON diversified_sales FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read diversified_budgets"
  ON diversified_budgets FOR SELECT
  TO authenticated
  USING (true);

-- Service role has full access
CREATE POLICY "Service role has full access to diversified_sales"
  ON diversified_sales FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to diversified_budgets"
  ON diversified_budgets FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to insert/update budgets (for manual entry)
CREATE POLICY "Authenticated users can manage diversified_budgets"
  ON diversified_budgets FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
