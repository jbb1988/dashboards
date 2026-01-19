import { NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Check for ALL transaction types that might have costs for Seattle WOs
    // This includes expense reports, vendor bills, journal entries, etc.

    const query = `
      SELECT
        t.type,
        COUNT(*) as count,
        SUM(ABS(t.total)) as total_amount
      FROM transaction t
      WHERE t.entity = '2153'
        AND t.trandate >= '2025-01-01'
      GROUP BY t.type
      ORDER BY total_amount DESC
    `;

    const response = await netsuiteRequest<{ items: any[] }>('/services/rest/query/v1/suiteql', {
      method: 'POST',
      body: { q: query },
      params: { limit: '100' },
    });

    return NextResponse.json({
      transactionTypes: response.items || [],
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Query failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
