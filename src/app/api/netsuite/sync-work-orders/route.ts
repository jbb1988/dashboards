/**
 * API Route: /api/netsuite/sync-work-orders
 * Sync work orders from NetSuite to standalone netsuite_work_orders table
 *
 * Query Parameters:
 * - startDate: YYYY-MM-DD (default: 1 year ago)
 * - endDate: YYYY-MM-DD (default: today)
 * - status: Filter by status (can specify multiple)
 * - limit: Max records to fetch (default: 5000)
 */

import { NextResponse } from 'next/server';
import { getAllWorkOrders, getWorkOrderLines } from '@/lib/netsuite';
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
    const limit = parseInt(url.searchParams.get('limit') || '5000');

    console.log('Starting NetSuite Work Orders sync...');
    console.log('Parameters:', { startDate, endDate, statuses, limit });

    // Fetch work orders from NetSuite
    const workOrders = await getAllWorkOrders({
      startDate,
      endDate,
      status: statuses.length > 0 ? statuses : undefined,
      limit,
    });

    if (workOrders.length === 0) {
      return NextResponse.json({
        success: true,
        stats: {
          workOrdersFetched: 0,
          workOrdersCreated: 0,
          workOrdersUpdated: 0,
          lineItemsCreated: 0,
          lineItemsUpdated: 0,
          errors: [],
        },
        message: 'No work orders found matching criteria',
        syncedAt: new Date().toISOString(),
      });
    }

    // Get Supabase admin client
    const supabase = getSupabaseAdmin();

    let workOrdersCreated = 0;
    let workOrdersUpdated = 0;
    let lineItemsCreated = 0;
    let lineItemsUpdated = 0;
    const errors: string[] = [];

    // Upsert work orders to database
    for (const wo of workOrders) {
      try {
        // Check if work order exists
        const { data: existing } = await supabase
          .from('netsuite_work_orders')
          .select('id')
          .eq('netsuite_id', wo.netsuite_id)
          .single();

        // Prepare record with all WO detail fields
        const record = {
          netsuite_id: wo.netsuite_id,
          wo_number: wo.wo_number,
          wo_date: wo.wo_date,
          status: wo.status,
          created_from_so_id: wo.created_from_so_id,
          created_from_so_number: wo.created_from_so_number,
          customer_id: wo.customer_id,
          start_date: wo.start_date,
          end_date: wo.end_date,
          bill_of_materials_id: wo.bill_of_materials_id,
          manufacturing_routing_id: wo.manufacturing_routing_id,
          item_id: wo.item_id,
          assembly_description: wo.assembly_description,
          serial_number: wo.serial_number,
          synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { data: upsertedWO, error: upsertError } = await supabase
          .from('netsuite_work_orders')
          .upsert(record, {
            onConflict: 'netsuite_id',
            ignoreDuplicates: false,
          })
          .select('id')
          .single();

        if (upsertError) {
          console.error(`Error upserting WO ${wo.wo_number}:`, upsertError);
          errors.push(`WO ${wo.wo_number}: ${upsertError.message}`);
          continue;
        }

        if (existing) {
          workOrdersUpdated++;
          console.log(`✓ Updated WO ${wo.wo_number}`);
        } else {
          workOrdersCreated++;
          console.log(`✓ Created WO ${wo.wo_number}`);
        }

        // Fetch and insert line items
        try {
          const lines = await getWorkOrderLines(wo.netsuite_id);

          if (lines.length > 0) {
            for (const line of lines) {
              try {
                // Check if line exists
                const { data: existingLine } = await supabase
                  .from('netsuite_work_order_lines')
                  .select('id')
                  .eq('work_order_id', upsertedWO.id)
                  .eq('netsuite_line_id', line.netsuite_line_id)
                  .single();

                const lineRecord = {
                  work_order_id: upsertedWO.id,
                  netsuite_line_id: line.netsuite_line_id,
                  line_number: line.line_number,
                  item_id: line.item_id,
                  item_name: line.item_name,
                  item_description: line.item_description,
                  item_type: line.item_type,
                  quantity: line.quantity,
                  quantity_completed: line.quantity_completed,
                  unit_cost: line.unit_cost,
                  line_cost: line.line_cost,
                  cost_estimate: line.cost_estimate,
                  actual_cost: line.actual_cost,
                  est_gross_profit: line.est_gross_profit,
                  est_gross_profit_pct: line.est_gross_profit_pct,
                  class_id: line.class_id,
                  class_name: line.class_name,
                  location_id: line.location_id,
                  location_name: line.location_name,
                  expected_completion_date: line.expected_completion_date,
                  is_closed: line.is_closed,
                  updated_at: new Date().toISOString(),
                };

                const { error: lineError } = await supabase
                  .from('netsuite_work_order_lines')
                  .upsert(lineRecord, {
                    onConflict: 'work_order_id,netsuite_line_id',
                    ignoreDuplicates: false,
                  });

                if (lineError) {
                  console.error(`Error upserting line for WO ${wo.wo_number}:`, lineError);
                  errors.push(`WO ${wo.wo_number} line ${line.netsuite_line_id}: ${lineError.message}`);
                } else {
                  if (existingLine) {
                    lineItemsUpdated++;
                  } else {
                    lineItemsCreated++;
                  }
                }
              } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                errors.push(`WO ${wo.wo_number} line ${line.netsuite_line_id}: ${errorMsg}`);
                console.error(`Error processing line for WO ${wo.wo_number}:`, error);
              }
            }

            console.log(`  → Synced ${lines.length} line items for WO ${wo.wo_number}`);
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`WO ${wo.wo_number} line items: ${errorMsg}`);
          console.error(`Error fetching line items for WO ${wo.wo_number}:`, error);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`WO ${wo.wo_number}: ${errorMsg}`);
        console.error(`Error processing WO ${wo.wo_number}:`, error);
      }
    }

    const stats = {
      workOrdersFetched: workOrders.length,
      workOrdersCreated,
      workOrdersUpdated,
      lineItemsCreated,
      lineItemsUpdated,
      errors,
    };

    console.log('Work Orders sync complete:', stats);

    return NextResponse.json({
      success: true,
      stats,
      message: `Successfully synced ${workOrdersCreated + workOrdersUpdated} of ${workOrders.length} work orders (${workOrdersCreated} new, ${workOrdersUpdated} updated) with ${lineItemsCreated + lineItemsUpdated} line items`,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in Work Orders sync:', error);
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
