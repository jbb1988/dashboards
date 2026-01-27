import { NextResponse } from 'next/server';
import { getInventoryMetrics } from '@/lib/netsuite-inventory-metrics';

export const dynamic = 'force-dynamic';

/**
 * GET /api/netsuite/inventory-metrics
 *
 * Returns Inventory KPIs including:
 * - Total inventory value (on-hand x cost)
 * - Low stock items (below reorder point)
 * - Backordered items
 * - Orders/Revenue blocked by inventory constraints
 * - Backorder blast radius (impact analysis)
 * - Today's action queue (prioritized problems)
 *
 * Query params:
 * - locationId: Filter by location (optional)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const filters = {
      locationId: searchParams.get('locationId') || undefined,
    };

    const metrics = await getInventoryMetrics(filters);

    return NextResponse.json({
      success: true,
      metrics: {
        // Summary KPIs
        summary: {
          totalInventoryValue: metrics.totalInventoryValue,
          totalItemsOnHand: metrics.totalItemsOnHand,
          totalBackorderedItems: metrics.totalBackorderedItems,
          lowStockItemCount: metrics.lowStockItemCount,
          // New actionable KPIs
          revenueBlockedByInventory: metrics.revenueBlockedByInventory,
          ordersBlockedByInventory: metrics.ordersBlockedByInventory,
          topBlockingDriver: metrics.topBlockingDriver,
          topBlockingDriverCount: metrics.topBlockingDriverCount,
        },

        // Backorder blast radius - impact analysis
        backorderBlastRadius: metrics.backorderBlastRadius,

        // Today's action queue
        actionItems: metrics.actionItems,

        // Breakdown
        valueByType: metrics.valueByType,

        // Lists for detail views (sorted by revenue blocked DESC)
        lowStockItems: metrics.lowStockItems,
        backorderedItems: metrics.backorderedItems,
        allItems: metrics.allItems.slice(0, 100), // Limit to 100 for performance
      },
    });
  } catch (error) {
    console.error('Error fetching inventory metrics:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch inventory metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
