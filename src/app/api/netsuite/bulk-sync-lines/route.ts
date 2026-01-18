/**
 * BULK sync ALL line items in ONE query - FAST
 * Instead of 2,386 API calls, this does 3 (paginated)
 */

import { NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get('type') || 'WorkOrd'; // WorkOrd or SalesOrd
  const startDate = url.searchParams.get('startDate') || '2025-01-01';

  const supabase = getSupabaseAdmin();
  const PAGE_SIZE = 1000;

  try {
    // Convert date format
    const [y, m, d] = startDate.split('-');
    const nsDate = `${m}/${d}/${y}`;

    // ONE query for ALL line items
    const query = `
      SELECT
        t.id AS transaction_id,
        t.tranid AS transaction_number,
        tl.id AS line_id,
        tl.linesequencenumber AS line_number,
        tl.item AS item_id,
        COALESCE(i.itemid, BUILTIN.DF(tl.item)) AS item_name,
        COALESCE(i.displayname, BUILTIN.DF(tl.item)) AS item_description,
        tl.itemtype AS item_type,
        tl.quantity,
        tl.rate,
        tl.amount,
        tl.costestimate,
        tl.class AS class_id,
        BUILTIN.DF(tl.class) AS class_name,
        tl.location AS location_id
      FROM Transaction t
      INNER JOIN TransactionLine tl ON tl.transaction = t.id
      LEFT JOIN Item i ON i.id = tl.item
      WHERE t.type = '${type}'
        AND t.trandate >= TO_DATE('${nsDate}', 'MM/DD/YYYY')
        AND tl.mainline = 'F'
        AND tl.item IS NOT NULL
      ORDER BY t.id, tl.linesequencenumber
    `;

    console.log(`BULK fetching ALL ${type} line items since ${startDate}...`);

    // Paginate through ALL results
    let allLines: any[] = [];
    let offset = 0;
    let hasMore = true;
    let pageCount = 0;

    while (hasMore) {
      pageCount++;
      console.log(`  Page ${pageCount}: offset ${offset}...`);

      const response = await netsuiteRequest<{ items: any[]; hasMore: boolean }>(
        '/services/rest/query/v1/suiteql',
        {
          method: 'POST',
          body: { q: query },
          params: { limit: PAGE_SIZE.toString(), offset: offset.toString() },
        }
      );

      const items = response.items || [];
      allLines = allLines.concat(items);
      hasMore = response.hasMore && items.length === PAGE_SIZE;
      offset += items.length;

      console.log(`  Got ${items.length} lines (total: ${allLines.length})`);
    }

    console.log(`Fetched ${allLines.length} lines in ${pageCount} API calls`);

    // Group by transaction
    const linesByTxn: Record<string, any[]> = {};
    for (const line of allLines) {
      const txnId = line.transaction_id;
      if (!linesByTxn[txnId]) linesByTxn[txnId] = [];
      linesByTxn[txnId].push(line);
    }

    // Get DB mapping of netsuite_id to our internal id
    const table = type === 'WorkOrd' ? 'netsuite_work_orders' : 'netsuite_sales_orders';
    const lineTable = type === 'WorkOrd' ? 'netsuite_work_order_lines' : 'netsuite_sales_order_lines';
    const fkColumn = type === 'WorkOrd' ? 'work_order_id' : 'sales_order_id';

    const { data: txnMap } = await supabase
      .from(table)
      .select('id, netsuite_id');

    const idMap: Record<string, string> = {};
    for (const row of txnMap || []) {
      idMap[row.netsuite_id] = row.id;
    }

    // Build all records first, then BATCH upsert
    let errors: string[] = [];
    const allRecords: any[] = [];

    for (const [txnId, lines] of Object.entries(linesByTxn)) {
      const dbId = idMap[txnId];
      if (!dbId) {
        errors.push(`No DB record for txn ${txnId}`);
        continue;
      }

      for (const line of lines) {
        const record: any = {
          [fkColumn]: dbId,
          netsuite_line_id: line.line_id,
          line_number: parseInt(line.line_number) || 0,
          item_id: line.item_id,
          item_name: line.item_name,
          item_description: line.item_description,
          item_type: line.item_type,
          quantity: parseFloat(line.quantity) || null,
          updated_at: new Date().toISOString(),
        };

        if (type === 'WorkOrd') {
          record.unit_cost = parseFloat(line.rate) || null;
          record.line_cost = parseFloat(line.amount) || null;
          record.cost_estimate = parseFloat(line.costestimate) || null;
          record.class_id = line.class_id;
          record.class_name = line.class_name;
          record.location_id = line.location_id;
        } else {
          record.rate = parseFloat(line.rate) || null;
          record.amount = parseFloat(line.amount) || null;
          record.cost_estimate = parseFloat(line.costestimate) || null;
          record.location_id = line.location_id;
        }

        allRecords.push(record);
      }
    }

    // BATCH upsert 500 at a time
    const BATCH_SIZE = 500;
    let upserted = 0;
    for (let i = 0; i < allRecords.length; i += BATCH_SIZE) {
      const batch = allRecords.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from(lineTable)
        .upsert(batch, { onConflict: `${fkColumn},netsuite_line_id` });

      if (error) {
        errors.push(`Batch ${i / BATCH_SIZE}: ${error.message}`);
      } else {
        upserted += batch.length;
      }
      console.log(`  Upserted batch ${Math.floor(i / BATCH_SIZE) + 1} (${upserted} total)`);
    }

    return NextResponse.json({
      success: true,
      type,
      stats: {
        apiCalls: pageCount,
        linesFromNetSuite: allLines.length,
        transactionsWithLines: Object.keys(linesByTxn).length,
        linesUpserted: upserted,
        errors: errors.slice(0, 10),
        errorCount: errors.length,
      },
      message: `Synced ${allLines.length} lines in ${pageCount} API calls`,
    });
  } catch (error) {
    console.error('Bulk sync error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
