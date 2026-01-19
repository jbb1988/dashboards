import { NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Get ALL cost-related fields from Work Orders
    const query = `
      SELECT
        wo.id,
        wo.tranid,
        wo.trandate,
        wo.status,
        wo.total,
        wo.totalcostestimate,
        wo.estimatedcost,
        wo.altgrossprof,
        wo.totalactualcost,
        wo.estgrossprofit,
        wo.estgrossprofitpercent,
        wo.custbody_actual_cost,
        wo.custbody_total_cost
      FROM transaction wo
      WHERE wo.tranid IN ('WO5967', 'WO5968', 'WO5969', 'WO5970', 'WO5971', 'WO5973', 'WO5974', 'WO6583')
      ORDER BY wo.tranid
    `;

    const response = await netsuiteRequest<{ items: any[] }>('/services/rest/query/v1/suiteql', {
      method: 'POST',
      body: { q: query },
      params: { limit: '100' },
    });

    const wos = response.items || [];

    // Calculate totals
    const totals = {
      total: wos.reduce((sum, wo) => sum + parseFloat(wo.total || 0), 0),
      totalcostestimate: wos.reduce((sum, wo) => sum + parseFloat(wo.totalcostestimate || 0), 0),
      estimatedcost: wos.reduce((sum, wo) => sum + parseFloat(wo.estimatedcost || 0), 0),
      totalactualcost: wos.reduce((sum, wo) => sum + parseFloat(wo.totalactualcost || 0), 0),
    };

    return NextResponse.json({
      workOrders: wos,
      count: wos.length,
      totals,
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Query failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
