/**
 * Check if Boston SOs have lines in NetSuite
 */

import { NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  try {
    const bostonTransactionIds = ['1099273', '1116796']; // SO7324, SO7521

    const lineQuery = `
      SELECT
        t.id AS transaction_id,
        t.tranid AS so_number,
        tl.id AS line_id,
        tl.linesequencenumber,
        COALESCE(i.itemid, BUILTIN.DF(tl.item)) AS item_name,
        tl.amount
      FROM Transaction t
      INNER JOIN TransactionLine tl ON tl.transaction = t.id
      LEFT JOIN Item i ON i.id = tl.item
      WHERE t.id IN (${bostonTransactionIds.join(', ')})
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
