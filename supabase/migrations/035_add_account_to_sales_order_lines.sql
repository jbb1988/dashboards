-- Add account fields to sales order lines for product type derivation
-- This enables grouping SO lines by product type (TBEN, MCC, etc.)

ALTER TABLE netsuite_sales_order_lines
  ADD COLUMN account_id VARCHAR(50),
  ADD COLUMN account_number VARCHAR(20),
  ADD COLUMN account_name VARCHAR(255);

-- Index for fast product type queries
CREATE INDEX idx_ns_sol_account ON netsuite_sales_order_lines(account_number);

-- Add comments for documentation
COMMENT ON COLUMN netsuite_sales_order_lines.account_id
  IS 'NetSuite internal ID for the revenue account';

COMMENT ON COLUMN netsuite_sales_order_lines.account_number
  IS 'Revenue account number used to derive product type (TBEN, MCC, etc.)';

COMMENT ON COLUMN netsuite_sales_order_lines.account_name
  IS 'Full name of the revenue account';
