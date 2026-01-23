import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const supabase = getSupabaseAdmin();

  try {
    // Get SO7521
    const { data: so } = await supabase
      .from('netsuite_sales_orders')
      .select('*')
      .eq('netsuite_id', '1116796')
      .single();

    if (!so) {
      return NextResponse.json({ error: 'SO7521 not found' }, { status: 404 });
    }

    // Get ALL line items
    const { data: allLines } = await supabase
      .from('netsuite_sales_order_lines')
      .select('*')
      .eq('sales_order_id', so.id)
      .order('line_number');

    return NextResponse.json({
      so: {
        id: so.id,
        netsuite_id: so.netsuite_id,
        so_number: so.so_number,
        synced_at: so.synced_at,
        updated_at: so.updated_at,
      },
      totalLines: allLines?.length || 0,
      linesWithAccount: allLines?.filter(l => l.account_number).length || 0,
      linesWithoutAccount: allLines?.filter(l => !l.account_number).length || 0,
      sampleWithAccount: allLines?.filter(l => l.account_number).slice(0, 5).map(l => ({
        line_number: l.line_number,
        item_name: l.item_name,
        account_number: l.account_number,
        account_name: l.account_name,
        amount: l.amount,
        updated_at: l.updated_at,
      })) || [],
      sampleWithoutAccount: allLines?.filter(l => !l.account_number).slice(0, 5).map(l => ({
        line_number: l.line_number,
        item_name: l.item_name,
        account_number: l.account_number,
        amount: l.amount,
        updated_at: l.updated_at,
      })) || [],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
