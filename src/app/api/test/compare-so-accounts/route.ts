import { NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';

export async function GET() {
  try {
    // Query SO7150 (known to have account_numbers) line items
    const querySO7150 = `
      SELECT
        tl.id AS line_id,
        tl.linesequencenumber AS line_number,
        tl.item AS item_id,
        BUILTIN.DF(tl.item) AS item_name,
        tl.account AS account_id,
        a.acctnumber AS account_number,
        a.acctname AS account_name
      FROM transactionline tl
      LEFT JOIN account a ON a.id = tl.account
      WHERE tl.transaction = (SELECT id FROM transaction WHERE tranid = 'SO7150')
        AND tl.mainline = 'F'
        AND tl.item IS NOT NULL
      ORDER BY tl.linesequencenumber
      LIMIT 10
    `;

    const so7150Response = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      { method: 'POST', body: { q: querySO7150 } }
    );

    // Query SO3009 (Fairfax 2025) line items
    const querySO3009 = `
      SELECT
        tl.id AS line_id,
        tl.linesequencenumber AS line_number,
        tl.item AS item_id,
        BUILTIN.DF(tl.item) AS item_name,
        tl.account AS account_id,
        a.acctnumber AS account_number,
        a.acctname AS account_name
      FROM transactionline tl
      LEFT JOIN account a ON a.id = tl.account
      WHERE tl.transaction = 341203
        AND tl.mainline = 'F'
        AND tl.item IS NOT NULL
      ORDER BY tl.linesequencenumber
      LIMIT 10
    `;

    const so3009Response = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      { method: 'POST', body: { q: querySO3009 } }
    );

    return NextResponse.json({
      so7150: {
        lines: so7150Response.items || [],
        linesWithAccount: (so7150Response.items || []).filter((l: any) => l.account_number).length,
      },
      so3009: {
        lines: so3009Response.items || [],
        linesWithAccount: (so3009Response.items || []).filter((l: any) => l.account_number).length,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
