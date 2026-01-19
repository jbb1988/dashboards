/**
 * Verify foreign key integrity between sales_order_lines and sales_orders
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getSupabaseAdmin();

  // Get a recent 2025 SO
  const { data: recentSO } = await supabase
    .from('netsuite_sales_orders')
    .select('id, netsuite_id, so_number, so_date')
    .gte('so_date', '2025-01-01')
    .order('so_date', { ascending: false })
    .limit(1)
    .single();

  if (!recentSO) {
    return NextResponse.json({ error: 'No recent 2025 SO found' });
  }

  // Check if any lines reference this SO's database ID
  const { data: linesByDBId, count: countByDBId } = await supabase
    .from('netsuite_sales_order_lines')
    .select('*', { count: 'exact' })
    .eq('sales_order_id', recentSO.id);

  // Check if any lines exist with this NetSuite ID in their transaction_id
  // (This would show if the lines exist but aren't linked)
  const { data: allLines } = await supabase
    .from('netsuite_sales_order_lines')
    .select('*')
    .limit(5);

  // Get sample of all SO IDs
  const { data: allSOIds } = await supabase
    .from('netsuite_sales_orders')
    .select('id, netsuite_id, so_number')
    .gte('so_date', '2025-01-01')
    .limit(10);

  // Count lines that reference 2025 SO IDs
  const soIds = allSOIds?.map(so => so.id) || [];
  const { count: linesFor2025SOs } = await supabase
    .from('netsuite_sales_order_lines')
    .select('*', { count: 'exact', head: true })
    .in('sales_order_id', soIds);

  return NextResponse.json({
    recentSO,
    linesByDBId: {
      count: countByDBId,
      sample: linesByDBId?.slice(0, 3),
    },
    allLines: allLines?.slice(0, 3).map(line => ({
      id: line.id,
      sales_order_id: line.sales_order_id,
      netsuite_line_id: line.netsuite_line_id,
      item_name: line.item_name,
      amount: line.amount,
    })),
    recentSOIds: allSOIds?.map(so => ({
      db_id: so.id,
      netsuite_id: so.netsuite_id,
      so_number: so.so_number,
    })),
    linesFor2025SOs,
  });
}
