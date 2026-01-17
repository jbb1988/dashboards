import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const url = new URL(request.url);
  const woNumber = url.searchParams.get('woNumber') || 'WO6721';

  const supabase = getSupabaseAdmin();

  // Get the work order
  const { data: wo } = await supabase
    .from('netsuite_work_orders')
    .select('id, wo_number')
    .eq('wo_number', woNumber)
    .single();

  if (!wo) {
    return NextResponse.json({ error: `WO ${woNumber} not found` }, { status: 404 });
  }

  // Delete line items
  const { error, count } = await supabase
    .from('netsuite_work_order_lines')
    .delete()
    .eq('work_order_id', wo.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    message: `Deleted ${count || 'unknown number of'} lines for ${woNumber}`,
    woId: wo.id,
  });
}
