/**
 * Debug why lines aren't being inserted
 */
import { NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    // Check 1: How many SO headers do we have?
    const { count: soCount } = await supabase
      .from('netsuite_sales_orders')
      .select('*', { count: 'exact', head: true });

    // Check 2: Sample a few SO IDs
    const { data: sampleSOs } = await supabase
      .from('netsuite_sales_orders')
      .select('id, netsuite_id, so_number')
      .limit(5);

    // Check 3: Get lines from NetSuite for ONE specific SO
    const testSO = sampleSOs?.[0];
    if (!testSO) {
      return NextResponse.json({
        error: 'No sales orders in database',
      });
    }

    const lineQuery = `
      SELECT
        tl.id AS line_id,
        tl.transaction AS transaction_id,
        tl.linesequencenumber,
        tl.item AS item_id,
        COALESCE(i.itemid, BUILTIN.DF(tl.item)) AS item_name,
        tl.quantity,
        tl.rate,
        tl.amount
      FROM TransactionLine tl
      LEFT JOIN Item i ON i.id = tl.item
      WHERE tl.transaction = '${testSO.netsuite_id}'
        AND tl.mainline = 'F'
      ORDER BY tl.linesequencenumber
    `;

    const nsResponse = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: lineQuery },
        params: { limit: '100', offset: '0' },
      }
    );

    // Check 4: How many lines exist for this SO in our DB?
    const { data: dbLines, count: dbLineCount } = await supabase
      .from('netsuite_sales_order_lines')
      .select('*', { count: 'exact' })
      .eq('sales_order_id', testSO.id);

    return NextResponse.json({
      debug: {
        so_count_in_db: soCount,
        test_so: testSO,
        lines_from_netsuite: nsResponse.items?.length || 0,
        lines_in_db_for_test_so: dbLineCount,
        netsuite_lines: nsResponse.items || [],
        db_lines: dbLines || [],
      },
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
