import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getSupabaseAdmin();

  // Check if SO6887 and SO6067 have lines
  const soNumbers = ['SO6887', 'SO6067'];
  const results = [];

  for (const soNum of soNumbers) {
    const { data: so } = await supabase
      .from('netsuite_sales_orders')
      .select('id, so_number')
      .eq('so_number', soNum)
      .single();

    if (so) {
      const { count } = await supabase
        .from('netsuite_sales_order_lines')
        .select('*', { count: 'exact', head: true })
        .eq('sales_order_id', so.id);

      results.push({
        so_number: soNum,
        so_id: so.id,
        line_count: count,
      });
    }
  }

  return NextResponse.json({ results });
}
