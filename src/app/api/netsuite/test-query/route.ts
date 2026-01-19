import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('netsuite_sales_orders')
    .select(`
      id,
      customer_name,
      so_number,
      so_date,
      netsuite_sales_order_lines (
        item_name,
        amount,
        quantity
      )
    `)
    .gte('so_date', '2025-01-01')
    .lte('so_date', '2025-12-31')
    .limit(5);

  return NextResponse.json({
    success: !error,
    error: error?.message,
    count: data?.length || 0,
    sample: data,
  });
}
