/**
 * API Route: /api/closeout/profitability
 * Enhanced Project Profitability Dashboard API
 *
 * CORRECT FLOW: Excel Project → Work Orders → Sales Orders
 *
 * 1. Get closeout project from Excel data (closeout_projects table)
 * 2. Get WO numbers assigned to that project (closeout_work_orders table)
 * 3. Look up those WOs in NetSuite (netsuite_work_orders) to get linked SO IDs
 * 4. Fetch the Sales Orders and their line items
 * 5. Return complete hierarchy with KPIs
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Types for the API response
interface SOLineItem {
  lineId: string;
  itemId: string;
  itemName: string | null;
  itemDescription: string | null;
  itemType: string | null;
  quantity: number;
  rate: number;
  amount: number;
  costEstimate: number;
  grossProfit: number;
  grossMarginPct: number;
  isClosed: boolean;
}

interface WOLineItem {
  lineId: string;
  itemId: string;
  itemName: string | null;
  itemDescription: string | null;
  itemType: string | null;
  quantity: number;
  quantityCompleted: number;
  unitCost: number;
  lineCost: number;
  isClosed: boolean;
}

interface WorkOrder {
  woNumber: string;
  netsuiteId: string;
  woDate: string | null;
  status: string | null;
  customerName: string | null;
  excelRevenue: number | null; // Revenue from Excel for this WO
  excelCost: number | null;    // Cost from Excel for this WO
  lineItems: WOLineItem[];
  totals: {
    itemCount: number;
    totalQuantity: number;
    totalCost: number;
  };
}

interface SalesOrder {
  soNumber: string;
  netsuiteId: string;
  soDate: string | null;
  status: string | null;
  customerName: string | null;
  totalAmount: number;
  lineItems: SOLineItem[];
  workOrders: WorkOrder[];
  totals: {
    lineItemCount: number;
    workOrderCount: number;
    revenue: number;
    costEstimate: number;
    grossProfit: number;
    grossMarginPct: number;
    woManufacturingCost: number;
  };
}

interface ExcelProject {
  id: string;
  projectName: string;
  projectYear: number;
  projectType: string;
  budgetRevenue: number;
  budgetCost: number;
  budgetGP: number;
  actualRevenue: number;
  actualCost: number;
  actualGP: number;
  variance: number;
}

interface ProjectKPIs {
  // From Excel
  budgetRevenue: number;
  budgetCost: number;
  budgetGP: number;
  budgetGPM: number;
  // From NetSuite (actual manufacturing)
  netsuiteRevenue: number;
  netsuiteCostEstimate: number;
  netsuiteWOCost: number;
  // Calculated
  actualRevenue: number;
  actualCost: number;
  actualGP: number;
  actualGPM: number;
  variance: number;
  variancePct: number;
  cpi: number;
}

interface ProjectProfitabilityResponse {
  project: {
    name: string;
    year: number | null;
    type: string | null;
    customerName: string | null;
    excelProjects: ExcelProject[];
    kpis: ProjectKPIs;
    salesOrders: SalesOrder[];
    totals: {
      salesOrderCount: number;
      workOrderCount: number;
      soLineItemCount: number;
      woLineItemCount: number;
      totalRevenue: number;
      totalCostEstimate: number;
      totalWOCost: number;
    };
  };
  debug: {
    excelWONumbers: string[];
    netsuiteWOsFound: number;
    linkedSOIds: string[];
  };
  syncStatus: {
    lastSyncedAt: string | null;
    workOrderCount: number;
    salesOrderCount: number;
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const projectName = url.searchParams.get('project');
    const yearParam = url.searchParams.get('year');
    const year = yearParam ? parseInt(yearParam) : null;
    const typeParam = url.searchParams.get('type'); // Optional: filter by project type (MCC, TBEN, etc.)

    if (!projectName) {
      return NextResponse.json({
        error: 'Missing required parameter',
        message: 'project parameter is required (e.g., ?project=Sarasota&year=2025)',
      }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // STEP 1: Get Excel projects matching name (and optionally year/type)
    let projectQuery = supabase
      .from('closeout_projects')
      .select('*')
      .ilike('project_name', `%${projectName}%`);

    if (year) {
      projectQuery = projectQuery.eq('project_year', year);
    }

    if (typeParam) {
      projectQuery = projectQuery.eq('project_type', typeParam);
    }

    const { data: excelProjects, error: projError } = await projectQuery;

    if (projError) {
      console.error('Error fetching Excel projects:', projError);
      return NextResponse.json({
        error: 'Database error',
        message: projError.message,
      }, { status: 500 });
    }

    if (!excelProjects || excelProjects.length === 0) {
      return NextResponse.json({
        error: 'No project found',
        message: `No Excel project found for "${projectName}"${year ? ` in ${year}` : ''}`,
        suggestion: 'Check the project name matches the Excel data exactly',
      }, { status: 404 });
    }

    // Get project IDs for WO lookup
    const projectIds = excelProjects.map(p => p.id);

    // STEP 2: Get Work Order numbers from Excel (closeout_work_orders)
    const { data: excelWOs, error: woQueryError } = await supabase
      .from('closeout_work_orders')
      .select('wo_number, actual_revenue, actual_cost, closeout_project_id')
      .in('closeout_project_id', projectIds)
      .not('wo_number', 'is', null)
      .neq('wo_number', '');

    if (woQueryError) {
      console.error('Error fetching Excel WOs:', woQueryError);
    }

    // Get unique WO numbers and format for NetSuite lookup (add "WO" prefix)
    const rawWONumbers = [...new Set((excelWOs || []).map(wo => wo.wo_number))];
    const netsuiteWONumbers = rawWONumbers.map(n => `WO${n}`);

    // Create map of WO number to Excel data
    const excelWODataMap: Record<string, { revenue: number; cost: number }> = {};
    (excelWOs || []).forEach(wo => {
      const nsNum = `WO${wo.wo_number}`;
      if (!excelWODataMap[nsNum]) {
        excelWODataMap[nsNum] = { revenue: 0, cost: 0 };
      }
      excelWODataMap[nsNum].revenue += wo.actual_revenue || 0;
      excelWODataMap[nsNum].cost += wo.actual_cost || 0;
    });

    // STEP 3: Look up these WOs in NetSuite to get linked SO IDs
    let linkedSOIds: string[] = [];
    let netsuiteWOs: any[] = [];

    if (netsuiteWONumbers.length > 0) {
      const { data: nsWOs, error: nsWOError } = await supabase
        .from('netsuite_work_orders')
        .select('wo_number, netsuite_id, created_from_so_id, status, wo_date, customer_name')
        .in('wo_number', netsuiteWONumbers);

      if (nsWOError) {
        console.error('Error fetching NetSuite WOs:', nsWOError);
      } else {
        netsuiteWOs = nsWOs || [];
        linkedSOIds = [...new Set(
          netsuiteWOs
            .map(wo => wo.created_from_so_id)
            .filter(Boolean)
        )];
      }
    }

    // STEP 4: Fetch Sales Orders by their NetSuite internal ID
    let salesOrders: any[] = [];

    if (linkedSOIds.length > 0) {
      const { data: sos, error: soError } = await supabase
        .from('netsuite_sales_orders')
        .select(`
          id,
          netsuite_id,
          so_number,
          so_date,
          status,
          customer_name,
          total_amount,
          synced_at,
          netsuite_sales_order_lines (
            id,
            netsuite_line_id,
            line_number,
            item_id,
            item_name,
            item_description,
            item_type,
            quantity,
            rate,
            amount,
            cost_estimate,
            gross_profit,
            gross_margin_pct,
            is_closed
          )
        `)
        .in('netsuite_id', linkedSOIds);

      if (soError) {
        console.error('Error fetching sales orders:', soError);
      } else {
        salesOrders = sos || [];
      }
    }

    // STEP 5: Fetch Work Orders with line items for the linked SOs
    const soNumbers = salesOrders.map(so => so.so_number);
    let workOrdersWithLines: any[] = [];

    if (soNumbers.length > 0) {
      const { data: wos, error: woLineError } = await supabase
        .from('netsuite_work_orders')
        .select(`
          id,
          netsuite_id,
          wo_number,
          wo_date,
          status,
          customer_name,
          created_from_so_number,
          netsuite_work_order_lines (
            id,
            netsuite_line_id,
            line_number,
            item_id,
            item_name,
            item_description,
            item_type,
            quantity,
            quantity_completed,
            unit_cost,
            line_cost,
            is_closed
          )
        `)
        .in('created_from_so_number', soNumbers);

      if (!woLineError) {
        workOrdersWithLines = wos || [];
      }
    }

    // Build work orders map by SO number
    const woBySONumber: Record<string, WorkOrder[]> = {};
    for (const wo of workOrdersWithLines) {
      const soNum = wo.created_from_so_number;
      if (!soNum) continue;

      if (!woBySONumber[soNum]) {
        woBySONumber[soNum] = [];
      }

      const woLineItems: WOLineItem[] = (wo.netsuite_work_order_lines || []).map((line: any) => ({
        lineId: line.netsuite_line_id,
        itemId: line.item_id,
        itemName: line.item_name,
        itemDescription: line.item_description,
        itemType: line.item_type,
        quantity: line.quantity || 0,
        quantityCompleted: line.quantity_completed || 0,
        unitCost: line.unit_cost || 0,
        lineCost: line.line_cost || 0,
        isClosed: line.is_closed || false,
      }));

      const totalCost = woLineItems.reduce((sum, li) => sum + li.lineCost, 0);
      const totalQty = woLineItems.reduce((sum, li) => sum + li.quantity, 0);

      // Get Excel data for this WO
      const excelData = excelWODataMap[wo.wo_number] || { revenue: null, cost: null };

      woBySONumber[soNum].push({
        woNumber: wo.wo_number,
        netsuiteId: wo.netsuite_id,
        woDate: wo.wo_date,
        status: wo.status,
        customerName: wo.customer_name,
        excelRevenue: excelData.revenue,
        excelCost: excelData.cost,
        lineItems: woLineItems,
        totals: {
          itemCount: woLineItems.length,
          totalQuantity: totalQty,
          totalCost: totalCost,
        },
      });
    }

    // Build response
    let totalRevenue = 0;
    let totalCostEstimate = 0;
    let totalWOCost = 0;
    let totalSOLines = 0;
    let totalWOLines = 0;
    let totalWOCount = 0;

    const salesOrdersResponse: SalesOrder[] = salesOrders.map((so: any) => {
      const soLineItems: SOLineItem[] = (so.netsuite_sales_order_lines || []).map((line: any) => ({
        lineId: line.netsuite_line_id,
        itemId: line.item_id,
        itemName: line.item_name,
        itemDescription: line.item_description,
        itemType: line.item_type,
        quantity: line.quantity || 0,
        rate: line.rate || 0,
        amount: line.amount || 0,
        costEstimate: line.cost_estimate || 0,
        grossProfit: line.gross_profit || 0,
        grossMarginPct: line.gross_margin_pct || 0,
        isClosed: line.is_closed || false,
      }));

      const linkedWOs = woBySONumber[so.so_number] || [];

      const soRevenue = soLineItems.reduce((sum, li) => sum + li.amount, 0);
      const soCostEstimate = soLineItems.reduce((sum, li) => sum + li.costEstimate, 0);
      const soGrossProfit = soRevenue - soCostEstimate;
      const soGrossMarginPct = soRevenue > 0 ? (soGrossProfit / soRevenue) * 100 : 0;
      const woMfgCost = linkedWOs.reduce((sum, wo) => sum + wo.totals.totalCost, 0);
      const woLineCount = linkedWOs.reduce((sum, wo) => sum + wo.lineItems.length, 0);

      totalRevenue += soRevenue;
      totalCostEstimate += soCostEstimate;
      totalWOCost += woMfgCost;
      totalSOLines += soLineItems.length;
      totalWOLines += woLineCount;
      totalWOCount += linkedWOs.length;

      return {
        soNumber: so.so_number,
        netsuiteId: so.netsuite_id,
        soDate: so.so_date,
        status: so.status,
        customerName: so.customer_name,
        totalAmount: so.total_amount || soRevenue,
        lineItems: soLineItems,
        workOrders: linkedWOs,
        totals: {
          lineItemCount: soLineItems.length,
          workOrderCount: linkedWOs.length,
          revenue: soRevenue,
          costEstimate: soCostEstimate,
          grossProfit: soGrossProfit,
          grossMarginPct: soGrossMarginPct,
          woManufacturingCost: woMfgCost,
        },
      };
    });

    // Aggregate Excel project totals
    const excelTotals = excelProjects.reduce((acc, p) => ({
      budgetRevenue: acc.budgetRevenue + (p.budget_revenue || 0),
      budgetCost: acc.budgetCost + (p.budget_cost || 0),
      budgetGP: acc.budgetGP + (p.budget_gp || 0),
      actualRevenue: acc.actualRevenue + (p.actual_revenue || 0),
      actualCost: acc.actualCost + (p.actual_cost || 0),
      actualGP: acc.actualGP + (p.actual_gp || 0),
      variance: acc.variance + (p.variance || 0),
    }), {
      budgetRevenue: 0,
      budgetCost: 0,
      budgetGP: 0,
      actualRevenue: 0,
      actualCost: 0,
      actualGP: 0,
      variance: 0,
    });

    // Calculate KPIs - combining Excel budget with NetSuite actuals
    const budgetGPM = excelTotals.budgetRevenue > 0
      ? (excelTotals.budgetGP / excelTotals.budgetRevenue) * 100
      : 0;

    const actualGPM = excelTotals.actualRevenue > 0
      ? (excelTotals.actualGP / excelTotals.actualRevenue) * 100
      : 0;

    const cpi = excelTotals.actualCost > 0
      ? excelTotals.budgetCost / excelTotals.actualCost
      : 1;

    const kpis: ProjectKPIs = {
      budgetRevenue: excelTotals.budgetRevenue,
      budgetCost: excelTotals.budgetCost,
      budgetGP: excelTotals.budgetGP,
      budgetGPM: budgetGPM,
      netsuiteRevenue: totalRevenue,
      netsuiteCostEstimate: totalCostEstimate,
      netsuiteWOCost: totalWOCost,
      actualRevenue: excelTotals.actualRevenue,
      actualCost: excelTotals.actualCost,
      actualGP: excelTotals.actualGP,
      actualGPM: actualGPM,
      variance: excelTotals.variance,
      variancePct: excelTotals.budgetGP > 0
        ? (excelTotals.variance / excelTotals.budgetGP) * 100
        : 0,
      cpi: cpi,
    };

    // Map Excel projects for response
    const excelProjectsResponse: ExcelProject[] = excelProjects.map(p => ({
      id: p.id,
      projectName: p.project_name,
      projectYear: p.project_year,
      projectType: p.project_type,
      budgetRevenue: p.budget_revenue || 0,
      budgetCost: p.budget_cost || 0,
      budgetGP: p.budget_gp || 0,
      actualRevenue: p.actual_revenue || 0,
      actualCost: p.actual_cost || 0,
      actualGP: p.actual_gp || 0,
      variance: p.variance || 0,
    }));

    // Get sync status
    const { data: syncData } = await supabase
      .from('netsuite_work_orders')
      .select('synced_at')
      .order('synced_at', { ascending: false })
      .limit(1);

    const { count: woCount } = await supabase
      .from('netsuite_work_orders')
      .select('id', { count: 'exact', head: true });

    const { count: soCount } = await supabase
      .from('netsuite_sales_orders')
      .select('id', { count: 'exact', head: true });

    const response: ProjectProfitabilityResponse = {
      project: {
        name: projectName,
        year: year,
        type: typeParam,
        customerName: salesOrders[0]?.customer_name || null,
        excelProjects: excelProjectsResponse,
        kpis: kpis,
        salesOrders: salesOrdersResponse,
        totals: {
          salesOrderCount: salesOrdersResponse.length,
          workOrderCount: totalWOCount,
          soLineItemCount: totalSOLines,
          woLineItemCount: totalWOLines,
          totalRevenue: totalRevenue,
          totalCostEstimate: totalCostEstimate,
          totalWOCost: totalWOCost,
        },
      },
      debug: {
        excelWONumbers: rawWONumbers,
        netsuiteWOsFound: netsuiteWOs.length,
        linkedSOIds: linkedSOIds,
      },
      syncStatus: {
        lastSyncedAt: syncData?.[0]?.synced_at || null,
        workOrderCount: woCount || 0,
        salesOrderCount: soCount || 0,
      },
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Profitability API error:', error);
    return NextResponse.json({
      error: 'Server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

/**
 * POST endpoint for comparing Excel vs NetSuite data
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { project, year, type } = body;

    if (!project) {
      return NextResponse.json({
        error: 'Missing required parameter',
        message: 'project is required in request body',
      }, { status: 400 });
    }

    // Build URL for GET request
    const url = new URL(request.url);
    url.searchParams.set('project', project);
    if (year) url.searchParams.set('year', year.toString());
    if (type) url.searchParams.set('type', type);

    // Get data via GET handler
    const getRequest = new Request(url.toString());
    const response = await GET(getRequest);

    return response;

  } catch (error) {
    console.error('Profitability POST API error:', error);
    return NextResponse.json({
      error: 'Server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
