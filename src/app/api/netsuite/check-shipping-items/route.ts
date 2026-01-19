/**
 * Check shipping/freight items classification
 */

import { NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  try {
    // Query for shipping items
    const shippingQuery = `
      SELECT
        i.id,
        i.itemid,
        i.displayname,
        i.itemtype,
        i.class,
        BUILTIN.DF(i.class) AS class_name
      FROM Item i
      WHERE i.itemtype = 'ShipItem'
      ORDER BY i.id
    `;

    const response = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: shippingQuery },
        params: { limit: '50' },
      }
    );

    return NextResponse.json({
      success: true,
      shippingItems: response.items || [],
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
