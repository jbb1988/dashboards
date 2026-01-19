/**
 * Check full Boston SO details including quantity and type
 */

import { NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  try {
    const bostonTransactionIds = ['1099273', '1116796'];

    const lineQuery = `
      SELECT
        t.id AS transaction_id,
        t.tranid AS so_number,
        t.type,
        t.status,
        tl.id AS line_id,
        tl.linesequencenumber,
        COALESCE(i.itemid, BUILTIN.DF(tl.item)) AS item_name,
        tl.quantity,
        tl.rate,
        tl.amount,
        a.acctnumber AS account_number
      FROM Transaction t
      INNER JOIN TransactionLine tl ON tl.transaction = t.id
      LEFT JOIN Item i ON i.id = tl.item
      LEFT JOIN Account a ON a.id = tl.account
      WHERE t.id IN (${bostonTransactionIds.join(', ')})
        AND tl.mainline = 'F'
      ORDER BY t.id, tl.linesequencenumber
      LIMIT 10
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
      lines: response.items || [],
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
