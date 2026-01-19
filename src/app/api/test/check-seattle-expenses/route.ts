import { NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const query = `
      SELECT
        er.id,
        er.tranid,
        er.trandate,
        er.status,
        er.total,
        er.entity AS customer_id,
        BUILTIN.DF(er.entity) AS customer_name,
        er.employee,
        BUILTIN.DF(er.employee) AS employee_name
      FROM transaction er
      WHERE er.type = 'ExpRept'
        AND er.entity = '2153'
      ORDER BY er.trandate DESC
    `;

    const response = await netsuiteRequest<{ items: any[] }>('/services/rest/query/v1/suiteql', {
      method: 'POST',
      body: { q: query },
      params: { limit: '100' },
    });

    return NextResponse.json({
      expenseReports: response.items || [],
      count: (response.items || []).length,
      totalAmount: (response.items || []).reduce((sum, er) => sum + parseFloat(er.total || 0), 0),
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Query failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
