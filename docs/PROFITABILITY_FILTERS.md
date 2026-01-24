# Profitability Dashboard Filters Guide

## Overview

The Profitability Dashboard supports granular filtering to handle projects with multiple engagements in the same year. This allows you to view and analyze specific work periods, service types, or separate installations for the same customer.

## Problem Statement

Some customers have multiple separate engagements within the same year:
- **Example:** Plano 2025
  - February 2025: Equipment installation (TBEN, PM, TBIN, etc.) - $153,708
  - June 2025: Maintenance & Calibration service (MCC) - $9,586

Without filters, these would be aggregated together showing $163,292 total, making it difficult to analyze each engagement separately.

## Available Filters

### 1. Year Filter
- **Purpose:** Filter by fiscal/calendar year
- **Format:** 4-digit year (e.g., 2025)
- **Usage:** Enter year or leave blank for all years
- **Example:** `2025` shows only 2025 projects

### 2. Month Filter (NEW)
- **Purpose:** Filter by specific month within a year
- **Format:** Dropdown (January - December)
- **Usage:** Select month or choose "All" for no month filter
- **Example:** `February` + `2025` shows only February 2025 engagements

### 3. Project Type Filter (NEW)
- **Purpose:** Filter by work type/category
- **Format:** Dropdown with common project types
- **Options:**
  - **TBEN** - Test Bench Equipment New
  - **TBEU** - Test Bench Equipment Upgrade
  - **TBIN** - Test Bench Install & Training New
  - **TBIU** - Test Bench Install & Training Upgrade
  - **M3NEW** - M3 Software New
  - **M3IN** - M3 Install
  - **M3IU** - M3 Upgrade
  - **DRM3** - Deferred Revenue M3
  - **DRMCC** - Deferred Revenue MCC
  - **MCC** - Maintenance & Calibration Services
  - **PM** - Project Management
  - **SCH** - Shipping & Handling
- **Usage:** Select type or choose "All" for no type filter

## How to Use Filters

### Basic Usage

1. **Search for project:** Enter project name (e.g., "Plano")
2. **Set year:** Enter year in Year field (e.g., "2025")
3. **Click Search:** View aggregated results for all engagements

### Advanced Usage: Filtering Multiple Engagements

When a project has the **"Multiple entries"** indicator:

1. **Identify the engagements:**
   - Check the badge count (e.g., "2x" means 2 separate engagements)
   - Note the types and months shown in the project browser

2. **Filter to specific engagement:**
   - **Option A: By Month**
     - Set Year: `2025`
     - Set Month: `February`
     - Click Search → Shows only February engagement

   - **Option B: By Type**
     - Set Year: `2025`
     - Set Type: `MCC`
     - Click Search → Shows only MCC engagements

   - **Option C: Combined**
     - Set Year: `2025`
     - Set Month: `June`
     - Set Type: `MCC`
     - Click Search → Shows only June MCC engagement

### Clearing Filters

- **Month:** Select "All" from dropdown
- **Type:** Select "All" from dropdown
- **Year:** Delete value from field
- **All:** Click "Browse" then select a new project (resets all filters)

## Real-World Examples

### Example 1: Plano 2025 - Separate Installations

**Scenario:** Plano has equipment installation in February and MCC service in June

**View February Installation:**
```
Project: Plano
Year: 2025
Month: February
Type: (All)
Result: $153,708 revenue, 6 different project types
```

**View June MCC Service:**
```
Project: Plano
Year: 2025
Month: June
Type: (All)
Result: $9,586 revenue, MCC service only
```

**View All 2025 Together:**
```
Project: Plano
Year: 2025
Month: (All)
Type: (All)
Result: $163,292 revenue, all engagements combined
```

### Example 2: Filter by Service Type Across All Customers

**View all MCC engagements for a customer:**
```
Project: [Customer Name]
Year: 2025
Month: (All)
Type: MCC
Result: All MCC maintenance services for that customer in 2025
```

### Example 3: Quarterly Analysis

**View Q1 engagements:**
```
Project: [Customer Name]
Year: 2025
Month: January (then February, then March)
Type: (All)
Result: Analyze each month of Q1 separately
```

## Multiple Engagement Indicator

### What It Means

Projects with multiple entries in the same year show:
- **Badge:** Small blue badge with count (e.g., "2x", "3x")
- **Subtitle:** "Multiple entries" text in project info
- **Tooltip:** Hover over badge for explanation

### When You See It

The indicator appears when:
- Same customer has multiple separate engagements in one year
- Different months (Feb installation, June service)
- Different work types (TBEN in Jan, MCC in Jun)
- Mix of both (Feb TBEN + Feb MCC + Jun MCC)

### How to Handle It

1. **Click the project** → Shows aggregated total
2. **Use Month/Type filters** → View each engagement separately
3. **Compare engagements** → Switch filters to compare different periods

## API Filter Parameters

For developers or API usage:

```
GET /api/closeout/profitability?project={name}&year={year}&month={month}&type={type}
```

**Parameters:**
- `project` (required): Project name (e.g., "Plano")
- `year` (optional): 4-digit year (e.g., "2025")
- `month` (optional): Month number 1-12 (e.g., "2" for February)
- `type` (optional): Project type code (e.g., "MCC", "TBEN")

**Examples:**
```
/api/closeout/profitability?project=Plano&year=2025
/api/closeout/profitability?project=Plano&year=2025&month=2
/api/closeout/profitability?project=Plano&year=2025&type=MCC
/api/closeout/profitability?project=Plano&year=2025&month=6&type=MCC
```

## Filter Combinations

Filters work independently and can be combined:

| Year | Month | Type | Result |
|------|-------|------|--------|
| ✓ | - | - | All engagements in that year |
| ✓ | ✓ | - | All engagements in specific month |
| ✓ | - | ✓ | All engagements of that type in year |
| ✓ | ✓ | ✓ | Specific engagement (month + type + year) |
| - | ✓ | - | Error: Month requires year |
| - | - | ✓ | All engagements of that type across all years |

## Best Practices

### When to Use Filters

1. **Multiple entries indicator shown** → Use filters to view each engagement
2. **Analyzing specific work types** → Filter by Type (e.g., all MCC services)
3. **Quarterly/monthly reporting** → Filter by Month
4. **Comparing installations vs. service** → Toggle between TBEN and MCC types
5. **Budget variance analysis** → Filter to specific engagement that's over/under budget

### When NOT to Use Filters

1. **Viewing total project performance** → Leave filters blank
2. **Year-over-year comparison** → Use year filter only, not month/type
3. **Customer health check** → View all engagements together
4. **Executive summary** → Aggregate view (no filters)

## Troubleshooting

### Q: Project shows $0 revenue after filtering
**A:** The selected month/type combination has no data. Try removing one filter to see what combinations exist.

### Q: Revenue doesn't match Excel
**A:** Check if you're filtering. Excel may show:
- One specific engagement (matches filtered view)
- Total across all engagements (matches unfiltered view)
- Verify month/type to match Excel row

### Q: Can't see specific engagement
**A:** Ensure:
1. Year is set correctly
2. Month/Type match the engagement you're looking for
3. Data was imported/synced for that period

### Q: Filter shows nothing
**A:** Common causes:
- Typo in project name
- Wrong year
- Month/type combination doesn't exist
- Data not yet synced from NetSuite

## Technical Details

### How Filtering Works

1. **Database Query:** Filters applied at SQL level for performance
2. **Multiple Tables:**
   - `closeout_projects` → Excel data, grouped by name/year/month/type
   - `netsuite_sales_orders` → Revenue line items
   - `netsuite_work_orders` → Cost line items
3. **Aggregation:**
   - No filters → Sum all matching entries
   - With filters → Sum only entries matching filter criteria

### Data Structure

Each project entry in `closeout_projects` represents:
- **Unique combination** of: name + year + month + type
- **Example:** Plano 2025 Feb TBEN is separate from Plano 2025 Jun MCC
- **Aggregation:** API sums based on filters applied

## Related Documentation

- **Account Number Issue:** See `/docs/NETSUITE_ACCOUNT_NUMBER_CRITICAL.md`
- **Cost Calculation:** See `/COST_CALCULATION_DISCOVERY.md`
- **NetSuite Sync:** See `/docs/NETSUITE_SYNC_OPTIMIZATION.md`

---

**Last Updated:** January 24, 2026
**Version:** 1.0
**Author:** Claude Code
**Related Feature:** Profitability Dashboard v2.0
