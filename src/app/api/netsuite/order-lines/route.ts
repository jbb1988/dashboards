import { NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';

export const dynamic = 'force-dynamic';

/**
 * GET /api/netsuite/order-lines?orderId=123
 *
 * Returns line items for a specific sales order with manufacturing vs deferred classification
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.json({
        success: false,
        error: 'orderId parameter is required',
      }, { status: 400 });
    }

    // Query line items with item income account for classification
    const query = `
      SELECT
        tl.id AS line_id,
        tl.item AS item_id,
        BUILTIN.DF(tl.item) AS item_name,
        i.displayname AS item_description,
        tl.quantity,
        tl.rate,
        tl.amount,
        i.incomeaccount AS income_acct_id,
        ia.acctnumber AS income_account,
        ia.fullname AS income_account_name
      FROM TransactionLine tl
      LEFT JOIN Item i ON i.id = tl.item
      LEFT JOIN Account ia ON ia.id = i.incomeaccount
      WHERE tl.transaction = '${orderId.replace(/'/g, "''")}'
        AND tl.mainline = 'F'
        AND tl.item IS NOT NULL
      ORDER BY tl.linesequencenumber
    `;

    const response = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: query },
        params: { limit: '500' },
      }
    );

    const lines = (response.items || []).map(row => {
      const incomeAccount = row.income_account || '';

      // Classify as manufacturing or deferred based on income account
      const isManufacturing =
        incomeAccount.startsWith('401') ||
        incomeAccount.startsWith('402') ||
        incomeAccount.startsWith('403') ||
        incomeAccount.startsWith('404') ||
        incomeAccount.startsWith('407') ||
        incomeAccount.startsWith('414');

      return {
        line_id: row.line_id?.toString() || '',
        item_id: row.item_id?.toString() || '',
        item_name: row.item_name || '',
        item_description: row.item_description || '',
        quantity: parseFloat(row.quantity) || 0,
        rate: parseFloat(row.rate) || 0,
        amount: parseFloat(row.amount) || 0,
        income_account: incomeAccount,
        income_account_name: row.income_account_name || '',
        is_manufacturing: isManufacturing,
      };
    });

    return NextResponse.json({
      success: true,
      orderId,
      lines,
      summary: {
        total_lines: lines.length,
        manufacturing_lines: lines.filter(l => l.is_manufacturing).length,
        deferred_lines: lines.filter(l => !l.is_manufacturing).length,
      },
    });
  } catch (error) {
    console.error('Error fetching order lines:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch order lines',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
