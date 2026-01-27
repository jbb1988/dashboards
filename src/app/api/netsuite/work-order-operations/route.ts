import { NextResponse } from 'next/server';
import {
  getWorkOrdersWithShopStatus,
  WorkOrderWithShopStatus,
} from '@/lib/netsuite-wip-reports';

export const dynamic = 'force-dynamic';

/**
 * GET /api/netsuite/work-order-operations
 *
 * Fetches work order shop floor status from NetSuite.
 * Uses custbodyiqfworkodershopstatus (the ACTUAL production stage field)
 * instead of manufacturingOperationTask (which is empty).
 *
 * Query Parameters:
 * - workOrder: Filter by specific work order number
 * - status: Filter by WO status (comma-separated)
 * - dateFrom: Filter by start date (YYYY-MM-DD)
 * - dateTo: Filter by end date (YYYY-MM-DD)
 * - includeWIP: Include WIP cost data (default: true)
 * - limit: Max number of work orders to return (default: 500)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const workOrder = searchParams.get('workOrder') || undefined;
    const status = searchParams.get('status') || undefined;
    const dateFrom = searchParams.get('dateFrom') || undefined;
    const dateTo = searchParams.get('dateTo') || undefined;
    const includeWIP = searchParams.get('includeWIP') !== 'false';
    const limit = parseInt(searchParams.get('limit') || '500', 10);

    console.log('Work Order Operations API:', {
      workOrder,
      status,
      dateFrom,
      dateTo,
      includeWIP,
      limit,
    });

    // Parse status filter if provided
    const statusFilter = status ? status.split(',') : undefined;

    // Fetch work orders with shop floor status
    const workOrders = await getWorkOrdersWithShopStatus({
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

    // Revenue, cost, and margin now come directly from the SO join in the main query
    // (using foreigntotal, totalcostestimate, and estgrossprofitpercent)
    // No need to fetch separate WIP data

    // Calculate KPI totals
    const kpis = calculateKPIs(filteredWOs);

    // Transform data to match expected frontend interface
    const transformedData = filteredWOs.map(wo => ({
      work_order_id: wo.work_order_id,
      work_order: wo.work_order,
      wo_date: wo.wo_date,
      status: wo.wo_status,
      customer_id: wo.customer_id,
      customer_name: wo.customer_name,
      so_number: wo.so_number,
      assembly_description: wo.assembly_description,
      // Map shop status to operation fields for compatibility
      shop_status: wo.shop_status,
      shop_status_id: wo.shop_status_id,
      days_in_status: wo.days_in_status,
      // Legacy operation fields - now derived from shop status
      operations: [],
      current_operation: wo.shop_status ? {
        operation_sequence: 1,
        operation_name: wo.shop_status,
        status: wo.wo_status || 'In Progress',
        start_date: wo.last_modified,
        end_date: null,
        completed_quantity: null,
        input_quantity: null,
        work_center: null,
        estimated_time: null,
        actual_time: null,
      } : null,
      total_operations: wo.shop_status ? 1 : 0,
      completed_operations: 0,
      percent_complete: 0,
      days_in_current_op: wo.days_in_status,
      revenue: wo.revenue,
      total_cost: wo.total_cost,
      margin_pct: wo.margin_pct,
    }));

    return NextResponse.json({
      data: transformedData,
      count: transformedData.length,
      kpis,
    });
  } catch (error) {
    console.error('Work Order Operations API error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

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
function calculateKPIs(workOrders: WorkOrderWithShopStatus[]) {
  const totalWIP = workOrders.length;

  // Total WIP value (revenue)
  const wipValue = workOrders.reduce((sum, wo) => sum + (wo.revenue || 0), 0);

  // Total cost
  const totalCost = workOrders.reduce((sum, wo) => sum + (wo.total_cost || 0), 0);

  // WOs stuck (days_in_status > 7 as threshold)
  const stuckWOs = workOrders.filter(wo => wo.days_in_status > 7);
  const operationsBehind = stuckWOs.length;

  // Revenue at risk (sum of revenue for stuck WOs)
  const revenueAtRisk = stuckWOs.reduce((sum, wo) => sum + (wo.revenue || 0), 0);

  // Average days in status
  const wosWithDays = workOrders.filter(wo => wo.days_in_status !== null);
  const avgDaysInOp = wosWithDays.length > 0
    ? Math.round(wosWithDays.reduce((sum, wo) => sum + wo.days_in_status, 0) / wosWithDays.length * 10) / 10
    : 0;

  // Ready to ship (shop_status contains "Ship")
  const readyToShip = workOrders.filter(wo =>
    wo.shop_status?.toLowerCase().includes('ship')
  ).length;

  // Average margin
  const wosWithMargin = workOrders.filter(wo => wo.margin_pct !== null);
  const avgMargin = wosWithMargin.length > 0
    ? wosWithMargin.reduce((sum, wo) => sum + (wo.margin_pct || 0), 0) / wosWithMargin.length
    : null;

  // Stage distribution
  const stageDistribution: Record<string, number> = {};
  for (const wo of workOrders) {
    const stage = wo.shop_status || 'Unknown';
    stageDistribution[stage] = (stageDistribution[stage] || 0) + 1;
  }

  return {
    totalWIP,
    wipValue,
    operationsBehind,
    avgDaysInOp,
    readyToShip,
    avgMargin,
    totalCost,
    revenueAtRisk,
    stageDistribution,
  };
}
