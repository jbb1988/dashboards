/**
 * TRULY CLEAN: Delete EVERYTHING for 2025, then sync fresh
 */

import { NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get('year') || '2025';
  console.log(`🧹 TRULY CLEAN: Complete wipe and resync for ${year}`);

  try {
    const supabase = getSupabaseAdmin();

    // STEP 1: Delete year-specific lines first
    console.log(`Step 1: Getting ${year} SO IDs...`);
    const { data: soIds } = await supabase
      .from('netsuite_sales_orders')
      .select('id')
      .gte('so_date', `${year}-01-01`)
      .lte('so_date', `${year}-12-31`);

    let allLinesCount = 0;

    if (soIds && soIds.length > 0) {
      console.log(`Deleting lines for ${soIds.length} SOs...`);
      const ids = soIds.map(r => r.id);
      const BATCH_SIZE = 100;

      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const batch = ids.slice(i, i + BATCH_SIZE);
        const { error, count } = await supabase
          .from('netsuite_sales_order_lines')
          .delete({ count: 'exact' })
          .in('sales_order_id', batch);

        if (error) throw new Error(`Line delete failed: ${error.message}`);
        allLinesCount += (count || 0);
      }
    }

    console.log(`✓ Deleted ${allLinesCount} lines`);

    // STEP 2: Delete year SOs
    console.log(`Step 2: Deleting ${year} SOs...`);
    const { error: delSOsError, count: sosCount } = await supabase
      .from('netsuite_sales_orders')
      .delete({ count: 'exact' })
      .gte('so_date', `${year}-01-01`)
      .lte('so_date', `${year}-12-31`);

    if (delSOsError) {
      throw new Error(`Failed to delete SOs: ${delSOsError.message}`);
    }

    console.log(`✓ Deleted ${sosCount} SOs`);

    // STEP 3: Verify clean state
    const { count: verifySOs } = await supabase
      .from('netsuite_sales_orders')
      .select('*', { count: 'exact', head: true })
      .gte('so_date', `${year}-01-01`)
      .lte('so_date', `${year}-12-31`);

    console.log(`Verification: ${verifySOs} ${year} SOs remaining`);

    if (verifySOs !== 0) {
      throw new Error(`Clean failed: ${verifySOs} ${year} SOs still exist`);
    }

    // STEP 4: Fetch 2025 SOs from NetSuite
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
      ORDER BY t.id
    `;

    console.log('Step 4: Fetching 2025 SOs from NetSuite...');
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

    console.log(`✓ Fetched ${allSalesOrders.length} SOs from NetSuite`);

    // Deduplicate SOs by netsuite_id
    const seenSOIds = new Set<string>();
    const uniqueSOs = allSalesOrders.filter(so => {
      const id = String(so.id);
      if (seenSOIds.has(id)) {
        console.warn(`  ⚠️  Duplicate SO detected: ${id}`);
        return false;
      }
      seenSOIds.add(id);
      return true;
    });

    console.log(`  Deduplicated SOs: ${allSalesOrders.length} → ${uniqueSOs.length}`);

    // STEP 5: Insert SOs
    console.log('Step 5: Inserting SOs...');
    const soRecords = uniqueSOs.map(so => ({
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
        throw new Error(`SO insert failed batch ${i}: ${error.message}`);
      }

      inserted += batch.length;
      console.log(`  Inserted ${inserted}/${soRecords.length} SOs`);
    }

    console.log(`✓ Inserted ${inserted} SOs`);

    // STEP 6: Build ID map
    const { data: soMapping } = await supabase
      .from('netsuite_sales_orders')
      .select('id, netsuite_id');

    const idMap: Record<string, string> = {};
    for (const row of soMapping || []) {
      idMap[row.netsuite_id] = row.id;
    }

    console.log(`✓ Mapped ${Object.keys(idMap).length} SOs`);

    // STEP 7: Fetch lines from NetSuite
    const lineQuery = `
      SELECT
        t.id AS transaction_id,
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
        tl.revrecstartdate,
        tl.revrecenddate,
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

    console.log('Step 7: Fetching lines from NetSuite...');
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

    console.log(`✓ Fetched ${allLines.length} lines from NetSuite`);

    // STEP 8: Deduplicate and insert lines
    console.log('Step 8: Deduplicating and inserting lines...');

    // Deduplicate by transaction_id + line_id
    const seenKeys = new Set<string>();
    const uniqueLines = allLines.filter(line => {
      const key = `${line.transaction_id}-${line.line_id}`;
      if (seenKeys.has(key)) {
        console.warn(`  ⚠️  Duplicate detected: ${key}`);
        return false;
      }
      seenKeys.add(key);
      return true;
    });

    console.log(`  Deduplicated: ${allLines.length} → ${uniqueLines.length} lines`);

    let linesInserted = 0;
    let linesSkipped = 0;

    const lineRecords = uniqueLines
      .filter(line => {
        const hasParent = idMap[String(line.transaction_id)];
        if (!hasParent) {
          linesSkipped++;
          console.warn(`  ⚠️  Skipping orphan line: ${line.line_id} (SO ${line.transaction_id})`);
        }
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
        revrecstartdate: line.revrecstartdate || null,
        revrecenddate: line.revrecenddate || null,
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
        throw new Error(`Line insert failed batch ${i}: ${error.message}`);
      }

      linesInserted += batch.length;
      console.log(`  Inserted ${linesInserted}/${lineRecords.length} lines`);
    }

    console.log(`✓ Inserted ${linesInserted} lines`);

    // STEP 9: Final validation
    const { count: nullCount } = await supabase
      .from('netsuite_sales_order_lines')
      .select('*', { count: 'exact', head: true })
      .is('item_name', null);

    return NextResponse.json({
      success: true,
      year,
      stats: {
        deleted_lines: allLinesCount,
        deleted_sos: sosCount,
        sos_from_netsuite: allSalesOrders.length,
        sos_inserted: inserted,
        lines_from_netsuite: allLines.length,
        lines_deduplicated: uniqueLines.length,
        lines_skipped: linesSkipped,
        lines_inserted: linesInserted,
        null_items: nullCount || 0,
      },
      message: `SUCCESS: ${inserted} SOs, ${linesInserted} lines, ${nullCount || 0} NULLs`,
    });
  } catch (e: any) {
    console.error('Truly clean error:', e);
    return NextResponse.json({
      success: false,
      error: e?.message || String(e),
      stack: e?.stack,
    }, { status: 500 });
  }
}
