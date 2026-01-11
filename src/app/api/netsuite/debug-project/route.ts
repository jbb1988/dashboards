import { NextRequest, NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';

export const dynamic = 'force-dynamic';

// Debug endpoint to check specific project data from NetSuite
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const customer = searchParams.get('customer') || 'Milwaukee';

  try {
    // Query all transactions for this customer with Test Bench class
    const suiteQL = `
      SELECT
        t.id AS transaction_id,
        t.tranid,
        t.trandate,
        t.type AS transaction_type,
        BUILTIN.DF(t.entity) AS customer_name,
        tl.class AS class_id,
        BUILTIN.DF(tl.class) AS class_name,
        a.acctnumber AS account_number,
        a.fullname AS account_name,
        tl.netamount,
        tl.costestimate,
        tl.quantity,
        BUILTIN.DF(tl.item) AS item_name
      FROM Transaction t
      INNER JOIN TransactionLine tl ON tl.transaction = t.id
      LEFT JOIN Account a ON a.id = tl.account
      WHERE t.posting = 'T'
        AND tl.mainline = 'F'
        AND tl.class = 1
        AND BUILTIN.DF(t.entity) LIKE '%${customer}%'
        AND tl.netamount IS NOT NULL
        AND tl.netamount != 0
      ORDER BY t.trandate DESC
    `;

    console.log('Debug query for customer:', customer);

    const response = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      { method: 'POST', body: { q: suiteQL }, params: { limit: '100' } }
    );

    // Also query without class filter to see all transactions
    const suiteQL2 = `
      SELECT
        t.id AS transaction_id,
        t.tranid,
        t.trandate,
        t.type AS transaction_type,
        BUILTIN.DF(t.entity) AS customer_name,
        tl.class AS class_id,
        BUILTIN.DF(tl.class) AS class_name,
        a.acctnumber AS account_number,
        a.fullname AS account_name,
        tl.netamount,
        tl.costestimate,
        tl.quantity,
        BUILTIN.DF(tl.item) AS item_name
      FROM Transaction t
      INNER JOIN TransactionLine tl ON tl.transaction = t.id
      LEFT JOIN Account a ON a.id = tl.account
      WHERE t.posting = 'T'
        AND tl.mainline = 'F'
        AND BUILTIN.DF(t.entity) LIKE '%${customer}%'
        AND tl.netamount IS NOT NULL
        AND tl.netamount != 0
        AND (a.acctnumber LIKE '4%' OR a.acctnumber LIKE '5%')
      ORDER BY t.trandate DESC
    `;

    const response2 = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      { method: 'POST', body: { q: suiteQL2 }, params: { limit: '100' } }
    );

    return NextResponse.json({
      success: true,
      customer,
      withClassFilter: {
        count: response.items?.length || 0,
        items: response.items || [],
      },
      withoutClassFilter: {
        count: response2.items?.length || 0,
        items: response2.items || [],
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Debug project error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
