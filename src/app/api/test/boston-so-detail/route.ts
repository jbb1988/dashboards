/**
 * Check detailed info about Boston SOs
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getSupabaseAdmin();

  // Get Boston SOs
  const { data: bostonSOs } = await supabase
    .from('netsuite_sales_orders')
    .select('*')
    .in('so_number', ['SO7324', 'SO7521']);

  // For each Boston SO, check if lines exist
  const results = [];
  for (const so of bostonSOs || []) {
    const { data: lines, count } = await supabase
      .from('netsuite_sales_order_lines')
      .select('*', { count: 'exact' })
      .eq('sales_order_id', so.id);

    results.push({
      so_number: so.so_number,
      so_date: so.so_date,
      netsuite_id: so.netsuite_id,
      db_id: so.id,
      total_amount: so.total_amount,
      status: so.status,
      synced_at: so.synced_at,
      line_count: count,
      sample_lines: lines?.slice(0, 2),
    });
  }

  // Also check if there are ANY lines for these NetSuite IDs
  // (in case there's an ID mismatch)
  const netsuiteIds = bostonSOs?.map(so => so.netsuite_id) || [];

  return NextResponse.json({
    bostonSOs: results,
    note: 'If line_count is 0, these SOs may not have line items in NetSuite, or they need to be resynced',
  });
}
