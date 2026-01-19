/**
 * Count total 2025 SalesOrders in NetSuite
 */

import { NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  try {
    const countQuery = `
      SELECT COUNT(*) AS total_count
      FROM Transaction t
      WHERE t.type = 'SalesOrd'
        AND t.trandate >= TO_DATE('2025-01-01', 'YYYY-MM-DD')
        AND t.trandate <= TO_DATE('2025-12-31', 'YYYY-MM-DD')
    `;

    const response = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: countQuery },
      }
    );

    return NextResponse.json({
      success: true,
      count: response.items?.[0]?.total_count || 0,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
