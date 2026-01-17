/**
 * API Route: /api/netsuite/sync-actual-costs
 * Batch sync actual costs from NetSuite Work Order Completions and Issues
 *
 * This endpoint is MORE EFFICIENT than the per-WO approach because it fetches
 * ALL actual costs in ONE SuiteQL query instead of N queries (one per WO).
 *
 * How it works:
 * 1. Query NetSuite for all WOCompl/WOIssue transactions that post costs
 * 2. Group costs by WO ID and Item ID
 * 3. Update netsuite_work_order_lines.actual_cost in batch
 * 4. Update netsuite_work_orders.total_actual_cost aggregated total
 *
 * Query Parameters:
 * - startDate: YYYY-MM-DD (default: 2024-01-01)
 * - endDate: YYYY-MM-DD (default: today)
 * - limit: Max records to fetch (default: 10000)
 */

import { NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for large syncs

interface ActualCostRecord {
  wo_id: string;
  item_id: string;
  actual_cost: number;
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);

    // Parse query parameters
    const startDate = url.searchParams.get('startDate') || '2024-01-01';
    const endDate = url.searchParams.get('endDate') || new Date().toISOString().split('T')[0];
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '1000'), 1000); // NetSuite max is 1000

    console.log('Starting batch actual cost sync...');
    console.log('Parameters:', { startDate, endDate, limit });

    // Convert dates to NetSuite format (MM/DD/YYYY)
    const [startY, startM, startD] = startDate.split('-');
    const [endY, endM, endD] = endDate.split('-');
    const nsStartDate = `${startM}/${startD}/${startY}`;
    const nsEndDate = `${endM}/${endD}/${endY}`;

    // EFFICIENT QUERY: Get actual costs from WOCompl/WOIssue transactions
    // Starts from completion transaction lines and groups by WO ID and item
    // Note: We get WO numbers from our local database since we already have that mapping
    const query = `
      SELECT
        completionLine.createdfrom AS wo_id,
        completionLine.item AS item_id,
        SUM(ABS(COALESCE(tal.amount, 0))) AS actual_cost
      FROM TransactionLine completionLine
      INNER JOIN Transaction t ON t.id = completionLine.transaction
      INNER JOIN TransactionAccountingLine tal ON tal.transaction = t.id
        AND tal.transactionline = completionLine.id
      WHERE t.type IN ('WOCompl', 'WOIssue')
        AND tal.posting = 'T'
        AND tal.amount < 0
        AND t.trandate >= TO_DATE('${nsStartDate}', 'MM/DD/YYYY')
        AND t.trandate <= TO_DATE('${nsEndDate}', 'MM/DD/YYYY')
        AND completionLine.createdfrom IS NOT NULL
      GROUP BY completionLine.createdfrom, completionLine.item
    `;

    console.log('Executing batch SuiteQL query for actual costs...');

    const response = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: query },
        params: { limit: limit.toString() },
      }
    );

    const rows = response.items || [];
    console.log(`SuiteQL returned ${rows.length} cost records`);

    if (rows.length === 0) {
      return NextResponse.json({
        success: true,
        stats: {
          recordsFetched: 0,
          linesUpdated: 0,
          workOrdersUpdated: 0,
          errors: [],
        },
        message: 'No actual cost records found for the date range',
        syncedAt: new Date().toISOString(),
      });
    }

    // Parse records
    const costRecords: ActualCostRecord[] = rows.map(row => ({
      wo_id: row.wo_id?.toString() || '',
      item_id: row.item_id?.toString() || '',
      actual_cost: parseFloat(row.actual_cost) || 0,
    }));

    // Group by WO for total calculation
    const costsByWO = new Map<string, { items: Map<string, number>; total: number }>();
    for (const record of costRecords) {
      if (!costsByWO.has(record.wo_id)) {
        costsByWO.set(record.wo_id, {
          items: new Map(),
          total: 0,
        });
      }
      const woData = costsByWO.get(record.wo_id)!;
      woData.items.set(record.item_id, (woData.items.get(record.item_id) || 0) + record.actual_cost);
      woData.total += record.actual_cost;
    }

    console.log(`Found actual costs for ${costsByWO.size} work orders`);

    // Get Supabase admin client
    const supabase = getSupabaseAdmin();

    let linesUpdated = 0;
    let workOrdersUpdated = 0;
    const errors: string[] = [];

    // Update each work order and its line items
    for (const [woNetsuiteId, woData] of costsByWO) {
      try {
        // Find the work order in our database
        const { data: wo, error: woFindError } = await supabase
          .from('netsuite_work_orders')
          .select('id, wo_number')
          .eq('netsuite_id', woNetsuiteId)
          .single();

        if (woFindError || !wo) {
          // WO not in our database - might not be synced yet
          continue;
        }

        const woNumber = wo.wo_number || woNetsuiteId;

        // Update total_actual_cost on work order header
        const { error: woUpdateError } = await supabase
          .from('netsuite_work_orders')
          .update({
            total_actual_cost: woData.total,
            updated_at: new Date().toISOString(),
          })
          .eq('id', wo.id);

        if (woUpdateError) {
          errors.push(`WO ${woNumber}: ${woUpdateError.message}`);
          console.error(`Error updating WO ${woNumber}:`, woUpdateError);
        } else {
          workOrdersUpdated++;
        }

        // Update actual_cost on line items
        for (const [itemId, actualCost] of woData.items) {
          const { data: updated, error: lineError } = await supabase
            .from('netsuite_work_order_lines')
            .update({
              actual_cost: actualCost,
              line_cost: actualCost, // Also update line_cost to use actual when available
              updated_at: new Date().toISOString(),
            })
            .eq('work_order_id', wo.id)
            .eq('item_id', itemId)
            .select('id');

          if (lineError) {
            errors.push(`WO ${woNumber} item ${itemId}: ${lineError.message}`);
          } else if (updated && updated.length > 0) {
            linesUpdated += updated.length;
          }
        }

        console.log(`  Updated WO ${woNumber}: total=$${woData.total.toFixed(2)}, ${woData.items.size} items`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`WO ${woNetsuiteId}: ${errorMsg}`);
        console.error(`Error processing WO ${woNetsuiteId}:`, error);
      }
    }

    const stats = {
      recordsFetched: rows.length,
      uniqueWorkOrders: costsByWO.size,
      linesUpdated,
      workOrdersUpdated,
      errors: errors.slice(0, 50), // Limit errors in response
    };

    console.log('Batch actual cost sync complete:', stats);

    return NextResponse.json({
      success: true,
      stats,
      message: `Synced actual costs for ${workOrdersUpdated} work orders (${linesUpdated} line items updated)`,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in batch actual cost sync:', error);
    return NextResponse.json(
      {
        error: 'Sync failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : String(error),
      },
      { status: 500 }
    );
  }
}

// GET endpoint for checking sync status
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    // Count WOs with actual costs
    const { count: woWithCosts } = await supabase
      .from('netsuite_work_orders')
      .select('id', { count: 'exact', head: true })
      .not('total_actual_cost', 'is', null)
      .gt('total_actual_cost', 0);

    // Count total WOs
    const { count: totalWO } = await supabase
      .from('netsuite_work_orders')
      .select('id', { count: 'exact', head: true });

    // Count lines with actual costs
    const { count: linesWithCosts } = await supabase
      .from('netsuite_work_order_lines')
      .select('id', { count: 'exact', head: true })
      .not('actual_cost', 'is', null)
      .gt('actual_cost', 0);

    // Get sample of WOs with costs
    const { data: sampleWOs } = await supabase
      .from('netsuite_work_orders')
      .select('wo_number, total_actual_cost, updated_at')
      .not('total_actual_cost', 'is', null)
      .gt('total_actual_cost', 0)
      .order('updated_at', { ascending: false })
      .limit(5);

    return NextResponse.json({
      status: 'ready',
      stats: {
        workOrdersWithActualCosts: woWithCosts || 0,
        totalWorkOrders: totalWO || 0,
        linesWithActualCosts: linesWithCosts || 0,
        coveragePercent: totalWO ? Math.round(((woWithCosts || 0) / totalWO) * 100) : 0,
      },
      recentUpdates: sampleWOs || [],
      usage: {
        sync: 'POST /api/netsuite/sync-actual-costs?startDate=2024-01-01&endDate=2025-12-31',
        description: 'Fetches actual costs from WOCompl/WOIssue transactions in batch',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to get sync status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
