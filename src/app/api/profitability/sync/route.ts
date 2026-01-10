import { NextRequest, NextResponse } from 'next/server';
import { getProjectProfitability } from '@/lib/netsuite';
import {
  upsertProjectProfitability,
  deleteAllProjectProfitability,
  deleteProjectProfitabilityByYear,
  createProfitabilitySyncLog,
  updateProfitabilitySyncLog,
  ProjectProfitability,
} from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minute timeout for sync

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode') || 'full'; // 'full' | 'delta' | 'year'
  const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : null;
  const startDate = searchParams.get('startDate') || undefined;
  const endDate = searchParams.get('endDate') || undefined;
  const pageSize = parseInt(searchParams.get('pageSize') || '500', 10);
  const maxPages = parseInt(searchParams.get('maxPages') || '100', 10);
  const clearFirst = searchParams.get('clear') === 'true';

  // Create sync log entry
  const syncLogId = await createProfitabilitySyncLog(mode === 'delta' ? 'delta' : 'full');

  try {
    console.log('Starting profitability sync:', { mode, year, startDate, endDate, pageSize, maxPages, clearFirst });

    // Determine date range based on mode
    let syncStartDate = startDate;
    let syncEndDate = endDate;

    if (mode === 'full' && !startDate) {
      // Full sync: 3 years back
      syncStartDate = '2022-01-01';
      syncEndDate = new Date().toISOString().split('T')[0];
    } else if (mode === 'year' && year) {
      syncStartDate = `${year}-01-01`;
      syncEndDate = `${year}-12-31`;
    } else if (mode === 'delta' && !startDate) {
      // Delta sync: last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      syncStartDate = thirtyDaysAgo.toISOString().split('T')[0];
      syncEndDate = new Date().toISOString().split('T')[0];
    }

    // Clear data if requested
    let deletedCount = 0;
    if (clearFirst) {
      if (mode === 'year' && year) {
        deletedCount = await deleteProjectProfitabilityByYear(year);
        console.log(`Deleted ${deletedCount} records for year ${year}`);
      } else if (mode === 'full') {
        deletedCount = await deleteAllProjectProfitability();
        console.log(`Deleted ${deletedCount} total records`);
      }
    }

    // Fetch data from NetSuite with pagination
    let allRecords: ProjectProfitability[] = [];
    let offset = 0;
    let hasMore = true;
    let pageCount = 0;

    while (hasMore && pageCount < maxPages) {
      console.log(`Fetching page ${pageCount + 1} from NetSuite (offset: ${offset})`);

      const result = await getProjectProfitability({
        startDate: syncStartDate,
        endDate: syncEndDate,
        limit: pageSize,
        offset,
      });

      // Transform NetSuite records to Supabase format
      const transformed: ProjectProfitability[] = result.records.map(r => ({
        netsuite_transaction_id: r.netsuiteTransactionId,
        netsuite_line_id: r.netsuiteLineId,
        transaction_number: r.transactionNumber,
        transaction_type: r.transactionType,
        transaction_date: r.transactionDate,
        posting_period: r.postingPeriod,
        year: r.year,
        month: r.month,
        customer_id: r.customerId,
        customer_name: r.customerName,
        class_id: r.classId,
        class_name: r.className,
        project_type: r.projectType,
        account_id: r.accountId,
        account_number: r.accountNumber,
        account_name: r.accountName,
        account_type: r.accountType,
        is_revenue: r.isRevenue,
        is_cogs: r.isCogs,
        amount: r.amount,
        quantity: r.quantity,
        item_id: r.itemId,
        item_name: r.itemName,
      }));

      allRecords = [...allRecords, ...transformed];

      hasMore = result.hasMore;
      offset += pageSize;
      pageCount++;

      console.log(`Page ${pageCount}: Fetched ${result.records.length} records (total: ${allRecords.length})`);

      // Update sync log with progress
      if (syncLogId) {
        await updateProfitabilitySyncLog(syncLogId, {
          records_fetched: allRecords.length,
        });
      }
    }

    console.log(`Syncing ${allRecords.length} records to Supabase...`);

    // Upsert to Supabase in batches
    const batchSize = 500;
    let totalUpserted = 0;
    const errors: string[] = [];

    for (let i = 0; i < allRecords.length; i += batchSize) {
      const batch = allRecords.slice(i, i + batchSize);
      const result = await upsertProjectProfitability(batch);

      if (result.success) {
        totalUpserted += result.count;
      } else {
        errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${result.error}`);
      }
    }

    console.log('Sync complete:', { totalUpserted, errors });

    // Update sync log with final stats
    if (syncLogId) {
      await updateProfitabilitySyncLog(syncLogId, {
        status: errors.length > 0 ? 'failed' : 'completed',
        completed_at: new Date().toISOString(),
        records_fetched: allRecords.length,
        records_upserted: totalUpserted,
        records_deleted: deletedCount,
        error_message: errors.length > 0 ? errors.join('; ') : undefined,
        metadata: {
          mode,
          year,
          startDate: syncStartDate,
          endDate: syncEndDate,
          pagesProcessed: pageCount,
          hasMoreInNetSuite: hasMore,
        },
      });
    }

    // Calculate summary stats
    const revenueRecords = allRecords.filter(r => r.is_revenue);
    const cogsRecords = allRecords.filter(r => r.is_cogs);
    const totalRevenue = revenueRecords.reduce((sum, r) => sum + Math.abs(r.amount), 0);
    const totalCogs = cogsRecords.reduce((sum, r) => sum + Math.abs(r.amount), 0);

    return NextResponse.json({
      success: true,
      message: `Synced ${totalUpserted} project profitability records`,
      stats: {
        totalFetched: allRecords.length,
        totalUpserted,
        totalDeleted: deletedCount,
        pagesProcessed: pageCount,
        hasMoreInNetSuite: hasMore,
        revenueRecords: revenueRecords.length,
        cogsRecords: cogsRecords.length,
        totalRevenue,
        totalCogs,
        grossProfit: totalRevenue - totalCogs,
        grossProfitPct: totalRevenue > 0 ? ((totalRevenue - totalCogs) / totalRevenue) * 100 : 0,
        errors: errors.length > 0 ? errors : undefined,
      },
      filters: {
        mode,
        year,
        startDate: syncStartDate,
        endDate: syncEndDate,
      },
      syncLogId,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error syncing profitability:', error);

    // Update sync log with error
    if (syncLogId) {
      await updateProfitabilitySyncLog(syncLogId, {
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to sync profitability data',
        message: error instanceof Error ? error.message : 'Unknown error',
        syncLogId,
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check sync status
export async function GET() {
  return NextResponse.json({
    message: 'Use POST to trigger a sync',
    usage: {
      method: 'POST',
      queryParams: {
        mode: "'full' (default), 'delta' (last 30 days), or 'year'",
        year: 'Year to sync (when mode=year)',
        startDate: 'Optional start date (YYYY-MM-DD)',
        endDate: 'Optional end date (YYYY-MM-DD)',
        pageSize: 'Number of records per page (default: 500)',
        maxPages: 'Maximum pages to fetch (default: 100)',
        clear: "'true' to clear existing data before sync",
      },
      examples: [
        'POST /api/profitability/sync?mode=full&clear=true',
        'POST /api/profitability/sync?mode=year&year=2024',
        'POST /api/profitability/sync?mode=delta',
      ],
    },
  });
}
