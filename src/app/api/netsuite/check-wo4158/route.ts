import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const supabase = getSupabaseAdmin();

  // Get WO4158 details
  const { data: wo } = await supabase
    .from('netsuite_work_orders')
    .select('*')
    .eq('wo_number', 'WO4158')
    .maybeSingle();

  let soByCreatedFrom = null;
  if (wo?.created_from_so_id) {
    // Check if SO with this netsuite_id exists
    const { data: so } = await supabase
      .from('netsuite_sales_orders')
      .select('*')
      .eq('netsuite_id', wo.created_from_so_id)
      .maybeSingle();
    soByCreatedFrom = so;
  }

  // Also check for SO3009 by number
  const { data: so3009ByNumber } = await supabase
    .from('netsuite_sales_orders')
    .select('*')
    .eq('so_number', 'SO3009')
    .maybeSingle();

  return NextResponse.json({
    wo4158: wo,
    soByCreatedFromId: soByCreatedFrom,
    so3009ByNumber: so3009ByNumber,
    diagnosis: !wo
      ? 'WO4158 not found'
      : !wo.created_from_so_id
      ? 'WO4158 has no created_from_so_id'
      : !soByCreatedFrom
      ? `SO with netsuite_id=${wo.created_from_so_id} not found`
      : !so3009ByNumber
      ? 'SO3009 not found by so_number'
      : soByCreatedFrom.id !== so3009ByNumber.id
      ? 'created_from_so_id points to different SO than SO3009'
      : 'All links OK',
  });
}
