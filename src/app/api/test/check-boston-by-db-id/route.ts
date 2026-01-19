/**
 * Check for Boston lines by database ID
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getSupabaseAdmin();

  // Get Boston SO database IDs
  const { data: bostonSOs } = await supabase
    .from('netsuite_sales_orders')
    .select('id, netsuite_id, so_number')
    .in('so_number', ['SO7324', 'SO7521']);

  // For each, check lines
  const results = [];
  for (const so of bostonSOs || []) {
    const { data: lines, count } = await supabase
      .from('netsuite_sales_order_lines')
      .select('*', { count: 'exact' })
      .eq('sales_order_id', so.id);

    results.push({
      so_number: so.so_number,
      netsuite_id: so.netsuite_id,
      db_id: so.id,
      line_count: count,
      sample_lines: lines?.slice(0, 2),
    });
  }

  return NextResponse.json({
    bostonSOs: results,
  });
}
