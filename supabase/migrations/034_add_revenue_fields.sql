-- Add revenue recognition date fields to sales order lines
-- These fields help identify multi-year contracts (MCC maintenance, M3 software)

ALTER TABLE netsuite_sales_order_lines
  ADD COLUMN IF NOT EXISTS revrecstartdate DATE,
  ADD COLUMN IF NOT EXISTS revrecenddate DATE;

-- Add index on revrecenddate for efficient queries
CREATE INDEX IF NOT EXISTS idx_sol_revrecenddate
  ON netsuite_sales_order_lines(revrecenddate)
  WHERE revrecenddate IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN netsuite_sales_order_lines.revrecstartdate IS 'Revenue recognition start date from NetSuite';
COMMENT ON COLUMN netsuite_sales_order_lines.revrecenddate IS 'Revenue recognition end date from NetSuite';
