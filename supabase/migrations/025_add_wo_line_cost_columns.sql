-- Migration: Add cost detail columns to work order lines
-- These columns store transactionLine cost fields from NetSuite

ALTER TABLE netsuite_work_order_lines
  ADD COLUMN IF NOT EXISTS cost_estimate DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS est_gross_profit DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS est_gross_profit_pct DECIMAL(10,4),
  ADD COLUMN IF NOT EXISTS actual_cost DECIMAL(15,2);

COMMENT ON COLUMN netsuite_work_order_lines.cost_estimate IS 'Cost estimate from NetSuite transactionLine.costestimate';
COMMENT ON COLUMN netsuite_work_order_lines.est_gross_profit IS 'Estimated gross profit from NetSuite transactionLine.estgrossprofit';
COMMENT ON COLUMN netsuite_work_order_lines.est_gross_profit_pct IS 'Estimated gross profit percentage from NetSuite transactionLine.estgrossprofitpercent';
COMMENT ON COLUMN netsuite_work_order_lines.actual_cost IS 'Actual cost from Work Order Completion/Issue transactions (GL postings)';
