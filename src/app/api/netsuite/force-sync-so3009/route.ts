import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { netsuiteRequest } from '@/lib/netsuite';

export async function POST() {
  const supabase = getSupabaseAdmin();

  try {
    console.log('Fetching SO3009 (341203) from NetSuite...');

    // Step 1: Fetch SO header from NetSuite
    const headerQuery = `
      SELECT
        t.id AS netsuite_id,
        t.tranid,
        t.trandate,
        t.postingperiod,
        t.status,
        t.memo,
        t.entity AS customer_id,
        BUILTIN.DF(t.entity) AS customer_name,
        t.subtotal,
        t.discounttotal,
        t.taxtotal,
        t.total
      FROM Transaction t
      WHERE t.id = 341203
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
        { error: 'SO3009 not found in NetSuite' },
        { status: 404 }
      );
    }

    const soData = headerResponse.items[0];
    console.log('Found SO3009:', soData);

    // Step 2: Insert SO header into database
    const { data: insertedSO, error: insertError } = await supabase
      .from('netsuite_sales_orders')
      .upsert(
        {
          netsuite_id: soData.netsuite_id.toString(),
          so_number: soData.tranid,
          tranid: soData.tranid,
          so_date: soData.trandate,
          posting_period: soData.postingperiod?.toString(),
          status: soData.status,
          memo: soData.memo,
          customer_id: soData.customer_id?.toString(),
          customer_name: soData.customer_name,
          subtotal: soData.subtotal || 0,
          discount_total: soData.discounttotal || 0,
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

    console.log('Inserted SO3009 header:', insertedSO);

    // Step 3: Fetch line items from NetSuite
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
        BUILTIN.DF(tl.account) AS account_number,
        a.accountname AS account_name
      FROM TransactionLine tl
      LEFT JOIN Item i ON i.id = tl.item
      LEFT JOIN Account a ON a.id = tl.account
      WHERE tl.transaction = 341203
        AND tl.mainline = 'F'
        AND tl.item IS NOT NULL
      ORDER BY tl.linesequencenumber
    `;

    const linesResponse = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: linesQuery },
      }
    );

    const lines = linesResponse.items || [];
    console.log(`Found ${lines.length} line items for SO3009`);

    // Step 4: Insert line items into database
    let linesInserted = 0;
    const lineErrors = [];

    for (const line of lines) {
      try {
        const { error: lineError } = await supabase
          .from('netsuite_sales_order_lines')
          .upsert(
            {
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
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'sales_order_id,netsuite_line_id' }
          );

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

    return NextResponse.json({
      success: true,
      message: `SO3009 synced successfully`,
      soHeader: soData,
      stats: {
        linesFromNetSuite: lines.length,
        linesInserted,
        lineErrors: lineErrors.slice(0, 10),
      },
      nextStep: 'Check Fairfax profitability - should now show revenue',
    });
  } catch (error: any) {
    console.error('Error syncing SO3009:', error);
    return NextResponse.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}
