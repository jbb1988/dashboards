import { NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';

export async function GET() {
  try {
    // Fetch line items from NetSuite with detailed account info
    const query = `
      SELECT
        tl.id AS line_id,
        tl.linesequencenumber AS line_number,
        tl.item AS item_id,
        BUILTIN.DF(tl.item) AS item_name,
        tl.account AS account_id,
        BUILTIN.DF(tl.account) AS account_number,
        a.accountsearchdisplayname AS account_display,
        a.acctname AS account_name
      FROM transactionline tl
      LEFT JOIN account a ON a.id = tl.account
      WHERE tl.transaction = 341203
        AND tl.mainline = 'F'
        AND tl.item IS NOT NULL
      ORDER BY tl.linesequencenumber
      LIMIT 10
    `;

    const response = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      { method: 'POST', body: { q: query } }
    );

    return NextResponse.json({
      success: true,
      query,
      sampleLines: response.items || [],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
