# Budget and WIP Report Integration - Complete Guide

## Overview

Enhanced the profitability dashboard with two major features:
1. **Budget Integration** - Pull budget data from NetSuite Budget vs Actuals report
2. **WIP Report Option** - Use real-time WIP reports for active projects

## 1. Budget Integration

### NetSuite Account Structure

**Revenue Accounts (4xxx)**
- 4011 = Test Bench Equipment New
- 4012 = Test Bench Equipment Upgrade
- 4081 = Deferred Revenue M3 (multi-year contracts)
- 41xx = MCC Services
- etc.

**COGS Accounts (5xxx)**
- 5011 = Test Bench Equipment Cost
- 5012 = Test Bench Equipment Upgrade Cost
- 5081 = Deferred Revenue M3 Cost
- 51xx = MCC Services Cost
- etc.

### Database Schema

**New Table: `netsuite_project_budgets`**

```sql
CREATE TABLE netsuite_project_budgets (
  id UUID PRIMARY KEY,
  project_name VARCHAR(255) NOT NULL,
  project_year INTEGER NOT NULL,
  customer_id VARCHAR(50),

  -- Budget from NetSuite Report 492
  budget_revenue DECIMAL(15,2),    -- Sum of 4xxx accounts
  budget_cost DECIMAL(15,2),       -- Sum of 5xxx accounts

  -- Auto-calculated
  budget_gross_profit DECIMAL(15,2),
  budget_gross_margin_pct DECIMAL(5,2),

  -- Metadata
  source_report VARCHAR(100),
  synced_at TIMESTAMPTZ,

  UNIQUE(project_name, project_year)
);
```

### API Endpoints

#### Query Budget Data
```bash
GET /api/netsuite/budget-report?project=Seattle&year=2025

Response:
{
  "budgets": [{
    "customerName": "Seattle, City of",
    "revenue": { "budget": 216994, "accounts": [...] },
    "cogs": { "budget": 45000, "accounts": [...] },
    "grossProfit": 171994,
    "grossMarginPct": 79.26
  }],
  "totalRevenueBudget": 216994,
  "totalCogsBudget": 45000
}
```

#### Sync Budget Data
```bash
POST /api/netsuite/sync-budgets

Response:
{
  "success": true,
  "budgets": [...],
  "count": 25
}
```

### Integration with Profitability Dashboard

The profitability endpoint now automatically:
1. Checks for NetSuite budget data in `netsuite_project_budgets`
2. Falls back to Excel data in `closeout_projects` if not found
3. Indicates source in response

```bash
GET /api/closeout/profitability?project=Seattle&year=2025

Response:
{
  "kpis": {
    "revenue": 216994,
    "cost": 34852,
    "budgetRevenue": 216994,  // From NetSuite or Excel
    "budgetCost": 45000       // From NetSuite or Excel
  },
  "syncStatus": {
    "budgetSource": "netsuite"  // or "excel"
  }
}
```

## 2. WIP Report Integration

### Optional Real-Time Cost Data

For active/open projects, you can now optionally use NetSuite WIP reports for real-time costs:

```bash
# Use synced database (default - recommended for closed projects)
GET /api/closeout/profitability?project=Seattle&year=2025

# Use WIP reports (real-time - good for active projects)
GET /api/closeout/profitability?project=Seattle&year=2025&useWipReport=true
```

### Response Indicates Data Source

```json
{
  "syncStatus": {
    "dataSource": "database",  // or "wip-report"
    "budgetSource": "netsuite", // or "excel"
    "note": "Using synced database for cost data (recommended for closed projects)"
  }
}
```

### When to Use Each Option

| Scenario | Recommended | Why |
|----------|-------------|-----|
| Closed/completed projects | `database` (default) | Stable, fast, already synced |
| Active/WIP projects | `useWipReport=true` | Real-time costs, no sync delay |
| Historical analysis | `database` | Consistent snapshots |
| Budget planning | Either | Both have current actuals |

## 3. Data Flow Diagram

```
NetSuite Budget Report (492)
           ↓
    [Sync Budget API]
           ↓
  netsuite_project_budgets table
           ↓
    [Profitability API] ← Falls back to closeout_projects (Excel)
           ↓
        Dashboard

NetSuite WIP Reports (1654/1963)
           ↓
    [Optional: useWipReport=true]
           ↓
    [Profitability API] ← Default uses synced database
           ↓
        Dashboard
```

## 4. Setup & Sync Process

### Step 1: Run Migration

```bash
npx supabase db push
# Applies 030_add_project_budgets.sql
```

### Step 2: Sync Budget Data

```bash
# Sync all project budgets from NetSuite
curl -X POST http://localhost:3000/api/netsuite/sync-budgets
```

### Step 3: Query Budget Data

```bash
# Check what was synced
curl http://localhost:3000/api/netsuite/budget-report?project=Seattle
```

### Step 4: Use in Dashboard

The profitability dashboard will automatically use NetSuite budget data when available.

## 5. Budget vs Actuals Analysis

With both budget and actual data, the dashboard can now show:

```typescript
{
  "kpis": {
    // Budget (from NetSuite Report 492)
    "budgetRevenue": 216994,
    "budgetCost": 45345,

    // Actuals (from synced data or WIP reports)
    "actualRevenue": 216994,
    "actualCost": 34852,

    // Variance Analysis (auto-calculated)
    "revenue": 216994,
    "cost": 34852,
    "grossProfit": 182142,
    "grossMarginPct": 83.94,
    "cpi": 1.30  // Cost Performance Index
  }
}
```

### Cost Performance Index (CPI)

```
CPI = Budget Cost / Actual Cost
CPI = 45,345 / 34,852
CPI = 1.30

CPI > 1.0 = Under budget (good!)
CPI = 1.0 = On budget
CPI < 1.0 = Over budget (bad!)
```

Seattle project has **CPI of 1.30** meaning actual costs are 30% lower than budgeted!

## 6. NetSuite Report 492 Integration

### Accessing the Report

URL: `https://3850636.app.netsuite.com/app/reporting/reportrunner.nl?cr=492`

This is the "Budget vs Actuals" report that provides:
- Budget revenue by account (4xxx)
- Budget cost by account (5xxx)
- Actual revenue
- Actual cost
- Variance analysis

### Data Structure

The report likely queries:
- `budgets` table - Budget header
- `budgetlines` table - Budget line items by account
- `transaction` + `transactionline` - Actual values
- `account` table - Account names and numbers

## 7. Implementation Notes

### Budget Data Sync Frequency

**Recommendation**: Sync weekly or monthly
- Budgets don't change frequently
- Manual sync via POST endpoint
- Can be automated with cron job if needed

### WIP Report Usage

**Recommendation**: Use selectively
- Good for active projects needing real-time visibility
- Default database method is faster and works for most cases
- Consider caching WIP report results if used frequently

### Excel Data Migration

**Current State**: Excel data in `closeout_projects` still works
**Future State**: Can be replaced entirely by NetSuite budget data
**Migration Path**:
1. Sync all historical budgets from NetSuite
2. Verify data matches Excel
3. Switch to NetSuite as primary source
4. Archive Excel data

## 8. API Reference

### Budget Endpoints

```bash
# Query budget data
GET /api/netsuite/budget-report
  ?project=<name>
  ?year=<yyyy>
  ?customer=<name>

# Sync budget data from NetSuite
POST /api/netsuite/sync-budgets
```

### Profitability Endpoint Updates

```bash
GET /api/closeout/profitability
  ?project=<name>           # Required
  ?year=<yyyy>              # Optional
  ?useWipReport=<true|false>  # Optional, default: false

Response:
{
  "kpis": {
    "budgetRevenue": 216994,
    "budgetCost": 45345,
    "actualRevenue": 216994,
    "actualCost": 34852
  },
  "syncStatus": {
    "budgetSource": "netsuite|excel",
    "dataSource": "database|wip-report"
  }
}
```

## 9. Next Steps

### Immediate
- [x] Create budget table
- [x] Add budget API endpoints
- [x] Integrate with profitability dashboard
- [x] Add WIP report option

### Soon
- [ ] Sync budget data for all projects
- [ ] Add DRMCC product type classification (need account number)
- [ ] Create budget variance dashboard
- [ ] Add budget trend analysis

### Future
- [ ] Automate budget sync with cron job
- [ ] Create budget forecasting
- [ ] Add budget approval workflow
- [ ] Historical budget comparison

## 10. Benefits

### Before
- Budget data only in Excel spreadsheets
- Manual reconciliation required
- No real-time cost visibility
- Single data source

### After
- ✅ Budget data from NetSuite Report 492
- ✅ Automatic budget vs actual comparison
- ✅ Optional real-time WIP report costs
- ✅ CPI tracking (Cost Performance Index)
- ✅ Flexible data sources based on project stage
- ✅ Falls back gracefully to Excel when needed

## 11. Account Number Reference

### Revenue Accounts (4xxx)

| Account | Description | Product Type |
|---------|-------------|--------------|
| 4011 | Test Bench Equipment New | TBEN |
| 4012 | Test Bench Equipment Upgrade | TBEU |
| 4013 | Project Management Fee | PM |
| 4018 | Shipping/Handling | SCH |
| 403x | Test Bench Install | TBIN |
| 404x | M3 Install | M3IN |
| 4051 | M3 Software New | M3NEW |
| 405x | M3 Software | M3 Software |
| 407x | Test Bench Service | TB Service |
| 4081 | Deferred Revenue M3 | DRM3 |
| 408x/409x | M3 Software Renewal | M3 Software |
| 410x/411x | MCC Services | MCC |

### COGS Accounts (5xxx)

Mirror structure of 4xxx accounts:
- 5011 = Cost for 4011
- 5012 = Cost for 4012
- 5081 = Cost for 4081
- etc.

## 12. Troubleshooting

### Budget Data Not Showing

**Check:**
1. Has budget been synced? `POST /api/netsuite/sync-budgets`
2. Does project name match? Check case sensitivity
3. Is year correct? Check fiscal year vs calendar year
4. Falls back to Excel? Check `syncStatus.budgetSource`

### WIP Report Slow

**Solution:**
- Don't use `useWipReport=true` for closed projects
- Cache WIP report results if needed
- Default database method is much faster

### Missing DRMCC Classification

**Need:** Account number for Deferred Revenue MCC
- Similar to DRM3 (4081/5081)
- Likely 4181/5181 or similar
- Check NetSuite chart of accounts

## Summary

The profitability dashboard now has:
1. ✅ Budget integration from NetSuite Report 492
2. ✅ Optional WIP report for real-time costs
3. ✅ Flexible data sources
4. ✅ Budget vs actual comparison
5. ✅ CPI tracking
6. ✅ Graceful fallbacks

All while maintaining backward compatibility with existing Excel data!
