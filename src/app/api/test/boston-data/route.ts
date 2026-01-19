import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getSupabaseAdmin();

  // Check if SO7324 and SO7521 have line items
  const { data, error } = await supabase
    .from('netsuite_sales_orders')
    .select(`
      so_number,
      netsuite_id,
      netsuite_sales_order_lines (
        id,
        item_name,
        account_number,
        amount
      )
    `)
    .in('so_number', ['SO7324', 'SO7521']);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    salesOrders: data?.map(so => ({
      soNumber: so.so_number,
      netsuiteId: so.netsuite_id,
      lineCount: so.netsuite_sales_order_lines?.length || 0,
      sampleLine: so.netsuite_sales_order_lines?.[0] || null,
    })),
  });
}
