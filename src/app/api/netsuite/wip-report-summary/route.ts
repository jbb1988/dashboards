import { NextResponse } from 'next/server';
import { getWIPReportSummary } from '@/lib/netsuite-wip-reports';

export const dynamic = 'force-dynamic';

/**
 * Query the MARS WIP Report-TB Review (Summary) - Search ID: 1654
 * Shows rolled-up costs per work order with Labor $, Expense Report $, Material $, Freight $
 *
 * Query params:
 * - customer: Filter by customer name
 * - salesOrder: Filter by SO number
 * - workOrder: Filter by WO number
 * - dateFrom: Filter by date (YYYY-MM-DD)
 * - dateTo: Filter by date (YYYY-MM-DD)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const filters = {
      customer: searchParams.get('customer') || undefined,
      salesOrder: searchParams.get('salesOrder') || undefined,
      workOrder: searchParams.get('workOrder') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
    };

    const results = await getWIPReportSummary(filters);

    // Calculate totals
    const totals = results.reduce((acc, row) => ({
      revenue: acc.revenue + (parseFloat(String(row.revenue || 0))),
      labor_hours: acc.labor_hours + (parseFloat(String(row.labor_hours || 0))),
      labor_cost: acc.labor_cost + (parseFloat(String(row.labor_cost || 0))),
      expense_cost: acc.expense_cost + (parseFloat(String(row.expense_report_cost || 0))),
      material_cost: acc.material_cost + (parseFloat(String(row.material_cost || 0))),
      freight_cost: acc.freight_cost + (parseFloat(String(row.freight_cost || 0))),
      total_cost: acc.total_cost + (parseFloat(String(row.total_cost || 0))),
      gross_margin: acc.gross_margin + (parseFloat(String(row.gross_margin || 0))),
    }), {
      revenue: 0,
      labor_hours: 0,
      labor_cost: 0,
      expense_cost: 0,
      material_cost: 0,
      freight_cost: 0,
      total_cost: 0,
      gross_margin: 0,
    });

    return NextResponse.json({
      workOrders: results,
      count: results.length,
      totals,
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Query failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
