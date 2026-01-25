/**
 * Force sync a single Sales Order with complete line item data
 *
 * Run with: npx tsx scripts/force-sync-so.ts SO5571
 */

// IMPORTANT: Load env vars BEFORE importing netsuite library
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Dynamic import to ensure env vars are loaded first
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

async function main() {
  // Initialize netsuite module after env vars are loaded
  await initNetsuite();

  const soNumber = process.argv[2];

  if (!soNumber) {
    console.log('Usage: npx tsx scripts/force-sync-so.ts SO5571');
    process.exit(1);
  }

  console.log(`\n🔄 Force syncing ${soNumber} from NetSuite...\n`);

  // Step 1: Fetch SO header from NetSuite
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
    console.error(`❌ ${soNumber} not found in NetSuite`);
    process.exit(1);
  }

  const soData = headers[0];
  console.log(`✅ Found ${soNumber} in NetSuite:`);
  console.log(`   NetSuite ID: ${soData.netsuite_id}`);
  console.log(`   Customer: ${soData.customer_name}`);
  console.log(`   Total: $${soData.total?.toLocaleString()}`);

  // Step 2: Insert/update SO header into database
  const { data: insertedSO, error: insertError } = await supabase
    .from('netsuite_sales_orders')
    .upsert(
      {
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
      },
      { onConflict: 'netsuite_id' }
    )
    .select()
    .single();

  if (insertError) {
    console.error(`❌ Failed to insert SO header:`, insertError.message);
    process.exit(1);
  }

  console.log(`\n✅ Inserted/updated SO header (DB ID: ${insertedSO.id})`);

  // Step 3: Fetch line items from NetSuite with ALL required fields
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
  console.log(`\n📦 Found ${lines.length} line items in NetSuite`);

  // Step 4: Delete existing lines and insert fresh
  const { error: deleteError } = await supabase
    .from('netsuite_sales_order_lines')
    .delete()
    .eq('sales_order_id', insertedSO.id);

  if (deleteError) {
    console.error('⚠️  Error deleting old lines:', deleteError.message);
  }

  // Step 5: Insert line items into database
  let linesInserted = 0;
  const lineErrors: string[] = [];

  for (const line of lines) {
    try {
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

      if (lineError) {
        lineErrors.push(`Line ${line.line_number}: ${lineError.message}`);
      } else {
        linesInserted++;
      }
    } catch (err) {
      lineErrors.push(`Line ${line.line_number}: ${err}`);
    }
  }

  console.log(`✅ Inserted ${linesInserted}/${lines.length} line items`);

  if (lineErrors.length > 0) {
    console.log(`\n⚠️  Line errors (${lineErrors.length}):`);
    for (const err of lineErrors.slice(0, 5)) {
      console.log(`   ${err}`);
    }
  }

  // Show MCC lines
  const mccLines = lines.filter((l: any) => {
    const acct = l.account_number || '';
    return acct.startsWith('410') || acct.startsWith('411');
  });

  console.log(`\n📊 MCC Lines (accounts 410x/411x): ${mccLines.length}`);
  let mccRevenue = 0;
  for (const line of mccLines) {
    const amount = parseFloat(line.amount) || 0;
    if (amount < 0) mccRevenue += Math.abs(amount);
    console.log(`   ${line.account_number} | ${line.item_name?.substring(0, 30).padEnd(30)} | $${amount.toLocaleString()}`);
  }
  console.log(`\n💰 Total MCC Revenue: $${mccRevenue.toLocaleString()}`);

  console.log(`\n✨ Sync complete! Refresh the dashboard to see updated data.\n`);
}

main().catch(console.error);
