/**
 * API Route: /api/closeout/profitability
 * Enhanced Project Profitability Dashboard API
 *
 * CORRECT FLOW: Excel Project Type → Work Orders → Sales Orders → Line Items
 *
 * Shows data organized by project type (TBEN, MCC, etc.) so you can see
 * which WOs and SOs belong to each type of work.
 *
 * Project Type Legend:
 * - TBEN: Test Bench Equipment New
 * - TBIN: Test Bench Install
 * - PM: Project Management
 * - M3IN: M3 Install
 * - MCC: Maintenance Service and Calibration
 * - DRM3: DRM3
 * - SCH: Scheduling
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Project type descriptions
const PROJECT_TYPE_NAMES: Record<string, string> = {
  'TBEN': 'Test Bench Equipment New',
  'TBIN': 'Test Bench Install',
  'PM': 'Project Management',
  'M3IN': 'M3 Install',
  'MCC': 'Maintenance Service & Calibration',
  'DRM3': 'DRM3',
  'SCH': 'Scheduling',
};

// Types for the API response
interface SOLineItem {
  lineNumber: number;
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
  lineNumber: number;
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

interface LinkedSalesOrder {
  soNumber: string;
  netsuiteId: string;
  soDate: string | null;
  status: string | null;
  customerName: string | null;
  totalAmount: number;
  lineItems: SOLineItem[];
  totals: {
    lineItemCount: number;
    revenue: number;
    costEstimate: number;
    grossProfit: number;
    grossMarginPct: number;
  };
}

interface WorkOrderDetail {
  woNumber: string;
  netsuiteId: string;
  woDate: string | null;
  status: string | null;
  linkedSO: LinkedSalesOrder | null;
  lineItems: WOLineItem[];
  totals: {
    lineItemCount: number;
    totalCost: number;
  };
}

interface ProjectTypeDetail {
  typeCode: string;
  typeName: string;
  excelData: {
    budgetRevenue: number;
    budgetCost: number;
    budgetGP: number;
    actualRevenue: number;
    actualCost: number;
    actualGP: number;
    variance: number;
  };
  workOrders: WorkOrderDetail[];
  linkedSalesOrders: string[]; // List of SO numbers linked to this project type
  totals: {
    woCount: number;
    soCount: number;
    netsuiteRevenue: number;
    netsuiteCostEstimate: number;
  };
}

interface ProjectProfitabilityResponse {
  project: {
    name: string;
    year: number | null;
    customerName: string | null;
    projectTypes: ProjectTypeDetail[];
    totals: {
      projectTypeCount: number;
      workOrderCount: number;
      salesOrderCount: number;
      excelBudgetRevenue: number;
      excelActualRevenue: number;
      excelVariance: number;
      netsuiteRevenue: number;
      netsuiteCostEstimate: number;
    };
  };
  legend: Record<string, string>;
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
    const typeParam = url.searchParams.get('type'); // Optional: filter by specific project type

    if (!projectName) {
      return NextResponse.json({
        error: 'Missing required parameter',
        message: 'project parameter is required (e.g., ?project=Sarasota&year=2025)',
        example: '/api/closeout/profitability?project=Sarasota&year=2025',
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

    // Exclude year=0 summary rows
    projectQuery = projectQuery.gt('project_year', 0);

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

    // STEP 2: For each project type, get WOs and their linked SOs
    const projectTypes: ProjectTypeDetail[] = [];
    const allSONumbers: Set<string> = new Set();
    let totalWOCount = 0;

    for (const excelProject of excelProjects) {
      // Get WOs for this project type
      const { data: excelWOs } = await supabase
        .from('closeout_work_orders')
        .select('wo_number, actual_revenue, actual_cost')
        .eq('closeout_project_id', excelProject.id)
        .not('wo_number', 'is', null)
        .neq('wo_number', '');

      const uniqueWONumbers = [...new Set((excelWOs || []).map(wo => wo.wo_number))];
      const netsuiteWONumbers = uniqueWONumbers.map(n => `WO${n}`);

      // Look up WOs in NetSuite
      let workOrderDetails: WorkOrderDetail[] = [];
      const linkedSOIds: Set<string> = new Set();

      if (netsuiteWONumbers.length > 0) {
        const { data: nsWOs } = await supabase
          .from('netsuite_work_orders')
          .select(`
            netsuite_id,
            wo_number,
            wo_date,
            status,
            created_from_so_id,
            created_from_so_number,
            netsuite_work_order_lines (
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
          .in('wo_number', netsuiteWONumbers);

        if (nsWOs) {
          for (const wo of nsWOs) {
            if (wo.created_from_so_id) {
              linkedSOIds.add(wo.created_from_so_id);
            }

            const woLineItems: WOLineItem[] = (wo.netsuite_work_order_lines || []).map((line: any) => ({
              lineNumber: line.line_number || 0,
              itemId: line.item_id || '',
              itemName: line.item_name,
              itemDescription: line.item_description,
              itemType: line.item_type,
              quantity: line.quantity || 0,
              quantityCompleted: line.quantity_completed || 0,
              unitCost: line.unit_cost || 0,
              lineCost: line.line_cost || 0,
              isClosed: line.is_closed || false,
            }));

            workOrderDetails.push({
              woNumber: wo.wo_number,
              netsuiteId: wo.netsuite_id,
              woDate: wo.wo_date,
              status: wo.status,
              linkedSO: null, // Will be filled in below
              lineItems: woLineItems,
              totals: {
                lineItemCount: woLineItems.length,
                totalCost: woLineItems.reduce((sum, li) => sum + li.lineCost, 0),
              },
            });
          }
        }
      }

      // Fetch linked Sales Orders with line items
      if (linkedSOIds.size > 0) {
        const { data: salesOrders } = await supabase
          .from('netsuite_sales_orders')
          .select(`
            netsuite_id,
            so_number,
            so_date,
            status,
            customer_name,
            total_amount,
            netsuite_sales_order_lines (
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
          .in('netsuite_id', Array.from(linkedSOIds));

        // Map SOs to WOs
        if (salesOrders) {
          const soMap = new Map<string, any>();
          for (const so of salesOrders) {
            soMap.set(so.netsuite_id, so);
            allSONumbers.add(so.so_number);
          }

          // Attach SOs to WOs
          for (const woDetail of workOrderDetails) {
            const nsWO = (await supabase
              .from('netsuite_work_orders')
              .select('created_from_so_id')
              .eq('wo_number', woDetail.woNumber)
              .single()).data;

            if (nsWO?.created_from_so_id && soMap.has(nsWO.created_from_so_id)) {
              const so = soMap.get(nsWO.created_from_so_id);
              const soLineItems: SOLineItem[] = (so.netsuite_sales_order_lines || []).map((line: any) => ({
                lineNumber: line.line_number || 0,
                itemId: line.item_id || '',
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

              const soRevenue = soLineItems.reduce((sum, li) => sum + li.amount, 0);
              const soCostEstimate = soLineItems.reduce((sum, li) => sum + li.costEstimate, 0);

              woDetail.linkedSO = {
                soNumber: so.so_number,
                netsuiteId: so.netsuite_id,
                soDate: so.so_date,
                status: so.status,
                customerName: so.customer_name,
                totalAmount: so.total_amount || soRevenue,
                lineItems: soLineItems,
                totals: {
                  lineItemCount: soLineItems.length,
                  revenue: soRevenue,
                  costEstimate: soCostEstimate,
                  grossProfit: soRevenue - soCostEstimate,
                  grossMarginPct: soRevenue > 0 ? ((soRevenue - soCostEstimate) / soRevenue) * 100 : 0,
                },
              };
            }
          }
        }
      }

      // Calculate totals for this project type
      const netsuiteRevenue = workOrderDetails.reduce((sum, wo) =>
        sum + (wo.linkedSO?.totals.revenue || 0), 0);
      const netsuiteCostEstimate = workOrderDetails.reduce((sum, wo) =>
        sum + (wo.linkedSO?.totals.costEstimate || 0), 0);
      const soNumbers = workOrderDetails
        .filter(wo => wo.linkedSO)
        .map(wo => wo.linkedSO!.soNumber);

      projectTypes.push({
        typeCode: excelProject.project_type,
        typeName: PROJECT_TYPE_NAMES[excelProject.project_type] || excelProject.project_type,
        excelData: {
          budgetRevenue: excelProject.budget_revenue || 0,
          budgetCost: excelProject.budget_cost || 0,
          budgetGP: excelProject.budget_gp || 0,
          actualRevenue: excelProject.actual_revenue || 0,
          actualCost: excelProject.actual_cost || 0,
          actualGP: excelProject.actual_gp || 0,
          variance: excelProject.variance || 0,
        },
        workOrders: workOrderDetails,
        linkedSalesOrders: [...new Set(soNumbers)],
        totals: {
          woCount: workOrderDetails.length,
          soCount: new Set(soNumbers).size,
          netsuiteRevenue,
          netsuiteCostEstimate,
        },
      });

      totalWOCount += workOrderDetails.length;
    }

    // Calculate overall totals
    const excelBudgetRevenue = projectTypes.reduce((sum, pt) => sum + pt.excelData.budgetRevenue, 0);
    const excelActualRevenue = projectTypes.reduce((sum, pt) => sum + pt.excelData.actualRevenue, 0);
    const excelVariance = projectTypes.reduce((sum, pt) => sum + pt.excelData.variance, 0);
    const netsuiteRevenue = projectTypes.reduce((sum, pt) => sum + pt.totals.netsuiteRevenue, 0);
    const netsuiteCostEstimate = projectTypes.reduce((sum, pt) => sum + pt.totals.netsuiteCostEstimate, 0);

    // Get customer name from first SO
    const firstSOWithCustomer = projectTypes
      .flatMap(pt => pt.workOrders)
      .find(wo => wo.linkedSO?.customerName);

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
        customerName: firstSOWithCustomer?.linkedSO?.customerName || null,
        projectTypes: projectTypes.sort((a, b) => b.excelData.actualRevenue - a.excelData.actualRevenue),
        totals: {
          projectTypeCount: projectTypes.length,
          workOrderCount: totalWOCount,
          salesOrderCount: allSONumbers.size,
          excelBudgetRevenue,
          excelActualRevenue,
          excelVariance,
          netsuiteRevenue,
          netsuiteCostEstimate,
        },
      },
      legend: PROJECT_TYPE_NAMES,
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
