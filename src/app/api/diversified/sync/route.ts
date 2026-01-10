import { NextRequest, NextResponse } from 'next/server';
import { getDiversifiedSales as getNetSuiteSales } from '@/lib/netsuite';
import { upsertDiversifiedSales, DiversifiedSale } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minute timeout for sync

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const pageSize = parseInt(searchParams.get('pageSize') || '100', 10);
    const maxPages = parseInt(searchParams.get('maxPages') || '50', 10);

    console.log('Starting diversified sales sync:', { startDate, endDate, pageSize, maxPages });

    let allRecords: DiversifiedSale[] = [];
    let offset = 0;
    let hasMore = true;
    let pageCount = 0;

    // Paginate through NetSuite data
    while (hasMore && pageCount < maxPages) {
      console.log(`Fetching page ${pageCount + 1} from NetSuite (offset: ${offset})`);

      const result = await getNetSuiteSales({
        startDate,
        endDate,
        limit: pageSize,
        offset,
      });

      // Transform NetSuite records to Supabase format
      const transformed: DiversifiedSale[] = result.records.map((r) => ({
        netsuite_transaction_id: r.netsuiteTransactionId,
        netsuite_line_id: r.netsuiteLineId,
        transaction_type: r.transactionType,
        transaction_number: r.transactionNumber,
        transaction_date: r.transactionDate,
        posting_period: r.postingPeriod,
        year: r.year,
        month: r.month,
        class_id: r.classId,
        class_name: r.className,
        class_category: r.classCategory,
        parent_class: r.parentClass,
        customer_id: r.customerId,
        customer_name: r.customerName,
        account_id: r.accountId,
        account_name: r.accountName,
        quantity: r.quantity,
        revenue: r.revenue,
        cost: r.cost,
        gross_profit: r.grossProfit,
        gross_profit_pct: r.grossProfitPct,
        item_id: r.itemId,
        item_name: r.itemName,
        item_description: r.itemDescription,
      }));

      allRecords = [...allRecords, ...transformed];

      hasMore = result.hasMore;
      offset += pageSize;
      pageCount++;

      console.log(`Page ${pageCount}: Fetched ${result.records.length} records (total: ${allRecords.length})`);
    }

    console.log(`Syncing ${allRecords.length} records to Supabase...`);

    // Upsert to Supabase in batches
    const batchSize = 500;
    let totalUpserted = 0;
    const errors: string[] = [];

    for (let i = 0; i < allRecords.length; i += batchSize) {
      const batch = allRecords.slice(i, i + batchSize);
      const result = await upsertDiversifiedSales(batch);

      if (result.success) {
        totalUpserted += result.count;
      } else {
        errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${result.error}`);
      }
    }

    console.log('Sync complete:', { totalUpserted, errors });

    return NextResponse.json({
      success: true,
      message: `Synced ${totalUpserted} diversified sales records`,
      stats: {
        totalFetched: allRecords.length,
        totalUpserted,
        pagesProcessed: pageCount,
        hasMoreInNetSuite: hasMore,
        errors: errors.length > 0 ? errors : undefined,
      },
      filters: {
        startDate,
        endDate,
      },
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error syncing diversified sales:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to sync diversified sales',
        message: error instanceof Error ? error.message : 'Unknown error',
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
        startDate: 'Optional start date (YYYY-MM-DD)',
        endDate: 'Optional end date (YYYY-MM-DD)',
        pageSize: 'Number of records per page (default: 100)',
        maxPages: 'Maximum pages to fetch (default: 50)',
      },
      example: 'POST /api/diversified/sync?startDate=2024-01-01&endDate=2024-12-31',
    },
  });
}
