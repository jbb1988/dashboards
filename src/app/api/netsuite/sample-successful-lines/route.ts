import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const supabase = getSupabaseAdmin();

  try {
    // Find lines with account_number populated
    const { data: linesWithAccount } = await supabase
      .from('netsuite_sales_order_lines')
      .select('*, sales_order:netsuite_sales_orders(*)')
      .not('account_number', 'is', null)
      .limit(10);

    // Find lines without account_number
    const { data: linesWithoutAccount } = await supabase
      .from('netsuite_sales_order_lines')
      .select('*, sales_order:netsuite_sales_orders(*)')
      .is('account_number', null)
      .limit(10);

    return NextResponse.json({
      success: true,
      withAccountCount: linesWithAccount?.length || 0,
      withoutAccountCount: linesWithoutAccount?.length || 0,
      sampleWithAccount: linesWithAccount?.map(l => ({
        so_number: l.sales_order?.so_number,
        netsuite_id: l.sales_order?.netsuite_id,
        line_number: l.line_number,
        item_name: l.item_name,
        account_number: l.account_number,
        class_id: l.class_id,
        class_name: l.class_name,
      })) || [],
      sampleWithoutAccount: linesWithoutAccount?.map(l => ({
        so_number: l.sales_order?.so_number,
        netsuite_id: l.sales_order?.netsuite_id,
        line_number: l.line_number,
        item_name: l.item_name,
        account_number: l.account_number,
        class_id: l.class_id,
        class_name: l.class_name,
      })) || [],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
