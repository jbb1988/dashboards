import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get('year') || '2025';

  const supabase = getSupabaseAdmin();

  const { data: salesOrders, error: soError } = await supabase
    .from('netsuite_sales_orders')
    .select(`
      id,
      customer_name,
      so_number,
      so_date,
      netsuite_sales_order_lines!sales_order_id (
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
    .limit(5);

  return NextResponse.json({
    error: soError?.message,
    count: salesOrders?.length || 0,
    sample: salesOrders?.slice(0, 2),
  });
}
