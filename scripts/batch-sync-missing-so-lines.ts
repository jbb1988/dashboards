/**
 * Batch sync all SOs that have 0 lines in the database
 *
 * Run with: npx tsx scripts/batch-sync-missing-so-lines.ts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

let netsuiteRequest: typeof import('../src/lib/netsuite').netsuiteRequest;

async function initNetsuite() {
  const ns = await import('../src/lib/netsuite');
  netsuiteRequest = ns.netsuiteRequest;
}

async function netsuiteQuery(query: string): Promise<any[]> {
  const response = await netsuiteRequest(
    '/services/rest/query/v1/suiteql',
    {
      method: 'POST',
      body: { q: query },
      params: { limit: '1000' },
    }
  ) as { items: any[] };
  return response.items || [];
}

async function syncSO(soNumber: string): Promise<{ success: boolean; lines: number; error?: string }> {
  try {
    // Fetch SO header
    const headerQuery = `
      SELECT
        so.id AS netsuite_id,
        so.tranid,
        so.trandate,
        BUILTIN.DF(so.postingperiod) AS posting_period,
        so.status,
        so.memo,
        so.entity AS customer_id,
        BUILTIN.DF(so.entity) AS customer_name,
        so.taxtotal,
        so.total
      FROM transaction so
      WHERE so.type = 'SalesOrd'
        AND so.tranid = '${soNumber.replace(/'/g, "''")}'
    `;

    const headers = await netsuiteQuery(headerQuery);
    if (headers.length === 0) {
      return { success: false, lines: 0, error: 'Not found in NetSuite' };
    }

    const soData = headers[0];

    // Upsert SO header
    const { data: insertedSO, error: insertError } = await supabase
      .from('netsuite_sales_orders')
      .upsert({
        netsuite_id: soData.netsuite_id.toString(),
        so_number: soData.tranid,
        so_date: soData.trandate,
        posting_period: soData.posting_period,
        status: soData.status,
        memo: soData.memo,
        customer_id: soData.customer_id?.toString(),
        customer_name: soData.customer_name,
        tax_total: soData.taxtotal || 0,
        total_amount: soData.total || 0,
        synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'netsuite_id' })
      .select()
      .single();

    if (insertError) {
      return { success: false, lines: 0, error: insertError.message };
    }

    // Fetch line items
    const linesQuery = `
      SELECT
        tl.id AS line_id,
        tl.linesequencenumber AS line_number,
        tl.item AS item_id,
        COALESCE(i.itemid, BUILTIN.DF(tl.item)) AS item_name,
        COALESCE(i.displayname, BUILTIN.DF(tl.item)) AS item_description,
        tl.memo AS line_memo,
        tl.itemtype AS item_type,
        tl.class AS class_id,
        BUILTIN.DF(tl.class) AS class_name,
        tl.quantity,
        tl.rate,
        tl.amount,
        tl.costestimate,
        tl.isclosed,
        tl.account AS account_id,
        BUILTIN.DF(tl.account) AS account_name,
        a.acctnumber AS account_number,
        tl.revrecstartdate,
        tl.revrecenddate
      FROM transactionline tl
      LEFT JOIN item i ON i.id = tl.item
      LEFT JOIN account a ON a.id = tl.account
      WHERE tl.transaction = ${soData.netsuite_id}
        AND tl.mainline = 'F'
      ORDER BY tl.linesequencenumber
    `;

    const lines = await netsuiteQuery(linesQuery);

    // Delete existing lines
    await supabase
      .from('netsuite_sales_order_lines')
      .delete()
      .eq('sales_order_id', insertedSO.id);

    // Insert new lines
    let linesInserted = 0;
    for (const line of lines) {
      const { error: lineError } = await supabase
        .from('netsuite_sales_order_lines')
        .insert({
          sales_order_id: insertedSO.id,
          netsuite_line_id: line.line_id.toString(),
          line_number: parseInt(line.line_number) || 0,
          item_id: line.item_id?.toString(),
          item_name: line.item_name,
          item_description: line.item_description,
          line_memo: line.line_memo,
          item_type: line.item_type,
          item_class_id: line.class_id?.toString(),
          item_class_name: line.class_name,
          quantity: parseFloat(line.quantity) || null,
          rate: parseFloat(line.rate) || null,
          amount: parseFloat(line.amount) || null,
          cost_estimate: parseFloat(line.costestimate) || null,
          is_closed: line.isclosed === 'T',
          account_number: line.account_number,
          account_name: line.account_name,
          revrecstartdate: line.revrecstartdate || null,
          revrecenddate: line.revrecenddate || null,
          updated_at: new Date().toISOString(),
        });

      if (!lineError) linesInserted++;
    }

    return { success: true, lines: linesInserted };
  } catch (err: any) {
    return { success: false, lines: 0, error: err.message };
  }
}

async function main() {
  await initNetsuite();

  console.log('\n🔍 Finding all SOs with 0 lines...\n');

  // Get all SOs
  const { data: allSOs } = await supabase
    .from('netsuite_sales_orders')
    .select('id, so_number')
    .order('so_number', { ascending: true });

  const sosToSync: string[] = [];

  for (const so of allSOs || []) {
    const { count } = await supabase
      .from('netsuite_sales_order_lines')
      .select('*', { count: 'exact', head: true })
      .eq('sales_order_id', so.id);

    if (count === 0) {
      sosToSync.push(so.so_number);
    }
  }

  console.log(`Found ${sosToSync.length} SOs with 0 lines\n`);

  if (sosToSync.length === 0) {
    console.log('✅ All SOs have lines synced!');
    return;
  }

  console.log('Starting batch sync...\n');

  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const soNumber of sosToSync) {
    process.stdout.write(`  Syncing ${soNumber}... `);
    const result = await syncSO(soNumber);

    if (result.success) {
      console.log(`✅ ${result.lines} lines`);
      synced++;
    } else {
      console.log(`❌ ${result.error}`);
      failed++;
      errors.push(`${soNumber}: ${result.error}`);
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 100));
  }

  console.log('\n' + '='.repeat(60));
  console.log('BATCH SYNC COMPLETE');
  console.log('='.repeat(60));
  console.log(`✅ Synced: ${synced}`);
  console.log(`❌ Failed: ${failed}`);

  if (errors.length > 0) {
    console.log('\nErrors:');
    for (const err of errors.slice(0, 10)) {
      console.log(`  ${err}`);
    }
    if (errors.length > 10) {
      console.log(`  ... and ${errors.length - 10} more`);
    }
  }

  console.log('\n');
}

main().catch(console.error);
