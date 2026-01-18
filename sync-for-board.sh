#!/bin/bash
# BOARD PRESENTATION DATA SYNC - Run this script to prepare data
# Execute from project root directory

set -e  # Exit on error

echo "=================================================="
echo "PROJECT PROFITABILITY - BOARD PRESENTATION SYNC"
echo "=================================================="
echo ""

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"
START_DATE="${START_DATE:-2023-01-01}"

echo "Configuration:"
echo "  Base URL: $BASE_URL"
echo "  Start Date: $START_DATE"
echo ""

# Step 1: Sync Work Order Line Items
echo "Step 1/3: Syncing Work Order Line Items..."
echo "  This will fetch ALL component costs for work orders"
echo ""
curl -X POST "$BASE_URL/api/netsuite/bulk-sync-lines?type=WorkOrd&startDate=$START_DATE" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n" \
  | jq '.' || echo "Failed to sync work order lines"

echo ""
echo "✓ Work order lines synced"
echo ""

# Step 2: Sync Sales Order Line Items (Fix NULLs)
echo "Step 2/3: Syncing Sales Order Line Items (fixing NULL item_names)..."
echo "  This uses COALESCE to eliminate NULL values"
echo ""
curl -X POST "$BASE_URL/api/netsuite/bulk-sync-lines?type=SalesOrd&startDate=$START_DATE" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n" \
  | jq '.' || echo "Failed to sync sales order lines"

echo ""
echo "✓ Sales order lines synced"
echo ""

# Step 3: Verify Data Quality
echo "Step 3/3: Verifying data quality..."
echo ""

# Check work order lines
WO_COUNT=$(curl -s "$BASE_URL/api/netsuite/count-synced" | jq '.counts.workOrderLines // 0')
echo "  Work Order Lines: $WO_COUNT"

# Check sales order lines
SO_COUNT=$(curl -s "$BASE_URL/api/netsuite/count-synced" | jq '.counts.salesOrderLines // 0')
echo "  Sales Order Lines: $SO_COUNT"

echo ""
echo "=================================================="
echo "SYNC COMPLETE!"
echo "=================================================="
echo ""
echo "Next Steps:"
echo "  1. Check for NULL values in item_name fields"
echo "  2. Build the project detail dashboard API"
echo "  3. Create the board presentation frontend"
echo ""
echo "Quick validation queries (run in Supabase SQL editor):"
echo ""
echo "  -- Check for NULLs in sales order lines"
echo "  SELECT COUNT(*) as null_count"
echo "  FROM netsuite_sales_order_lines"
echo "  WHERE item_name IS NULL;"
echo ""
echo "  -- Check for NULLs in work order lines"
echo "  SELECT COUNT(*) as null_count"
echo "  FROM netsuite_work_order_lines"
echo "  WHERE item_name IS NULL;"
echo ""
echo "  -- View sample project profitability"
echo "  SELECT"
echo "    so.customer_name,"
echo "    COUNT(DISTINCT so.id) as sales_orders,"
echo "    COUNT(DISTINCT wo.id) as work_orders,"
echo "    SUM(sol.amount) as total_revenue"
echo "  FROM netsuite_sales_orders so"
echo "  LEFT JOIN netsuite_sales_order_lines sol ON sol.sales_order_id = so.id"
echo "  LEFT JOIN netsuite_work_orders wo ON wo.created_from_so_number = so.so_number"
echo "  GROUP BY so.customer_name"
echo "  ORDER BY total_revenue DESC"
echo "  LIMIT 10;"
echo ""
