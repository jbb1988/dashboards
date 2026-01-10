import { NextRequest, NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';

    // Query accounts - search for revenue accounts (type = Income)
    // or search by name/number
    let whereClause = "a.accttype = 'Income'";
    if (search) {
      whereClause = `(
        LOWER(a.acctname) LIKE LOWER('%${search}%')
        OR a.acctnumber LIKE '%${search}%'
      )`;
    }

    const suiteQL = `
      SELECT
        a.id,
        a.acctnumber,
        a.acctname,
        a.accttype,
        BUILTIN.DF(a.parent) AS parent_name
      FROM Account a
      WHERE ${whereClause}
      ORDER BY a.acctnumber
    `;

    console.log('Executing Account query:', suiteQL);

    const response = await netsuiteRequest<{ items: any[]; hasMore: boolean; totalResults: number }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: suiteQL },
        params: { limit: '200', offset: '0' },
      }
    );

    return NextResponse.json({
      accounts: response.items || [],
      count: response.items?.length || 0,
      search,
    });

  } catch (error) {
    console.error('Error fetching NetSuite accounts:', error);
    return NextResponse.json({
      error: 'Failed to fetch accounts',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
