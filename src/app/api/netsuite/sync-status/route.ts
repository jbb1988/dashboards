/**
 * API Route: /api/netsuite/sync-status
 * Returns the current sync status of NetSuite data tables
 *
 * Used by the profitability dashboard to show data freshness
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface SyncStatus {
  workOrders: {
    count: number;
    lastSyncedAt: string | null;
    oldestDate: string | null;
    newestDate: string | null;
  };
  workOrderLines: {
    count: number;
  };
  salesOrders: {
    count: number;
    lastSyncedAt: string | null;
    oldestDate: string | null;
    newestDate: string | null;
  };
  salesOrderLines: {
    count: number;
  };
  isStale: boolean;
  staleDays: number;
  lastSyncedAt: string | null;
  recommendation: string | null;
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    // Get work order stats
    const { count: woCount } = await supabase
      .from('netsuite_work_orders')
      .select('*', { count: 'exact', head: true });

    const { data: woLatest } = await supabase
      .from('netsuite_work_orders')
      .select('synced_at, wo_date')
      .order('synced_at', { ascending: false })
      .limit(1);

    const { data: woOldest } = await supabase
      .from('netsuite_work_orders')
      .select('wo_date')
      .order('wo_date', { ascending: true })
      .limit(1);

    const { data: woNewest } = await supabase
      .from('netsuite_work_orders')
      .select('wo_date')
      .order('wo_date', { ascending: false })
      .limit(1);

    // Get work order line stats
    const { count: wolCount } = await supabase
      .from('netsuite_work_order_lines')
      .select('*', { count: 'exact', head: true });

    // Get sales order stats
    const { count: soCount } = await supabase
      .from('netsuite_sales_orders')
      .select('*', { count: 'exact', head: true });

    const { data: soLatest } = await supabase
      .from('netsuite_sales_orders')
      .select('synced_at, so_date')
      .order('synced_at', { ascending: false })
      .limit(1);

    const { data: soOldest } = await supabase
      .from('netsuite_sales_orders')
      .select('so_date')
      .order('so_date', { ascending: true })
      .limit(1);

    const { data: soNewest } = await supabase
      .from('netsuite_sales_orders')
      .select('so_date')
      .order('so_date', { ascending: false })
      .limit(1);

    // Get sales order line stats
    const { count: solCount } = await supabase
      .from('netsuite_sales_order_lines')
      .select('*', { count: 'exact', head: true });

    // Calculate staleness
    const lastWOSync = woLatest?.[0]?.synced_at ? new Date(woLatest[0].synced_at) : null;
    const lastSOSync = soLatest?.[0]?.synced_at ? new Date(soLatest[0].synced_at) : null;
    const latestSync = lastWOSync && lastSOSync
      ? (lastWOSync > lastSOSync ? lastWOSync : lastSOSync)
      : (lastWOSync || lastSOSync);

    const now = new Date();
    const staleDays = latestSync
      ? Math.floor((now.getTime() - latestSync.getTime()) / (1000 * 60 * 60 * 24))
      : -1;
    const isStale = staleDays > 1 || staleDays === -1;

    // Generate recommendation
    let recommendation: string | null = null;
    if (staleDays === -1) {
      recommendation = 'No sync data found. Run initial sync: POST /api/netsuite/scheduled-sync';
    } else if (staleDays > 7) {
      recommendation = `Data is ${staleDays} days old. Consider running a manual sync.`;
    } else if (staleDays > 1) {
      recommendation = 'Data is slightly stale. Scheduled sync will run at 2 AM UTC.';
    } else if ((solCount || 0) < (soCount || 0) * 2) {
      recommendation = 'Many sales orders may be missing line items. Consider re-syncing historical data.';
    }

    const status: SyncStatus = {
      workOrders: {
        count: woCount || 0,
        lastSyncedAt: woLatest?.[0]?.synced_at || null,
        oldestDate: woOldest?.[0]?.wo_date || null,
        newestDate: woNewest?.[0]?.wo_date || null,
      },
      workOrderLines: {
        count: wolCount || 0,
      },
      salesOrders: {
        count: soCount || 0,
        lastSyncedAt: soLatest?.[0]?.synced_at || null,
        oldestDate: soOldest?.[0]?.so_date || null,
        newestDate: soNewest?.[0]?.so_date || null,
      },
      salesOrderLines: {
        count: solCount || 0,
      },
      isStale,
      staleDays,
      lastSyncedAt: latestSync?.toISOString() || null,
      recommendation,
    };

    return NextResponse.json({
      success: true,
      status,
    });

  } catch (error) {
    console.error('Sync status error:', error);
    return NextResponse.json({
      error: 'Failed to get sync status',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
