/**
 * Check 2025-2026 data completeness ONLY
 */

import { NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    // Count 2025-2026 Sales Orders in NetSuite
    const soQuery = `
      SELECT COUNT(*) as total
      FROM Transaction
      WHERE type = 'SalesOrd'
        AND trandate >= TO_DATE('01/01/2025', 'MM/DD/YYYY')
    `;
    const soResponse = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      { method: 'POST', body: { q: soQuery }, params: { limit: '1' } }
    );
    const netsuiteSO = parseInt(soResponse.items?.[0]?.total) || 0;

    // Count 2025-2026 Sales Orders in DB
    const { count: dbSO } = await supabase
      .from('netsuite_sales_orders')
      .select('*', { count: 'exact', head: true })
      .gte('so_date', '2025-01-01');

    // Count 2025-2026 Work Orders in NetSuite
    const woQuery = `
      SELECT COUNT(*) as total
      FROM Transaction
      WHERE type = 'WorkOrd'
        AND trandate >= TO_DATE('01/01/2025', 'MM/DD/YYYY')
    `;
    const woResponse = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      { method: 'POST', body: { q: woQuery }, params: { limit: '1' } }
    );
    const netsuiteWO = parseInt(woResponse.items?.[0]?.total) || 0;

    // Count 2025-2026 Work Orders in DB
    const { count: dbWO } = await supabase
      .from('netsuite_work_orders')
      .select('*', { count: 'exact', head: true })
      .gte('wo_date', '2025-01-01');

    // Count line items with/without names for 2025-2026 SOs
    const { data: soIds } = await supabase
      .from('netsuite_sales_orders')
      .select('id')
      .gte('so_date', '2025-01-01');

    const soIdList = (soIds || []).map(s => s.id);

    let linesWithName = 0;
    let linesWithoutName = 0;

    if (soIdList.length > 0) {
      const { count: withName } = await supabase
        .from('netsuite_sales_order_lines')
        .select('*', { count: 'exact', head: true })
        .in('sales_order_id', soIdList)
        .not('item_name', 'is', null);

      const { count: withoutName } = await supabase
        .from('netsuite_sales_order_lines')
        .select('*', { count: 'exact', head: true })
        .in('sales_order_id', soIdList)
        .is('item_name', null);

      linesWithName = withName || 0;
      linesWithoutName = withoutName || 0;
    }

    return NextResponse.json({
      period: '2025-01-01 to present',
      salesOrders: {
        netsuite: netsuiteSO,
        database: dbSO || 0,
        missing: netsuiteSO - (dbSO || 0),
        complete: netsuiteSO === (dbSO || 0),
      },
      workOrders: {
        netsuite: netsuiteWO,
        database: dbWO || 0,
        missing: netsuiteWO - (dbWO || 0),
        complete: netsuiteWO === (dbWO || 0),
      },
      lineItems: {
        withItemName: linesWithName,
        withoutItemName: linesWithoutName,
        total: linesWithName + linesWithoutName,
        percentComplete: linesWithName + linesWithoutName > 0
          ? Math.round((linesWithName / (linesWithName + linesWithoutName)) * 100)
          : 0,
      },
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
