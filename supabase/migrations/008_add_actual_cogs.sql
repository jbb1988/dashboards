-- Add actual cost tracking columns to project_budgets
-- These will be populated from the Excel Cost Audit data

ALTER TABLE project_budgets
ADD COLUMN IF NOT EXISTS actual_revenue DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS actual_cogs DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS actual_gp DECIMAL(15,2) DEFAULT 0;

-- Add computed GPM columns for convenience
ALTER TABLE project_budgets
ADD COLUMN IF NOT EXISTS budget_gpm DECIMAL(5,2) GENERATED ALWAYS AS (
  CASE WHEN budget_revenue > 0 THEN (budget_gp / budget_revenue * 100) ELSE 0 END
) STORED,
ADD COLUMN IF NOT EXISTS actual_gpm DECIMAL(5,2) GENERATED ALWAYS AS (
  CASE WHEN actual_revenue > 0 THEN (actual_gp / actual_revenue * 100) ELSE 0 END
) STORED;
