import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
import { getExcelFromStorage } from '@/lib/supabase';
import { getEnrichedWorkOrder } from '@/lib/enrichment-cache';

export const dynamic = 'force-dynamic';

// In-memory cache to avoid re-parsing Excel on every request
let cachedData: any = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes (increased for performance)

interface CostAuditRow {
  project: string;
  opportunity: string;
  type: string;
  year: number;
  month: number;
  invoiceNum: string;
  itemNumber: string;
  itemDescription: string;
  budgetRevenue: number;
  budgetCost: number;
  budgetGP: number;
  budgetGPPercent: number;
  actualRevenue: number;
  actualCost: number;
  actualGP: number;
  actualGPPercent: number;
  bVsA: number;
  variance: number;
  comments: string;
  woNumber: string; // Column Q: Work Order number
}

interface MarginRow {
  customer: string;
  revenue: Record<number, number>;
  cogs: Record<number, number>;
  gp: Record<number, number>;
  gpm: Record<number, number>;
  totalRevenue: number;
  totalCOGS: number;
  totalGP: number;
  avgGPM: number;
  trend: 'up' | 'down' | 'stable';
  yearsActive: number;
}

interface TypeMarginRow {
  type: string;
  revenue: Record<number, number>;
  cogs: Record<number, number>;
  gpm: Record<number, number>;
}

export async function GET(request: Request) {
  try {
    // Check for cache bust parameter
    const url = new URL(request.url);
    const bustCache = url.searchParams.get('bust') === 'true';
    const includeEnrichment = url.searchParams.get('includeEnrichment') !== 'false'; // Default true

    // Check cache first (unless bust requested)
    const now = Date.now();
    if (!bustCache && cachedData && (now - cacheTimestamp) < CACHE_DURATION) {
      return NextResponse.json(cachedData);
    }

    // Try to get file from Supabase Storage first, then fall back to local
    let fileBuffer: Buffer | null = null;

    // Try Supabase Storage
    fileBuffer = await getExcelFromStorage('closeout-data.xlsx');

    // Fall back to local filesystem (for development)
    if (!fileBuffer) {
      const localPath = path.join(process.cwd(), 'data', 'closeout-data.xlsx');
      if (fs.existsSync(localPath)) {
        fileBuffer = fs.readFileSync(localPath);
      }
    }

    if (!fileBuffer) {
      return NextResponse.json({
        error: 'Data file not found',
        message: 'Please upload closeout-data.xlsx to Supabase Storage (data-files bucket)',
      }, { status: 404 });
    }

    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

    // Parse main cost audit sheet
    const costAuditSheet = workbook.Sheets['TB & MCC Cost Audit 2020-Curren'];
    const costAuditRaw = XLSX.utils.sheet_to_json(costAuditSheet, { header: 1 }) as any[][];

    // Skip header rows and parse data
    const costAuditData: CostAuditRow[] = [];
    for (let i = 4; i < costAuditRaw.length; i++) {
      const row = costAuditRaw[i];
      if (!row[0] || row[0] === 'Open') continue;

      // Parse month - Excel stores dates as serial numbers
      let monthVal = 0;
      const rawMonth = row[4];
      if (typeof rawMonth === 'number' && rawMonth > 1000) {
        // Excel serial date - convert to JS date
        // Excel epoch is Dec 30, 1899
        const excelEpoch = new Date(1899, 11, 30);
        const jsDate = new Date(excelEpoch.getTime() + rawMonth * 24 * 60 * 60 * 1000);
        monthVal = jsDate.getMonth() + 1; // getMonth() is 0-indexed
      } else if (typeof rawMonth === 'number' && rawMonth >= 1 && rawMonth <= 12) {
        monthVal = rawMonth;
      } else if (typeof rawMonth === 'string') {
        const monthMap: Record<string, number> = {
          'january': 1, 'jan': 1, 'february': 2, 'feb': 2,
          'march': 3, 'mar': 3, 'april': 4, 'apr': 4,
          'may': 5, 'june': 6, 'jun': 6, 'july': 7, 'jul': 7,
          'august': 8, 'aug': 8, 'september': 9, 'sep': 9,
          'october': 10, 'oct': 10, 'november': 11, 'nov': 11,
          'december': 12, 'dec': 12,
        };
        monthVal = monthMap[rawMonth.toLowerCase().trim()] || parseInt(rawMonth) || 0;
      }

      costAuditData.push({
        project: row[0] || '',
        opportunity: row[1] || '',
        type: row[2] || '',
        year: row[3] || 0,
        month: monthVal,
        invoiceNum: row[5]?.toString() || '',
        itemNumber: row[6]?.toString() || '',
        itemDescription: row[10] || '',
        budgetRevenue: parseFloat(row[11]) || 0,
        budgetCost: parseFloat(row[12]) || 0,
        budgetGP: parseFloat(row[13]) || 0,
        budgetGPPercent: parseFloat(row[14]) || 0,
        actualRevenue: parseFloat(row[15]) || 0,
        actualCost: parseFloat(row[22]) || 0,
        actualGP: parseFloat(row[25]) || 0,
        actualGPPercent: parseFloat(row[26]) || 0,
        bVsA: parseFloat(row[27]) || 0,
        variance: parseFloat(row[28]) || 0,
        comments: row[29]?.toString() || '',
        woNumber: row[16]?.toString()?.trim() || '', // Column Q: WO#
      });
    }

    // Parse MCC Margin Analysis
    const mccSheet = workbook.Sheets['MCC Margin Analysis'];
    const mccRaw = XLSX.utils.sheet_to_json(mccSheet, { header: 1 }) as any[][];

    const mccMargins: MarginRow[] = [];
    const mccYears = [2021, 2022, 2023, 2024, 2025];
    for (let i = 3; i < mccRaw.length; i++) {
      const row = mccRaw[i];
      if (!row[1]) continue;

      const revenue: Record<number, number> = {};
      const cogs: Record<number, number> = {};
      const gpm: Record<number, number> = {};

      mccYears.forEach((year, idx) => {
        revenue[year] = parseFloat(row[2 + idx]) || 0;
        cogs[year] = parseFloat(row[9 + idx]) || 0;
        const gpmVal = row[16 + idx];
        gpm[year] = typeof gpmVal === 'number' ? gpmVal : 0;
      });

      // Calculate totals and averages for this customer
      const totalRevenue = Object.values(revenue).reduce((sum, val) => sum + val, 0);
      const totalCOGS = Object.values(cogs).reduce((sum, val) => sum + val, 0);
      const totalGP = totalRevenue - totalCOGS;
      const avgGPM = totalRevenue > 0 ? totalGP / totalRevenue : 0;

      // Calculate trend (compare most recent year to previous)
      const years = mccYears.filter(y => revenue[y] > 0).sort();
      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (years.length >= 2) {
        const latestYear = years[years.length - 1];
        const previousYear = years[years.length - 2];
        const latestGPM = gpm[latestYear] || 0;
        const previousGPM = gpm[previousYear] || 0;
        if (latestGPM > previousGPM + 0.05) trend = 'up';
        else if (latestGPM < previousGPM - 0.05) trend = 'down';
      }

      // Calculate GP by year
      const gp: Record<number, number> = {};
      mccYears.forEach(year => {
        gp[year] = revenue[year] - cogs[year];
      });

      mccMargins.push({
        customer: row[1],
        revenue,
        cogs,
        gp,
        gpm,
        totalRevenue,
        totalCOGS,
        totalGP,
        avgGPM,
        trend,
        yearsActive: years.length,
      });
    }

    // Parse TB Type Margin Analysis
    const tbTypeSheet = workbook.Sheets['TB Type Margin Analysis'];
    const tbTypeRaw = XLSX.utils.sheet_to_json(tbTypeSheet, { header: 1 }) as any[][];

    const tbTypeMargins: TypeMarginRow[] = [];
    const tbYears = [2020, 2021, 2022, 2023, 2024, 2025];
    for (let i = 3; i < tbTypeRaw.length; i++) {
      const row = tbTypeRaw[i];
      if (!row[1]) continue;

      const revenue: Record<number, number> = {};
      const cogs: Record<number, number> = {};
      const gpm: Record<number, number> = {};

      tbYears.forEach((year, idx) => {
        revenue[year] = parseFloat(row[2 + idx]) || 0;
        cogs[year] = parseFloat(row[10 + idx]) || 0;
        const gpmVal = row[18 + idx];
        gpm[year] = typeof gpmVal === 'number' ? gpmVal : 0;
      });

      tbTypeMargins.push({
        type: row[1],
        revenue,
        cogs,
        gpm,
      });
    }

    // Calculate KPIs (optimize by using single pass)
    const currentYear = new Date().getFullYear();
    let totalActualRevenue = 0;
    let totalActualCost = 0;
    let totalBudgetRevenue = 0;
    let totalBudgetCost = 0;

    // Single pass to calculate totals for current/previous year
    costAuditData.forEach(d => {
      if (d.year === currentYear || d.year === currentYear - 1) {
        totalActualRevenue += d.actualRevenue;
        totalActualCost += d.actualCost;
        totalBudgetRevenue += d.budgetRevenue;
        totalBudgetCost += d.budgetCost;
      }
    });

    const totalActualGP = totalActualRevenue - totalActualCost;
    const overallGPM = totalActualRevenue > 0 ? (totalActualGP / totalActualRevenue) : 0;
    const totalBudgetGP = totalBudgetRevenue - totalBudgetCost;

    // Group by Customer + Year - each year's work is a SEPARATE project
    const projectSummary: Record<string, {
      project: string;      // Customer name
      projectKey: string;   // "Customer|Year" unique key
      type: string;
      projectDate: string;  // "Mon YYYY" format for display
      projectYear: number;
      projectMonth: number;
      actualRevenue: number;
      actualCost: number;
      actualGP: number;
      actualGPM: number;
      budgetRevenue: number;
      budgetGP: number;
      variance: number;
      variancePercent: number;
      itemCount: number;
      lineItems: {
        itemNumber: string;
        itemDescription: string;
        budgetRevenue: number;
        budgetCost: number;
        budgetGP: number;
        actualRevenue: number;
        actualCost: number;
        actualGP: number;
        variance: number;
        year: number;
        month: number;
        comments: string;
      }[];
      negativeVarianceItems: {
        itemNumber: string;
        itemDescription: string;
        budgetGP: number;
        actualGP: number;
        variance: number;
        year: number;
        month: number;
        comments: string;
      }[];
      salesOrders?: {
        soNumber: string;
        soId: string;
        soStatus: string | null;
        soDate: string;
        customerName: string;
        netsuiteEnriched: boolean;
        lineItems: {
          itemName: string;
          itemDescription: string;
          quantity: number;
          unitPrice: number;
          lineAmount: number;
          costEstimate: number;
        }[];
        workOrders: {
          woNumber: string;
          itemDescription: string;
          budgetRevenue: number;
          budgetCost: number;
          budgetGP: number;
          actualRevenue: number;
          actualCost: number;
          actualGP: number;
          variance: number;
          netsuiteEnriched: boolean;
          woStatus?: string;
          woDate?: string;
        }[];
        totalRevenue: number;
        totalCost: number;
        totalGP: number;
      }[];
      unenrichedWorkOrders?: {
        woNumber: string;
        itemDescription: string;
        budgetRevenue: number;
        budgetCost: number;
        budgetGP: number;
        actualRevenue: number;
        actualCost: number;
        actualGP: number;
        variance: number;
        netsuiteEnriched: boolean;
      }[];
    }> = {};

    // Month names for formatting
    const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    costAuditData.forEach(row => {
      // Create unique key: Customer + Year = unique project
      const projectKey = `${row.project}|${row.year}`;

      if (!projectSummary[projectKey]) {
        // Format project date from the Month column (Excel date)
        const dateStr = row.month > 0 ? `${MONTH_NAMES[row.month]} ${row.year}` : `${row.year}`;

        projectSummary[projectKey] = {
          project: row.project,
          projectKey: projectKey,
          type: row.type,
          projectDate: dateStr,
          projectYear: row.year,
          projectMonth: row.month,
          actualRevenue: 0,
          actualCost: 0,
          actualGP: 0,
          actualGPM: 0,
          budgetRevenue: 0,
          budgetGP: 0,
          variance: 0,
          variancePercent: 0,
          itemCount: 0,
          lineItems: [],
          negativeVarianceItems: [],
        };
      }

      // Sum up financials for this project (Customer + Year)
      projectSummary[projectKey].actualRevenue += row.actualRevenue;
      projectSummary[projectKey].actualCost += row.actualCost;
      projectSummary[projectKey].budgetRevenue += row.budgetRevenue;
      projectSummary[projectKey].budgetGP += row.budgetGP;
      projectSummary[projectKey].itemCount++;

      // Add line items
      if (row.actualRevenue > 0 || row.budgetRevenue > 0) {
        projectSummary[projectKey].lineItems.push({
          itemNumber: row.itemNumber,
          itemDescription: row.itemDescription,
          budgetRevenue: row.budgetRevenue,
          budgetCost: row.budgetCost,
          budgetGP: row.budgetGP,
          actualRevenue: row.actualRevenue,
          actualCost: row.actualCost,
          actualGP: row.actualGP,
          variance: row.actualGP - row.budgetGP,
          year: row.year,
          month: row.month,
          comments: row.comments,
        });
      }

      // Track negative variance items
      const lineVariance = row.actualGP - row.budgetGP;
      if (lineVariance < 0 && Math.abs(lineVariance) > 100) {
        projectSummary[projectKey].negativeVarianceItems.push({
          itemNumber: row.itemNumber,
          itemDescription: row.itemDescription,
          budgetGP: row.budgetGP,
          actualGP: row.actualGP,
          variance: lineVariance,
          year: row.year,
          month: row.month,
          comments: row.comments,
        });
      }
    });

    // Group work orders by project
    const workOrdersByProject: Record<string, Record<string, any>> = {};
    costAuditData.forEach(row => {
      if (!row.woNumber) return; // Skip rows without WO#

      const projectKey = `${row.project}|${row.year}`;
      if (!workOrdersByProject[projectKey]) {
        workOrdersByProject[projectKey] = {};
      }

      if (!workOrdersByProject[projectKey][row.woNumber]) {
        workOrdersByProject[projectKey][row.woNumber] = {
          woNumber: row.woNumber,
          itemDescription: row.itemDescription,
          budgetRevenue: 0,
          budgetCost: 0,
          budgetGP: 0,
          actualRevenue: 0,
          actualCost: 0,
          actualGP: 0,
          variance: 0,
          netsuiteEnriched: false,
          soNumber: null,
          lineItems: [],
        };
      }

      // Aggregate financials for this work order
      const wo = workOrdersByProject[projectKey][row.woNumber];
      wo.budgetRevenue += row.budgetRevenue;
      wo.budgetCost += row.budgetCost;
      wo.budgetGP += row.budgetGP;
      wo.actualRevenue += row.actualRevenue;
      wo.actualCost += row.actualCost;
      wo.actualGP += row.actualGP;
      wo.variance += row.variance;
    });

    // Group by Sales Order, then Work Orders under each SO
    // Hierarchy: Project → Sales Orders → Work Orders → Line Items
    Object.keys(projectSummary).forEach(projectKey => {
      const workOrders = workOrdersByProject[projectKey];
      if (!workOrders) return;

      // Group WOs by their parent Sales Order
      const salesOrderMap: Record<string, any> = {};

      Object.values(workOrders).forEach((wo: any) => {
        // Check if this WO has NetSuite enrichment
        const enrichedData = getEnrichedWorkOrder(wo.woNumber);

        if (enrichedData && enrichedData.soNumber) {
          const soNumber = enrichedData.soNumber;

          // Create SO entry if it doesn't exist
          if (!salesOrderMap[soNumber]) {
            salesOrderMap[soNumber] = {
              soNumber: soNumber,
              soId: enrichedData.soId,
              soStatus: enrichedData.soStatus,
              soDate: enrichedData.soDate,
              customerName: enrichedData.customerName,
              netsuiteEnriched: true,
              lineItems: enrichedData.lineItems || [], // SO line items (what was sold)
              workOrders: [], // WOs that fulfill this SO
              totalRevenue: 0,
              totalCost: 0,
              totalGP: 0,
            };
          }

          // Add this WO under its parent SO
          salesOrderMap[soNumber].workOrders.push({
            ...wo,
            netsuiteEnriched: true,
            woStatus: enrichedData.woStatus,
            woDate: enrichedData.woDate,
            // WO line items would come from WO-specific query if available
          });

          // Aggregate financials
          salesOrderMap[soNumber].totalRevenue += wo.actualRevenue;
          salesOrderMap[soNumber].totalCost += wo.actualCost;
          salesOrderMap[soNumber].totalGP += wo.actualGP;
        } else {
          // WO not enriched or no SO - show as standalone
          if (!salesOrderMap['_unenriched']) {
            salesOrderMap['_unenriched'] = {
              soNumber: null,
              netsuiteEnriched: false,
              workOrders: [],
              totalRevenue: 0,
              totalCost: 0,
              totalGP: 0,
            };
          }

          salesOrderMap['_unenriched'].workOrders.push(wo);
          salesOrderMap['_unenriched'].totalRevenue += wo.actualRevenue;
          salesOrderMap['_unenriched'].totalCost += wo.actualCost;
          salesOrderMap['_unenriched'].totalGP += wo.actualGP;
        }
      });

      // Attach sales orders to project (instead of just work orders)
      projectSummary[projectKey].salesOrders = Object.values(salesOrderMap).filter(so => so.soNumber);
      projectSummary[projectKey].unenrichedWorkOrders = salesOrderMap['_unenriched']?.workOrders || [];
    });

    // Calculate derived fields and sort items
    Object.values(projectSummary).forEach(p => {
      p.actualGP = p.actualRevenue - p.actualCost;
      p.actualGPM = p.actualRevenue > 0 ? (p.actualGP / p.actualRevenue) : 0;
      p.variance = p.actualGP - p.budgetGP;
      p.variancePercent = p.budgetGP !== 0 ? (p.variance / Math.abs(p.budgetGP)) : 0;
      // Sort line items by revenue (highest first)
      p.lineItems.sort((a, b) => b.actualRevenue - a.actualRevenue);
      // Sort negative variance items by variance (most negative first)
      p.negativeVarianceItems.sort((a, b) => a.variance - b.variance);
    });

    // Get all unique years for filtering
    const allYears = [...new Set(costAuditData.map(d => d.year).filter(y => y > 0))].sort((a, b) => b - a);

    const projects = Object.values(projectSummary)
      .filter(p => p.actualRevenue > 0)
      .sort((a, b) => b.actualRevenue - a.actualRevenue);

    // Find at-risk projects (GPM < 50% or negative variance)
    const atRiskProjects = projects.filter(p => p.actualGPM < 0.5 || p.variance < -10000);

    // Year over year summary
    const yearSummary: Record<number, { revenue: number; cost: number; gp: number; gpm: number }> = {};
    costAuditData.forEach(row => {
      if (!yearSummary[row.year]) {
        yearSummary[row.year] = { revenue: 0, cost: 0, gp: 0, gpm: 0 };
      }
      yearSummary[row.year].revenue += row.actualRevenue;
      yearSummary[row.year].cost += row.actualCost;
    });

    Object.values(yearSummary).forEach(y => {
      y.gp = y.revenue - y.cost;
      y.gpm = y.revenue > 0 ? (y.gp / y.revenue) : 0;
    });

    // Type breakdown
    const typeBreakdown: Record<string, { type: string; revenue: number; cost: number; gp: number; gpm: number; count: number }> = {};
    costAuditData.forEach(row => {
      if (!row.type) return;
      if (!typeBreakdown[row.type]) {
        typeBreakdown[row.type] = { type: row.type, revenue: 0, cost: 0, gp: 0, gpm: 0, count: 0 };
      }
      typeBreakdown[row.type].revenue += row.actualRevenue;
      typeBreakdown[row.type].cost += row.actualCost;
      typeBreakdown[row.type].count++;
    });

    Object.values(typeBreakdown).forEach(t => {
      t.gp = t.revenue - t.cost;
      t.gpm = t.revenue > 0 ? (t.gp / t.revenue) : 0;
    });

    // Limit negative variance items to top 10 per project
    projects.forEach(p => {
      if (p.negativeVarianceItems.length > 10) {
        p.negativeVarianceItems = p.negativeVarianceItems.slice(0, 10);
      }
    });

    // Calculate enrichment percentage based on in-memory cache
    let enrichmentPct = 0;
    if (includeEnrichment) {
      try {
        // Count how many work orders have enrichment
        let totalWOs = 0;
        let enrichedWOs = 0;

        projects.forEach(project => {
          if (project.salesOrders) {
            project.salesOrders.forEach(so => {
              totalWOs += so.workOrders.length;
              enrichedWOs += so.workOrders.length; // All WOs in salesOrders are enriched
            });
          }
          if (project.unenrichedWorkOrders) {
            totalWOs += project.unenrichedWorkOrders.length;
            // These are NOT enriched, so don't increment enrichedWOs
          }
        });

        enrichmentPct = totalWOs > 0 ? Math.round((enrichedWOs / totalWOs) * 100) : 0;
      } catch (error) {
        console.error('Error calculating enrichment percentage:', error);
        enrichmentPct = 0;
      }
    }

    const responseData = {
      kpis: {
        totalRevenue: totalActualRevenue,
        totalCost: totalActualCost,
        totalGrossProfit: totalActualGP,
        overallGPM,
        budgetRevenue: totalBudgetRevenue,
        budgetGP: totalBudgetGP,
        budgetVariance: totalActualGP - totalBudgetGP,
        projectCount: projects.length,
        atRiskCount: atRiskProjects.length,
        enrichmentPct,
      },
      projects,
      atRiskProjects,
      yearSummary,
      allYears,
      typeBreakdown: Object.values(typeBreakdown).filter(t => t.revenue > 0).sort((a, b) => b.revenue - a.revenue),
      mccMargins: mccMargins.filter(m => Object.values(m.revenue).some(v => v > 0)),
      tbTypeMargins: tbTypeMargins.filter(t => Object.values(t.revenue).some(v => v > 0)),
      lastUpdated: new Date().toISOString(),
      dataFile: 'closeout-data.xlsx',
    };

    // Cache the result
    cachedData = responseData;
    cacheTimestamp = Date.now();

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Error reading closeout data:', error);
    return NextResponse.json({
      error: 'Failed to read closeout data',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
