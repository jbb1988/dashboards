# Profitability Dashboard Reconciliation Fix

**Date:** January 24, 2026
**Updated:** January 24, 2026 (Added Milwaukee case, best practices)
**File:** `src/app/api/closeout/profitability/route.ts`

---

## Executive Summary

The profitability dashboard calculates revenue by matching Sales Order (SO) line items to Work Order (WO) item IDs. When WO item IDs are incomplete or don't match SO line items, revenue is under-reported or incorrectly calculated.

**Root Cause:** NetSuite WO line items often have different `item_id` values than corresponding SO line items, causing the matching logic to exclude valid revenue lines.

---

## Case Studies

### Case 1: Plano MCC June 2025

| Metric | Dashboard (Wrong) | Excel (Correct) |
|--------|-------------------|-----------------|
| Revenue | $10,458 | $9,586 |
| GP | $14,000 | ~$6,000 |
| GPM | 130.2% (impossible) | ~65% |

**Issues Found:**
1. Missing `Math.abs()` on cost estimate (caused 130% GPM)
2. Credit line (+$872) not included because itemId not in WO

**Data:**
```
WO5529 item IDs: [2521, 4332, 4277, 4278, 5130]

SO6794 MCC lines (account 4101):
- itemId=5130, amt=-$10,458 → MATCHED
- itemId=5244, amt=+$872   → NOT MATCHED (credit, should offset revenue)
- itemId=5134, amt=-$7,151 → NOT MATCHED (different month)
- itemId=5244, amt=+$266   → NOT MATCHED (different month credit)
```

**Fix:** Include largest credit per matched account.
- Calculation: `-10,458 + 872 = -9,586` → `$9,586` ✓

---

### Case 2: Milwaukee MCC May 2025

| Metric | Dashboard (Wrong) | Excel (Correct) |
|--------|-------------------|-----------------|
| Revenue | $35,952 | $63,364 |
| Cost | $9,451 | $54,997 |

**Issues Found:**
1. MCC revenue line (-$27,412) excluded because itemId not in WO

**Data:**
```
WO5326 + WO5327 item IDs: [2521,4332,4335,655,5555,4278,4277,1267,5550,1266,4333]

SO5249 MCC lines (account 4101):
- itemId=5555, amt=-$10,785.60 → MATCHED
- itemId=5550, amt=-$25,166.40 → MATCHED
- itemId=5286, amt=-$27,412.00 → NOT MATCHED (missing from WO!)
```

**Fix:** Include ALL negative amounts (revenue) on matched MCC accounts.
- Calculation: `-10,785.60 + -25,166.40 + -27,412 = -63,364` → `$63,364` ✓

---

## Common Patterns

### Pattern A: Missing Credits (Plano-type)
- **Symptom:** Revenue slightly too HIGH
- **Cause:** Credit/adjustment lines have different itemId than WO
- **Fix:** Include largest credit per matched account

### Pattern B: Missing Revenue Lines (Milwaukee-type)
- **Symptom:** Revenue significantly too LOW
- **Cause:** Revenue lines have itemId not present in WO
- **Fix:** Include all negative amounts on matched MCC accounts

### Pattern C: Impossible GPM (>100%)
- **Symptom:** Gross margin over 100%
- **Cause:** Missing `Math.abs()` on cost calculation
- **Fix:** Always use `Math.abs()` when calculating costs

---

## Current Fix Logic

```
1. PRIMARY: Filter by revenue recognition dates (if populated)
   - Check if line's revrecstartdate/revrecenddate overlaps engagement month

2. FALLBACK: Filter by WO item_id matching
   - Match SO line itemId to WO line itemIds

3. ENHANCEMENT A: Include all MCC revenue on matched accounts
   - If account 4101-4111 has matched lines, include ALL negative amounts

4. ENHANCEMENT B: Include largest credit per account
   - For positive amounts (credits), only include the largest one

5. CALCULATION: Sum then absolute value
   - soRevenue = Math.abs(sum of all line amounts)
   - soCostEstimate = Math.abs(sum of all cost estimates)
```

---

## Best Practices to Prevent Reconciliation Issues

### For NetSuite Data Entry

1. **Ensure WO Line Items Match SO Line Items**
   - When creating a Work Order from a Sales Order, verify all service items are included
   - The WO should have line items for EVERY revenue line that will be billed
   - Missing WO line items = missing revenue in dashboard

2. **Use Consistent Item IDs**
   - Same service should use same item across WO and SO
   - Avoid creating duplicate items with different IDs for the same service

3. **Populate Revenue Recognition Dates**
   - Set `revrecstartdate` and `revrecenddate` on SO line items
   - This allows precise filtering by engagement month
   - Without these, the system uses heuristics that may fail

4. **One SO Per Engagement Period (Ideal)**
   - If possible, create separate SOs for different engagement months
   - Multi-month SOs with mixed line items are hard to reconcile

5. **Credits Should Reference Original Items**
   - Credit/adjustment lines should use the same itemId as the original revenue
   - This ensures credits are properly matched to their revenue lines

### For Excel Closeout Data

1. **Include WO Numbers**
   - Always record which WO number corresponds to which revenue
   - This enables verification against NetSuite

2. **Match Account Numbers**
   - Use consistent account numbers (4101 for MCC, 4081 for equipment)
   - Dashboard filters by account number as fallback

3. **Document Adjustments**
   - Note any credits or adjustments separately
   - Include itemId if known

### For Dashboard Verification

1. **Check GPM Range**
   - Valid GPM: 20-80% typically
   - GPM > 100%: Indicates calculation bug (likely missing Math.abs)
   - GPM < 0%: Indicates cost > revenue (check for missing revenue lines)

2. **Compare Line Counts**
   - Dashboard "X lines" should roughly match Excel row count
   - Significant difference = filtering issue

3. **Verify Account Distribution**
   - Expand SO to see product type breakdown
   - MCC should show account 4101
   - Equipment should show account 4081

---

## Diagnostic Queries

### Check WO Item IDs vs SO Item IDs

```sql
-- Find mismatches between WO and SO item_ids
WITH wo_items AS (
  SELECT DISTINCT wol.item_id, wol.item_name
  FROM netsuite_work_orders wo
  JOIN netsuite_work_order_lines wol ON wol.work_order_id = wo.id
  WHERE wo.wo_number IN ('WO5326', 'WO5327')
),
so_items AS (
  SELECT DISTINCT sol.item_id, sol.item_name, sol.amount, sol.account_number
  FROM netsuite_sales_orders so
  JOIN netsuite_sales_order_lines sol ON sol.sales_order_id = so.id
  WHERE so.so_number = 'SO5249'
    AND sol.account_number LIKE '410%'
)
SELECT
  so_items.*,
  CASE WHEN wo_items.item_id IS NULL THEN 'NOT IN WO' ELSE 'MATCHED' END as status
FROM so_items
LEFT JOIN wo_items ON wo_items.item_id = so_items.item_id
ORDER BY status, so_items.amount;
```

### Check Revenue Recognition Date Coverage

```sql
SELECT
  so.so_number,
  COUNT(*) as total_lines,
  COUNT(sol.revrecstartdate) as with_rev_rec,
  ROUND(100.0 * COUNT(sol.revrecstartdate) / COUNT(*), 1) as pct_coverage
FROM netsuite_sales_orders so
JOIN netsuite_sales_order_lines sol ON sol.sales_order_id = so.id
WHERE sol.account_number LIKE '410%'
GROUP BY so.so_number
HAVING COUNT(*) > 0
ORDER BY pct_coverage ASC;
```

### Find Projects Likely to Have Issues

```sql
-- Projects where WO item count << SO item count (likely missing items)
WITH wo_counts AS (
  SELECT wo.created_from_so_number as so_number, COUNT(DISTINCT wol.item_id) as wo_items
  FROM netsuite_work_orders wo
  JOIN netsuite_work_order_lines wol ON wol.work_order_id = wo.id
  GROUP BY wo.created_from_so_number
),
so_counts AS (
  SELECT so.so_number, COUNT(DISTINCT sol.item_id) as so_items
  FROM netsuite_sales_orders so
  JOIN netsuite_sales_order_lines sol ON sol.sales_order_id = so.id
  WHERE sol.account_number LIKE '410%'
  GROUP BY so.so_number
)
SELECT
  so_counts.so_number,
  so_counts.so_items,
  COALESCE(wo_counts.wo_items, 0) as wo_items,
  so_counts.so_items - COALESCE(wo_counts.wo_items, 0) as potential_missing
FROM so_counts
LEFT JOIN wo_counts ON wo_counts.so_number = so_counts.so_number
WHERE so_counts.so_items > COALESCE(wo_counts.wo_items, 0)
ORDER BY potential_missing DESC;
```

---

## Troubleshooting Flowchart

```
Revenue Mismatch?
├── Dashboard > Excel (too high)
│   ├── Check: Are non-MCC items included?
│   ├── Check: Multiple months in same SO?
│   └── Fix: Review account number filtering
│
├── Dashboard < Excel (too low)
│   ├── Check: How many SO lines matched vs total?
│   ├── Check: Are WO item_ids complete?
│   └── Fix: Ensure WO has all revenue line items
│
└── GPM > 100% (impossible)
    ├── Check: Is Math.abs() applied to costs?
    └── Fix: Apply Math.abs() to cost calculations

Cost Mismatch?
├── Check: WO actual costs vs Excel
├── Check: Are all WOs included?
└── Check: Cost estimate vs actual cost fields
```

---

## Code Reference

### Key File
`src/app/api/closeout/profitability/route.ts`

### Critical Sections

| Line Range | Purpose |
|------------|---------|
| ~380-390 | Collect WO item IDs |
| ~475-505 | Filter SO lines (rev rec dates, item_id matching) |
| ~510-545 | Include additional MCC revenue lines |
| ~550-575 | Include largest credit per account |
| ~580-585 | Calculate revenue with Math.abs() |

### Debug Logging

To enable debugging, add this after the filter:
```typescript
console.log(`[Debug] WO itemIds: size=${workOrderItemIds.size}, ids=[${Array.from(workOrderItemIds).join(',')}]`);
console.log(`[Debug] After filter: ${enhancedLines.length} lines, validLines had ${validLines.length}`);
```

---

## Commits History

| Commit | Description |
|--------|-------------|
| `eae8592` | Initial fix: Math.abs on cost, account fallback |
| `9c2d319` | Added rev rec date filtering |
| `2bd22c1` | Include largest credit per account |
| `35d6b8b` | Include all MCC revenue on matched accounts |

---

## Future Improvements

1. **Sync Rev Rec Dates from NetSuite**
   - Would eliminate need for item_id matching heuristics
   - Enables precise month-based filtering

2. **WO-SO Item Mapping Table**
   - Create lookup table linking WO items to SO items
   - Populate during sync process

3. **Automated Reconciliation Report**
   - Nightly job comparing dashboard vs Excel
   - Flag projects with >5% variance

4. **Alert on GPM Anomalies**
   - Warn when GPM < 0% or > 100%
   - Indicates data or calculation issue
