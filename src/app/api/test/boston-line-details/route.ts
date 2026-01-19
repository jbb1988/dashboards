/**
 * Check Boston line details from database
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getSupabaseAdmin();

  const { data: lines } = await supabase
    .from('netsuite_sales_order_lines')
    .select(`
      id,
      item_name,
      quantity,
      rate,
      amount,
      account_number,
      account_name,
      netsuite_sales_orders!inner (
        so_number,
        total_amount
      )
    `)
    .in('netsuite_sales_orders.so_number', ['SO7324', 'SO7521'])
    .limit(10);

  return NextResponse.json({
    lines: lines?.map(line => {
      const so = (line as any).netsuite_sales_orders;
      return {
        so_number: so?.so_number,
        so_total: so?.total_amount,
        item_name: line.item_name,
        quantity: line.quantity,
        rate: line.rate,
        amount: line.amount,
        account_number: line.account_number,
        account_name: line.account_name,
      };
    }),
  });
}
