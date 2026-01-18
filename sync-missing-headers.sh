#!/bin/bash
# Sync missing header records for work orders and sales orders

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
START_DATE="${START_DATE:-2023-01-01}"

echo "=================================================="
echo "SYNCING MISSING HEADER RECORDS"
echo "=================================================="
echo ""

# Sync work order headers
echo "Step 1/2: Syncing Work Order Headers..."
curl -X POST "$BASE_URL/api/netsuite/sync-work-orders?startDate=$START_DATE&limit=10000" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n"

echo ""
echo "✓ Work order headers synced"
echo ""

# Sync sales order headers
echo "Step 2/2: Syncing Sales Order Headers..."
curl -X POST "$BASE_URL/api/netsuite/sync-sales-orders?startDate=$START_DATE&limit=10000" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n"

echo ""
echo "✓ Sales order headers synced"
echo ""

echo "=================================================="
echo "NOW RE-RUN THE LINE ITEMS SYNC"
echo "=================================================="
echo ""
echo "./sync-for-board.sh"
echo ""
