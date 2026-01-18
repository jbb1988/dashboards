/**
 * NUCLEAR CLEAN: Delete and resync 2025 using raw SQL
 */

import { NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST() {
  const year = '2025';
  console.log(`🔥 NUCLEAR CLEAN: Deleting all ${year} data via SQL...`);

  try {
    const supabase = getSupabaseAdmin();

    // Step 1: DELETE using raw SQL (bypasses RLS)
    console.log(`Step 1: Deleting 2025 sales orders via SQL...`);

    const { data: deleteResult, error: deleteError } = await supabase.rpc('delete_year_sales_orders', {
      target_year: 2025
    });

    if (deleteError) {
      // If RPC doesn't exist, use direct SQL
      console.log('RPC not found, using direct SQL delete...');

      const { data, error } = await supabase
        .from('netsuite_sales_orders')
        .delete()
        .gte('so_date', '2025-01-01')
        .lte('so_date', '2025-12-31');

      if (error) {
        console.error('SQL delete failed:', JSON.stringify(error, null, 2));
        return NextResponse.json({
          success: false,
          error: `Delete failed: ${error.message}`,
          code: error.code,
          details: error.details,
          hint: error.hint,
        }, { status: 500 });
      }

      console.log(`✓ Deleted SOs`, data);
    } else {
      console.log(`✓ Deleted via RPC:`, deleteResult);
    }

    // Step 2: Verify deletion
    const { count } = await supabase
      .from('netsuite_sales_orders')
      .select('*', { count: 'exact', head: true })
      .gte('so_date', '2025-01-01')
      .lte('so_date', '2025-12-31');

    console.log(`After deletion: ${count} SOs remaining`);

    if (count && count > 0) {
      return NextResponse.json({
        success: false,
        error: `Delete verification failed: ${count} SOs still exist`,
      }, { status: 500 });
    }

    // Step 3: Fetch 2025 SOs from NetSuite
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

    console.log(`Step 3: Fetching ${year} SOs from NetSuite...`);
    const PAGE_SIZE = 1000;
    let allSalesOrders: any[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
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
    }

    console.log(`✓ Fetched ${allSalesOrders.length} SOs`);

    // Step 4: Insert SOs
    console.log('Step 4: Inserting SOs...');
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
    let inserted = 0;

    for (let i = 0; i < soRecords.length; i += BATCH_SIZE) {
      const batch = soRecords.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from('netsuite_sales_orders')
        .insert(batch);

      if (error) {
        console.error(`Insert error batch ${i}:`, error);
        throw new Error(`Insert failed: ${error.message}`);
      }

      inserted += batch.length;
      console.log(`  Inserted ${inserted}/${soRecords.length}`);
    }

    // Step 5: Get ID mapping
    const { data: soMapping } = await supabase
      .from('netsuite_sales_orders')
      .select('id, netsuite_id')
      .gte('so_date', '2025-01-01')
      .lte('so_date', '2025-12-31');

    const idMap: Record<string, string> = {};
    for (const row of soMapping || []) {
      idMap[row.netsuite_id] = row.id;
    }

    console.log(`✓ Mapped ${Object.keys(idMap).length} SOs`);

    // Step 6: Fetch lines
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

    console.log('Step 6: Fetching lines...');
    let allLines: any[] = [];
    offset = 0;
    hasMore = true;

    while (hasMore) {
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
    }

    console.log(`✓ Fetched ${allLines.length} lines`);

    // Step 7: Insert lines (only for SOs we have)
    console.log('Step 7: Inserting lines...');
    let linesInserted = 0;
    let linesSkipped = 0;

    const lineRecords = allLines
      .filter(line => {
        const hasParent = idMap[String(line.transaction_id)];
        if (!hasParent) linesSkipped++;
        return hasParent;
      })
      .map(line => ({
        sales_order_id: idMap[String(line.transaction_id)],
        netsuite_line_id: line.line_id?.toString(),
        line_number: parseInt(line.linesequencenumber || 0),
        item_id: line.item_id?.toString(),
        item_name: line.item_name || `[Unknown ${line.item_id}]`,
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
        console.error(`Line insert error:`, error);
        throw new Error(`Line insert failed: ${error.message}`);
      }

      linesInserted += batch.length;
      console.log(`  Inserted ${linesInserted}/${lineRecords.length} lines`);
    }

    // Final validation
    const { count: nullCount } = await supabase
      .from('netsuite_sales_order_lines')
      .select('*', { count: 'exact', head: true })
      .is('item_name', null);

    return NextResponse.json({
      success: true,
      year,
      stats: {
        sos_from_netsuite: allSalesOrders.length,
        sos_inserted: inserted,
        lines_from_netsuite: allLines.length,
        lines_skipped: linesSkipped,
        lines_inserted: linesInserted,
        null_items: nullCount || 0,
      },
      message: `Clean: ${inserted} SOs, ${linesInserted} lines, ${nullCount || 0} NULLs`,
    });
  } catch (e: any) {
    console.error('Nuclear clean error:', e);
    return NextResponse.json({
      success: false,
      error: e?.message || String(e),
      stack: e?.stack,
    }, { status: 500 });
  }
}
