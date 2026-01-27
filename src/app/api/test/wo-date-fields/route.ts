import { NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Query work orders with all date-related fields
    const query = `
      SELECT
        wo.id,
        wo.tranid,
        wo.trandate,
        wo.enddate,
        wo.duedate,
        wo.shipdate,
        wo.expectedclosedate,
        wo.startdate,
        wo.actualshipdate,
        wo.custbody_expected_completion,
        wo.custbodyexpectedcompletiondate,
        wo.status,
        BUILTIN.DF(wo.status) AS statusname
      FROM Transaction wo
      WHERE wo.type = 'WorkOrd'
        AND wo.status IN ('B', 'D')
      ORDER BY wo.trandate DESC
      FETCH FIRST 10 ROWS ONLY
    `;

    const response = await netsuiteRequest<{ items: any[] }>('/services/rest/query/v1/suiteql', {
      method: 'POST',
      body: { q: query },
      params: { limit: '10' },
    });

    return NextResponse.json({
      workOrders: response.items || [],
      count: (response.items || []).length,
      note: 'Checking which date fields exist on work orders',
    });
  } catch (error) {
    // If query fails, try simpler version
    try {
      const simpleQuery = `
        SELECT
          wo.id,
          wo.tranid,
          wo.trandate,
          wo.enddate,
          wo.duedate,
          wo.status
        FROM Transaction wo
        WHERE wo.type = 'WorkOrd'
          AND wo.status IN ('B', 'D')
        ORDER BY wo.trandate DESC
        FETCH FIRST 10 ROWS ONLY
      `;

      const response = await netsuiteRequest<{ items: any[] }>('/services/rest/query/v1/suiteql', {
        method: 'POST',
        body: { q: simpleQuery },
        params: { limit: '10' },
      });

      return NextResponse.json({
        workOrders: response.items || [],
        count: (response.items || []).length,
        note: 'Simplified query - some fields may not exist',
      });
    } catch (innerError) {
      return NextResponse.json({
        error: 'Query failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        innerError: innerError instanceof Error ? innerError.message : 'Unknown',
      }, { status: 500 });
    }
  }
}
