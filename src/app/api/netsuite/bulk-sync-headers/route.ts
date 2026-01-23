/**
 * BULK sync ALL SO/WO headers in ONE query - FAST
 * Instead of querying one record at a time, this uses paginated SuiteQL
 */

import { NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET() {
  return NextResponse.json({
    message: 'Use POST with ?type=SalesOrd|WorkOrd|both&startDate=YYYY-MM-DD'
  });
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get('type') || 'both'; // 'SalesOrd', 'WorkOrd', or 'both'
  const startDate = url.searchParams.get('startDate') || '2024-01-01';

  const supabase = getSupabaseAdmin();
  const PAGE_SIZE = 1000;

  const stats = {
    salesOrders: { fetched: 0, inserted: 0, updated: 0, errors: 0 },
    workOrders: { fetched: 0, inserted: 0, updated: 0, errors: 0 },
  };

  try {
    // Convert date format
    const [y, m, d] = startDate.split('-');
    const nsDate = `${m}/${d}/${y}`;

    // SALES ORDERS
    if (type === 'SalesOrd' || type === 'both') {
      console.log(`\n=== SYNCING SALES ORDER HEADERS since ${startDate} ===`);

      // Simplified query - just essentials to avoid timeout
      const soQuery = `
        SELECT
          id,
          tranid,
          trandate,
          status,
          entity AS customer_id,
          taxtotal,
          total
        FROM transaction
        WHERE type = 'SalesOrd'
          AND trandate >= TO_DATE('${nsDate}', 'MM/DD/YYYY')
        ORDER BY trandate DESC
      `;

      // Paginate through all SO headers
      let allSOs: any[] = [];
      let offset = 0;
      let hasMore = true;
      let pageCount = 0;

      while (hasMore) {
        pageCount++;
        console.log(`  SO Headers Page ${pageCount}: offset ${offset}...`);

        const response = await netsuiteRequest<{ items: any[]; hasMore: boolean }>(
          '/services/rest/query/v1/suiteql',
          {
            method: 'POST',
            body: { q: soQuery },
            params: { limit: PAGE_SIZE.toString(), offset: offset.toString() },
          }
        );

        const items = response.items || [];
        allSOs = allSOs.concat(items);
        hasMore = response.hasMore && items.length === PAGE_SIZE;
        offset += items.length;

        console.log(`    Got ${items.length} SOs (total: ${allSOs.length})`);
      }

      stats.salesOrders.fetched = allSOs.length;
      console.log(`Fetched ${allSOs.length} SO headers in ${pageCount} API calls`);

      // Get existing SOs to determine insert vs update
      const { data: existingSOs } = await supabase
        .from('netsuite_sales_orders')
        .select('netsuite_id');

      const existingSOIds = new Set((existingSOs || []).map(so => so.netsuite_id));

      // Build all SO records (simplified - only essential fields)
      const soRecords = allSOs.map(row => ({
        netsuite_id: row.id || '',
        so_number: row.tranid || '',
        so_date: row.trandate || null,
        posting_period: null,
        status: row.status || null,
        memo: null,
        customer_id: row.customer_id || null,
        customer_name: null,
        subtotal: null,
        discount_total: null,
        tax_total: parseFloat(row.taxtotal) || null,
        total_amount: parseFloat(row.total) || null,
        terms: null,
        ship_method: null,
        ship_date: null,
        expected_ship_date: null,
        subsidiary_id: null,
        subsidiary_name: null,
        location_id: null,
        location_name: null,
        class_id: null,
        class_name: null,
        department_id: null,
        department_name: null,
        sales_rep_id: null,
        sales_rep_name: null,
        synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      // Count inserts vs updates
      for (const record of soRecords) {
        if (existingSOIds.has(record.netsuite_id)) {
          stats.salesOrders.updated++;
        } else {
          stats.salesOrders.inserted++;
        }
      }

      // BATCH upsert 500 at a time
      const BATCH_SIZE = 500;
      let upserted = 0;
      for (let i = 0; i < soRecords.length; i += BATCH_SIZE) {
        const batch = soRecords.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
          .from('netsuite_sales_orders')
          .upsert(batch, { onConflict: 'netsuite_id' });

        if (error) {
          console.error(`SO Batch ${i / BATCH_SIZE} error:`, error.message);
          stats.salesOrders.errors++;
        } else {
          upserted += batch.length;
        }
        console.log(`  Upserted SO batch ${Math.floor(i / BATCH_SIZE) + 1} (${upserted}/${soRecords.length})`);
      }

      console.log(`✓ Synced ${upserted} Sales Order headers`);
    }

    // WORK ORDERS
    if (type === 'WorkOrd' || type === 'both') {
      console.log(`\n=== SYNCING WORK ORDER HEADERS since ${startDate} ===`);

      // Simplified query - NO JOINS to avoid timeout
      const woQuery = `
        SELECT
          id,
          tranid,
          trandate,
          status
        FROM transaction
        WHERE type = 'WorkOrd'
          AND trandate >= TO_DATE('${nsDate}', 'MM/DD/YYYY')
        ORDER BY trandate DESC
      `;

      // Paginate through all WO headers
      let allWOs: any[] = [];
      let offset = 0;
      let hasMore = true;
      let pageCount = 0;

      while (hasMore) {
        pageCount++;
        console.log(`  WO Headers Page ${pageCount}: offset ${offset}...`);

        const response = await netsuiteRequest<{ items: any[]; hasMore: boolean }>(
          '/services/rest/query/v1/suiteql',
          {
            method: 'POST',
            body: { q: woQuery },
            params: { limit: PAGE_SIZE.toString(), offset: offset.toString() },
          }
        );

        const items = response.items || [];
        allWOs = allWOs.concat(items);
        hasMore = response.hasMore && items.length === PAGE_SIZE;
        offset += items.length;

        console.log(`    Got ${items.length} WOs (total: ${allWOs.length})`);
      }

      stats.workOrders.fetched = allWOs.length;
      console.log(`Fetched ${allWOs.length} WO headers in ${pageCount} API calls`);

      // Get existing WOs to determine insert vs update
      const { data: existingWOs } = await supabase
        .from('netsuite_work_orders')
        .select('netsuite_id');

      const existingWOIds = new Set((existingWOs || []).map(wo => wo.netsuite_id));

      // Build all WO records (simplified - only essential fields)
      const woRecords = allWOs.map(row => ({
        netsuite_id: row.id || '',
        wo_number: row.tranid || '',
        wo_date: row.trandate || null,
        status: row.status || null,
        start_date: null,
        end_date: null,
        customer_id: null,
        bill_of_materials: null,
        bom_revision: null,
        manufacturing_routing: null,
        created_from_so_id: null,
        created_from_so_number: null,
        item_id: null,
        assembly_description: null,
        serial_number: null,
        synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      // Count inserts vs updates
      for (const record of woRecords) {
        if (existingWOIds.has(record.netsuite_id)) {
          stats.workOrders.updated++;
        } else {
          stats.workOrders.inserted++;
        }
      }

      // BATCH upsert 500 at a time
      const BATCH_SIZE = 500;
      let upserted = 0;
      for (let i = 0; i < woRecords.length; i += BATCH_SIZE) {
        const batch = woRecords.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
          .from('netsuite_work_orders')
          .upsert(batch, { onConflict: 'netsuite_id' });

        if (error) {
          console.error(`WO Batch ${i / BATCH_SIZE} error:`, error.message);
          stats.workOrders.errors++;
        } else {
          upserted += batch.length;
        }
        console.log(`  Upserted WO batch ${Math.floor(i / BATCH_SIZE) + 1} (${upserted}/${woRecords.length})`);
      }

      console.log(`✓ Synced ${upserted} Work Order headers`);
    }

    return NextResponse.json({
      success: true,
      type,
      stats,
      message: `Synced ${stats.salesOrders.fetched + stats.workOrders.fetched} headers total (${stats.salesOrders.fetched} SOs, ${stats.workOrders.fetched} WOs)`,
    });
  } catch (error) {
    console.error('Bulk sync headers error:', error);
    return NextResponse.json(
      {
        success: false,
        error: String(error),
        stats,
      },
      { status: 500 }
    );
  }
}
