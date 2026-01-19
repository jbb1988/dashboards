-- Migration: Add netsuite_expense_reports table
-- Purpose: Store expense report transactions from NetSuite for project cost tracking

CREATE TABLE netsuite_expense_reports (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- NetSuite Identifiers
  netsuite_id VARCHAR(50) NOT NULL UNIQUE,        -- NetSuite internal ID
  tranid VARCHAR(100) NOT NULL,                    -- Transaction number (e.g., EXPRPT123)

  -- Expense Report Details
  trandate DATE,                                   -- Transaction date
  posting_period VARCHAR(50),                      -- Posting period
  status VARCHAR(50),                              -- Status (Pending, Approved, Paid)
  memo TEXT,                                       -- Expense report memo

  -- Employee/Requestor
  employee_id VARCHAR(50),                         -- Employee NetSuite ID
  employee_name VARCHAR(255),                      -- Employee name

  -- Project/Job Links
  customer_id VARCHAR(50),                         -- Customer/Job NetSuite ID
  customer_name VARCHAR(255),                      -- Customer/Job name
  class_id VARCHAR(50),                            -- Class/Department
  class_name VARCHAR(100),                         -- Class name

  -- Related Transactions
  related_so_id VARCHAR(50),                       -- Linked Sales Order (if applicable)
  related_so_number VARCHAR(100),                  -- SO transaction number
  related_wo_id VARCHAR(50),                       -- Linked Work Order (if applicable)
  related_wo_number VARCHAR(100),                  -- WO transaction number

  -- Financial Summary
  total_amount DECIMAL(15,2),                      -- Total expense amount

  -- Location/Subsidiary
  subsidiary_id VARCHAR(50),
  subsidiary_name VARCHAR(100),
  location_id VARCHAR(50),
  location_name VARCHAR(100),

  -- Sync Metadata
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expense Report Line Items
CREATE TABLE netsuite_expense_report_lines (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Key to expense reports
  expense_report_id UUID NOT NULL REFERENCES netsuite_expense_reports(id) ON DELETE CASCADE,

  -- NetSuite Identifiers
  netsuite_line_id VARCHAR(50) NOT NULL,           -- NetSuite line ID
  line_number INTEGER,                             -- Line sequence

  -- Expense Details
  expense_date DATE,                               -- Date of expense
  category VARCHAR(100),                           -- Expense category (Travel, Meals, etc.)
  expense_account VARCHAR(50),                     -- GL account
  expense_account_name VARCHAR(255),               -- Account name

  -- Item/Description
  item_id VARCHAR(50),
  item_name VARCHAR(255),
  memo TEXT,                                       -- Line memo/description

  -- Amount
  amount DECIMAL(15,2),                            -- Line amount

  -- Project Links (can differ from header)
  customer_id VARCHAR(50),                         -- Customer/Job for this line
  customer_name VARCHAR(255),
  class_id VARCHAR(50),
  class_name VARCHAR(100),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint
  UNIQUE(expense_report_id, netsuite_line_id)
);

-- Indexes for netsuite_expense_reports
CREATE INDEX idx_ns_exprpt_tranid ON netsuite_expense_reports(tranid);
CREATE INDEX idx_ns_exprpt_date ON netsuite_expense_reports(trandate);
CREATE INDEX idx_ns_exprpt_customer ON netsuite_expense_reports(customer_id);
CREATE INDEX idx_ns_exprpt_employee ON netsuite_expense_reports(employee_id);
CREATE INDEX idx_ns_exprpt_so ON netsuite_expense_reports(related_so_number);
CREATE INDEX idx_ns_exprpt_wo ON netsuite_expense_reports(related_wo_number);

-- Indexes for netsuite_expense_report_lines
CREATE INDEX idx_ns_exprpt_lines_report ON netsuite_expense_report_lines(expense_report_id);
CREATE INDEX idx_ns_exprpt_lines_customer ON netsuite_expense_report_lines(customer_id);
CREATE INDEX idx_ns_exprpt_lines_account ON netsuite_expense_report_lines(expense_account);

-- Enable Row Level Security
ALTER TABLE netsuite_expense_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE netsuite_expense_report_lines ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow authenticated users to read
CREATE POLICY "Allow authenticated users to read netsuite_expense_reports"
  ON netsuite_expense_reports FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to read netsuite_expense_report_lines"
  ON netsuite_expense_report_lines FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policy: Allow service role full access
CREATE POLICY "Allow service role full access to netsuite_expense_reports"
  ON netsuite_expense_reports FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service role full access to netsuite_expense_report_lines"
  ON netsuite_expense_report_lines FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add comments
COMMENT ON TABLE netsuite_expense_reports IS 'Expense report transactions from NetSuite for project cost tracking';
COMMENT ON TABLE netsuite_expense_report_lines IS 'Line items from NetSuite expense reports';
COMMENT ON COLUMN netsuite_expense_reports.customer_id IS 'Customer/Job this expense is charged to';
COMMENT ON COLUMN netsuite_expense_reports.related_wo_number IS 'Work Order this expense is associated with';
COMMENT ON COLUMN netsuite_expense_report_lines.amount IS 'Expense line amount';
