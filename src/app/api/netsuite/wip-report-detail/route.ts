import { NextResponse } from 'next/server';
import { getWIPReportDetail } from '@/lib/netsuite-wip-reports';

export const dynamic = 'force-dynamic';

/**
 * Query the MARS WIP Report-TB Review (Itemized Detail for Analysis) - Search ID: 1963
 * Shows individual cost line items with detailed breakdown by item
 *
 * Query params:
 * - customer: Filter by customer name
 * - workOrder: Filter by WO number
 * - dateFrom: Filter by date (YYYY-MM-DD)
 * - dateTo: Filter by date (YYYY-MM-DD)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const filters = {
      customer: searchParams.get('customer') || undefined,
      workOrder: searchParams.get('workOrder') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
    };

    const results = await getWIPReportDetail(filters);

    // Calculate totals
    const totals = results.reduce((acc, row) => ({
      labor_hours: acc.labor_hours + (parseFloat(String(row.labor_hours || 0))),
      labor_cost: acc.labor_cost + (parseFloat(String(row.labor_cost || 0))),
      expense_cost: acc.expense_cost + (parseFloat(String(row.expense_report_cost || 0))),
      material_cost: acc.material_cost + (parseFloat(String(row.material_cost || 0))),
      freight_cost: acc.freight_cost + (parseFloat(String(row.freight_cost || 0))),
      total_cost: acc.total_cost + (parseFloat(String(row.total_cost || 0))),
    }), {
      labor_hours: 0,
      labor_cost: 0,
      expense_cost: 0,
      material_cost: 0,
      freight_cost: 0,
      total_cost: 0,
    });

    return NextResponse.json({
      lineItems: results,
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
