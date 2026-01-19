import { NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const query = `
      SELECT
        c.id,
        c.companyname,
        c.entityid
      FROM customer c
      WHERE LOWER(c.companyname) LIKE '%seattle%'
         OR LOWER(c.entityid) LIKE '%seattle%'
      ORDER BY c.id
    `;

    const response = await netsuiteRequest<{ items: any[] }>('/services/rest/query/v1/suiteql', {
      method: 'POST',
      body: { q: query },
      params: { limit: '50' },
    });

    return NextResponse.json({
      customers: response.items || [],
      count: (response.items || []).length,
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Query failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
