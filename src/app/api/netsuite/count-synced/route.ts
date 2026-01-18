/**
 * API Route: /api/netsuite/count-synced
 * Count synced work orders and sales orders in database
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    // Count work orders
    const { count: woCount, error: woError } = await supabase
      .from('netsuite_work_orders')
      .select('*', { count: 'exact', head: true });

    // Count work order lines
    const { count: wolCount, error: wolError } = await supabase
      .from('netsuite_work_order_lines')
      .select('*', { count: 'exact', head: true });

    // Count sales orders
    const { count: soCount, error: soError } = await supabase
      .from('netsuite_sales_orders')
      .select('*', { count: 'exact', head: true });

    // Count sales order lines
    const { count: solCount, error: solError } = await supabase
      .from('netsuite_sales_order_lines')
      .select('*', { count: 'exact', head: true });

    // Count sales order lines with NULL item_name
    const { count: nullItemNameCount, error: nullError } = await supabase
      .from('netsuite_sales_order_lines')
      .select('*', { count: 'exact', head: true })
      .is('item_name', null);

    // Get sample recent sales order lines with item names
    const { data: recentSOLines } = await supabase
      .from('netsuite_sales_order_lines')
      .select('netsuite_line_id, item_id, item_name, item_description, updated_at')
      .order('updated_at', { ascending: false })
      .limit(10);

    // Get sample recent work orders
    const { data: recentWOs } = await supabase
      .from('netsuite_work_orders')
      .select('wo_number, wo_date, status, created_from_so_number')
      .order('wo_date', { ascending: false })
      .limit(10);

    // Get date range of sales orders
    const { data: dateRange } = await supabase
      .from('netsuite_sales_orders')
      .select('so_date')
      .order('so_date', { ascending: true })
      .limit(1);

    const { data: dateRangeMax } = await supabase
      .from('netsuite_sales_orders')
      .select('so_date')
      .order('so_date', { ascending: false })
      .limit(1);

    // Get distinct item_ids that have NULL item_name (excluding system items with negative IDs)
    const { data: nullItemIds } = await supabase
      .from('netsuite_sales_order_lines')
      .select('item_id, item_type')
      .is('item_name', null)
      .gt('item_id', '0')
      .limit(50);

    // Get distinct item_ids that are system items (negative IDs) with NULL names
    const { data: systemItemIds } = await supabase
      .from('netsuite_sales_order_lines')
      .select('item_id, item_type')
      .is('item_name', null)
      .lt('item_id', '0')
      .limit(20);

    // Count by item_type for NULL items
    const { data: nullByType } = await supabase
      .from('netsuite_sales_order_lines')
      .select('item_type')
      .is('item_name', null);

    // Group null items by type
    const nullTypeGroups: Record<string, number> = {};
    for (const row of nullByType || []) {
      const t = row.item_type || 'unknown';
      nullTypeGroups[t] = (nullTypeGroups[t] || 0) + 1;
    }

    return NextResponse.json({
      success: true,
      counts: {
        workOrders: woCount || 0,
        workOrderLines: wolCount || 0,
        salesOrders: soCount || 0,
        salesOrderLines: solCount || 0,
        salesOrderLinesNullItemName: nullItemNameCount || 0,
      },
      dateRange: {
        earliest: dateRange?.[0]?.so_date || null,
        latest: dateRangeMax?.[0]?.so_date || null,
      },
      nullAnalysis: {
        byItemType: nullTypeGroups,
        sampleRealItemsWithNull: nullItemIds || [],
        sampleSystemItemsWithNull: systemItemIds || [],
      },
      recentWorkOrders: recentWOs || [],
      recentSalesOrderLines: recentSOLines || [],
      errors: [woError, wolError, soError, solError, nullError].filter(e => e),
    });
  } catch (error) {
    console.error('Error counting synced records:', error);
    return NextResponse.json(
      {
        error: 'Failed to count records',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
