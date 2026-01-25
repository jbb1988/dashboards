-- Add line_memo column to capture line-level description from NetSuite
-- This contains important info like "Contracted 2024 - Year 2 of 5" for deferred revenue

ALTER TABLE netsuite_sales_order_lines
ADD COLUMN IF NOT EXISTS line_memo TEXT;

COMMENT ON COLUMN netsuite_sales_order_lines.line_memo IS 'Line-level memo/description from NetSuite transactionline.memo - contains contract year info for deferred revenue';
