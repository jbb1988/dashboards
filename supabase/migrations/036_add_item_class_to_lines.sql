-- Add item class fields to sales order lines for proper product type classification
ALTER TABLE netsuite_sales_order_lines
  ADD COLUMN IF NOT EXISTS item_class_id VARCHAR(50),
  ADD COLUMN IF NOT EXISTS item_class_name VARCHAR(255);

-- Index for fast filtering by item class
CREATE INDEX IF NOT EXISTS idx_ns_sol_item_class ON netsuite_sales_order_lines(item_class_name);

COMMENT ON COLUMN netsuite_sales_order_lines.item_class_id
  IS 'Item class ID from NetSuite (e.g., 1=Test Bench, 28=Other)';

COMMENT ON COLUMN netsuite_sales_order_lines.item_class_name
  IS 'Item class name used for product type classification';
