import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getSupabaseAdmin();

  // Get a sample line
  const { data: sampleLine } = await supabase
    .from('netsuite_sales_order_lines')
    .select('id, sales_order_id, item_name, amount')
    .not('sales_order_id', 'is', null)
    .limit(1)
    .single();

  // Check if the sales_order_id exists in netsuite_sales_orders
  let soExists = null;
  if (sampleLine) {
    const { data: so } = await supabase
      .from('netsuite_sales_orders')
      .select('id, so_number, netsuite_id')
      .eq('id', sampleLine.sales_order_id)
      .single();

    soExists = so;
  }

  // Count orphaned lines (lines where sales_order_id doesn't match any SO)
  const { count: totalLines } = await supabase
    .from('netsuite_sales_order_lines')
    .select('*', { count: 'exact', head: true });

  // Get recent 2025 SO IDs
  const { data: recent2025SOs } = await supabase
    .from('netsuite_sales_orders')
    .select('id, so_number, netsuite_id')
    .gte('so_date', '2025-01-01')
    .lte('so_date', '2025-12-31')
    .order('so_date', { ascending: false })
    .limit(5);

  // Check if any lines reference these SOs
  const soIds = recent2025SOs?.map(so => so.id) || [];
  const { count: linesForRecent2025 } = await supabase
    .from('netsuite_sales_order_lines')
    .select('*', { count: 'exact', head: true })
    .in('sales_order_id', soIds);

  return NextResponse.json({
    success: true,
    sampleLine,
    soExists,
    totalLines,
    recent2025SOs,
    linesForRecent2025,
  });
}
