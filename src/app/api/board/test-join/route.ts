import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getSupabaseAdmin();

  // Get one SO
  const { data: so } = await supabase
    .from('netsuite_sales_orders')
    .select('id, so_number, customer_name')
    .gte('so_date', '2025-01-01')
    .limit(1)
    .single();

  if (!so) {
    return NextResponse.json({ error: 'No SO found' });
  }

  // Get lines for that SO
  const { data: lines } = await supabase
    .from('netsuite_sales_order_lines')
    .select('*')
    .eq('sales_order_id', so.id);

  return NextResponse.json({
    so,
    line_count: lines?.length || 0,
    lines: lines?.slice(0, 3),
  });
}
