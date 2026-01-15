-- Migration: Create closeout profitability tracking tables
-- Purpose: Store closeout worksheet data as primary source with NetSuite enrichment

-- Table: closeout_projects
-- Stores project-level data aggregated from closeout worksheet
CREATE TABLE closeout_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core identifiers from Excel
  project_name VARCHAR(255) NOT NULL,           -- Customer name (Column A)
  opportunity_id VARCHAR(100),                   -- Column B
  project_type VARCHAR(50) NOT NULL,             -- Column C (TB, MCC, etc.)
  project_year INTEGER NOT NULL,                 -- Column D
  project_month INTEGER,                         -- Column E

  -- Financial totals (aggregated from work orders)
  budget_revenue DECIMAL(15,2) DEFAULT 0,
  budget_cost DECIMAL(15,2) DEFAULT 0,
  budget_gp DECIMAL(15,2) DEFAULT 0,
  budget_gp_pct DECIMAL(5,2),

  actual_revenue DECIMAL(15,2) DEFAULT 0,
  actual_cost DECIMAL(15,2) DEFAULT 0,
  actual_gp DECIMAL(15,2) DEFAULT 0,
  actual_gp_pct DECIMAL(5,2),

  variance DECIMAL(15,2) DEFAULT 0,
  variance_pct DECIMAL(5,2),

  -- Audit fields
  excel_source VARCHAR(255) DEFAULT 'closeout-data.xlsx',
  excel_sheet VARCHAR(100) DEFAULT 'TB & MCC Cost Audit 2020-Current',
  last_synced_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one project per customer+year+type
  UNIQUE(project_name, project_year, project_type)
);

-- Indexes for closeout_projects
CREATE INDEX idx_closeout_projects_year ON closeout_projects(project_year);
CREATE INDEX idx_closeout_projects_type ON closeout_projects(project_type);
CREATE INDEX idx_closeout_projects_name ON closeout_projects(project_name);

-- Table: closeout_work_orders
-- Stores work order references from closeout worksheet with NetSuite enrichment
CREATE TABLE closeout_work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to project
  closeout_project_id UUID NOT NULL REFERENCES closeout_projects(id) ON DELETE CASCADE,

  -- Work Order info from Excel
  wo_number VARCHAR(100) NOT NULL,               -- Column Q: WO#
  invoice_number VARCHAR(100),                    -- Column F
  item_description TEXT,                          -- Column K

  -- Financials from Excel (this specific WO line)
  budget_revenue DECIMAL(15,2) DEFAULT 0,        -- Column L
  budget_cost DECIMAL(15,2) DEFAULT 0,           -- Column M
  budget_gp DECIMAL(15,2) DEFAULT 0,             -- Column N

  actual_revenue DECIMAL(15,2) DEFAULT 0,        -- Column P
  actual_cost DECIMAL(15,2) DEFAULT 0,           -- Column W
  actual_gp DECIMAL(15,2) DEFAULT 0,             -- Column Z

  variance DECIMAL(15,2) DEFAULT 0,              -- Column AC
  comments TEXT,                                  -- Column AD

  -- NetSuite enrichment
  netsuite_enriched BOOLEAN DEFAULT FALSE,
  netsuite_wo_id VARCHAR(50),                    -- NetSuite Work Order internal ID
  netsuite_so_id VARCHAR(50),                    -- Linked Sales Order internal ID
  netsuite_so_number VARCHAR(50),                -- SO transaction number
  netsuite_enriched_at TIMESTAMPTZ,

  excel_row_number INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for closeout_work_orders
CREATE INDEX idx_closeout_wo_project ON closeout_work_orders(closeout_project_id);
CREATE INDEX idx_closeout_wo_number ON closeout_work_orders(wo_number);
CREATE INDEX idx_closeout_wo_enriched ON closeout_work_orders(netsuite_enriched);

-- Table: netsuite_work_order_details
-- Caches NetSuite Work Order and Sales Order line item details
CREATE TABLE netsuite_work_order_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to closeout WO
  closeout_wo_id UUID REFERENCES closeout_work_orders(id) ON DELETE CASCADE,

  -- Work Order header
  wo_id VARCHAR(50) NOT NULL,
  wo_number VARCHAR(50) NOT NULL,
  wo_status VARCHAR(50),
  wo_date DATE,

  -- Linked Sales Order
  so_id VARCHAR(50),
  so_number VARCHAR(50),
  so_status VARCHAR(50),
  so_date DATE,

  -- Customer info
  customer_id VARCHAR(50),
  customer_name VARCHAR(255),

  -- Line item details (from SO or WO)
  line_id VARCHAR(50),
  item_id VARCHAR(50),
  item_name VARCHAR(255),
  item_description TEXT,
  item_type VARCHAR(50),

  quantity DECIMAL(15,4),
  unit_price DECIMAL(15,2),
  line_amount DECIMAL(15,2),
  cost_estimate DECIMAL(15,2),                   -- COGS from NetSuite

  -- Source tracking
  source_type VARCHAR(20),                        -- 'work_order' or 'sales_order'

  -- Cache metadata
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(wo_number, line_id)
);

-- Indexes for netsuite_work_order_details
CREATE INDEX idx_nswo_closeout ON netsuite_work_order_details(closeout_wo_id);
CREATE INDEX idx_nswo_number ON netsuite_work_order_details(wo_number);
CREATE INDEX idx_nswo_so ON netsuite_work_order_details(so_number);

-- Enable Row Level Security (RLS) for all tables
ALTER TABLE closeout_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE closeout_work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE netsuite_work_order_details ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow authenticated users to read all data
CREATE POLICY "Allow authenticated users to read closeout_projects"
  ON closeout_projects FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to read closeout_work_orders"
  ON closeout_work_orders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to read netsuite_work_order_details"
  ON netsuite_work_order_details FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies: Allow service role full access
CREATE POLICY "Allow service role full access to closeout_projects"
  ON closeout_projects FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service role full access to closeout_work_orders"
  ON closeout_work_orders FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service role full access to netsuite_work_order_details"
  ON netsuite_work_order_details FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add helpful comments to tables
COMMENT ON TABLE closeout_projects IS 'Project-level closeout data from Excel worksheet as primary data source';
COMMENT ON TABLE closeout_work_orders IS 'Work order details from closeout worksheet with NetSuite enrichment capability';
COMMENT ON TABLE netsuite_work_order_details IS 'Cached NetSuite Work Order and Sales Order line item details';

COMMENT ON COLUMN closeout_work_orders.wo_number IS 'Work Order number from Column Q of closeout worksheet';
COMMENT ON COLUMN closeout_work_orders.netsuite_enriched IS 'TRUE if NetSuite SO/WO details have been fetched and cached';
COMMENT ON COLUMN netsuite_work_order_details.cost_estimate IS 'COGS from NetSuite costestimate field';
