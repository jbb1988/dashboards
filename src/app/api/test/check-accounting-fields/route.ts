import { NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Get a sample of accounting line fields to see what's available
    const query = `
      SELECT
        tl.transaction,
        tl.account,
        BUILTIN.DF(tl.account) AS account_name,
        tl.amount,
        wo.tranid AS wo_number
      FROM transactionaccountingline tl
      INNER JOIN transaction wo ON tl.transaction = wo.id
      WHERE wo.tranid = 'WO5967'
    `;

    const response = await netsuiteRequest<{ items: any[] }>('/services/rest/query/v1/suiteql', {
      method: 'POST',
      body: { q: query },
      params: { limit: '100' },
    });

    return NextResponse.json({
      accountingLines: response.items || [],
      count: (response.items || []).length,
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Query failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
