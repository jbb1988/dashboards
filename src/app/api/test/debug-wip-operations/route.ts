import { NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';

export const dynamic = 'force-dynamic';

/**
 * Debug endpoint to test WIP operations query and see actual NetSuite data
 */
export async function GET() {
  try {
    // Query with SO join to get revenue
    const query = `
      SELECT
        wo.id,
        wo.tranid,
        wo.trandate,
        wo.status,
        BUILTIN.DF(wo.status) AS statusname,
        wo.entity,
        BUILTIN.DF(wo.entity) AS customername,
        wo.custbodyiqsassydescription,
        so.tranid AS sonumber,
        so.custbody2 AS revenue,
        ROUND(SYSDATE - wo.trandate) AS daysopen
      FROM Transaction wo
      LEFT JOIN TransactionLine woline ON woline.transaction = wo.id AND woline.mainline = 'T'
      LEFT JOIN Transaction so ON so.id = woline.createdfrom
      WHERE wo.type = 'WorkOrd'
      ORDER BY wo.trandate DESC
    `;

    console.log('Debug query:', query);

    const response = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: query },
        params: { limit: '20' },
      }
    );

    const items = response.items || [];

    // Log everything
    console.log('=== DEBUG WIP OPERATIONS ===');
    console.log('Total items:', items.length);

    if (items.length > 0) {
      console.log('Column names:', Object.keys(items[0]));
      console.log('First 3 rows:');
      items.slice(0, 3).forEach((item, i) => {
        console.log(`Row ${i}:`, JSON.stringify(item, null, 2));
      });
    }

    // Count items with revenue
    const withRevenue = items.filter(i => i.revenue != null).length;
    const withSO = items.filter(i => i.sonumber != null).length;

    return NextResponse.json({
      success: true,
      count: items.length,
      withRevenue,
      withSO,
      columnNames: items.length > 0 ? Object.keys(items[0]) : [],
      sampleData: items.slice(0, 10),
    });
  } catch (error) {
    console.error('Debug query failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
