/**
 * API Route: /api/netsuite/scheduled-sync
 * Scheduled sync endpoint to keep NetSuite data up to date
 * Syncs last 90 days of data to catch any updates
 */

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getAllWorkOrders, getWorkOrderLines, getAllSalesOrders } from '@/lib/netsuite';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max execution time

async function syncWorkOrders(startDate: string, endDate: string, limit: number) {
  const workOrders = await getAllWorkOrders({ startDate, endDate, limit });

  if (workOrders.length === 0) {
    return {
      workOrdersFetched: 0,
      workOrdersCreated: 0,
      workOrdersUpdated: 0,
      lineItemsCreated: 0,
      lineItemsUpdated: 0,
    };
  }

  const supabase = getSupabaseAdmin();
  let workOrdersCreated = 0;
  let workOrdersUpdated = 0;
  let lineItemsCreated = 0;
  let lineItemsUpdated = 0;

  for (const wo of workOrders) {
    const { data: existing } = await supabase
      .from('netsuite_work_orders')
      .select('id')
      .eq('wo_number', wo.wo_number)
      .single();

    if (existing) {
      await supabase
        .from('netsuite_work_orders')
        .update({
          wo_date: wo.wo_date,
          status: wo.status,
          start_date: wo.start_date,
          end_date: wo.end_date,
          customer_id: wo.customer_id,
          created_from_so_number: wo.created_from_so_number,
          synced_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
      workOrdersUpdated++;
    } else {
      const { data: inserted } = await supabase
        .from('netsuite_work_orders')
        .insert({
          netsuite_id: wo.netsuite_id,
          wo_number: wo.wo_number,
          wo_date: wo.wo_date,
          status: wo.status,
          start_date: wo.start_date,
          end_date: wo.end_date,
          customer_id: wo.customer_id,
          created_from_so_number: wo.created_from_so_number,
          synced_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      workOrdersCreated++;
    }

    // Sync line items
    const lineItems = await getWorkOrderLines(wo.netsuite_id);
    const { data: woRecord } = await supabase
      .from('netsuite_work_orders')
      .select('id')
      .eq('wo_number', wo.wo_number)
      .single();

    if (woRecord && lineItems.length > 0) {
      for (const line of lineItems) {
        const { data: existingLine } = await supabase
          .from('netsuite_work_order_lines')
          .select('id')
          .eq('work_order_id', woRecord.id)
          .eq('netsuite_line_id', line.netsuite_line_id)
          .single();

        if (existingLine) {
          await supabase
            .from('netsuite_work_order_lines')
            .update({
              quantity: line.quantity,
              quantity_completed: line.quantity_completed,
              is_closed: line.is_closed,
            })
            .eq('id', existingLine.id);
          lineItemsUpdated++;
        } else {
          await supabase.from('netsuite_work_order_lines').insert({
            work_order_id: woRecord.id,
            netsuite_line_id: line.netsuite_line_id,
            line_number: line.line_number,
            item_id: line.item_id,
            item_type: line.item_type,
            quantity: line.quantity,
            quantity_completed: line.quantity_completed,
            location_id: line.location_id,
            is_closed: line.is_closed,
          });
          lineItemsCreated++;
        }
      }
    }
  }

  return {
    workOrdersFetched: workOrders.length,
    workOrdersCreated,
    workOrdersUpdated,
    lineItemsCreated,
    lineItemsUpdated,
  };
}

async function syncSalesOrders(startDate: string, endDate: string, limit: number) {
  const { headers, linesBySOId } = await getAllSalesOrders({
    startDate,
    endDate,
    includeLineItems: true,
    limit,
  });

  if (headers.length === 0) {
    return {
      salesOrdersFetched: 0,
      salesOrdersCreated: 0,
      salesOrdersUpdated: 0,
      lineItemsCreated: 0,
      lineItemsUpdated: 0,
    };
  }

  const supabase = getSupabaseAdmin();
  let salesOrdersCreated = 0;
  let salesOrdersUpdated = 0;
  let lineItemsCreated = 0;
  let lineItemsUpdated = 0;

  for (const so of headers) {
    const { data: existing } = await supabase
      .from('netsuite_sales_orders')
      .select('id')
      .eq('so_number', so.so_number)
      .single();

    let soId: string;

    if (existing) {
      await supabase
        .from('netsuite_sales_orders')
        .update({
          so_date: so.so_date,
          status: so.status,
          total_amount: so.total_amount,
          synced_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
      soId = existing.id;
      salesOrdersUpdated++;
    } else {
      const { data: inserted } = await supabase
        .from('netsuite_sales_orders')
        .insert({
          netsuite_id: so.netsuite_id,
          so_number: so.so_number,
          so_date: so.so_date,
          status: so.status,
          customer_name: so.customer_name,
          total_amount: so.total_amount,
          synced_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      soId = inserted!.id;
      salesOrdersCreated++;
    }

    // Sync line items
    const lineItems = linesBySOId[so.netsuite_id] || [];
    for (const line of lineItems) {
      const { data: existingLine } = await supabase
        .from('netsuite_sales_order_lines')
        .select('id')
        .eq('sales_order_id', soId)
        .eq('netsuite_line_id', line.netsuite_line_id)
        .single();

      if (existingLine) {
        await supabase
          .from('netsuite_sales_order_lines')
          .update({
            quantity: line.quantity,
            rate: line.rate,
            amount: line.amount,
            cost_estimate: line.cost_estimate,
            is_closed: line.is_closed,
          })
          .eq('id', existingLine.id);
        lineItemsUpdated++;
      } else {
        await supabase.from('netsuite_sales_order_lines').insert({
          sales_order_id: soId,
          netsuite_line_id: line.netsuite_line_id,
          line_number: line.line_number,
          item_id: line.item_id,
          item_type: line.item_type,
          quantity: line.quantity,
          rate: line.rate,
          amount: line.amount,
          cost_estimate: line.cost_estimate,
          location_id: line.location_id,
          is_closed: line.is_closed,
        });
        lineItemsCreated++;
      }
    }
  }

  return {
    salesOrdersFetched: headers.length,
    salesOrdersCreated,
    salesOrdersUpdated,
    lineItemsCreated,
    lineItemsUpdated,
  };
}

export async function GET(request: Request) {
  try {
    // Optional: Add authorization check for cron jobs
    const headersList = await headers();
    const authHeader = headersList.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const startTime = Date.now();

    // Calculate date range: last 90 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    console.log(`Starting scheduled sync for ${startDateStr} to ${endDateStr}`);

    // Sync work orders
    const woStats = await syncWorkOrders(startDateStr, endDateStr, 1000);

    // Sync sales orders
    const soStats = await syncSalesOrders(startDateStr, endDateStr, 1000);

    const duration = Date.now() - startTime;

    console.log(`Scheduled sync completed in ${duration}ms`);

    return NextResponse.json({
      success: true,
      duration: `${duration}ms`,
      dateRange: {
        start: startDateStr,
        end: endDateStr,
        daysSync: 90,
      },
      workOrders: {
        success: true,
        stats: woStats,
      },
      salesOrders: {
        success: true,
        stats: soStats,
      },
      syncedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Scheduled sync error:', error);
    return NextResponse.json(
      {
        error: 'Scheduled sync failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggers
export async function POST(request: Request) {
  return GET(request);
}
