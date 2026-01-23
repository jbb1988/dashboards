# CRITICAL: NetSuite account_number Field Documentation

## Problem Summary

**Symptom:** Sales Order line items appear in the database but don't show up in the profitability dashboard. The line items exist with all data (item_name, amount, quantity, etc.) but are filtered out and not displayed.

**Root Cause:** The `account_number` field is NULL for all line items, and the profitability API filters out lines without account_number (see `/src/app/api/closeout/profitability/route.ts` line 408).

## Critical Information

### NetSuite Data Model

1. **transactionLine table HAS an `account` field**
   - Field: `tl.account` (BIGINT, references account.id)
   - This is NOT clearly documented in the NetSuite schema
   - Most materials/parts lines do NOT have this field populated
   - Only revenue/service items have `tl.account` populated

2. **account_number must be fetched via JOIN**
   - The `account` table contains `acctnumber` and `acctname`
   - **WRONG:** `BUILTIN.DF(tl.account)` - this does NOT work
   - **CORRECT:** `LEFT JOIN account a ON a.id = tl.account`

### Which Line Items Have Accounts

**Lines WITH account_number:**
- Revenue items (account 4xxx series)
- Service items
- Fee items (project management, freight, etc.)
- Item IDs like: 94000001, 96000000, 82100211, 81100211, etc.

**Lines WITHOUT account_number:**
- Materials/parts (warehouse items ending in WH, E)
- Inventory items (these use item defaults, not transaction-level accounts)
- Comment lines
- Subtotal lines
- Item IDs like: 401030WH, 434731WH, 530001WH, etc.

**This is NORMAL NetSuite behavior** - not all transaction lines have GL accounts. Materials get their accounts from the item master record, not the transaction line.

## The Solution

### Correct SuiteQL Query Pattern

**ALWAYS use this pattern when fetching sales order line items:**

```sql
SELECT
  tl.id AS line_id,
  tl.linesequencenumber AS line_number,
  tl.item AS item_id,
  COALESCE(i.itemid, BUILTIN.DF(tl.item)) AS item_name,
  COALESCE(i.displayname, BUILTIN.DF(tl.item)) AS item_description,
  tl.itemtype AS item_type,
  tl.quantity,
  tl.rate,
  tl.amount,
  tl.costestimate,
  tl.class AS class_id,
  BUILTIN.DF(tl.class) AS class_name,
  tl.location AS location_id,
  tl.isclosed,
  -- CRITICAL: Fetch account via JOIN, not BUILTIN.DF
  tl.account AS account_id,
  a.acctnumber AS account_number,
  a.acctname AS account_name
FROM transactionline tl
LEFT JOIN item i ON i.id = tl.item
LEFT JOIN account a ON a.id = tl.account  -- MUST INCLUDE THIS JOIN
WHERE tl.transaction = {so_id}
  AND tl.mainline = 'F'
  AND tl.item IS NOT NULL
ORDER BY tl.linesequencenumber
```

### Database Insert Pattern

When inserting into `netsuite_sales_order_lines`:

```typescript
await supabase.from('netsuite_sales_order_lines').insert({
  sales_order_id: so.id,
  netsuite_line_id: line.line_id?.toString(),
  line_number: parseInt(line.line_number) || 0,
  item_id: line.item_id?.toString(),
  item_name: line.item_name,
  item_description: line.item_description,
  item_type: line.item_type,
  class_id: line.class_id?.toString(),
  class_name: line.class_name,
  quantity: parseFloat(line.quantity) || null,
  rate: parseFloat(line.rate) || null,
  amount: parseFloat(line.amount) || null,
  cost_estimate: parseFloat(line.costestimate) || null,
  location_id: line.location_id?.toString(),
  is_closed: line.isclosed === 'T',
  // CRITICAL: Include account fields
  account_number: line.account_number,
  account_name: line.account_name,
  updated_at: new Date().toISOString(),
});
```

## Endpoints That Do This Correctly

### ✅ Working Examples

**1. `/src/app/api/netsuite/truly-clean-2025/route.ts` (lines 235-241)**
```sql
tl.account AS account_id,
a.acctnumber AS account_number,
a.fullname AS account_name
FROM ...
LEFT JOIN Account a ON a.id = tl.account
```

**2. `/src/app/api/netsuite/force-insert-so3009-lines/route.ts` (FIXED)**
```sql
a.acctnumber AS account_number,
a.acctname AS account_name
FROM transactionline tl
LEFT JOIN account a ON a.id = tl.account
```

### ❌ Endpoints That Need Fixing

**1. `/src/lib/netsuite.ts` - `getAllSalesOrders()` function (lines 1841-1862)**
- Currently does NOT fetch account_number at all
- Only fetches: item_id, item_name, quantity, rate, amount, etc.
- **NEEDS FIX:** Add account JOIN to line items query

**2. `/src/app/api/netsuite/bulk-sync-lines/route.ts` (lines 26-50)**
- Currently does NOT fetch account_number
- Only fetches basic line item fields
- **NEEDS FIX:** Add account JOIN

**3. `/src/app/api/netsuite/scheduled-sync/route.ts` (lines 192-226)**
- Uses `getAllSalesOrders()` which doesn't fetch account_number
- **NEEDS FIX:** Use the truly-clean-2025 pattern instead

## How to Verify It's Working

### Test Query
```bash
curl -s "https://mars-dashboards.vercel.app/api/netsuite/check-so3009-lines" | \
  python3 -c "import sys, json; d=json.load(sys.stdin); \
  lines_with_acct = [l for l in d.get('lines', []) if l.get('account_number')]; \
  print(f'Lines with account_number: {len(lines_with_acct)}/{d[\"lineCount\"]}')"
```

Expected output:
```
Lines with account_number: 17/193
```

This is CORRECT - only revenue/service items have account_number, materials don't.

### Check Profitability View
```bash
curl -s "https://mars-dashboards.vercel.app/api/closeout/profitability?project=Fairfax&year=2025" | \
  python3 -c "import sys, json; d=json.load(sys.stdin); \
  so=d.get('salesOrders', [])[0] if d.get('salesOrders') else {}; \
  print(f'Line Items: {so.get(\"totals\", {}).get(\"lineItemCount\")}'); \
  print(f'Revenue: \${so.get(\"totals\", {}).get(\"revenue\", 0):,.2f}')"
```

Expected output:
```
Line Items: 17
Revenue: $982,066.00
```

If you see **Line Items: 0**, the account_number field is missing.

## Historical Context

### Timeline
- **Pre-Jan 18, 2026:** All sync endpoints did NOT fetch account_number
  - `getAllSalesOrders()` - no account field
  - `bulk-sync-lines` - no account field
  - `scheduled-sync` - no account field
  - Result: Line items existed in DB but didn't show in profitability view

- **Jan 18, 2026:** `truly-clean-2025` endpoint created with proper account JOIN
  - Boston 2025 synced using this → has account_number ✅
  - Other projects still broken ❌

- **Jan 23, 2026:** Discovered the issue during Fairfax 2025 debugging
  - SO3009 (Fairfax) had 193 lines but 0 visible
  - Fixed by adding account JOIN to force-insert endpoint
  - Now Fairfax 2025 shows 17 revenue line items ✅

### Why This Was Hard to Debug
1. Line items existed in database (looked fine in SQL queries)
2. NetSuite API returned data successfully (200 OK responses)
3. No error messages - just silently filtered out
4. Filter on line 408 of profitability API: `if (!line.account_number) return false;`
5. Not obvious that account_number should come from a JOIN, not direct field

## The Profitability API Filter

**File:** `/src/app/api/closeout/profitability/route.ts` (line 408)

```typescript
const validLines = (so.netsuite_sales_order_lines || []).filter((line: any) => {
  const itemName = line.item_name || '';
  const itemType = line.item_type || '';
  const accountNumber = line.account_number || '';

  // Exclude various non-revenue items
  if (itemName === 'Subtotal') return false;
  if (itemName === 'Comment') return false;
  if (itemName.startsWith('-Not Taxable-')) return false;
  if (itemType === 'TaxGroup') return false;
  if (itemType === 'Subtotal') return false;
  if (itemType === 'Description') return false;
  if (accountNumber === '2050') return false;

  // CRITICAL: Only include revenue line items (those with account numbers)
  if (!line.account_number) return false;  // <-- THIS LINE FILTERS OUT ALL LINES WITHOUT ACCOUNTS

  return true;
});
```

**This filter is correct** - it's designed to show only revenue/billable items, not materials/parts. But it requires that account_number be populated correctly via the JOIN.

## Action Items

### Immediate (Done)
- ✅ Fixed Fairfax 2025 (SO3009) using force-insert endpoint
- ✅ Documented this critical issue

### Future (TODO)
- ⚠️ Fix `getAllSalesOrders()` in `/src/lib/netsuite.ts` to include account JOIN
- ⚠️ Fix `bulk-sync-lines` to include account JOIN
- ⚠️ Update `scheduled-sync` to use correct pattern
- ⚠️ Re-sync all historical data with account_number field
- ⚠️ Add validation/warning when account_number is missing

## Quick Reference

**Command to fix a specific SO:**
```bash
# Create a force-insert endpoint for that SO
# Use the pattern from force-insert-so3009-lines/route.ts
# Run: curl -X POST "https://mars-dashboards.vercel.app/api/netsuite/force-insert-so{NUMBER}-lines"
```

**What to look for in NetSuite queries:**
```sql
✅ GOOD: LEFT JOIN account a ON a.id = tl.account
❌ BAD:  BUILTIN.DF(tl.account) AS account_number  -- DOESN'T WORK
❌ BAD:  Missing account JOIN entirely
```

## Expected Behavior

**Normal line item distribution for a typical Sales Order:**
- Total lines: 193
- Lines with account_number: 15-20 (revenue/service items)
- Lines without account_number: 173-178 (materials/parts)

**Visible in profitability dashboard:** Only the 15-20 revenue lines
**This is correct** - materials don't appear as line items, they're rolled up into cost estimates.

---

**Last Updated:** January 23, 2026
**Author:** Claude Code (after debugging Fairfax SO3009)
**Severity:** CRITICAL - affects all sales order line item visibility
