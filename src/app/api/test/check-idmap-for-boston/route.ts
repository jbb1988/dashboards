/**
 * Check if Boston NetSuite IDs would be in idMap
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getSupabaseAdmin();
  const year = '2025';

  // Replicate the idMap query from the sync
  const { data: soMapping } = await supabase
    .from('netsuite_sales_orders')
    .select('id, netsuite_id, so_number, so_date')
    .gte('so_date', `${year}-01-01`)
    .lte('so_date', `${year}-12-31`);

  const idMap: Record<string, string> = {};
  for (const row of soMapping || []) {
    idMap[row.netsuite_id] = row.id;
  }

  // Check if Boston IDs are in the map
  const bostonNetsuiteIds = ['1099273', '1116796'];
  const bostonInMap = bostonNetsuiteIds.map(id => ({
    netsuite_id: id,
    inMap: !!idMap[id],
    dbId: idMap[id] || null,
  }));

  // Find Boston SOs in the mapping
  const bostonSOs = soMapping?.filter(so =>
    bostonNetsuiteIds.includes(so.netsuite_id)
  );

  return NextResponse.json({
    totalSOsInMap: Object.keys(idMap).length,
    bostonInMap,
    bostonSOs,
    allNetsuiteIdsSample: Object.keys(idMap).slice(0, 10),
  });
}
