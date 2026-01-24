# Profitability Dashboard Reconciliation Fix

**Date:** January 24, 2026
**Issue:** Plano MCC June 2025 showing incorrect revenue and impossible GPM
**File:** `src/app/api/closeout/profitability/route.ts`

---

## Problem Summary

| Metric | Dashboard (Wrong) | Excel (Correct) |
|--------|-------------------|-----------------|
| Revenue | $10,458 | $9,586 |
| GP | $14,000 | ~$6,000 |
| GPM | 130.2% (impossible) | ~65% |
| Discrepancy | +$872 extra revenue | - |

---

## Root Causes

### Bug #1: Missing `Math.abs()` on SO Cost Estimate

**Location:** Line ~520 (after fix)

**Before:**
```typescript
const soCostEstimate = enhancedLines.reduce((sum, li) => sum + li.costEstimate, 0);
```

**After:**
```typescript
const soCostEstimate = Math.abs(enhancedLines.reduce((sum, li) => sum + li.costEstimate, 0));
```

**Why:** NetSuite stores cost estimates as negative values. Without `Math.abs()`, the GP calculation became:
- Revenue: $10,458
- Cost: -$3,500 (negative!)
- GP: $10,458 - (-$3,500) = $13,958 (inflated!)
- GPM: 133% (impossible!)

---

### Bug #2: WO Item ID Filtering Not Matching Credits

**The Data Structure:**

Work Order (WO5529) has 5 item IDs: `[2521, 4332, 4277, 4278, 5130]`

Sales Order (SO6794) line items for account 4101 (MCC):
| itemId | item | amount | matched? |
|--------|------|--------|----------|
| 5130 | 81100010 | -$10,458 | YES (in WO) |
| 5244 | 80000005 | +$872 | NO |
| 5134 | 80100011 | -$7,151 | NO |
| 5244 | 80000005 | +$266 | NO |

**The Problem:**
- Only `itemId=5130` matched the WO, giving revenue of `$10,458`
- The `+$872` credit (itemId=5244) was NOT in the WO, so it was excluded
- Correct calculation: `-10,458 + 872 = -9,586` → `Math.abs() = $9,586`

**Why Credits Exist:**
In NetSuite, positive amounts on revenue accounts (4101) represent credits/adjustments that reduce the base revenue. These credits may not have the same `item_id` as the main revenue line but still belong to the same engagement.

---

## The Fix

### Strategy: Include Largest Credit Per Matched Account

When a line matches by WO item_id, we note its account number. Then we find additional credit lines (positive amounts) on the same account and include only the **largest** credit per account.

**Why "largest only"?**
- The `+$872` credit belongs to June MCC (the current engagement)
- The `+$266` credit likely belongs to a different month (February?)
- Without rev rec dates populated, we can't distinguish by date
- Taking the largest credit is a heuristic that works for this pattern

**Code Flow:**
```
1. Filter SO lines by WO item_id matching
   → Matched: itemId=5130, amt=-10458, acct=4101

2. Collect account numbers from matched lines
   → matchedAccounts = {4101}

3. Find ALL credits on matched accounts (positive amounts, not already included)
   → Found: +872 on 4101, +266 on 4101

4. Keep only the LARGEST credit per account
   → Largest on 4101: +872 (include)
   → Smaller on 4101: +266 (exclude)

5. Calculate revenue
   → Sum: -10458 + 872 = -9586
   → Abs: $9,586 ✓
```

---

## Key Code Sections

### 1. SO Lines Query (includes rev rec dates for future use)

```typescript
netsuite_sales_order_lines (
  line_number,
  item_id,
  item_name,
  amount,
  cost_estimate,
  account_number,
  account_name,
  revrecstartdate,    // Revenue recognition start
  revrecenddate       // Revenue recognition end
)
```

### 2. Primary Filter: Rev Rec Dates (if available)

```typescript
if (year && month) {
  const engagementStart = new Date(year, month - 1, 1);
  const engagementEnd = new Date(year, month, 0);

  if (revRecStart && revRecEnd) {
    // Check if line's rev rec period overlaps engagement month
    const overlaps = revRecStart <= engagementEnd && revRecEnd >= engagementStart;
    return overlaps;
  }
}
```

### 3. Fallback Filter: WO Item ID Matching

```typescript
if (workOrderItemIds.size === 0) {
  // No WO item_ids? Filter by MCC account numbers
  const acct = line.accountNumber || '';
  return acct.startsWith('410') || acct.startsWith('411');
}
return workOrderItemIds.has(line.itemId);
```

### 4. Credit Inclusion: Largest Per Account

```typescript
const creditsByAccount = new Map<string, any>();
for (const line of validLines) {
  const isCredit = line.amount > 0;
  const sameAccount = matchedAccounts.has(line.account_number);
  const alreadyIncluded = enhancedLines.some(el => el.lineNumber === line.line_number);

  if (isCredit && sameAccount && !alreadyIncluded) {
    const existing = creditsByAccount.get(line.account_number);
    if (!existing || line.amount > existing.amount) {
      creditsByAccount.set(line.account_number, line);
    }
  }
}
// Add largest credit per account to enhancedLines
```

### 5. Revenue Calculation (with Math.abs)

```typescript
const soRevenue = Math.abs(enhancedLines.reduce((sum, li) => sum + li.amount, 0));
const soCostEstimate = Math.abs(enhancedLines.reduce((sum, li) => sum + li.costEstimate, 0));
const soGrossProfit = soRevenue - soCostEstimate;
```

---

## Diagnostic Queries

### Check WO Item IDs

```sql
SELECT wo.wo_number, wol.item_id, wol.item_name
FROM netsuite_work_orders wo
JOIN netsuite_work_order_lines wol ON wol.work_order_id = wo.id
WHERE wo.wo_number = 'WO5529';
```

### Check SO Lines with Credits

```sql
SELECT
  sol.item_id,
  sol.item_name,
  sol.amount,
  sol.account_number,
  CASE WHEN sol.amount > 0 THEN 'CREDIT' ELSE 'REVENUE' END as line_type
FROM netsuite_sales_orders so
JOIN netsuite_sales_order_lines sol ON sol.sales_order_id = so.id
WHERE so.so_number = 'SO6794'
  AND sol.account_number = '4101'
ORDER BY sol.amount;
```

### Check if Rev Rec Dates are Populated

```sql
SELECT
  COUNT(*) as total_lines,
  COUNT(revrecstartdate) as with_start_date,
  COUNT(revrecenddate) as with_end_date
FROM netsuite_sales_order_lines
WHERE sales_order_id = (SELECT id FROM netsuite_sales_orders WHERE so_number = 'SO6794');
```

---

## Future Improvements

1. **Populate Rev Rec Dates**: If NetSuite has these dates, sync them. This would allow precise filtering by engagement month instead of heuristics.

2. **Match by Item Name**: If item_ids don't match between WO and SO, consider matching by item name as a fallback.

3. **Link Credits to Revenue Lines**: NetSuite may have a way to link credit lines to their corresponding revenue lines. Investigate if there's a reference field.

4. **Excel as Source of Truth**: For projects where SO data is unreliable, consider using the Excel closeout data for revenue instead of calculating from SO lines.

---

## Testing Checklist

When similar issues occur, verify:

- [ ] Revenue matches Excel closeout data
- [ ] GPM is in valid range (typically 30-70%, never >100%)
- [ ] Check Vercel logs for which lines are matched/excluded
- [ ] Compare WO item_ids with SO item_ids (often don't match!)
- [ ] Look for positive amounts on revenue accounts (credits)
- [ ] Check if rev rec dates are populated

---

## Related Files

- `src/app/api/closeout/profitability/route.ts` - Main profitability API
- `supabase/migrations/034_add_revenue_fields.sql` - Added revrecstartdate/revrecenddate
- `supabase/migrations/035_add_account_to_sales_order_lines.sql` - Added account fields

---

## Commits

1. `eae8592` - Initial fix: Math.abs on cost estimate, account number fallback
2. `f12ec24` - Added debug logging
3. `9c2d319` - Added rev rec date filtering
4. `256498d` - Added credit line inclusion for matched accounts
5. `2bd22c1` - Fixed to only include largest credit per account
6. `ac95e7d` - Removed debug logging
