/**
 * API Route: /api/closeout/enrich
 * Enrich closeout work orders with NetSuite SO/WO line item details
 */

import { NextResponse } from 'next/server';
import { getWorkOrdersNeedingEnrichment, enrichWorkOrderFromNetSuite } from '@/lib/closeout';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);

    // Parse query parameters
    const projectId = url.searchParams.get('projectId') || undefined;
    const woNumber = url.searchParams.get('woNumber') || undefined;
    const yearParam = url.searchParams.get('year');
    const year = yearParam ? parseInt(yearParam) : undefined;
    const forceRefresh = url.searchParams.get('forceRefresh') === 'true';

    // Parse body for additional options
    let bodyParams: any = {};
    try {
      const body = await request.text();
      if (body) {
        bodyParams = JSON.parse(body);
      }
    } catch {
      // Body parsing failed, use query params only
    }

    // Merge params
    const filters = {
      projectId: bodyParams.projectId || projectId,
      woNumber: bodyParams.woNumber || woNumber,
      year: bodyParams.year || year,
      forceRefresh: bodyParams.forceRefresh || forceRefresh,
    };

    console.log('Starting NetSuite enrichment with filters:', filters);

    // If specific WO number provided, enrich just that one
    if (filters.woNumber) {
      const result = await enrichWorkOrderFromNetSuite(filters.woNumber);

      return NextResponse.json({
        success: result.success,
        stats: {
          workOrdersProcessed: 1,
          netsuiteCallsMade: result.success ? 2 : 0, // 1 for WO, 1 for SO
          lineItemsCached: result.lineItemsAdded,
          errors: result.error ? [result.error] : [],
        },
        message: result.success
          ? `Successfully enriched WO ${filters.woNumber} with ${result.lineItemsAdded} line items`
          : `Failed to enrich WO ${filters.woNumber}: ${result.error}`,
      });
    }

    // Otherwise, get list of work orders needing enrichment
    const workOrders = await getWorkOrdersNeedingEnrichment({
      year: filters.year,
      projectId: filters.projectId,
    });

    console.log(`Found ${workOrders.length} work orders needing enrichment`);

    if (workOrders.length === 0) {
      return NextResponse.json({
        success: true,
        stats: {
          workOrdersProcessed: 0,
          netsuiteCallsMade: 0,
          lineItemsCached: 0,
          errors: [],
        },
        message: 'No work orders found needing enrichment',
      });
    }

    // Enrich each work order
    const errors: string[] = [];
    let workOrdersProcessed = 0;
    let netsuiteCallsMade = 0;
    let lineItemsCached = 0;

    for (const wo of workOrders) {
      try {
        const result = await enrichWorkOrderFromNetSuite(wo.wo_number);

        if (result.success) {
          workOrdersProcessed++;
          netsuiteCallsMade += 2; // 1 for WO, 1 for SO
          lineItemsCached += result.lineItemsAdded;
          console.log(`✓ Enriched WO ${wo.wo_number}: ${result.lineItemsAdded} line items`);
        } else {
          errors.push(`WO ${wo.wo_number}: ${result.error}`);
          console.error(`✗ Failed to enrich WO ${wo.wo_number}:`, result.error);
        }

        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`WO ${wo.wo_number}: ${errorMsg}`);
        console.error(`✗ Error enriching WO ${wo.wo_number}:`, error);
      }
    }

    return NextResponse.json({
      success: workOrdersProcessed > 0,
      stats: {
        workOrdersProcessed,
        netsuiteCallsMade,
        lineItemsCached,
        errors,
      },
      message: `Successfully enriched ${workOrdersProcessed} of ${workOrders.length} work orders with ${lineItemsCached} total line items`,
    });
  } catch (error) {
    console.error('Error in enrichment process:', error);
    return NextResponse.json(
      {
        error: 'Enrichment failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
