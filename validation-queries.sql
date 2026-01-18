-- ============================================================
-- DATA VALIDATION QUERIES FOR BOARD PRESENTATION
-- Run these in Supabase SQL Editor to verify data accuracy
-- ============================================================

-- 1. CHECK FOR NULL ITEM NAMES (MUST BE ZERO!)
-- ============================================================
SELECT 'Sales Order Lines - NULL item_name' AS check_name, COUNT(*) as null_count
FROM netsuite_sales_order_lines
WHERE item_name IS NULL
UNION ALL
SELECT 'Work Order Lines - NULL item_name', COUNT(*)
FROM netsuite_work_order_lines
WHERE item_name IS NULL;

-- Expected result: Both counts should be 0


-- 2. VERIFY WORK ORDER → SALES ORDER LINKAGE
-- ============================================================
SELECT
  COUNT(DISTINCT wo.id) as total_work_orders,
  COUNT(DISTINCT CASE WHEN wo.created_from_so_number IS NOT NULL THEN wo.id END) as linked_to_so,
  COUNT(DISTINCT CASE WHEN wo.created_from_so_number IS NULL THEN wo.id END) as not_linked
FROM netsuite_work_orders wo
WHERE wo.wo_date >= '2024-01-01';

-- Expected: Most work orders should be linked to a sales order


-- 3. PROJECT PROFITABILITY SUMMARY (Top 10 Projects)
-- ============================================================
SELECT
  so.customer_name AS project_name,
  COUNT(DISTINCT so.id) as sales_order_count,
  COUNT(DISTINCT wo.id) as work_order_count,
  COUNT(DISTINCT sol.id) as so_line_items,
  COUNT(DISTINCT wol.id) as wo_line_items,
  ROUND(SUM(sol.amount)::numeric, 2) as total_revenue,
  ROUND(SUM(wol.line_cost)::numeric, 2) as total_wo_costs,
  ROUND((SUM(sol.amount) - COALESCE(SUM(wol.line_cost), 0))::numeric, 2) as gross_profit,
  ROUND((CASE WHEN SUM(sol.amount) > 0
    THEN ((SUM(sol.amount) - COALESCE(SUM(wol.line_cost), 0)) / SUM(sol.amount) * 100)
    ELSE 0
  END)::numeric, 1) as margin_pct
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

-- Expected: Should show your top 10 projects with revenue, costs, and margins


-- 4. DETAILED PROJECT BREAKDOWN (Replace 'YOUR_PROJECT_NAME' with actual project)
-- ============================================================
SELECT
  so.so_number,
  so.so_date,
  sol.item_name AS sold_item,
  sol.quantity AS qty_sold,
  sol.rate AS unit_price,
  sol.amount AS revenue,
  wo.wo_number,
  wol.item_name AS component_item,
  wol.quantity AS component_qty,
  wol.unit_cost,
  wol.line_cost AS component_cost
FROM netsuite_sales_orders so
LEFT JOIN netsuite_sales_order_lines sol ON sol.sales_order_id = so.id
LEFT JOIN netsuite_work_orders wo ON wo.created_from_so_number = so.so_number
LEFT JOIN netsuite_work_order_lines wol ON wol.work_order_id = wo.id
WHERE so.customer_name = 'YOUR_PROJECT_NAME'  -- Replace with actual project name
ORDER BY so.so_number, sol.line_number, wo.wo_number, wol.line_number;

-- Expected: Hierarchical view of SO → SO Lines → WO → WO Lines


-- 5. VERIFY NO DUPLICATE LINE ITEMS
-- ============================================================
SELECT 'Duplicate SO Lines' AS check_name, COUNT(*) as duplicate_count
FROM (
  SELECT sales_order_id, netsuite_line_id, COUNT(*)
  FROM netsuite_sales_order_lines
  GROUP BY sales_order_id, netsuite_line_id
  HAVING COUNT(*) > 1
) dups
UNION ALL
SELECT 'Duplicate WO Lines', COUNT(*)
FROM (
  SELECT work_order_id, netsuite_line_id, COUNT(*)
  FROM netsuite_work_order_lines
  GROUP BY work_order_id, netsuite_line_id
  HAVING COUNT(*) > 1
) dups;

-- Expected: Both counts should be 0


-- 6. SYNC STATUS CHECK
-- ============================================================
SELECT
  'Sales Orders' AS table_name,
  COUNT(*) as total_records,
  MAX(synced_at) as last_synced,
  COUNT(DISTINCT customer_name) as unique_customers
FROM netsuite_sales_orders
WHERE so_date >= '2024-01-01'
UNION ALL
SELECT
  'Sales Order Lines',
  COUNT(*),
  MAX(updated_at),
  NULL
FROM netsuite_sales_order_lines
UNION ALL
SELECT
  'Work Orders',
  COUNT(*),
  MAX(synced_at),
  COUNT(DISTINCT customer_name)
FROM netsuite_work_orders
WHERE wo_date >= '2024-01-01'
UNION ALL
SELECT
  'Work Order Lines',
  COUNT(*),
  MAX(updated_at),
  NULL
FROM netsuite_work_order_lines;

-- Expected: All last_synced times should be recent (within last hour)


-- 7. MARGIN ANALYSIS BY PROJECT TYPE
-- ============================================================
SELECT
  CASE
    WHEN so.class_name LIKE '%TB%' THEN 'Test Bench'
    WHEN so.class_name LIKE '%MCC%' THEN 'MCC'
    WHEN so.class_name LIKE '%M3%' THEN 'M3'
    ELSE 'Other'
  END AS project_type,
  COUNT(DISTINCT so.customer_name) as project_count,
  ROUND(SUM(sol.amount)::numeric, 2) as total_revenue,
  ROUND(SUM(wol.line_cost)::numeric, 2) as total_costs,
  ROUND((CASE WHEN SUM(sol.amount) > 0
    THEN ((SUM(sol.amount) - COALESCE(SUM(wol.line_cost), 0)) / SUM(sol.amount) * 100)
    ELSE 0
  END)::numeric, 1) as avg_margin_pct
FROM netsuite_sales_orders so
LEFT JOIN netsuite_sales_order_lines sol ON sol.sales_order_id = so.id
LEFT JOIN netsuite_work_orders wo ON wo.created_from_so_number = so.so_number
LEFT JOIN netsuite_work_order_lines wol ON wol.work_order_id = wo.id
WHERE so.so_date >= '2024-01-01'
GROUP BY project_type
ORDER BY total_revenue DESC;

-- Expected: Margin by project type (TB, MCC, M3)


-- 8. RECENT SYNC LOG STATUS
-- ============================================================
SELECT
  sync_type,
  started_at,
  completed_at,
  status,
  records_fetched,
  records_upserted,
  error_message,
  EXTRACT(EPOCH FROM (completed_at - started_at)) / 60 as duration_minutes
FROM project_profitability_sync_log
ORDER BY started_at DESC
LIMIT 5;

-- Expected: Recent syncs should show 'completed' status


-- 9. IDENTIFY MISSING ITEM NAMES (SHOULD BE EMPTY)
-- ============================================================
SELECT
  'SO Line Missing Item' AS issue,
  so.so_number,
  sol.line_number,
  sol.item_id,
  sol.item_name,
  sol.item_description
FROM netsuite_sales_orders so
JOIN netsuite_sales_order_lines sol ON sol.sales_order_id = so.id
WHERE sol.item_name IS NULL OR sol.item_name = ''
LIMIT 20
UNION ALL
SELECT
  'WO Line Missing Item',
  wo.wo_number,
  wol.line_number::text,
  wol.item_id,
  wol.item_name,
  wol.item_description
FROM netsuite_work_orders wo
JOIN netsuite_work_order_lines wol ON wol.work_order_id = wo.id
WHERE wol.item_name IS NULL OR wol.item_name = ''
LIMIT 20;

-- Expected: No results (empty)


-- 10. BOARD-READY SUMMARY (Copy/Paste for Excel)
-- ============================================================
SELECT
  so.customer_name AS "Project Name",
  TO_CHAR(MIN(so.so_date), 'YYYY-MM-DD') AS "First SO Date",
  TO_CHAR(MAX(so.so_date), 'YYYY-MM-DD') AS "Last SO Date",
  COUNT(DISTINCT so.id) AS "Sales Orders",
  COUNT(DISTINCT wo.id) AS "Work Orders",
  TO_CHAR(SUM(sol.amount), 'FM$999,999,999.00') AS "Total Revenue",
  TO_CHAR(SUM(wol.line_cost), 'FM$999,999,999.00') AS "Total Costs",
  TO_CHAR(SUM(sol.amount) - COALESCE(SUM(wol.line_cost), 0), 'FM$999,999,999.00') AS "Gross Profit",
  ROUND((CASE WHEN SUM(sol.amount) > 0
    THEN ((SUM(sol.amount) - COALESCE(SUM(wol.line_cost), 0)) / SUM(sol.amount) * 100)
    ELSE 0
  END)::numeric, 1) || '%' AS "Margin %"
FROM netsuite_sales_orders so
LEFT JOIN netsuite_sales_order_lines sol ON sol.sales_order_id = so.id
LEFT JOIN netsuite_work_orders wo ON wo.created_from_so_number = so.so_number
LEFT JOIN netsuite_work_order_lines wol ON wol.work_order_id = wo.id
WHERE so.so_date >= '2024-01-01'
  AND (so.class_name LIKE '%TB%' OR so.class_name LIKE '%MCC%' OR so.class_name LIKE '%M3%')
GROUP BY so.customer_name
HAVING SUM(sol.amount) > 0
ORDER BY SUM(sol.amount) DESC;

-- Expected: Clean, formatted data ready for board presentation

-- ============================================================
-- VALIDATION COMPLETE
-- All queries above should return expected results
-- If any issues found, review sync logs and re-run sync
-- ============================================================
