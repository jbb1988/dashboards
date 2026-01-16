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
import { getAllWorkOrders } from '@/lib/netsuite';
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

        // Prepare record
        const record = {
          netsuite_id: wo.netsuite_id,
          wo_number: wo.wo_number,
          wo_date: wo.wo_date,
          posting_period: wo.posting_period,
          status: wo.status,
          memo: wo.memo,
          created_from_so_id: wo.created_from_so_id,
          created_from_so_number: wo.created_from_so_number,
          customer_id: wo.customer_id,
          customer_name: wo.customer_name,
          subsidiary_id: wo.subsidiary_id,
          subsidiary_name: wo.subsidiary_name,
          location_id: wo.location_id,
          location_name: wo.location_name,
          class_id: wo.class_id,
          class_name: wo.class_name,
          department_id: wo.department_id,
          department_name: wo.department_name,
          synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { error: upsertError } = await supabase
          .from('netsuite_work_orders')
          .upsert(record, {
            onConflict: 'netsuite_id',
            ignoreDuplicates: false,
          });

        if (upsertError) {
          console.error(`Error upserting WO ${wo.wo_number}:`, upsertError);
          errors.push(`WO ${wo.wo_number}: ${upsertError.message}`);
        } else {
          if (existing) {
            workOrdersUpdated++;
            console.log(`✓ Updated WO ${wo.wo_number}`);
          } else {
            workOrdersCreated++;
            console.log(`✓ Created WO ${wo.wo_number}`);
          }
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
      errors,
    };

    console.log('Work Orders sync complete:', stats);

    return NextResponse.json({
      success: true,
      stats,
      message: `Successfully synced ${workOrdersCreated + workOrdersUpdated} of ${workOrders.length} work orders (${workOrdersCreated} new, ${workOrdersUpdated} updated)`,
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
