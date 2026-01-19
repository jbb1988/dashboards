import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('netsuite_sales_orders')
    .select(`
      so_number,
      netsuite_id,
      total_amount,
      netsuite_sales_order_lines (
        line_number,
        item_id,
        item_name,
        item_description,
        account_number,
        account_name,
        quantity,
        rate,
        amount
      )
    `)
    .eq('so_number', 'SO7150');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'SO7150 not found' }, { status: 404 });
  }

  const so = data[0];
  const lines4081 = (so.netsuite_sales_order_lines || []).filter(
    (line: any) => line.account_number === '4081'
  );

  return NextResponse.json({
    soNumber: so.so_number,
    totalAmount: so.total_amount,
    lines4081,
    allLines: so.netsuite_sales_order_lines,
  }, { status: 200 });
}
