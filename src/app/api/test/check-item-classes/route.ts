/**
 * Check item class names for Boston line items
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getSupabaseAdmin();

  const { data: lines } = await supabase
    .from('netsuite_sales_order_lines')
    .select(`
      item_name,
      item_class_id,
      item_class_name,
      account_number,
      account_name,
      netsuite_sales_orders!inner (
        so_number
      )
    `)
    .in('netsuite_sales_orders.so_number', ['SO7324', 'SO7521'])
    .limit(15);

  return NextResponse.json({
    lines: lines?.map(line => {
      const so = (line as any).netsuite_sales_orders;
      return {
        so_number: so?.so_number,
        item_name: line.item_name,
        item_class_id: line.item_class_id,
        item_class_name: line.item_class_name,
        account_number: line.account_number,
        account_name: line.account_name,
      };
    }),
  });
}
