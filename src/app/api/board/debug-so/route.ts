import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get('year') || '2025';

  const supabase = getSupabaseAdmin();

  const { data: salesOrders, error } = await supabase
    .from('netsuite_sales_orders')
    .select(`
      id,
      customer_name,
      so_number,
      so_date,
      netsuite_sales_order_lines (
        item_name,
        amount,
        quantity,
        rate,
        class_name
      )
    `)
    .gte('so_date', `${year}-01-01`)
    .lte('so_date', `${year}-12-31`)
    .order('customer_name')
    .limit(3);

  return NextResponse.json({
    error: error?.message,
    count: salesOrders?.length || 0,
    sample: salesOrders,
  });
}
