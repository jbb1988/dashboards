import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getSupabaseAdmin();

  // Count how many 2025 SOs have lines
  const { data: sosWithLines } = await supabase
    .from('netsuite_sales_order_lines')
    .select('sales_order_id')
    .in('sales_order_id',
      supabase
        .from('netsuite_sales_orders')
        .select('id')
        .gte('so_date', '2025-01-01')
        .lte('so_date', '2025-12-31')
    );

  // Simpler approach: just count lines for 2025 SOs
  const { data: allSOs } = await supabase
    .from('netsuite_sales_orders')
    .select('id')
    .gte('so_date', '2025-01-01')
    .lte('so_date', '2025-12-31');

  const soIds = (allSOs || []).map(s => s.id);

  const { count: lineCount } = await supabase
    .from('netsuite_sales_order_lines')
    .select('*', { count: 'exact', head: true })
    .in('sales_order_id', soIds);

  return NextResponse.json({
    total_2025_sos: allSOs?.length || 0,
    total_lines_for_2025_sos: lineCount || 0,
  });
}
