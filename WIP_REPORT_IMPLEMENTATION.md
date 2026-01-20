# WIP Report Integration - Implementation Summary

## Saved Search IDs

- **MARS WIP Report-TB Review (Summary)**: Search ID `1654`
- **MARS WIP Report-TB Review (Itemized Detail)**: Search ID `1963`

## Files Created

### 1. Library Functions
**`/src/lib/netsuite-wip-reports.ts`**
- `getWIPReportSummary()` - Recreates Search ID 1654 logic
- `getWIPReportDetail()` - Recreates Search ID 1963 logic

### 2. API Endpoints
**`/src/app/api/netsuite/wip-report-summary/route.ts`**
- GET endpoint for summary report
- Query params: customer, salesOrder, workOrder, dateFrom, dateTo

**`/src/app/api/netsuite/wip-report-detail/route.ts`**
- GET endpoint for detailed report
- Query params: customer, workOrder, dateFrom, dateTo

## Cost Calculation Formulas (from NetSuite Saved Search)

Based on the saved search columns you provided:

### Labor Hours
```sql
CASE WHEN {item} IN (
  'Maintenance Calibration / Certification Labor',
  'Assembly Labor', 'Electrical Labor', 'Fab Labor', 'Fab Tank Labor',
  'CA Maintenance Calibration / Certification Labor',
  'Hardware Install & Training Labor', 'Crating & Shipping Labor',
  'Service Call Labor', 'Software Install & Training Labor',
  'Saw Labor', 'Test Labor'
) THEN ({quantity}) ELSE 0 END
```

### Labor $
```sql
CASE WHEN {item} IN (
  -- Labor items (same as above) PLUS overhead items:
  'Assembly Overhead', 'Crating & Shipping Overhead',
  'Electrical Overhead', 'Fab Overhead', 'Fab Tank Overhead',
  'Hardware Install & Training Overhead',
  'Maintenance Calibration / Certification Overhead',
  'Saw Overhead', 'Service Call Overhead',
  'Overhead - Software Install & Training', 'Test OH'
) THEN ({amount}) ELSE 0 END
```

### Expense Report $
```sql
CASE WHEN {item} IN (
  'Test Bench Expense Report',
  'Test Bench Outside Services'
) THEN ({amount}) ELSE 0 END
```

### Material $
```sql
CASE WHEN {itemtype} IN ('Assembly', 'InvtPart', 'NonInvtPart')
  OR {item} IN ('Test Bench Misc Material', 'Non Stock Purchases')
THEN ({amount}) ELSE 0 END
```

### Freight $
```sql
CASE WHEN {item} IN (
  'Test Bench Crating & Shipping-FREIGHT',
  'Test Bench Crating & Shipping-MATERIAL'
) THEN ({amount}) ELSE 0 END
```

## CRITICAL DISCOVERY: Field Discrepancy

**Issue**: The WIP report formulas use `{amount}` (line_cost) for all calculations, BUT we discovered that:
- Expense Report items have `line_cost = 0`, value is in `quantity` field
- Freight items have `line_cost = 0`, value is in `quantity` field

**Questions to Resolve**:
1. Does the NetSuite WIP report show correct costs for Seattle project?
2. If yes, how does `{amount}` capture expense/freight costs when line_cost is 0?
3. Is there a difference between:
   - `transactionline.amount` (what saved search uses)
   - `netsuite_work_order_lines.line_cost` (what we sync to DB)

## Current vs. WIP Report Logic

### Current Profitability Calculation
```typescript
// Uses BOTH line_cost and quantity based on item patterns
if (itemType === 'OthCharge' && line_cost === 0 && quantity > 0) {
  // Check if it's expense/shipping/service item
  if (matches patterns) {
    return sum + Math.abs(quantity);
  }
}
return sum + Math.abs(line_cost);
```
**Result**: $34,852 (matches Excel)

### WIP Report Formula Logic
```typescript
// Uses only {amount} field
if (item matches labor/overhead/expense/freight/material patterns) {
  return sum + Math.abs(amount);
}
```
**Expected Result**: Need to test with actual NetSuite {amount} field

## Next Steps

### Option A: Use Saved Search Directly
If NetSuite REST API supports querying saved searches by ID:
```typescript
const results = await netsuiteRequest('/services/rest/search/1654', {
  method: 'POST',
  body: { filters: {...} }
});
```

### Option B: Sync WIP Report Data
1. Add new tables: `wip_report_summary`, `wip_report_detail`
2. Create sync endpoint to pull from saved search
3. Update profitability dashboard to query these tables

### Option C: Hybrid Approach (Recommended)
1. Keep current line-item logic for closed WOs (works perfectly)
2. Query WIP reports for open/in-progress WOs
3. This gives us:
   - Accurate costs for closed projects
   - Real-time costs for active projects
   - Consistency with NetSuite reports

## DRMCC Classification

Still need:
- Account number for DRMCC (Deferred Revenue MCC)
- Similar to DRM3 which uses 4081/5081
- Likely 4181/5181 or similar?

## Testing Needed

1. Run WIP report in NetSuite for Seattle project
2. Compare totals:
   - Labor $
   - Expense Report $
   - Material $
   - Freight $
   - Total Cost
3. Verify they match our calculations ($34,852)
4. If they don't match, investigate field mapping

## Questions for User

1. What account number should DRMCC use?
2. Can you run the WIP report for Seattle and share the totals?
3. Do you have access to query NetSuite saved searches via API?
4. Would you prefer to:
   - Use saved searches directly (if API supports it)
   - Recreate the logic in our code
   - Sync WIP report data to our database
