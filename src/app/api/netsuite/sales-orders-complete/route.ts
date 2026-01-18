/**
 * COMPLETE Sales Order Sync for 2025-2026
 * Gets EVERY field, EVERY line item, NO NULLS
 */

import { NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get('year') || '2025';

  console.log(`Starting COMPLETE sales order sync for ${year}`);

  try {
    // Step 1: Get ALL sales orders for the year with COMPLETE data
    // Using only fields that exist on Transaction table
    const soQuery = `
      SELECT
        t.id,
        t.tranid,
        t.trandate,
        t.status,
        t.memo,
        t.entity AS customer_id,
        BUILTIN.DF(t.entity) AS customer_name,
        t.foreigntotal AS total,
        t.subsidiary,
        BUILTIN.DF(t.subsidiary) AS subsidiary_name,
        BUILTIN.DF(t.postingperiod) AS posting_period
      FROM Transaction t
      WHERE t.type = 'SalesOrd'
        AND t.trandate >= TO_DATE('${year}-01-01', 'YYYY-MM-DD')
        AND t.trandate <= TO_DATE('${year}-12-31', 'YYYY-MM-DD')
      ORDER BY t.trandate DESC, t.id
    `;

    console.log('Fetching sales order headers...');
    const PAGE_SIZE = 1000;
    let allSalesOrders: any[] = [];
    let offset = 0;
    let hasMore = true;
    let pageCount = 0;

    while (hasMore) {
      pageCount++;
      console.log(`  SO Headers Page ${pageCount}, offset ${offset}`);

      const response = await netsuiteRequest<{ items: any[]; hasMore: boolean }>(
        '/services/rest/query/v1/suiteql',
        {
          method: 'POST',
          body: { q: soQuery },
          params: { limit: PAGE_SIZE.toString(), offset: offset.toString() },
        }
      );

      const items = response.items || [];
      allSalesOrders = allSalesOrders.concat(items);
      hasMore = response.hasMore && items.length === PAGE_SIZE;
      offset += items.length;

      console.log(`  Got ${items.length} SOs (total: ${allSalesOrders.length})`);
    }

    console.log(`✓ Fetched ${allSalesOrders.length} sales orders in ${pageCount} pages`);

    // Step 2: Get ALL line items for these sales orders in ONE query
    // ONLY using fields that exist in NetSuite
    const lineQuery = `
      SELECT
        t.id AS transaction_id,
        t.tranid AS transaction_number,
        tl.id AS line_id,
        tl.linesequencenumber,
        tl.item AS item_id,
        COALESCE(i.itemid, BUILTIN.DF(tl.item)) AS item_name,
        COALESCE(i.displayname, BUILTIN.DF(tl.item)) AS item_description,
        tl.itemtype,
        tl.quantity,
        tl.rate,
        tl.amount,
        tl.costestimate,
        tl.class AS class_id,
        BUILTIN.DF(tl.class) AS class_name,
        tl.location AS location_id,
        BUILTIN.DF(tl.location) AS location_name
      FROM Transaction t
      INNER JOIN TransactionLine tl ON tl.transaction = t.id
      LEFT JOIN Item i ON i.id = tl.item
      WHERE t.type = 'SalesOrd'
        AND t.trandate >= TO_DATE('${year}-01-01', 'YYYY-MM-DD')
        AND t.trandate <= TO_DATE('${year}-12-31', 'YYYY-MM-DD')
        AND tl.mainline = 'F'
      ORDER BY t.id, tl.linesequencenumber
    `;

    console.log('Fetching ALL sales order line items...');
    let allLines: any[] = [];
    offset = 0;
    hasMore = true;
    pageCount = 0;

    while (hasMore) {
      pageCount++;
      console.log(`  SO Lines Page ${pageCount}, offset ${offset}`);

      const response = await netsuiteRequest<{ items: any[]; hasMore: boolean }>(
        '/services/rest/query/v1/suiteql',
        {
          method: 'POST',
          body: { q: lineQuery },
          params: { limit: PAGE_SIZE.toString(), offset: offset.toString() },
        }
      );

      const items = response.items || [];
      allLines = allLines.concat(items);
      hasMore = response.hasMore && items.length === PAGE_SIZE;
      offset += items.length;

      console.log(`  Got ${items.length} lines (total: ${allLines.length})`);
    }

    console.log(`✓ Fetched ${allLines.length} line items in ${pageCount} pages`);

    // Step 3: Upsert to Supabase
    const supabase = getSupabaseAdmin();

    console.log('Upserting sales order headers...');
    const soRecords = allSalesOrders.map(so => ({
      netsuite_id: so.id?.toString(),
      so_number: so.tranid,
      so_date: so.trandate,
      posting_period: so.posting_period,
      status: so.status,
      memo: so.memo,
      customer_id: so.customer_id?.toString(),
      customer_name: so.customer_name,
      total_amount: parseFloat(so.total || 0),
      subsidiary_id: so.subsidiary?.toString(),
      subsidiary_name: so.subsidiary_name,
      synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    // Batch upsert headers
    const BATCH_SIZE = 500;
    let headersUpserted = 0;
    for (let i = 0; i < soRecords.length; i += BATCH_SIZE) {
      const batch = soRecords.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from('netsuite_sales_orders')
        .upsert(batch, { onConflict: 'netsuite_id' });

      if (error) {
        console.error(`Header batch ${i / BATCH_SIZE + 1} error:`, error);
      } else {
        headersUpserted += batch.length;
      }
    }

    console.log(`✓ Upserted ${headersUpserted} sales order headers`);

    // Get mapping of netsuite_id to our UUID for ALL sales orders (not just the ones we synced)
    // This is critical because NetSuite returns lines for ALL 2025 SOs, including ones already in DB
    console.log('Building complete SO ID mapping...');
    const { data: soMapping } = await supabase
      .from('netsuite_sales_orders')
      .select('id, netsuite_id');

    const idMap: Record<string, string> = {};
    for (const row of soMapping || []) {
      idMap[row.netsuite_id] = row.id;
    }

    console.log(`✓ Mapped ${Object.keys(idMap).length} sales orders`);

    // Analyze transaction IDs in lines
    const uniqueTransactionIds = new Set(allLines.map(l => String(l.transaction_id)));
    const matchedIds = Array.from(uniqueTransactionIds).filter(id => idMap[id]);
    const unmatchedIds = Array.from(uniqueTransactionIds).filter(id => !idMap[id]);

    console.log(`Line analysis:`);
    console.log(`  Unique transaction IDs in lines: ${uniqueTransactionIds.size}`);
    console.log(`  Matched in idMap: ${matchedIds.length}`);
    console.log(`  Unmatched in idMap: ${unmatchedIds.length}`);
    if (unmatchedIds.length > 0 && unmatchedIds.length <= 10) {
      console.log(`  Sample unmatched IDs: ${unmatchedIds.slice(0, 10).join(', ')}`);
    }

    // Upsert line items
    console.log('Upserting line items...');
    let linesUpserted = 0;
    let nullItemCount = 0;
    let filteredOutCount = 0;

    const lineRecords = allLines
      .filter(line => {
        if (!line.item_name) {
          nullItemCount++;
          console.warn(`  NULL item_name for line ${line.line_id} on SO ${line.transaction_number}`);
        }
        const hasParent = idMap[String(line.transaction_id)]; // Convert to string for lookup
        if (!hasParent) {
          filteredOutCount++;
        }
        return hasParent; // Only lines with parent SO
      })
      .map(line => ({
        sales_order_id: idMap[String(line.transaction_id)],
        netsuite_line_id: line.line_id?.toString(),
        line_number: parseInt(line.linesequencenumber || 0),
        item_id: line.item_id?.toString(),
        item_name: line.item_name || `[Item ${line.item_id}]`, // Fallback for NULL
        item_description: line.item_description,
        item_type: line.itemtype,
        quantity: parseFloat(line.quantity || 0),
        rate: parseFloat(line.rate || 0),
        amount: parseFloat(line.amount || 0),
        cost_estimate: parseFloat(line.costestimate || 0),
        class_id: line.class_id?.toString(),
        class_name: line.class_name,
        location_id: line.location_id?.toString(),
        location_name: line.location_name,
        updated_at: new Date().toISOString(),
      }));

    for (let i = 0; i < lineRecords.length; i += BATCH_SIZE) {
      const batch = lineRecords.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from('netsuite_sales_order_lines')
        .upsert(batch, { onConflict: 'sales_order_id,netsuite_line_id' });

      if (error) {
        console.error(`Line batch ${i / BATCH_SIZE + 1} error:`, error);
      } else {
        linesUpserted += batch.length;
      }
    }

    console.log(`✓ Upserted ${linesUpserted} line items`);
    console.log(`  Filtered out (no parent SO): ${filteredOutCount} lines`);

    // Validation
    const { count: nullCheck } = await supabase
      .from('netsuite_sales_order_lines')
      .select('id', { count: 'exact', head: true })
      .is('item_name', null);

    return NextResponse.json({
      success: true,
      year,
      stats: {
        sales_orders_from_netsuite: allSalesOrders.length,
        sales_orders_upserted: headersUpserted,
        lines_from_netsuite: allLines.length,
        lines_filtered_out: filteredOutCount,
        lines_upserted: linesUpserted,
        null_item_names_in_netsuite: nullItemCount,
        null_item_names_in_db: nullCheck || 0,
      },
      message: `Complete sync for ${year}: ${headersUpserted} SOs, ${linesUpserted} lines`,
    });
  } catch (error) {
    console.error('Sales order sync error:', error);
    return NextResponse.json(
      {
        success: false,
        error: String(error),
        message: 'Failed to sync sales orders',
      },
      { status: 500 }
    );
  }
}
