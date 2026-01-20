import { NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Query 41xx accounts (likely MCC and deferred revenue)
    const query = `
      SELECT
        a.acctnumber,
        a.acctname,
        a.description
      FROM account a
      WHERE a.isinactive = 'F'
        AND (a.acctnumber LIKE '41%' OR a.acctnumber LIKE '51%')
      ORDER BY a.acctnumber
    `;

    const response = await netsuiteRequest<{ items: any[] }>('/services/rest/query/v1/suiteql', {
      method: 'POST',
      body: { q: query },
      params: { limit: '100' },
    });

    const accounts = response.items || [];

    // Look for deferred revenue patterns
    const deferredMCC = accounts.filter(a => {
      const name = (a.acctname || '').toLowerCase();
      return (name.includes('deferred') || name.includes('contract')) &&
             (name.includes('mcc') || name.includes('maintenance') || name.includes('calibration'));
    });

    return NextResponse.json({
      total: accounts.length,
      accounts,
      deferredMCC,
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Query failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
