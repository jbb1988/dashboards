#!/bin/bash
# Quick validation of current data for board presentation

echo "========================================"
echo "CURRENT DATA VALIDATION"
echo "========================================"
echo ""

# Check what we have in Supabase
echo "This script will help you run validation queries."
echo "Copy these queries into your Supabase SQL editor:"
echo ""

echo "1. CHECK FOR NULL ITEM NAMES (should be 0):"
echo "-------------------------------------------"
cat <<'SQL'
SELECT 'Sales Order Lines - NULL item_name' AS check_name, COUNT(*) as null_count
FROM netsuite_sales_order_lines
WHERE item_name IS NULL
UNION ALL
SELECT 'Work Order Lines - NULL item_name', COUNT(*)
FROM netsuite_work_order_lines
WHERE item_name IS NULL;
SQL

echo ""
echo ""
echo "2. TOP 10 PROJECTS BY REVENUE:"
echo "-------------------------------------------"
cat <<'SQL'
SELECT
  so.customer_name AS project_name,
  COUNT(DISTINCT so.id) as sales_orders,
  COUNT(DISTINCT wo.id) as work_orders,
  ROUND(SUM(sol.amount)::numeric, 2) as total_revenue,
  ROUND(SUM(wol.line_cost)::numeric, 2) as total_wo_costs,
  ROUND((SUM(sol.amount) - COALESCE(SUM(wol.line_cost), 0))::numeric, 2) as gross_profit
FROM netsuite_sales_orders so
LEFT JOIN netsuite_sales_order_lines sol ON sol.sales_order_id = so.id
LEFT JOIN netsuite_work_orders wo ON wo.created_from_so_number = so.so_number
LEFT JOIN netsuite_work_order_lines wol ON wol.work_order_id = wo.id
WHERE so.so_date >= '2024-01-01'
  AND (so.class_name LIKE '%TB%' OR so.class_name LIKE '%MCC%' OR so.class_name LIKE '%M3%')
GROUP BY so.customer_name
HAVING SUM(sol.amount) > 0
ORDER BY total_revenue DESC
LIMIT 10;
SQL

echo ""
echo ""
echo "3. CURRENT SYNC STATUS:"
echo "-------------------------------------------"
cat <<'SQL'
SELECT
  'Sales Orders' AS table_name,
  COUNT(*) as total_records,
  MAX(synced_at) as last_synced
FROM netsuite_sales_orders
WHERE so_date >= '2024-01-01'
UNION ALL
SELECT
  'Sales Order Lines',
  COUNT(*),
  MAX(updated_at)
FROM netsuite_sales_order_lines
UNION ALL
SELECT
  'Work Orders',
  COUNT(*),
  MAX(synced_at)
FROM netsuite_work_orders
WHERE wo_date >= '2024-01-01'
UNION ALL
SELECT
  'Work Order Lines',
  COUNT(*),
  MAX(updated_at)
FROM netsuite_work_order_lines;
SQL

echo ""
echo ""
echo "========================================"
echo "NEXT STEPS:"
echo "========================================"
echo ""
echo "1. Run these queries in Supabase SQL editor"
echo "2. If NULL counts are 0, you're ready for the board!"
echo "3. Use query #2 for your board presentation"
echo ""
echo "To get a board-ready Excel export, use query #10"
echo "from validation-queries.sql"
echo ""
