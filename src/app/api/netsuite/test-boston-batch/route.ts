/**
 * Test batched line query for Boston SOs
 */

import { NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  try {
    const bostonIds = ['1099273', '1116796'];

    const lineQuery = `
      SELECT
        t.id AS transaction_id,
        t.tranid AS so_number,
        tl.id AS line_id,
        tl.linesequencenumber,
        COALESCE(i.itemid, BUILTIN.DF(tl.item)) AS item_name,
        tl.amount,
        a.acctnumber AS account_number
      FROM Transaction t
      INNER JOIN TransactionLine tl ON tl.transaction = t.id
      LEFT JOIN Item i ON i.id = tl.item
      LEFT JOIN Account a ON a.id = tl.account
      WHERE t.id IN (${bostonIds.join(', ')})
        AND tl.mainline = 'F'
      ORDER BY t.id, tl.linesequencenumber
    `;

    const response = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: lineQuery },
      }
    );

    return NextResponse.json({
      success: true,
      query: lineQuery,
      lines: response.items || [],
      lineCount: response.items?.length || 0,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
