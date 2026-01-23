import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { netsuiteRequest } from '@/lib/netsuite';

export async function GET() {
  const supabase = getSupabaseAdmin();

  try {
    // Check if SO3009 header exists in database
    const { data: soHeader } = await supabase
      .from('netsuite_sales_orders')
      .select('*')
      .or('so_number.eq.SO3009,netsuite_id.eq.341203')
      .single();

    let lineItems = null;
    if (soHeader) {
      const { data: lines, count } = await supabase
        .from('netsuite_sales_order_lines')
        .select('*', { count: 'exact' })
        .eq('sales_order_id', soHeader.id);

      lineItems = { count, lines: lines?.slice(0, 5) };
    }

    // Query NetSuite directly for SO3009 line items
    const nsQuery = `
      SELECT
        tl.id AS line_id,
        tl.linesequencenumber AS line_number,
        tl.linetype AS line_type,
        tl.mainline,
        tl.item AS item_id,
        COALESCE(i.itemid, BUILTIN.DF(tl.item)) AS item_name,
        tl.quantity,
        tl.rate,
        tl.amount
      FROM Transaction t
      INNER JOIN TransactionLine tl ON tl.transaction = t.id
      LEFT JOIN Item i ON i.id = tl.item
      WHERE t.id = 341203
      ORDER BY tl.linesequencenumber
    `;

    const nsResponse = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: nsQuery },
      }
    );

    const nsLines = nsResponse.items || [];

    // Filter to see which lines would be synced
    const syncableLines = nsLines.filter(
      (line) => line.mainline === 'F' && line.item_id !== null
    );

    return NextResponse.json({
      database: {
        soHeader,
        lineItems,
      },
      netsuite: {
        totalLines: nsLines.length,
        syncableLines: syncableLines.length,
        allLines: nsLines,
        syncable: syncableLines,
      },
      analysis: {
        headerExists: !!soHeader,
        dbLineCount: lineItems?.count || 0,
        nsLineCount: nsLines.length,
        nsSyncableCount: syncableLines.length,
        issue:
          soHeader && lineItems?.count === 0 && syncableLines.length > 0
            ? 'Lines exist in NetSuite but not synced to database'
            : soHeader && lineItems?.count === 0 && syncableLines.length === 0
            ? 'No syncable lines in NetSuite (all mainline=T or item IS NULL)'
            : !soHeader
            ? 'SO header not in database'
            : 'Unknown issue',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
