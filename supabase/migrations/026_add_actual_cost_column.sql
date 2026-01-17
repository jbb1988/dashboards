-- Migration: Add actual_cost column to work order lines
-- Stores actual cost from Work Order Completion/Issue transactions

ALTER TABLE netsuite_work_order_lines
  ADD COLUMN IF NOT EXISTS actual_cost DECIMAL(15,2);

COMMENT ON COLUMN netsuite_work_order_lines.actual_cost IS 'Actual cost from Work Order Completion/Issue transactions (GL postings)';
