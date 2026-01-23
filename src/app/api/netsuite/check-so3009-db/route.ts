import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const supabase = getSupabaseAdmin();

  // Check for SO3009 by netsuite_id
  const { data: byId } = await supabase
    .from('netsuite_sales_orders')
    .select('*')
    .eq('netsuite_id', '341203')
    .maybeSingle();

  // Check for SO3009 by so_number
  const { data: byNumber } = await supabase
    .from('netsuite_sales_orders')
    .select('*')
    .eq('so_number', 'SO3009')
    .maybeSingle();

  // Check for any SO with tranid SO3009
  const { data: byTranid } = await supabase
    .from('netsuite_sales_orders')
    .select('*')
    .eq('tranid', 'SO3009')
    .maybeSingle();

  // Check line items if header exists
  let lineItems = null;
  const header = byId || byNumber || byTranid;
  if (header) {
    const { data: lines, count } = await supabase
      .from('netsuite_sales_order_lines')
      .select('*', { count: 'exact' })
      .eq('sales_order_id', header.id);
    lineItems = { count, sample: lines?.slice(0, 3) };
  }

  return NextResponse.json({
    foundById: !!byId,
    foundByNumber: !!byNumber,
    foundByTranid: !!byTranid,
    header: header || null,
    lineItems,
    diagnosis: !header
      ? 'SO3009 header does NOT exist in database - need to create it'
      : lineItems?.count === 0
      ? 'Header exists but has NO line items - need to sync lines'
      : 'Header and lines exist OK',
  });
}
