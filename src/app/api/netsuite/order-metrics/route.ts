import { NextResponse } from 'next/server';
import { getOrderMetrics } from '@/lib/netsuite-order-metrics';

export const dynamic = 'force-dynamic';

/**
 * GET /api/netsuite/order-metrics
 *
 * Returns Order→Cash KPIs including:
 * - Sales order aging by bucket (0-30, 31-60, 61-90, 90+ days)
 * - Total backlog value
 * - Revenue at risk
 * - On-time delivery percentage
 *
 * Query params:
 * - dateFrom: Filter orders from date (YYYY-MM-DD)
 * - dateTo: Filter orders to date (YYYY-MM-DD)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const filters = {
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
    };

    const metrics = await getOrderMetrics(filters);

    return NextResponse.json({
      success: true,
      metrics: {
        // Aging buckets
        aging: {
          '0-30': metrics.aging0to30,
          '31-60': metrics.aging31to60,
          '61-90': metrics.aging61to90,
          '90+': metrics.aging90Plus,
        },

        // Summary KPIs
        summary: {
          totalOpenOrders: metrics.totalOpenOrders,
          totalBacklogValue: metrics.totalBacklogValue,
          revenueAtRisk: metrics.revenueAtRisk,
          onTimeDeliveryPct: metrics.onTimeDeliveryPct,
        },

        // Lists for detail views
        orders: metrics.orders,
        fulfillments: metrics.recentFulfillments,
      },
    });
  } catch (error) {
    console.error('Error fetching order metrics:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch order metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
