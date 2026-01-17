import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const woNumber = url.searchParams.get('woNumber') || 'WO6721';

  const supabase = getSupabaseAdmin();

  // Get the work order
  const { data: wo } = await supabase
    .from('netsuite_work_orders')
    .select('id, wo_number, netsuite_id')
    .eq('wo_number', woNumber)
    .single();

  if (!wo) {
    return NextResponse.json({ error: `WO ${woNumber} not found` }, { status: 404 });
  }

  // Get line items from database
  const { data: lines } = await supabase
    .from('netsuite_work_order_lines')
    .select('*')
    .eq('work_order_id', wo.id)
    .order('line_number')
    .limit(10);

  return NextResponse.json({
    wo,
    lines,
  });
}
