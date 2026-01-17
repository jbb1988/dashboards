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

    // Get sample recent work orders
    const { data: recentWOs } = await supabase
      .from('netsuite_work_orders')
      .select('wo_number, wo_date, status, created_from_so_number')
      .order('wo_date', { ascending: false })
      .limit(10);

    return NextResponse.json({
      success: true,
      counts: {
        workOrders: woCount || 0,
        workOrderLines: wolCount || 0,
        salesOrders: soCount || 0,
        salesOrderLines: solCount || 0,
      },
      recentWorkOrders: recentWOs || [],
      errors: [woError, wolError, soError, solError].filter(e => e),
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
