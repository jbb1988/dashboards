/**
 * API Route: /api/netsuite/data-completeness
 * Check if our synced data is complete vs what's in NetSuite
 */

import { NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const results: any = {
      timestamp: new Date().toISOString(),
      salesOrders: {},
      workOrders: {},
    };

    // 1. Count Sales Orders in NetSuite (all time)
    console.log('Counting Sales Orders in NetSuite...');
    const soCountQuery = `
      SELECT COUNT(*) as total
      FROM Transaction
      WHERE type = 'SalesOrd'
    `;
    const soCountResponse = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      { method: 'POST', body: { q: soCountQuery }, params: { limit: '1' } }
    );
    const netsuiteSOCount = parseInt(soCountResponse.items?.[0]?.total) || 0;

    // 2. Count Sales Orders in our database
    const { count: dbSOCount } = await supabase
      .from('netsuite_sales_orders')
      .select('*', { count: 'exact', head: true });

    // 3. Get date range in NetSuite
    const soDateQuery = `
      SELECT MIN(trandate) as earliest, MAX(trandate) as latest
      FROM Transaction
      WHERE type = 'SalesOrd'
    `;
    const soDateResponse = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      { method: 'POST', body: { q: soDateQuery }, params: { limit: '1' } }
    );

    // 4. Get date range in our database
    const { data: dbEarliest } = await supabase
      .from('netsuite_sales_orders')
      .select('so_date')
      .order('so_date', { ascending: true })
      .limit(1);
    const { data: dbLatest } = await supabase
      .from('netsuite_sales_orders')
      .select('so_date')
      .order('so_date', { ascending: false })
      .limit(1);

    results.salesOrders = {
      netsuite: {
        total: netsuiteSOCount,
        dateRange: {
          earliest: soDateResponse.items?.[0]?.earliest,
          latest: soDateResponse.items?.[0]?.latest,
        },
      },
      database: {
        total: dbSOCount || 0,
        dateRange: {
          earliest: dbEarliest?.[0]?.so_date,
          latest: dbLatest?.[0]?.so_date,
        },
      },
      completeness: {
        percentage: netsuiteSOCount > 0 ? Math.round(((dbSOCount || 0) / netsuiteSOCount) * 100) : 0,
        missing: netsuiteSOCount - (dbSOCount || 0),
      },
    };

    // 5. Count Work Orders in NetSuite
    console.log('Counting Work Orders in NetSuite...');
    const woCountQuery = `
      SELECT COUNT(*) as total
      FROM Transaction
      WHERE type = 'WorkOrd'
    `;
    const woCountResponse = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      { method: 'POST', body: { q: woCountQuery }, params: { limit: '1' } }
    );
    const netsuiteWOCount = parseInt(woCountResponse.items?.[0]?.total) || 0;

    // 6. Count Work Orders in our database
    const { count: dbWOCount } = await supabase
      .from('netsuite_work_orders')
      .select('*', { count: 'exact', head: true });

    // 7. Get WO date ranges
    const woDateQuery = `
      SELECT MIN(trandate) as earliest, MAX(trandate) as latest
      FROM Transaction
      WHERE type = 'WorkOrd'
    `;
    const woDateResponse = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      { method: 'POST', body: { q: woDateQuery }, params: { limit: '1' } }
    );

    const { data: dbWOEarliest } = await supabase
      .from('netsuite_work_orders')
      .select('wo_date')
      .order('wo_date', { ascending: true })
      .limit(1);
    const { data: dbWOLatest } = await supabase
      .from('netsuite_work_orders')
      .select('wo_date')
      .order('wo_date', { ascending: false })
      .limit(1);

    results.workOrders = {
      netsuite: {
        total: netsuiteWOCount,
        dateRange: {
          earliest: woDateResponse.items?.[0]?.earliest,
          latest: woDateResponse.items?.[0]?.latest,
        },
      },
      database: {
        total: dbWOCount || 0,
        dateRange: {
          earliest: dbWOEarliest?.[0]?.wo_date,
          latest: dbWOLatest?.[0]?.wo_date,
        },
      },
      completeness: {
        percentage: netsuiteWOCount > 0 ? Math.round(((dbWOCount || 0) / netsuiteWOCount) * 100) : 0,
        missing: netsuiteWOCount - (dbWOCount || 0),
      },
    };

    // 8. Line items with NULL item_name analysis
    const { count: nullCount } = await supabase
      .from('netsuite_sales_order_lines')
      .select('*', { count: 'exact', head: true })
      .is('item_name', null);

    const { count: totalLines } = await supabase
      .from('netsuite_sales_order_lines')
      .select('*', { count: 'exact', head: true });

    results.lineItemQuality = {
      total: totalLines || 0,
      withItemName: (totalLines || 0) - (nullCount || 0),
      withoutItemName: nullCount || 0,
      percentComplete: totalLines ? Math.round((((totalLines || 0) - (nullCount || 0)) / totalLines) * 100) : 0,
    };

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error checking data completeness:', error);
    return NextResponse.json(
      {
        error: 'Check failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
