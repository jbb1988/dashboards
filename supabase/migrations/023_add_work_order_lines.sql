-- Migration: Add netsuite_work_order_lines table
-- Purpose: Store line item details for work orders (similar to sales order lines)

CREATE TABLE netsuite_work_order_lines (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Key to work orders
  work_order_id UUID NOT NULL REFERENCES netsuite_work_orders(id) ON DELETE CASCADE,

  -- NetSuite Identifiers
  netsuite_line_id VARCHAR(50) NOT NULL,           -- NetSuite line ID
  line_number INTEGER,                             -- Line sequence

  -- Item Information
  item_id VARCHAR(50),
  item_name VARCHAR(255),
  item_description TEXT,
  item_type VARCHAR(50),                           -- InvtPart, Assembly, etc.

  -- Quantities
  quantity DECIMAL(15,4),                          -- Quantity ordered
  quantity_completed DECIMAL(15,4),                -- Quantity built/completed

  -- Cost & Amounts
  unit_cost DECIMAL(15,2),                         -- Cost per unit
  line_cost DECIMAL(15,2),                         -- Total line cost

  -- Classification (can differ from header)
  class_id VARCHAR(50),
  class_name VARCHAR(100),
  location_id VARCHAR(50),
  location_name VARCHAR(100),

  -- Dates
  expected_completion_date DATE,

  -- Metadata
  is_closed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one line per work order + line ID
  UNIQUE(work_order_id, netsuite_line_id)
);

-- Indexes for netsuite_work_order_lines
CREATE INDEX idx_ns_wol_wo ON netsuite_work_order_lines(work_order_id);
CREATE INDEX idx_ns_wol_item ON netsuite_work_order_lines(item_id);

-- Enable Row Level Security
ALTER TABLE netsuite_work_order_lines ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow authenticated users to read
CREATE POLICY "Allow authenticated users to read netsuite_work_order_lines"
  ON netsuite_work_order_lines FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policy: Allow service role full access
CREATE POLICY "Allow service role full access to netsuite_work_order_lines"
  ON netsuite_work_order_lines FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add comment
COMMENT ON TABLE netsuite_work_order_lines IS 'Work order line items from NetSuite - components and assemblies being built';
COMMENT ON COLUMN netsuite_work_order_lines.unit_cost IS 'Cost per unit for this line item';
COMMENT ON COLUMN netsuite_work_order_lines.line_cost IS 'Total cost for this line (quantity * unit_cost)';
