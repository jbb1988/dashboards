import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Debug route to check revenue calculations and identify credit memo issues
// Use this to verify data after re-syncing with the Math.abs fix
export async function GET() {
  const admin = getSupabaseAdmin();

  try {
    const results: Record<string, unknown> = {};

    // Get total records and revenue per year
    for (const year of [2024, 2025, 2026]) {
      let totalRevenue = 0;
      let totalCost = 0;
      let recordCount = 0;
      let offset = 0;
      const batchSize = 1000;
      let hasMore = true;

      const customerRevenues = new Map<string, number>();
      const transactionIds = new Set<string>();
      const transactionTypes = new Map<string, { count: number; revenue: number }>();

      while (hasMore) {
        const { data, error } = await admin
          .from('diversified_sales')
          .select('netsuite_transaction_id, netsuite_line_id, customer_id, customer_name, revenue, cost, transaction_type')
          .eq('year', year)
          .range(offset, offset + batchSize - 1);

        if (error) {
          console.error(`Error fetching year ${year}:`, error);
          break;
        }

        if (data && data.length > 0) {
          for (const row of data) {
            totalRevenue += row.revenue || 0;
            totalCost += row.cost || 0;
            recordCount++;

            const txKey = `${row.netsuite_transaction_id}-${row.netsuite_line_id}`;
            transactionIds.add(txKey);

            // Track by transaction type
            const txType = row.transaction_type || 'Unknown';
            if (!transactionTypes.has(txType)) {
              transactionTypes.set(txType, { count: 0, revenue: 0 });
            }
            const typeStats = transactionTypes.get(txType)!;
            typeStats.count++;
            typeStats.revenue += row.revenue || 0;

            const customerKey = row.customer_id || row.customer_name;
            if (customerKey) {
              customerRevenues.set(
                customerKey,
                (customerRevenues.get(customerKey) || 0) + (row.revenue || 0)
              );
            }
          }
          offset += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      // Calculate customer totals (for YoY summing)
      let sumOfCustomerRevenues = 0;
      for (const [, rev] of customerRevenues) {
        sumOfCustomerRevenues += rev;
      }

      // Convert transaction types to array for display
      const txTypeBreakdown = Array.from(transactionTypes.entries())
        .map(([type, stats]) => ({
          type,
          count: stats.count,
          revenue: stats.revenue,
          formatted_revenue: `$${(stats.revenue / 1000000).toFixed(3)}M`,
        }))
        .sort((a, b) => b.revenue - a.revenue);

      results[`year_${year}`] = {
        record_count: recordCount,
        unique_transaction_lines: transactionIds.size,
        has_duplicates: recordCount !== transactionIds.size,
        duplicate_count: recordCount - transactionIds.size,
        total_revenue_direct: totalRevenue,
        total_cost_direct: totalCost,
        customer_count: customerRevenues.size,
        sum_of_customer_revenues: sumOfCustomerRevenues,
        revenue_match: Math.abs(totalRevenue - sumOfCustomerRevenues) < 0.01,
        formatted_revenue: `$${(totalRevenue / 1000000).toFixed(2)}M`,
        by_transaction_type: txTypeBreakdown,
      };
    }

    // Check for potential duplicates
    const { data: dupCheck } = await admin
      .from('diversified_sales')
      .select('netsuite_transaction_id, netsuite_line_id, revenue')
      .eq('year', 2025)
      .limit(2000);

    const lineIdMap = new Map<string, number>();
    if (dupCheck) {
      for (const row of dupCheck) {
        const key = `${row.netsuite_transaction_id}-${row.netsuite_line_id}`;
        lineIdMap.set(key, (lineIdMap.get(key) || 0) + 1);
      }
    }

    const duplicateLineIds = Array.from(lineIdMap.entries())
      .filter(([, count]) => count > 1)
      .map(([key, count]) => ({ key, count }));

    results.duplicate_check = {
      sample_size: dupCheck?.length || 0,
      duplicates_found: duplicateLineIds.length,
      duplicates: duplicateLineIds.slice(0, 10),
    };

    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Debug insights revenue error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
