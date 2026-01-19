/**
 * Check when lines were created and which SOs they belong to
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getSupabaseAdmin();

  // Get lines created recently (during the 2025/2026 resync)
  const { data: recentLines } = await supabase
    .from('netsuite_sales_order_lines')
    .select(`
      id,
      sales_order_id,
      netsuite_line_id,
      item_name,
      amount,
      created_at,
      netsuite_sales_orders!inner (
        so_number,
        so_date,
        netsuite_id
      )
    `)
    .gte('created_at', '2026-01-18')
    .order('created_at', { ascending: false })
    .limit(20);

  // Get count of lines by SO date range
  const { data: lineCountBySO } = await supabase
    .from('netsuite_sales_order_lines')
    .select(`
      sales_order_id,
      netsuite_sales_orders!inner (
        so_number,
        so_date
      )
    `)
    .gte('created_at', '2026-01-18');

  // Group by SO date
  const dateGroups: Record<string, number> = {};
  for (const line of lineCountBySO || []) {
    const so = (line as any).netsuite_sales_orders;
    const date = so?.so_date?.substring(0, 7) || 'unknown'; // YYYY-MM
    dateGroups[date] = (dateGroups[date] || 0) + 1;
  }

  return NextResponse.json({
    recentLines: recentLines?.map(line => {
      const so = (line as any).netsuite_sales_orders;
      return {
        line_id: line.id,
        item_name: line.item_name,
        amount: line.amount,
        created_at: line.created_at,
        so_number: so?.so_number,
        so_date: so?.so_date,
        netsuite_so_id: so?.netsuite_id,
      };
    }),
    lineCountByMonth: dateGroups,
    totalRecentLines: lineCountBySO?.length || 0,
  });
}
