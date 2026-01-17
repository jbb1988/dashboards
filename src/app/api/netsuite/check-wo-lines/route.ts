/**
 * Diagnostic endpoint to check raw WO line data from NetSuite
 */

import { NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const woNumber = url.searchParams.get('woNumber') || 'WO6721';

  // Get the NetSuite ID for this WO
  const supabase = getSupabaseAdmin();
  const { data: wo } = await supabase
    .from('netsuite_work_orders')
    .select('netsuite_id')
    .eq('wo_number', woNumber)
    .single();

  if (!wo) {
    return NextResponse.json({ error: `WO ${woNumber} not found in database` }, { status: 404 });
  }

  // Test the actual cost query from getWorkOrderLines
  const query = `
    SELECT
      tl.item AS item_id,
      BUILTIN.DF(tl.item) AS item_name,
      tal.amount,
      ABS(COALESCE(tal.amount, 0)) AS abs_amount,
      t.type,
      t.tranid
    FROM TransactionLine tl
    INNER JOIN Transaction t ON t.id = tl.transaction
    INNER JOIN TransactionAccountingLine tal ON tal.transaction = t.id AND tal.transactionline = tl.id
    WHERE tl.createdfrom = '${wo.netsuite_id}'
      AND t.type IN ('WOCompl', 'WOIssue')
      AND tl.mainline = 'F'
      AND tal.posting = 'T'
      AND tal.amount < 0
    ORDER BY tl.item
  `;

  try {
    const result = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: query },
        params: { limit: '100' },
      }
    );

    return NextResponse.json({
      woNumber,
      netsuiteId: wo.netsuite_id,
      lineCount: result.items?.length || 0,
      lines: result.items?.slice(0, 5) || [], // First 5 lines as sample
      allFields: result.items?.[0] ? Object.keys(result.items[0]) : [],
    });
  } catch (error) {
    return NextResponse.json({
      error: 'NetSuite query failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
