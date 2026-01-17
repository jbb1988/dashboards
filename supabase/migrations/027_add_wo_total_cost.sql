-- Migration: Add total_actual_cost column to work orders
-- Purpose: Store aggregated actual cost from Work Order Completion/Issue transactions
-- This enables faster queries without having to SUM() line items each time

-- Add total_actual_cost to netsuite_work_orders
ALTER TABLE netsuite_work_orders
  ADD COLUMN IF NOT EXISTS total_actual_cost DECIMAL(15,2);

-- Add index for filtering by cost
CREATE INDEX IF NOT EXISTS idx_ns_wo_total_actual_cost
  ON netsuite_work_orders(total_actual_cost)
  WHERE total_actual_cost IS NOT NULL;

COMMENT ON COLUMN netsuite_work_orders.total_actual_cost IS 'Sum of actual costs from Work Order Completion/Issue transactions (GL postings)';
