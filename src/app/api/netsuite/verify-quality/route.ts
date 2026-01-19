/**
 * Verify the transaction types of orphaned IDs
 */

import { NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  try {
    // Sample orphaned transaction IDs from the last sync
    const orphanedIds = ['1019531', '1020202', '1020205', '1020206', '1020321'];

    const query = `
      SELECT
        t.id,
        t.type,
        t.tranid,
        t.trandate,
        t.status
      FROM Transaction t
      WHERE t.id IN (${orphanedIds.join(', ')})
    `;

    const response = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: query },
      }
    );

    return NextResponse.json({
      success: true,
      transactions: response.items || [],
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
