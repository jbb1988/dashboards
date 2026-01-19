/**
 * Investigate NetSuite Item table fields for classification
 */

import { NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  try {
    // Query Item table for classification fields
    const itemQuery = `
      SELECT
        i.id,
        i.itemid,
        i.displayname,
        i.itemtype,
        i.class,
        BUILTIN.DF(i.class) AS class_name
      FROM Item i
      WHERE i.itemid IN ('81100211', '82100211', 'Misc Freight Carrier', 'UPS Collect', '530001WH')
    `;

    const response = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: itemQuery },
      }
    );

    // Also query a broader sample
    const sampleQuery = `
      SELECT
        i.id,
        i.itemid,
        i.itemtype,
        i.class,
        BUILTIN.DF(i.class) AS class_name
      FROM Item i
      WHERE i.itemtype IN ('InvtPart', 'Service', 'NonInvtPart', 'ShipItem')
      ORDER BY i.id
    `;

    const sampleResponse = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: sampleQuery },
        params: { limit: '20' },
      }
    );

    return NextResponse.json({
      success: true,
      specificItems: response.items || [],
      sampleItems: sampleResponse.items || [],
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
