/**
 * Count all SOs in database
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getSupabaseAdmin();

  const { count: totalSOs } = await supabase
    .from('netsuite_sales_orders')
    .select('*', { count: 'exact', head: true });

  const { count: sos2025 } = await supabase
    .from('netsuite_sales_orders')
    .select('*', { count: 'exact', head: true })
    .gte('so_date', '2025-01-01')
    .lte('so_date', '2025-12-31');

  const { count: sos2026 } = await supabase
    .from('netsuite_sales_orders')
    .select('*', { count: 'exact', head: true })
    .gte('so_date', '2026-01-01')
    .lte('so_date', '2026-12-31');

  // Check if Boston SOs exist
  const { data: bostonSOs } = await supabase
    .from('netsuite_sales_orders')
    .select('netsuite_id, so_number')
    .in('netsuite_id', ['1099273', '1116796']);

  return NextResponse.json({
    totalSOs,
    sos2025,
    sos2026,
    bostonSOs,
  });
}
