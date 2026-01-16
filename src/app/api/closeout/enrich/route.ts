/**
 * API Route: /api/closeout/enrich
 * Enrich closeout work orders with NetSuite SO/WO line item details
 * Stores results in Supabase database for persistence across serverless invocations
 *
 * Query Parameters:
 * - year: Filter by project year (e.g., 2025)
 * - type: Filter by project type (e.g., TB, MCC)
 * - projectId: Enrich only work orders for specific project
 * - forceRefresh: Re-fetch from NetSuite even if already enriched
 */

import { NextResponse } from 'next/server';
import { getWorkOrderByNumber, getSalesOrderWithLineItems } from '@/lib/netsuite';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // Parse query parameters for filtering
    const url = new URL(request.url);
    const years = url.searchParams.getAll('year').map(y => parseInt(y)).filter(y => !isNaN(y));
    const type = url.searchParams.get('type') || undefined;
    const projectId = url.searchParams.get('projectId') || undefined;
    const forceRefresh = url.searchParams.get('forceRefresh') === 'true';

    console.log('Starting NetSuite enrichment with filters:', { years, type, projectId, forceRefresh });

    // Get Supabase client
    const supabase = getSupabaseAdmin();

    // Build query to get work orders to enrich
    let query = supabase
      .from('closeout_work_orders')
      .select(`
        wo_number,
        netsuite_enriched,
        closeout_projects!inner (
          id,
          project_name,
          project_year,
          project_type
        )
      `)
      .not('wo_number', 'is', null)
      .neq('wo_number', '');

    // Apply filters based on query params
    if (years.length > 0) {
      query = query.in('closeout_projects.project_year', years);
    }

    if (type) {
      query = query.eq('closeout_projects.project_type', type);
    }

    if (projectId) {
      query = query.eq('closeout_projects.id', projectId);
    }

    // If not forcing refresh, only get unenriched work orders
    if (!forceRefresh) {
      query = query.or('netsuite_enriched.is.null,netsuite_enriched.eq.false');
    }

    const { data: workOrders, error: queryError } = await query;

    if (queryError) {
      throw new Error(`Failed to query work orders: ${queryError.message}`);
    }

    if (!workOrders || workOrders.length === 0) {
      return NextResponse.json({
        success: true,
        stats: {
          workOrdersProcessed: 0,
          netsuiteCallsMade: 0,
          lineItemsCached: 0,
          errors: [],
        },
        message: 'No work orders found matching filters',
      });
    }

    console.log(`Found ${workOrders.length} work orders to enrich`);
    console.log('First 10 WO numbers from database:', workOrders.slice(0, 10).map(wo => wo.wo_number).join(', '));

    // Enrich each work order from NetSuite and store in database
    const errors: string[] = [];
    let workOrdersProcessed = 0;
    let netsuiteCallsMade = 0;
    let lineItemsCached = 0;

    for (const wo of workOrders) {
      const woNumber = wo.wo_number;

      try {
        // Skip if already enriched (unless forcing refresh)
        if (wo.netsuite_enriched && !forceRefresh) {
          console.log(`✓ WO ${woNumber} already enriched in database`);
          workOrdersProcessed++;
          continue;
        }

        // Query NetSuite for Work Order
        console.log(`Querying NetSuite for WO ${woNumber}...`);
        const woData = await getWorkOrderByNumber(woNumber);
        netsuiteCallsMade++;

        if (!woData) {
          errors.push(`WO ${woNumber}: Not found in NetSuite`);
          console.warn(`✗ WO ${woNumber} not found in NetSuite`);
          continue;
        }

        // Get linked Sales Order if available
        let soData = null;
        if (woData.linkedSalesOrderId) {
          console.log(`Fetching SO ${woData.linkedSalesOrderNumber} for WO ${woNumber}...`);
          soData = await getSalesOrderWithLineItems(woData.linkedSalesOrderId);
          netsuiteCallsMade++;
        }

        // Update work order with enrichment status
        const { error: updateError } = await supabase
          .from('closeout_work_orders')
          .update({
            netsuite_enriched: true,
            netsuite_wo_id: woData.id,
            netsuite_so_id: woData.linkedSalesOrderId || null,
            netsuite_so_number: woData.linkedSalesOrderNumber || null,
            netsuite_enriched_at: new Date().toISOString(),
          })
          .eq('wo_number', woNumber);

        if (updateError) {
          console.error(`Error updating WO ${woNumber}:`, updateError);
          errors.push(`WO ${woNumber}: Database update failed - ${updateError.message}`);
          continue;
        }

        // Store line items in database
        if (soData && soData.lineItems && soData.lineItems.length > 0) {
          // Get the closeout_wo_id for this work order
          const { data: woRecord } = await supabase
            .from('closeout_work_orders')
            .select('id')
            .eq('wo_number', woNumber)
            .single();

          if (woRecord) {
            const lineItemRecords = soData.lineItems.map(item => ({
              closeout_wo_id: woRecord.id,
              wo_id: woData.id,
              wo_number: woData.tranId,
              wo_status: woData.status,
              wo_date: woData.tranDate || null,
              so_id: soData.id,
              so_number: soData.tranId,
              so_status: soData.status,
              so_date: soData.tranDate || null,
              customer_id: woData.customerId || soData.customerId,
              customer_name: woData.customerName || soData.customerName,
              line_id: item.lineId,
              item_id: item.itemId,
              item_name: item.itemName,
              item_description: item.itemDescription,
              item_type: item.itemType,
              quantity: item.quantity,
              unit_price: item.unitPrice,
              line_amount: item.lineAmount,
              cost_estimate: item.costEstimate,
              source_type: 'sales_order',
            }));

            const { error: insertError } = await supabase
              .from('netsuite_work_order_details')
              .upsert(lineItemRecords, {
                onConflict: 'wo_number,line_id',
                ignoreDuplicates: false,
              });

            if (insertError) {
              console.error(`Error inserting line items for WO ${woNumber}:`, insertError);
              errors.push(`WO ${woNumber}: Line items insert failed - ${insertError.message}`);
            } else {
              lineItemsCached += soData.lineItems.length;
            }
          }
        }

        workOrdersProcessed++;
        console.log(`✓ Enriched WO ${woNumber} → SO ${woData.linkedSalesOrderNumber} with ${soData?.lineItems?.length || 0} line items`);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`WO ${woNumber}: ${errorMsg}`);
        console.error(`✗ Error enriching WO ${woNumber}:`, error);
      }
    }

    // Build filter description for message
    const filterDesc = [];
    if (years.length > 0) filterDesc.push(`years=${years.join(',')}`);
    if (type) filterDesc.push(`type=${type}`);
    if (projectId) filterDesc.push(`projectId=${projectId}`);
    const filterText = filterDesc.length > 0 ? ` (filtered by ${filterDesc.join(', ')})` : '';

    return NextResponse.json({
      success: workOrdersProcessed > 0,
      stats: {
        workOrdersProcessed,
        netsuiteCallsMade,
        lineItemsCached,
        errors,
      },
      message: `Successfully enriched ${workOrdersProcessed} of ${workOrders.length} work orders with ${lineItemsCached} total line items${filterText}`,
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
