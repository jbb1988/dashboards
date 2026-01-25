/**
 * Force sync a single Sales Order with complete line item data
 * Usage: POST /api/netsuite/force-sync-so?soNumber=SO5571
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { netsuiteRequest } from '@/lib/netsuite';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const url = new URL(request.url);
  const soNumber = url.searchParams.get('soNumber');

  if (!soNumber) {
    return NextResponse.json(
      { error: 'soNumber parameter required (e.g., ?soNumber=SO5571)' },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  try {
    console.log(`Force syncing ${soNumber} from NetSuite...`);

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

    const headerResponse = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: headerQuery },
      }
    );

    if (!headerResponse.items || headerResponse.items.length === 0) {
      return NextResponse.json(
        { error: `${soNumber} not found in NetSuite` },
        { status: 404 }
      );
    }

    const soData = headerResponse.items[0];
    console.log(`Found ${soNumber}:`, soData);

    // Step 2: Insert/update SO header into database
    const { data: insertedSO, error: insertError } = await supabase
      .from('netsuite_sales_orders')
      .upsert(
        {
          netsuite_id: soData.netsuite_id.toString(),
          so_number: soData.tranid,
          tranid: soData.tranid,
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
      return NextResponse.json(
        { error: 'Failed to insert SO header', details: insertError.message },
        { status: 500 }
      );
    }

    console.log(`Inserted/updated ${soNumber} header:`, insertedSO.id);

    // Step 3: Fetch line items from NetSuite with ALL required fields
    const linesQuery = `
      SELECT
        tl.id AS line_id,
        tl.linesequencenumber AS line_number,
        tl.item AS item_id,
        COALESCE(i.itemid, BUILTIN.DF(tl.item)) AS item_name,
        COALESCE(i.displayname, BUILTIN.DF(tl.item)) AS item_description,
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

    const linesResponse = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: linesQuery },
        params: { limit: '1000' },
      }
    );

    const lines = linesResponse.items || [];
    console.log(`Found ${lines.length} line items for ${soNumber}`);

    // Step 4: Delete existing lines and insert fresh
    const { error: deleteError } = await supabase
      .from('netsuite_sales_order_lines')
      .delete()
      .eq('sales_order_id', insertedSO.id);

    if (deleteError) {
      console.error('Error deleting old lines:', deleteError);
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

    console.log(`Inserted ${linesInserted}/${lines.length} line items`);

    // Show sample of what was synced
    const mccLines = lines.filter((l: any) => {
      const acct = l.account_number || '';
      return acct.startsWith('410') || acct.startsWith('411');
    });

    return NextResponse.json({
      success: true,
      message: `${soNumber} synced successfully with ${linesInserted} lines`,
      soHeader: {
        id: insertedSO.id,
        netsuite_id: soData.netsuite_id,
        so_number: soData.tranid,
        customer: soData.customer_name,
        total: soData.total,
      },
      stats: {
        linesFromNetSuite: lines.length,
        linesInserted,
        mccLines: mccLines.length,
        lineErrors: lineErrors.slice(0, 10),
      },
      mccLinesSample: mccLines.slice(0, 5).map((l: any) => ({
        item: l.item_name,
        amount: l.amount,
        account: l.account_number,
        revRecStart: l.revrecstartdate,
        revRecEnd: l.revrecenddate,
      })),
    });
  } catch (error: any) {
    console.error(`Error syncing ${soNumber}:`, error);
    return NextResponse.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}
