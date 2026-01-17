-- Migration: Add detailed Work Order columns
-- These columns provide full manufacturing detail from NetSuite

ALTER TABLE netsuite_work_orders
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS bill_of_materials_id VARCHAR(50),
  ADD COLUMN IF NOT EXISTS manufacturing_routing_id VARCHAR(50),
  ADD COLUMN IF NOT EXISTS item_id VARCHAR(50),
  ADD COLUMN IF NOT EXISTS assembly_description TEXT,
  ADD COLUMN IF NOT EXISTS serial_number VARCHAR(255);

COMMENT ON COLUMN netsuite_work_orders.start_date IS 'Work order start date';
COMMENT ON COLUMN netsuite_work_orders.end_date IS 'Work order end/completion date';
COMMENT ON COLUMN netsuite_work_orders.bill_of_materials_id IS 'Bill of Materials NetSuite ID';
COMMENT ON COLUMN netsuite_work_orders.manufacturing_routing_id IS 'Manufacturing Routing NetSuite ID';
COMMENT ON COLUMN netsuite_work_orders.item_id IS 'Assembly item being built';
COMMENT ON COLUMN netsuite_work_orders.assembly_description IS 'Description of the assembly/item being manufactured';
COMMENT ON COLUMN netsuite_work_orders.serial_number IS 'Serial number for the manufactured item';
