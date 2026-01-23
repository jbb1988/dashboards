import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const supabase = getSupabaseAdmin();

  // Get SO3009 header
  const { data: so, error: soError } = await supabase
    .from('netsuite_sales_orders')
    .select('*')
    .eq('netsuite_id', '341203')
    .single();

  if (soError || !so) {
    return NextResponse.json({
      found: false,
      error: soError?.message || 'SO3009 not found',
    });
  }

  // Get line items for SO3009
  const { data: lines, error: linesError } = await supabase
    .from('netsuite_sales_order_lines')
    .select('*')
    .eq('sales_order_id', so.id);

  return NextResponse.json({
    found: true,
    so: {
      id: so.id,
      netsuite_id: so.netsuite_id,
      so_number: so.so_number,
      total_amount: so.total_amount,
      synced_at: so.synced_at,
    },
    lineCount: lines?.length || 0,
    lines: lines || [],
    linesError: linesError?.message,
  });
}
