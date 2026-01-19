/**
 * Find Misc Freight Carrier item
 */

import { NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  try {
    // Query for freight items by name
    const freightQuery = `
      SELECT
        i.id,
        i.itemid,
        i.displayname,
        i.itemtype,
        i.class,
        BUILTIN.DF(i.class) AS class_name
      FROM Item i
      WHERE i.itemid LIKE '%Freight%'
        OR i.displayname LIKE '%Freight%'
        OR i.itemid LIKE '%UPS%'
        OR i.displayname LIKE '%UPS%'
    `;

    const response = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: freightQuery },
      }
    );

    return NextResponse.json({
      success: true,
      items: response.items || [],
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
