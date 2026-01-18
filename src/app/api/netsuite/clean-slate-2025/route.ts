/**
 * NUCLEAR OPTION: Delete all 2025 SO data and resync from scratch
 * This ensures ZERO corrupted data from previous partial syncs
 */

import { NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST() {
  const year = '2025';
  console.log(`🔥 CLEAN SLATE: Deleting all ${year} data and resyncing...`);

  try {
    const supabase = getSupabaseAdmin();

    // Step 1: DELETE all 2025 sales orders (lines cascade automatically)
    console.log(`Step 1: Deleting all ${year} sales orders...`);
    const { data: toDelete, error: selectError } = await supabase
      .from('netsuite_sales_orders')
      .select('id, so_number')
      .gte('so_date', `${year}-01-01`)
      .lte('so_date', `${year}-12-31`);

    if (selectError) {
      console.error('Select error:', selectError);
      throw new Error(`Select failed: ${JSON.stringify(selectError)}`);
    }

    console.log(`Found ${toDelete?.length || 0} sales orders to delete`);

    if (toDelete && toDelete.length > 0) {
      console.log(`Deleting ${toDelete.length} sales orders...`);
      const { error: deleteError, count } = await supabase
        .from('netsuite_sales_orders')
        .delete({ count: 'exact' })
        .gte('so_date', `${year}-01-01`)
        .lte('so_date', `${year}-12-31`);

      if (deleteError) {
        console.error('Delete error:', deleteError);
        throw new Error(`Delete failed: ${JSON.stringify(deleteError)}`);
      }

      console.log(`✓ Deleted ${count || toDelete.length} sales orders and their lines`);
    } else {
      console.log('No existing 2025 data to delete');
    }

    // Step 2: Fresh sync of ALL 2025 sales orders
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

    console.log(`Step 2: Fetching ALL ${year} sales orders from NetSuite...`);
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

    // Step 3: Insert ALL sales orders
    console.log('Step 3: Inserting sales order headers...');
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

    const BATCH_SIZE = 500;
    let headersInserted = 0;
    for (let i = 0; i < soRecords.length; i += BATCH_SIZE) {
      const batch = soRecords.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from('netsuite_sales_orders')
        .insert(batch);

      if (error) {
        console.error(`Header batch ${i / BATCH_SIZE + 1} error:`, error);
        throw error;
      }

      headersInserted += batch.length;
      console.log(`  Inserted ${headersInserted}/${soRecords.length} headers`);
    }

    console.log(`✓ Inserted ${headersInserted} sales order headers`);

    // Step 4: Get the ID mapping for the SOs we just inserted
    console.log('Step 4: Building ID mapping...');
    const { data: soMapping } = await supabase
      .from('netsuite_sales_orders')
      .select('id, netsuite_id')
      .gte('so_date', `${year}-01-01`)
      .lte('so_date', `${year}-12-31`);

    const idMap: Record<string, string> = {};
    for (const row of soMapping || []) {
      idMap[row.netsuite_id] = row.id;
    }

    console.log(`✓ Mapped ${Object.keys(idMap).length} sales orders`);

    // Step 5: Fetch ALL line items for 2025 SOs
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

    console.log('Step 5: Fetching ALL sales order line items...');
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

    // Step 6: Insert line items (with strict validation)
    console.log('Step 6: Inserting line items...');
    let linesInserted = 0;
    let linesSkipped = 0;
    let nullItemsFromNetsuite = 0;

    const lineRecords = allLines
      .filter(line => {
        const hasParent = idMap[String(line.transaction_id)];
        if (!hasParent) {
          linesSkipped++;
          console.warn(`  ⚠️  Skipping line ${line.line_id}: parent SO ${line.transaction_id} not found`);
          return false;
        }
        if (!line.item_name) {
          nullItemsFromNetsuite++;
          console.warn(`  ⚠️  NULL item_name for line ${line.line_id} on SO ${line.transaction_number}`);
        }
        return true;
      })
      .map(line => ({
        sales_order_id: idMap[String(line.transaction_id)],
        netsuite_line_id: line.line_id?.toString(),
        line_number: parseInt(line.linesequencenumber || 0),
        item_id: line.item_id?.toString(),
        item_name: line.item_name || `[Unknown Item ${line.item_id}]`,
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
        .insert(batch);

      if (error) {
        console.error(`Line batch ${i / BATCH_SIZE + 1} error:`, error);
        throw error;
      }

      linesInserted += batch.length;
      console.log(`  Inserted ${linesInserted}/${lineRecords.length} lines`);
    }

    console.log(`✓ Inserted ${linesInserted} line items`);

    // Step 7: Final validation
    const { count: finalNullCheck } = await supabase
      .from('netsuite_sales_order_lines')
      .select('id', { count: 'exact', head: true })
      .is('item_name', null);

    const { count: finalLineCount } = await supabase
      .from('netsuite_sales_order_lines')
      .select('id', { count: 'exact', head: true });

    return NextResponse.json({
      success: true,
      year,
      clean_slate: true,
      stats: {
        deleted_count: toDelete?.length || 0,
        sales_orders_from_netsuite: allSalesOrders.length,
        sales_orders_inserted: headersInserted,
        lines_from_netsuite: allLines.length,
        lines_skipped: linesSkipped,
        lines_inserted: linesInserted,
        null_items_from_netsuite: nullItemsFromNetsuite,
        final_line_count_in_db: finalLineCount || 0,
        final_null_count_in_db: finalNullCheck || 0,
      },
      message: `Clean slate sync complete: ${headersInserted} SOs, ${linesInserted} lines, ${finalNullCheck || 0} NULLs`,
    });
  } catch (error) {
    console.error('Clean slate sync error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorDetails = error instanceof Error ? error.stack : undefined;

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        details: errorDetails,
        message: 'Clean slate sync failed',
      },
      { status: 500 }
    );
  }
}
