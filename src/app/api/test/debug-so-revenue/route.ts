import { NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Check available revenue-related fields on SO
    const query = `
      SELECT
        so.tranid,
        so.custbody1,
        so.estgrossprofit,
        so.estgrossprofitpercent,
        so.totalcostestimate,
        so.foreigntotal
      FROM Transaction so
      WHERE so.type = 'SalesOrd'
      ORDER BY so.trandate DESC
    `;

    const response = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: query },
        params: { limit: '10' },
      }
    );

    const items = response.items || [];

    return NextResponse.json({
      success: true,
      count: items.length,
      columnNames: items.length > 0 ? Object.keys(items[0]) : [],
      sampleData: items,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
