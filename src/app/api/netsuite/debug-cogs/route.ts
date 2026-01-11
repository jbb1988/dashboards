import { NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';

export const dynamic = 'force-dynamic';

// Debug endpoint to find where COGS data lives in NetSuite for Test Bench projects
export async function GET() {
  try {
    // Simple query: just count transactions per 5xxx account
    const query = `
      SELECT
        a.acctnumber,
        a.fullname,
        COUNT(tl.id) AS line_count
      FROM TransactionLine tl
      INNER JOIN Account a ON a.id = tl.account
      WHERE a.acctnumber LIKE '5%'
      GROUP BY a.acctnumber, a.fullname
      ORDER BY line_count DESC
    `;

    const result = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      { method: 'POST', body: { q: query }, params: { limit: '100' } }
    );

    return NextResponse.json({
      success: true,
      cogsAccounts: result.items || [],
      count: result.items?.length || 0,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Debug COGS error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
