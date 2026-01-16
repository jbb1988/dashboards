/**
 * API Route: /api/netsuite/sync-sales-orders
 * Sync sales orders (headers + line items) from NetSuite to standalone tables
 *
 * Query Parameters:
 * - startDate: YYYY-MM-DD (default: 1 year ago)
 * - endDate: YYYY-MM-DD (default: today)
 * - status: Filter by status (can specify multiple)
 * - includeLineItems: boolean (default: true)
 * - limit: Max records to fetch (default: 5000)
 */

import { NextResponse } from 'next/server';
import { getAllSalesOrders } from '@/lib/netsuite';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for large syncs

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);

    // Parse query parameters
    const startDate = url.searchParams.get('startDate') || undefined;
    const endDate = url.searchParams.get('endDate') || undefined;
    const statuses = url.searchParams.getAll('status').filter(s => s);
    const includeLineItems = url.searchParams.get('includeLineItems') !== 'false';
    const limit = parseInt(url.searchParams.get('limit') || '5000');

    console.log('Starting NetSuite Sales Orders sync...');
    console.log('Parameters:', { startDate, endDate, statuses, includeLineItems, limit });

    // Fetch sales orders from NetSuite
    const { headers, linesBySOId } = await getAllSalesOrders({
      startDate,
      endDate,
      status: statuses.length > 0 ? statuses : undefined,
      includeLineItems,
      limit,
    });

    if (headers.length === 0) {
      return NextResponse.json({
        success: true,
        stats: {
          salesOrdersFetched: 0,
          salesOrdersCreated: 0,
          salesOrdersUpdated: 0,
          lineItemsCreated: 0,
          lineItemsUpdated: 0,
          errors: [],
        },
        message: 'No sales orders found matching criteria',
        syncedAt: new Date().toISOString(),
      });
    }

    // Get Supabase admin client
    const supabase = getSupabaseAdmin();

    let salesOrdersCreated = 0;
    let salesOrdersUpdated = 0;
    let lineItemsCreated = 0;
    let lineItemsUpdated = 0;
    const errors: string[] = [];

    // Upsert sales orders to database
    for (const so of headers) {
      try {
        // Check if sales order exists
        const { data: existing } = await supabase
          .from('netsuite_sales_orders')
          .select('id')
          .eq('netsuite_id', so.netsuite_id)
          .single();

        // Prepare SO header record
        const headerRecord = {
          netsuite_id: so.netsuite_id,
          so_number: so.so_number,
          so_date: so.so_date,
          posting_period: so.posting_period,
          status: so.status,
          memo: so.memo,
          customer_id: so.customer_id,
          customer_name: so.customer_name,
          subtotal: so.subtotal,
          discount_total: so.discount_total,
          tax_total: so.tax_total,
          total_amount: so.total_amount,
          terms: so.terms,
          ship_method: so.ship_method,
          ship_date: so.ship_date,
          expected_ship_date: so.expected_ship_date,
          subsidiary_id: so.subsidiary_id,
          subsidiary_name: so.subsidiary_name,
          location_id: so.location_id,
          location_name: so.location_name,
          class_id: so.class_id,
          class_name: so.class_name,
          department_id: so.department_id,
          department_name: so.department_name,
          sales_rep_id: so.sales_rep_id,
          sales_rep_name: so.sales_rep_name,
          synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { data: upsertedSO, error: upsertError } = await supabase
          .from('netsuite_sales_orders')
          .upsert(headerRecord, {
            onConflict: 'netsuite_id',
            ignoreDuplicates: false,
          })
          .select('id')
          .single();

        if (upsertError) {
          console.error(`Error upserting SO ${so.so_number}:`, upsertError);
          errors.push(`SO ${so.so_number}: ${upsertError.message}`);
          continue;
        }

        if (existing) {
          salesOrdersUpdated++;
          console.log(`✓ Updated SO ${so.so_number}`);
        } else {
          salesOrdersCreated++;
          console.log(`✓ Created SO ${so.so_number}`);
        }

        // Insert line items if available
        if (includeLineItems && linesBySOId[so.netsuite_id]) {
          const lines = linesBySOId[so.netsuite_id];

          for (const line of lines) {
            try {
              // Check if line exists
              const { data: existingLine } = await supabase
                .from('netsuite_sales_order_lines')
                .select('id')
                .eq('sales_order_id', upsertedSO.id)
                .eq('netsuite_line_id', line.netsuite_line_id)
                .single();

              const lineRecord = {
                sales_order_id: upsertedSO.id,
                netsuite_line_id: line.netsuite_line_id,
                line_number: line.line_number,
                item_id: line.item_id,
                item_name: line.item_name,
                item_description: line.item_description,
                item_type: line.item_type,
                quantity: line.quantity,
                quantity_committed: line.quantity_committed,
                quantity_fulfilled: line.quantity_fulfilled,
                quantity_billed: line.quantity_billed,
                rate: line.rate,
                amount: line.amount,
                cost_estimate: line.cost_estimate,
                cost_estimate_type: line.cost_estimate_type,
                class_id: line.class_id,
                class_name: line.class_name,
                department_id: line.department_id,
                department_name: line.department_name,
                location_id: line.location_id,
                location_name: line.location_name,
                expected_ship_date: line.expected_ship_date,
                is_closed: line.is_closed,
                closed_date: line.closed_date,
                updated_at: new Date().toISOString(),
              };

              const { error: lineError } = await supabase
                .from('netsuite_sales_order_lines')
                .upsert(lineRecord, {
                  onConflict: 'sales_order_id,netsuite_line_id',
                  ignoreDuplicates: false,
                });

              if (lineError) {
                console.error(`Error upserting line for SO ${so.so_number}:`, lineError);
                errors.push(`SO ${so.so_number} line ${line.netsuite_line_id}: ${lineError.message}`);
              } else {
                if (existingLine) {
                  lineItemsUpdated++;
                } else {
                  lineItemsCreated++;
                }
              }
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : 'Unknown error';
              errors.push(`SO ${so.so_number} line ${line.netsuite_line_id}: ${errorMsg}`);
              console.error(`Error processing line for SO ${so.so_number}:`, error);
            }
          }

          console.log(`  → Synced ${lines.length} line items for SO ${so.so_number}`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`SO ${so.so_number}: ${errorMsg}`);
        console.error(`Error processing SO ${so.so_number}:`, error);
      }
    }

    const stats = {
      salesOrdersFetched: headers.length,
      salesOrdersCreated,
      salesOrdersUpdated,
      lineItemsCreated,
      lineItemsUpdated,
      errors,
    };

    console.log('Sales Orders sync complete:', stats);

    return NextResponse.json({
      success: true,
      stats,
      message: `Successfully synced ${salesOrdersCreated + salesOrdersUpdated} of ${headers.length} sales orders (${salesOrdersCreated} new, ${salesOrdersUpdated} updated) with ${lineItemsCreated + lineItemsUpdated} line items`,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in Sales Orders sync:', error);
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
