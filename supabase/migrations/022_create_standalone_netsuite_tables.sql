-- Migration: Create standalone NetSuite tables for Work Orders and Sales Orders
-- Purpose: Store ALL NetSuite WO/SO data independent of Excel imports for reusability across dashboards
-- Architecture: These tables are standalone caches of NetSuite data that any dashboard can query

-- ============================================================================
-- STEP 1: Create new standalone NetSuite tables
-- ============================================================================

-- Table: netsuite_work_orders
-- Complete work order master data from NetSuite (standalone, not tied to closeout worksheet)
CREATE TABLE netsuite_work_orders (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- NetSuite Identifiers
  netsuite_id VARCHAR(50) NOT NULL UNIQUE,        -- NetSuite internal ID
  wo_number VARCHAR(100) NOT NULL UNIQUE,         -- Transaction number (tranId)

  -- Work Order Details
  wo_date DATE,                                    -- Transaction date
  posting_period VARCHAR(50),                      -- Posting period
  status VARCHAR(50),                              -- Current status (e.g., Built, Closed)
  memo TEXT,                                       -- Work order memo

  -- Related Records
  created_from_so_id VARCHAR(50),                  -- Linked Sales Order internal ID
  created_from_so_number VARCHAR(100),             -- Linked SO transaction number

  -- Customer Information
  customer_id VARCHAR(50),                         -- Customer NetSuite ID
  customer_name VARCHAR(255),                      -- Customer name

  -- Financial Summary (optional - can be calculated from lines)
  total_quantity DECIMAL(15,4),
  total_amount DECIMAL(15,2),
  total_cost DECIMAL(15,2),

  -- Location/Subsidiary
  subsidiary_id VARCHAR(50),
  subsidiary_name VARCHAR(100),
  location_id VARCHAR(50),
  location_name VARCHAR(100),

  -- Classification
  class_id VARCHAR(50),
  class_name VARCHAR(100),
  department_id VARCHAR(50),
  department_name VARCHAR(100),

  -- Sync Metadata
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for netsuite_work_orders
CREATE INDEX idx_ns_wo_number ON netsuite_work_orders(wo_number);
CREATE INDEX idx_ns_wo_date ON netsuite_work_orders(wo_date);
CREATE INDEX idx_ns_wo_customer ON netsuite_work_orders(customer_id);
CREATE INDEX idx_ns_wo_so ON netsuite_work_orders(created_from_so_number);
CREATE INDEX idx_ns_wo_status ON netsuite_work_orders(status);
CREATE INDEX idx_ns_wo_netsuite_id ON netsuite_work_orders(netsuite_id);

-- Table: netsuite_sales_orders
-- Complete sales order header data from NetSuite (standalone, reusable across dashboards)
CREATE TABLE netsuite_sales_orders (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- NetSuite Identifiers
  netsuite_id VARCHAR(50) NOT NULL UNIQUE,
  so_number VARCHAR(100) NOT NULL UNIQUE,

  -- Sales Order Details
  so_date DATE,
  posting_period VARCHAR(50),
  status VARCHAR(50),                              -- Pending Fulfillment, Billed, Closed, etc.
  memo TEXT,

  -- Customer Information
  customer_id VARCHAR(50),
  customer_name VARCHAR(255),

  -- Financial Summary
  subtotal DECIMAL(15,2),
  discount_total DECIMAL(15,2),
  tax_total DECIMAL(15,2),
  total_amount DECIMAL(15,2),

  -- Terms & Shipping
  terms VARCHAR(100),
  ship_method VARCHAR(100),
  ship_date DATE,
  expected_ship_date DATE,

  -- Location/Subsidiary
  subsidiary_id VARCHAR(50),
  subsidiary_name VARCHAR(100),
  location_id VARCHAR(50),
  location_name VARCHAR(100),

  -- Classification
  class_id VARCHAR(50),
  class_name VARCHAR(100),
  department_id VARCHAR(50),
  department_name VARCHAR(100),

  -- Sales Information
  sales_rep_id VARCHAR(50),
  sales_rep_name VARCHAR(100),
  opportunity_id VARCHAR(50),                      -- Linked CRM opportunity

  -- Sync Metadata
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for netsuite_sales_orders
CREATE INDEX idx_ns_so_number ON netsuite_sales_orders(so_number);
CREATE INDEX idx_ns_so_date ON netsuite_sales_orders(so_date);
CREATE INDEX idx_ns_so_customer ON netsuite_sales_orders(customer_id);
CREATE INDEX idx_ns_so_status ON netsuite_sales_orders(status);
CREATE INDEX idx_ns_so_netsuite_id ON netsuite_sales_orders(netsuite_id);

-- Table: netsuite_sales_order_lines
-- Line item details for sales orders with cost and margin calculations
CREATE TABLE netsuite_sales_order_lines (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Key
  sales_order_id UUID NOT NULL REFERENCES netsuite_sales_orders(id) ON DELETE CASCADE,

  -- NetSuite Identifiers
  netsuite_line_id VARCHAR(50) NOT NULL,           -- NetSuite line ID
  line_number INTEGER,                             -- Line sequence

  -- Item Information
  item_id VARCHAR(50),
  item_name VARCHAR(255),
  item_description TEXT,
  item_type VARCHAR(50),                           -- InvtPart, NonInvtPart, Service, etc.

  -- Quantities
  quantity DECIMAL(15,4),
  quantity_committed DECIMAL(15,4),
  quantity_fulfilled DECIMAL(15,4),
  quantity_billed DECIMAL(15,4),

  -- Pricing
  rate DECIMAL(15,2),                              -- Unit price
  amount DECIMAL(15,2),                            -- Line total (quantity * rate)

  -- Cost & Margin (calculated columns)
  cost_estimate DECIMAL(15,2),                     -- COGS estimate
  cost_estimate_type VARCHAR(50),                  -- Average, FIFO, etc.
  gross_profit DECIMAL(15,2) GENERATED ALWAYS AS (amount - COALESCE(cost_estimate, 0)) STORED,
  gross_margin_pct DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE WHEN amount > 0 THEN ((amount - COALESCE(cost_estimate, 0)) / amount * 100) ELSE 0 END
  ) STORED,

  -- Classification (can differ from header)
  class_id VARCHAR(50),
  class_name VARCHAR(100),
  department_id VARCHAR(50),
  department_name VARCHAR(100),

  -- Location
  location_id VARCHAR(50),
  location_name VARCHAR(100),

  -- Dates
  expected_ship_date DATE,
  committed_date DATE,

  -- Metadata
  is_closed BOOLEAN DEFAULT FALSE,
  closed_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(sales_order_id, netsuite_line_id)
);

-- Indexes for netsuite_sales_order_lines
CREATE INDEX idx_ns_sol_so ON netsuite_sales_order_lines(sales_order_id);
CREATE INDEX idx_ns_sol_item ON netsuite_sales_order_lines(item_id);
CREATE INDEX idx_ns_sol_class ON netsuite_sales_order_lines(class_id);

-- ============================================================================
-- STEP 2: Enable Row Level Security on new tables
-- ============================================================================

ALTER TABLE netsuite_work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE netsuite_sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE netsuite_sales_order_lines ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow authenticated users to read all data
CREATE POLICY "Allow authenticated users to read netsuite_work_orders"
  ON netsuite_work_orders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to read netsuite_sales_orders"
  ON netsuite_sales_orders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to read netsuite_sales_order_lines"
  ON netsuite_sales_order_lines FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies: Allow service role full access
CREATE POLICY "Allow service role full access to netsuite_work_orders"
  ON netsuite_work_orders FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service role full access to netsuite_sales_orders"
  ON netsuite_sales_orders FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service role full access to netsuite_sales_order_lines"
  ON netsuite_sales_order_lines FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- STEP 3: Add helpful comments to new tables
-- ============================================================================

COMMENT ON TABLE netsuite_work_orders IS 'Standalone cache of ALL NetSuite work orders - reusable across dashboards';
COMMENT ON TABLE netsuite_sales_orders IS 'Standalone cache of ALL NetSuite sales order headers - reusable across dashboards';
COMMENT ON TABLE netsuite_sales_order_lines IS 'Sales order line items with cost estimates and calculated gross profit/margin';

COMMENT ON COLUMN netsuite_work_orders.wo_number IS 'Work Order transaction number from NetSuite (tranId)';
COMMENT ON COLUMN netsuite_work_orders.created_from_so_number IS 'Linked Sales Order transaction number';
COMMENT ON COLUMN netsuite_sales_order_lines.gross_profit IS 'Calculated: amount - cost_estimate';
COMMENT ON COLUMN netsuite_sales_order_lines.gross_margin_pct IS 'Calculated: (gross_profit / amount) * 100';

-- ============================================================================
-- STEP 4: Remove NetSuite enrichment columns from closeout_work_orders
-- ============================================================================

-- These columns are no longer needed - closeout tables will JOIN to netsuite tables instead
ALTER TABLE closeout_work_orders
  DROP COLUMN IF EXISTS netsuite_enriched,
  DROP COLUMN IF EXISTS netsuite_wo_id,
  DROP COLUMN IF EXISTS netsuite_so_id,
  DROP COLUMN IF EXISTS netsuite_so_number,
  DROP COLUMN IF EXISTS netsuite_enriched_at;

-- Remove the enriched index (no longer exists)
DROP INDEX IF EXISTS idx_closeout_wo_enriched;

-- ============================================================================
-- STEP 5: Drop old netsuite_work_order_details table
-- ============================================================================

-- This table is replaced by netsuite_sales_order_lines (better structure, standalone)
DROP TABLE IF EXISTS netsuite_work_order_details;

-- ============================================================================
-- Migration complete!
-- ============================================================================

-- Next steps after migration:
-- 1. Run initial sync: POST /api/netsuite/sync-work-orders { startDate: "2020-01-01" }
-- 2. Run initial sync: POST /api/netsuite/sync-sales-orders { startDate: "2020-01-01", includeLineItems: true }
-- 3. Update dashboard queries to JOIN netsuite tables instead of enriching
