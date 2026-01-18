# PROJECT PROFITABILITY DASHBOARD - BOARD PRESENTATION PLAN
## CRITICAL TIMELINE: Execute immediately for board presentation

---

## STEP 1: SYNC ALL LINE ITEMS (30 minutes)

### 1a. Sync Work Order Line Items
```bash
# This gets ALL component costs for work orders
curl -X POST "http://localhost:3000/api/netsuite/bulk-sync-lines?type=WorkOrd&startDate=2023-01-01"
```
**What this does:** Fetches ALL work order line items (components, assemblies, costs) in ONE bulk query instead of 2,386 individual API calls.

**Expected result:** ~35,000+ work order lines with complete item names, costs, quantities

### 1b. Re-sync Sales Order Line Items (Fix NULL item_names)
```bash
# This FIXES the NULL item_name issue by using COALESCE with BUILTIN.DF fallback
curl -X POST "http://localhost:3000/api/netsuite/bulk-sync-lines?type=SalesOrd&startDate=2023-01-01"
```
**What this does:** Re-syncs sales order line items using the improved query with `COALESCE(i.itemid, BUILTIN.DF(tl.item))` to eliminate NULLs.

**Expected result:** ~4,000+ sales order lines with NO NULL item_names

### 1c. Verify Data Quality
```bash
# Check for NULL item_names after sync
curl "http://localhost:3000/api/netsuite/verify-line-items"
```

---

## STEP 2: CREATE THE BOARD DASHBOARD QUERY (15 minutes)

Create a new API endpoint that joins everything together:

**File:** `src/app/api/profitability/project-detail/route.ts`

### Core Query Structure:
```sql
WITH project_sales AS (
  -- Get all sales orders by project (customer)
  SELECT
    so.customer_name AS project_name,
    so.so_number,
    so.so_date,
    sol.item_name,
    sol.quantity,
    sol.rate,
    sol.amount AS revenue,
    sol.cost_estimate
  FROM netsuite_sales_orders so
  LEFT JOIN netsuite_sales_order_lines sol ON sol.sales_order_id = so.id
  WHERE so.class_name LIKE '%TB%' OR so.class_name LIKE '%MCC%'  -- Filter your project types
),
project_work_orders AS (
  -- Get all work orders linked to those sales orders
  SELECT
    wo.customer_name AS project_name,
    wo.created_from_so_number AS so_number,
    wo.wo_number,
    wo.wo_date,
    wol.item_name,
    wol.quantity,
    wol.unit_cost,
    wol.line_cost AS cost
  FROM netsuite_work_orders wo
  LEFT JOIN netsuite_work_order_lines wol ON wol.work_order_id = wo.id
  WHERE wo.created_from_so_number IS NOT NULL
)
SELECT
  ps.project_name,
  ps.so_number,
  ps.item_name AS sold_item,
  ps.quantity AS qty_sold,
  ps.revenue,
  pwo.wo_number,
  pwo.item_name AS component_item,
  pwo.quantity AS component_qty,
  pwo.cost AS component_cost
FROM project_sales ps
LEFT JOIN project_work_orders pwo ON ps.so_number = pwo.so_number
ORDER BY ps.project_name, ps.so_number, pwo.wo_number;
```

---

## STEP 3: BUILD THE BOARD-READY FRONTEND (1-2 hours)

### Dashboard Layout:
```
┌─────────────────────────────────────────────────────────────┐
│  PROJECT PROFITABILITY DASHBOARD - [Project Name]          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📊 SUMMARY METRICS                                         │
│  ┌──────────────┬──────────────┬──────────────┬──────────┐ │
│  │ Total Revenue│ Total Costs  │ Gross Profit │   Margin │ │
│  │   $125,000   │   $78,000    │   $47,000    │   37.6%  │ │
│  └──────────────┴──────────────┴──────────────┴──────────┘ │
│                                                             │
│  📋 SALES ORDERS                                            │
│  ┌─────────────────────────────────────────────────────────┤
│  │ SO-12345 | 2025-01-15 | $45,000 Revenue                 │
│  │   ├─ Assembly XYZ     Qty: 10   Price: $4,000  $40,000 │
│  │   └─ Service Install  Qty: 1    Price: $5,000  $5,000  │
│  │                                                         │
│  │   🔧 WORK ORDERS FOR SO-12345                          │
│  │   ├─ WO-8901 | Assembly XYZ                            │
│  │   │   ├─ Component A   Qty: 10   Cost: $500   $5,000   │
│  │   │   ├─ Component B   Qty: 20   Cost: $150   $3,000   │
│  │   │   └─ Labor Hours   Qty: 40   Cost: $75    $3,000   │
│  │   │   TOTAL WO COST: $11,000                            │
│  │   │                                                     │
│  │   SO-12345 Profitability:                              │
│  │   Revenue: $45,000 | Costs: $11,000 | Profit: $34,000  │
│  └─────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────┘
```

### Component Structure:
- **File:** `src/app/profitability/[project]/page.tsx`
- Show expandable/collapsible sales orders
- Nest work orders under their source SO
- Show ALL line item detail (NO NULLS!)
- Calculate margins at SO level and project level

---

## STEP 4: ELIMINATE NULL VALUES (Critical for Board)

### NetSuite SuiteQL Best Practices for NULL Prevention:

1. **Use COALESCE with BUILTIN.DF fallback** (already in bulk-sync-lines)
   ```sql
   COALESCE(i.itemid, BUILTIN.DF(tl.item)) AS item_name
   ```

2. **Handle mainline rows correctly**
   ```sql
   WHERE tl.mainline = 'F' AND tl.item IS NOT NULL
   ```

3. **Always LEFT JOIN Item table**
   ```sql
   LEFT JOIN Item i ON i.id = tl.item
   ```

4. **Provide display fallbacks in frontend**
   ```typescript
   const displayName = item_name || item_description || `Item #${item_id}` || 'Unknown Item';
   ```

---

## STEP 5: DATA VALIDATION CHECKLIST

Before the board presentation, verify:

- [ ] All sales order lines have item_name (no NULLs)
- [ ] All work order lines have item_name (no NULLs)
- [ ] Work orders correctly link to sales orders via `created_from_so_number`
- [ ] Revenue totals match NetSuite (run spot check on 3-5 projects)
- [ ] Cost totals match NetSuite (compare WO costs)
- [ ] Margins are reasonable (20-60% typical for manufacturing)
- [ ] All projects from 2025 are included
- [ ] No duplicate line items (check unique constraint violations)

---

## ALTERNATIVE APPROACH: Use Existing project_profitability Table

If time is extremely limited, you can use the existing `project_profitability` table which tracks transaction-level data (invoices):

### Pros:
- Already synced and working
- Has revenue and costestimate data
- Shows actual billed amounts

### Cons:
- **Missing operational detail** (no SO → WO chain)
- **Missing line item detail** (what was sold, what components)
- Only shows aggregate invoice data, not project structure

### Quick Board Dashboard from Existing Data:
```sql
SELECT
  customer_name AS project,
  year,
  SUM(CASE WHEN is_revenue THEN amount ELSE 0 END) AS revenue,
  SUM(costestimate) AS cogs,
  SUM(CASE WHEN is_revenue THEN amount ELSE 0 END) - SUM(costestimate) AS gross_profit
FROM project_profitability
WHERE year IN (2024, 2025)
  AND project_type IN ('TB', 'MCC', 'M3')
GROUP BY customer_name, year
ORDER BY year DESC, revenue DESC;
```

**Use this if:** The board only needs high-level P&L by project, not operational detail.

---

## RECOMMENDED EXECUTION ORDER

### FOR BOARD PRESENTATION IN < 4 HOURS:

1. **Run bulk-sync-lines** for both WorkOrd and SalesOrd (30 min)
2. **Create simple project detail API** that joins SO → WO → Lines (30 min)
3. **Build simple frontend table** showing hierarchy (1 hour)
4. **Test with 3-5 real projects** to validate accuracy (30 min)
5. **Create 1-page summary** for board with key metrics (30 min)
6. **Buffer time** for fixes/adjustments (1 hour)

### FOR BOARD PRESENTATION IN < 1 HOUR (Emergency):

1. **Skip line items**, use existing `project_profitability` table
2. **Create simple summary query** grouped by project/year
3. **Export to Excel** with pivot tables (board is familiar with this)
4. **Add manual notes** for any anomalies

---

## KEY NETSUITE LINKS FOR WORK ORDER → SALES ORDER

Based on research, the relationship is:
- **Transaction table:** `created_from` field on work order points to sales order
- **TransactionLine table:** `sourceTransactionId` and `sourceTransactionLine` link WO lines to SO lines

Your schema already captures this:
```sql
-- netsuite_work_orders table
created_from_so_id VARCHAR(50),
created_from_so_number VARCHAR(100),
```

This is populated during sync from:
```sql
SELECT
  t.id AS transaction_id,
  t.tranid AS wo_number,
  BUILTIN.DF(t.createdfrom) AS created_from_so_number
FROM Transaction t
WHERE t.type = 'WorkOrd'
```

---

## ACCURACY GUARANTEES

To ensure NO NULL values for board presentation:

1. **Database constraints:** Add NOT NULL constraints on critical fields
   ```sql
   ALTER TABLE netsuite_sales_order_lines
   ALTER COLUMN item_name SET NOT NULL;
   ```

2. **Validation queries:**
   ```sql
   -- Find any NULLs before presenting
   SELECT COUNT(*) FROM netsuite_sales_order_lines WHERE item_name IS NULL;
   SELECT COUNT(*) FROM netsuite_work_order_lines WHERE item_name IS NULL;
   ```

3. **Fallback display logic:**
   ```typescript
   const safeItemName = item_name || item_description || `Item ID: ${item_id}`;
   ```

---

## SOURCES & RESEARCH

- [NetSuite Project 360 Dashboard Best Practices](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_164252378090.html)
- [Advanced Project Profitability](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_1484339384.html)
- [SuiteQL Work Order Queries (Tim Dietrich)](https://timdietrich.me/blog/netsuite-suiteql-work-order-queries/)
- [NetSuite Work Order to Sales Order Linking](https://netsuiteprofessionals.com/blog/question/source-transaction-line-field-on-work-order-from-related-sales-order/)
- [SuiteQL Transaction Line Mainline Handling](https://devblog.mirerp.com/posts/suiteql-transactionline-mainline/)

---

## DECISION POINT: Which Approach?

**Ask yourself:**

1. **Does the board need line item detail?**
   - YES → Use SO/WO tables approach (Steps 1-5 above)
   - NO → Use existing project_profitability table (Alternative approach)

2. **How much time do you have?**
   - < 1 hour → Use project_profitability + Excel export
   - 2-4 hours → Build SO/WO detail dashboard
   - 1+ days → Build full drill-down dashboard with charts

3. **What's the accuracy requirement?**
   - Exact match to NetSuite → Use transaction-level profitability
   - Operational detail → Use SO/WO approach
   - Both → Build separate views for each

---

## NEXT IMMEDIATE ACTIONS

**RIGHT NOW:**
1. Run the bulk sync commands (Step 1a, 1b)
2. While syncing, decide: Line item detail or summary only?
3. Build the appropriate dashboard based on decision
4. Test with real data
5. Present to board

**Need help?** The bulk-sync-lines endpoint is already built and ready to use. Just run the curl commands.
