import { NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Get Seattle WO IDs first
    const woQuery = `
      SELECT id, tranid
      FROM transaction
      WHERE type = 'WorkOrd'
        AND tranid IN ('WO5967', 'WO5968', 'WO5969', 'WO5970', 'WO5971', 'WO5973', 'WO5974', 'WO6583')
    `;

    const woResponse = await netsuiteRequest<{ items: any[] }>('/services/rest/query/v1/suiteql', {
      method: 'POST',
      body: { q: woQuery },
      params: { limit: '100' },
    });

    const wos = woResponse.items || [];

    // Check for Work Order Completion (Build) transactions for Seattle customer
    const buildQuery = `
      SELECT
        b.id,
        b.tranid,
        b.trandate,
        b.type,
        b.status,
        b.total,
        b.memo,
        b.entity,
        BUILTIN.DF(b.entity) AS entity_name
      FROM transaction b
      WHERE b.type = 'Build'
        AND b.entity = '2153'
        AND b.trandate >= '2025-01-01'
      ORDER BY b.trandate DESC
    `;

    const buildResponse = await netsuiteRequest<{ items: any[] }>('/services/rest/query/v1/suiteql', {
      method: 'POST',
      body: { q: buildQuery },
      params: { limit: '100' },
    });

    return NextResponse.json({
      workOrders: wos,
      builds: buildResponse.items || [],
      buildCount: (buildResponse.items || []).length,
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Query failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
