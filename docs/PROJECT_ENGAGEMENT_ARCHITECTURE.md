# Project Engagement Architecture

## Document Overview

**Created:** January 24, 2026
**Purpose:** Document the critical architectural decisions for how project engagements are identified, grouped, and displayed in the Profitability Dashboard
**Related Issues:** Plano reconciliation, multiple engagement handling, project_type grouping

---

## Table of Contents

1. [The Problem](#the-problem)
2. [Core Concept: What is a "Project"?](#core-concept-what-is-a-project)
3. [Database Structure](#database-structure)
4. [Architectural Solution](#architectural-solution)
5. [API Design](#api-design)
6. [Critical Lessons Learned](#critical-lessons-learned)
7. [Examples](#examples)

---

## The Problem

### Initial Symptom
When searching for "Plano 2025", the dashboard showed 6 identical entries all labeled "Plano 2025" with no way to distinguish between them.

### Root Cause
The system was treating each **project_type** (TBEN, PM, TBIN, SCH, etc.) as a separate project, when in reality these are **line items within a single Sales Order**.

### User Impact
- Couldn't tell which engagement was which
- Revenue numbers were fragmented across multiple entries
- Had to manually filter to see complete engagement data
- Excel reconciliation failed (Excel showed $153,708, API showed 6 separate entries with partial amounts)

---

## Core Concept: What is a "Project"?

### Definition
A **project engagement** is defined as:
> A distinct piece of work performed for a customer in a specific month/period, represented by one or more Sales Orders containing multiple line items (project_types).

### Key Principle
**NEVER aggregate separate engagements**, even if they're for the same customer in the same year.

### Examples

#### ✅ CORRECT: Two Separate Projects
**Plano 2025** has TWO distinct engagements:

1. **February 2025 - Equipment Installation**
   - Sales Order: SO3009
   - Line Items: TBEN, PM, TBIN, SCH (multiple project_types)
   - Total Revenue: $153,708
   - This is ONE project with multiple line items

2. **June 2025 - MCC Service**
   - Sales Order: (different SO)
   - Line Items: MCC
   - Total Revenue: $9,586
   - This is a SEPARATE project

**These should NEVER be aggregated together.**

#### ❌ INCORRECT: Treating Line Items as Projects
Don't do this:
- Plano TBEN 2025 - $XX,XXX
- Plano PM 2025 - $XX,XXX
- Plano TBIN 2025 - $XX,XXX
- Plano SCH 2025 - $XX,XXX

These are **line items** in one Sales Order, not separate projects.

---

## Database Structure

### Table: `closeout_projects`

The Excel import creates **one row per project_type**:

```sql
CREATE TABLE closeout_projects (
  id UUID PRIMARY KEY,
  project_name TEXT NOT NULL,
  project_year INTEGER NOT NULL,
  project_month INTEGER,           -- Key for engagement grouping
  project_type TEXT NOT NULL,       -- TBEN, PM, TBIN, MCC, etc.
  actual_revenue NUMERIC,
  actual_cost NUMERIC,
  actual_gp_pct NUMERIC,
  variance NUMERIC,
  -- ... other fields

  UNIQUE(project_name, project_year, project_type)
);
```

### Example: Plano February 2025 in Database

| id | project_name | project_year | project_month | project_type | actual_revenue |
|----|--------------|--------------|---------------|--------------|----------------|
| 1  | Plano        | 2025         | 2             | TBEN         | $120,000       |
| 2  | Plano        | 2025         | 2             | PM           | $15,000        |
| 3  | Plano        | 2025         | 2             | TBIN         | $10,000        |
| 4  | Plano        | 2025         | 2             | SCH          | $8,708         |

**These 4 rows = ONE engagement** (total: $153,708)

### Example: Plano June 2025 in Database

| id | project_name | project_year | project_month | project_type | actual_revenue |
|----|--------------|--------------|---------------|--------------|----------------|
| 5  | Plano        | 2025         | 6             | MCC          | $9,586         |

**This 1 row = ONE separate engagement**

---

## Architectural Solution

### Grouping Logic

**Projects are grouped by: `(project_name, project_year, project_month)`**

```typescript
// Key for engagement grouping
const key = `${row.project_name}|${row.project_year}|${row.project_month || 'null'}`;
```

### Aggregation Rules

For each engagement (unique name+year+month combination):

1. **Revenue:** Sum across all project_types
   ```typescript
   totalRevenue = rows.reduce((sum, r) => sum + (r.actual_revenue || 0), 0);
   ```

2. **GPM (Gross Profit Margin):** Weighted average by revenue
   ```typescript
   weightedGPM = rows.reduce((sum, r) => {
     const rev = r.actual_revenue || 0;
     const gpm = r.actual_gp_pct || 0;
     return sum + (gpm * rev);
   }, 0) / totalRevenue;
   ```

3. **Variance:** Sum across all project_types
   ```typescript
   totalVariance = rows.reduce((sum, r) => sum + (r.variance || 0), 0);
   ```

4. **Primary Project Type:** Determine display type
   ```typescript
   const primaryType =
     rows.find(r => ['TBEN', 'TBEU', 'MCC', 'M3NEW'].includes(r.project_type))?.project_type
     || rows.find(r => r.project_type !== 'PM')?.project_type
     || rows[0].project_type;
   ```

   **Priority:**
   - Prefer major types: TBEN, TBEU, MCC, M3NEW
   - Fall back to first non-PM type
   - Use first type if all are PM

---

## API Design

### 1. Projects List API

**Endpoint:** `GET /api/closeout/projects`

**Purpose:** Return list of distinct engagements for project browser

**Query Logic:**
```typescript
// Step 1: Fetch all rows from database
const { data: projects } = await supabase
  .from('closeout_projects')
  .select('project_name, project_year, project_month, project_type, actual_revenue, actual_gp_pct, variance')
  .gte('project_year', 2025);

// Step 2: Group by (name, year, month)
const engagementMap = new Map<string, ProjectData[]>();
for (const row of projects) {
  const key = `${row.project_name}|${row.project_year}|${row.project_month || 'null'}`;
  if (!engagementMap.has(key)) {
    engagementMap.set(key, []);
  }
  engagementMap.get(key)!.push(row);
}

// Step 3: Aggregate each engagement
const projectList = Array.from(engagementMap.entries()).map(([key, rows]) => {
  return {
    name: rows[0].project_name,
    latestYear: rows[0].project_year,
    latestMonth: rows[0].project_month,
    projectType: determinePrimaryType(rows),
    recentRevenue: sumRevenue(rows),
    recentGPM: weightedAverageGPM(rows),
    // ... other aggregated fields
  };
});
```

**Response Example:**
```json
{
  "projects": [
    {
      "name": "Plano",
      "latestYear": 2025,
      "latestMonth": 2,
      "projectType": "TBEN",
      "recentRevenue": 153708,
      "recentGPM": 42.5
    },
    {
      "name": "Plano",
      "latestYear": 2025,
      "latestMonth": 6,
      "projectType": "MCC",
      "recentRevenue": 9586,
      "recentGPM": 65.2
    }
  ]
}
```

### 2. Profitability API

**Endpoint:** `GET /api/closeout/profitability?project={name}&year={year}&month={month}&type={type}`

**Purpose:** Return detailed profitability data for a specific engagement

**CRITICAL:** When called from project browser, **DO NOT pass `type` parameter**

**Why?** We need ALL project_types for that month to get complete data.

**Correct Usage:**
```typescript
// From project browser selection
fetchData(
  'Plano',           // project name
  2025,              // year
  2,                 // month
  ''                 // type = EMPTY (fetch all types for this month)
);
```

**Query Logic:**
```typescript
let query = supabase
  .from('closeout_projects')
  .select('*')
  .eq('project_name', project)
  .eq('project_year', year);

if (month) {
  query = query.eq('project_month', month);
}

// DON'T filter by type when showing full engagement
if (type) {
  query = query.eq('project_type', type);
}
```

**Result:** Returns ALL project_types (TBEN, PM, TBIN, SCH) for Plano Feb 2025, with linked Sales Orders and Work Orders.

---

## Critical Lessons Learned

### 1. Project Types Are Line Items, Not Projects
**Lesson:** TBEN, PM, TBIN, SCH, etc. are **line items** within a Sales Order, not separate projects.

**Evidence:** NetSuite Sales Order SO3009 for Plano Feb 2025 contains all these types as separate line items.

**Action:** Group by month, not by project_type.

### 2. Never Filter by Type When Showing Engagement Details
**Lesson:** When user clicks on an engagement from the browser, fetch ALL project_types for that month.

**Bug:** Initially passed `projectType='TBEN'` to profitability API, which filtered out PM, TBIN, SCH rows, causing:
- Missing sales order details
- Wrong revenue totals
- Missing line items

**Fix:** Pass empty `type` parameter from browser selection.

### 3. Month Is the Engagement Identifier
**Lesson:** `project_month` is the critical field that distinguishes separate engagements.

**Why:** Same customer can have multiple separate projects in the same year:
- Plano Feb 2025 (installation) ≠ Plano Jun 2025 (MCC service)
- These are distinct engagements, never aggregate

### 4. Excel Reconciliation Requires Grouping
**Lesson:** Excel shows revenue aggregated by month (one row = one engagement with all project_types summed).

**Database:** Has multiple rows (one per project_type).

**API must:** Group and sum to match Excel view.

### 5. Primary Type Selection Matters for UX
**Lesson:** Users need to quickly identify engagement type in search results.

**Solution:** Show meaningful type (TBEN, MCC) rather than generic (PM).

**Logic:**
1. Show major service types first (TBEN, MCC, M3NEW)
2. Hide internal types like PM
3. Use first available if no major type

---

## Examples

### Example 1: Plano 2025 Complete Flow

#### Step 1: User searches "Plano"

**Projects API Response:**
```json
[
  {
    "name": "Plano",
    "latestYear": 2025,
    "latestMonth": 2,
    "projectType": "TBEN",
    "recentRevenue": 153708
  },
  {
    "name": "Plano",
    "latestYear": 2025,
    "latestMonth": 6,
    "projectType": "MCC",
    "recentRevenue": 9586
  }
]
```

**Search Dropdown Shows:**
```
Plano
TBEN • Feb 2025 • $153K

Plano
MCC • Jun 2025 • $9.6K
```

#### Step 2: User clicks "Plano TBEN • Feb 2025"

**Frontend calls:**
```typescript
fetchData('Plano', 2025, 2, ''); // Note: type is EMPTY
```

**API Query:**
```sql
SELECT * FROM closeout_projects
WHERE project_name = 'Plano'
  AND project_year = 2025
  AND project_month = 2
-- No project_type filter!
```

**Returns 4 rows:**
- TBEN: $120,000
- PM: $15,000
- TBIN: $10,000
- SCH: $8,708

**Total displayed:** $153,708 ✓ (matches Excel)

#### Step 3: Profitability view shows

**KPIs:**
- Revenue: $153,708 (sum of all 4 project_types)
- Cost: (summed across all types)
- GPM: (weighted average)

**Sales Orders:**
- SO3009 with ALL line items (TBEN, PM, TBIN, SCH)

**Work Orders:**
- All linked WOs with complete cost details

---

### Example 2: Filtering by MCC Category

#### User clicks "MCC" tab in project browser

**API call:**
```
GET /api/closeout/projects?category=mcc
```

**Filter applied:**
```typescript
projectList = projectList.filter(p => p.projectType === 'MCC');
```

**Result:** Only shows engagements where primary type is MCC
- Plano Jun 2025 (MCC)
- Other MCC engagements

**Does NOT show:** Plano Feb 2025 (TBEN)

---

## File Reference

### Modified Files

| File | Purpose | Key Changes |
|------|---------|-------------|
| `/src/app/api/closeout/projects/route.ts` | Projects list API | Added grouping by (name, year, month), aggregation logic |
| `/src/app/closeout-dashboard/components/ProfitabilityDashboard.tsx` | Main dashboard | Updated dropdown display, fixed selectProject to not pass type |
| `/src/app/closeout-dashboard/components/ProjectBrowser.tsx` | Project browser | Updated to pass month when selecting project |

### Related Documentation

- `/docs/PROFITABILITY_FILTERS.md` - Filter usage guide (needs update)
- `/docs/NETSUITE_ACCOUNT_NUMBER_CRITICAL.md` - Account number field fix
- `/COST_CALCULATION_DISCOVERY.md` - Cost calculation logic

---

## Migration Notes

### For Existing Data

No migration required. The database structure remains unchanged:
- `closeout_projects` table still has one row per project_type
- Existing unique constraint: `(project_name, project_year, project_type)`

**Change is API-level only:** How we GROUP and DISPLAY the data, not how it's stored.

### For New Projects

When importing new Excel data:
1. Excel rows are imported as-is (one row per project_type)
2. API automatically groups by month for display
3. No manual intervention needed

---

## Testing Checklist

When making changes to this architecture:

- [ ] Search for customer with multiple engagements in same year
- [ ] Verify search shows separate entries for different months
- [ ] Click each engagement and verify ALL project_types load
- [ ] Check revenue totals match Excel
- [ ] Verify sales order line items all appear
- [ ] Check work order costs are complete
- [ ] Test MCC filter shows only MCC engagements
- [ ] Verify "At-Risk" and "High-Value" filters work
- [ ] Confirm month/year display format is correct
- [ ] Test that clicking engagement sets filters correctly

---

## Troubleshooting

### Problem: Engagement shows $0 revenue

**Check:**
1. Is month filter set correctly?
2. Are we filtering by project_type when we shouldn't be?
3. Does the database have rows for this month?

**Solution:** Ensure profitability API is called with empty `type` parameter when showing full engagement.

### Problem: Missing sales order details

**Check:**
1. Is project_type filter active?
2. Are all project_types being fetched?

**Solution:** Remove project_type filter from profitability query when showing engagement.

### Problem: Revenue doesn't match Excel

**Check:**
1. Is the API grouping by month correctly?
2. Are all project_types in that month being summed?
3. Is there data for multiple months being aggregated incorrectly?

**Solution:** Verify grouping key: `${name}|${year}|${month}`

---

## Future Considerations

### Potential Enhancements

1. **Visual Grouping Indicator**
   - Show "4 line items" badge in search results
   - Expand to show TBEN, PM, TBIN, SCH breakdown

2. **Multi-Month Projects**
   - Some projects span multiple months
   - Consider "project phase" concept
   - Group related months under parent project

3. **Project Type Hierarchy**
   - TBEN = parent
   - PM, SCH = supporting line items
   - Display hierarchically in details view

4. **Comparison View**
   - Compare Feb installation vs Jun service
   - Show trends across engagements for same customer

### Performance Optimization

If projects table grows large:
1. Add database view with pre-aggregated engagements
2. Cache grouped results
3. Add index on `(project_name, project_year, project_month)`

---

## Appendix: Project Type Codes

| Code | Description | Category |
|------|-------------|----------|
| TBEN | Test Bench Equipment New | Major - Equipment |
| TBEU | Test Bench Equipment Upgrade | Major - Equipment |
| TBIN | Test Bench Install & Training New | Major - Installation |
| TBIU | Test Bench Install & Training Upgrade | Major - Installation |
| M3NEW | M3 Software New | Major - Software |
| M3IN | M3 Install | Major - Software |
| M3IU | M3 Upgrade | Major - Software |
| MCC | Maintenance & Calibration Services | Major - Service |
| PM | Project Management | Supporting |
| SCH | Shipping & Handling | Supporting |
| DRM3 | Deferred Revenue M3 | Accounting |
| DRMCC | Deferred Revenue MCC | Accounting |

**Primary Type Selection Logic:**
- Prefer "Major" category types
- Avoid "Supporting" and "Accounting" types
- Use first available if no major type exists

---

**Document Version:** 1.0
**Last Updated:** January 24, 2026
**Maintained By:** Development Team
**Questions?** Review commit history for implementation details
