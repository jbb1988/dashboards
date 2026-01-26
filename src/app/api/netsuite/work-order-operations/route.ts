import { NextResponse } from 'next/server';
import {
  getWorkOrderOperations,
  getWorkOrdersWithOperations,
  getWIPReportSummary,
  WorkOrderWithOperations,
} from '@/lib/netsuite-wip-reports';

export const dynamic = 'force-dynamic';

/**
 * GET /api/netsuite/work-order-operations
 *
 * Fetches work order manufacturing operations from NetSuite.
 *
 * Query Parameters:
 * - workOrder: Filter by specific work order number
 * - status: Filter by operation status
 * - dateFrom: Filter by start date (YYYY-MM-DD)
 * - dateTo: Filter by end date (YYYY-MM-DD)
 * - view: 'operations' for raw operations, 'combined' for WOs with operations (default: combined)
 * - includeWIP: Include WIP cost data (default: true)
 * - limit: Max number of work orders to return (default: 500)
 *
 * Required NetSuite Permissions:
 * - Lists > Manufacturing > Manufacturing Operation Task → View
 * - Lists > Manufacturing > Manufacturing Routing → View
 * - Setup > SuiteQL → Full
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const workOrder = searchParams.get('workOrder') || undefined;
    const status = searchParams.get('status') || undefined;
    const dateFrom = searchParams.get('dateFrom') || undefined;
    const dateTo = searchParams.get('dateTo') || undefined;
    const view = searchParams.get('view') || 'combined';
    const includeWIP = searchParams.get('includeWIP') !== 'false';
    const limit = parseInt(searchParams.get('limit') || '500', 10);

    console.log('Work Order Operations API:', {
      workOrder,
      status,
      dateFrom,
      dateTo,
      view,
      includeWIP,
      limit,
    });

    // Raw operations view - just return operations data
    if (view === 'operations') {
      const operations = await getWorkOrderOperations({
        workOrder,
        status,
        dateFrom,
        dateTo,
      });

      return NextResponse.json({
        data: operations,
        count: operations.length,
      });
    }

    // Combined view - work orders with operations
    // Parse status filter if provided
    const statusFilter = status ? status.split(',') : undefined;

    const workOrders = await getWorkOrdersWithOperations({
      status: statusFilter,
      dateFrom,
      dateTo,
      limit,
    });

    // Filter by specific work order if provided
    let filteredWOs = workOrders;
    if (workOrder) {
      filteredWOs = workOrders.filter(wo =>
        wo.work_order.toLowerCase().includes(workOrder.toLowerCase())
      );
    }

    // Optionally include WIP cost data
    if (includeWIP && filteredWOs.length > 0) {
      try {
        console.log('Fetching WIP cost data...');
        const wipData = await getWIPReportSummary({
          dateFrom,
          dateTo,
        });

        // Index WIP data by work order number
        const wipByWO = new Map<string, { revenue: number; totalCost: number }>();
        for (const wip of wipData) {
          const existing = wipByWO.get(wip.work_order) || { revenue: 0, totalCost: 0 };
          existing.revenue += wip.revenue || 0;
          existing.totalCost += wip.total_cost || 0;
          wipByWO.set(wip.work_order, existing);
        }

        // Merge WIP data into work orders
        filteredWOs = filteredWOs.map(wo => {
          const wip = wipByWO.get(wo.work_order);
          if (wip) {
            const marginPct = wip.revenue > 0
              ? ((wip.revenue - wip.totalCost) / wip.revenue) * 100
              : null;
            return {
              ...wo,
              revenue: wip.revenue,
              total_cost: wip.totalCost,
              margin_pct: marginPct,
            };
          }
          return wo;
        });

        console.log(`Merged WIP data for ${wipByWO.size} work orders`);
      } catch (wipError) {
        console.warn('Failed to fetch WIP data:', wipError);
        // Continue without WIP data
      }
    }

    // Calculate KPI totals
    const kpis = calculateKPIs(filteredWOs);

    return NextResponse.json({
      data: filteredWOs,
      count: filteredWOs.length,
      kpis,
    });
  } catch (error) {
    console.error('Work Order Operations API error:', error);

    // Check for specific NetSuite permission errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('ManufacturingOperationTask') ||
        errorMessage.includes('permission') ||
        errorMessage.includes('Invalid search')) {
      return NextResponse.json(
        {
          error: 'Missing NetSuite permissions',
          message: 'The ManufacturingOperationTask table requires additional permissions. ' +
                   'Please add: Lists > Manufacturing > Manufacturing Operation Task → View',
          details: errorMessage,
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch work order operations',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * Calculate KPI metrics for the dashboard
 */
function calculateKPIs(workOrders: WorkOrderWithOperations[]) {
  const totalWIP = workOrders.length;

  // Total WIP value (revenue)
  const wipValue = workOrders.reduce((sum, wo) => sum + (wo.revenue || 0), 0);

  // Operations behind schedule (days_in_current_op > 7 as threshold)
  const operationsBehind = workOrders.filter(wo =>
    wo.days_in_current_op !== null && wo.days_in_current_op > 7
  ).length;

  // Average days in operation
  const wosWithDays = workOrders.filter(wo => wo.days_in_current_op !== null);
  const avgDaysInOp = wosWithDays.length > 0
    ? Math.round(wosWithDays.reduce((sum, wo) => sum + (wo.days_in_current_op || 0), 0) / wosWithDays.length)
    : 0;

  // Ready to ship (at final operation or 100% complete)
  const readyToShip = workOrders.filter(wo => wo.percent_complete >= 90).length;

  // Average margin
  const wosWithMargin = workOrders.filter(wo => wo.margin_pct !== null);
  const avgMargin = wosWithMargin.length > 0
    ? wosWithMargin.reduce((sum, wo) => sum + (wo.margin_pct || 0), 0) / wosWithMargin.length
    : null;

  // Total cost
  const totalCost = workOrders.reduce((sum, wo) => sum + (wo.total_cost || 0), 0);

  return {
    totalWIP,
    wipValue,
    operationsBehind,
    avgDaysInOp,
    readyToShip,
    avgMargin,
    totalCost,
  };
}
