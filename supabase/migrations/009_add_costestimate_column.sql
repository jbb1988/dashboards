-- Add costestimate column to project_profitability
-- COGS comes from NetSuite TransactionLine.costestimate field (like Diversified Products)
-- This is the actual cost estimate per line item, not from GL account postings

ALTER TABLE project_profitability
ADD COLUMN IF NOT EXISTS costestimate DECIMAL(15,2) DEFAULT 0;

-- Update the materialized view to use costestimate for COGS calculation
DROP MATERIALIZED VIEW IF EXISTS project_profitability_summary;

CREATE MATERIALIZED VIEW project_profitability_summary AS
SELECT
  year,
  month,
  customer_name,
  project_type,
  class_name,
  SUM(CASE WHEN is_revenue THEN ABS(amount) ELSE 0 END) as total_revenue,
  SUM(COALESCE(costestimate, 0)) as total_cogs,
  SUM(CASE WHEN is_revenue THEN ABS(amount) ELSE 0 END) -
    SUM(COALESCE(costestimate, 0)) as gross_profit,
  COUNT(DISTINCT netsuite_transaction_id) as transaction_count,
  MAX(synced_at) as last_synced
FROM project_profitability
GROUP BY year, month, customer_name, project_type, class_name;

-- Recreate the unique index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_pps_unique
  ON project_profitability_summary(year, month, customer_name, COALESCE(project_type, ''), COALESCE(class_name, ''));

-- Index for costestimate column
CREATE INDEX IF NOT EXISTS idx_pp_costestimate ON project_profitability(costestimate) WHERE costestimate > 0;
