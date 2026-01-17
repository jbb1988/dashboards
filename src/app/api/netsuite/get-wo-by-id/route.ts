/**
 * API Route: /api/netsuite/get-wo-by-id
 * Get work order by internal ID
 */

import { NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id') || '1186730'; // Default to WO6922

    console.log(`Fetching work order with ID: ${id}`);

    // Query 1: Get work order from transaction table
    const woQuery = `
      SELECT *
      FROM transaction
      WHERE id = '${id}'
    `;

    const woResponse = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: woQuery },
        params: { limit: '1' },
      }
    );

    const workOrder = woResponse.items?.[0];

    if (!workOrder) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
    }

    // Query 2: Get all line items
    const lineQuery = `
      SELECT *
      FROM transactionline
      WHERE transaction = '${id}'
    `;

    const lineResponse = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: lineQuery },
        params: { limit: '1000' },
      }
    );

    return NextResponse.json({
      success: true,
      workOrder: {
        ...workOrder,
        _allFields: Object.keys(workOrder).sort(),
        _fieldCount: Object.keys(workOrder).length,
      },
      lineItems: lineResponse.items || [],
      lineItemFields: lineResponse.items?.[0] ? Object.keys(lineResponse.items[0]).sort() : [],
      summary: {
        id: workOrder.id,
        tranid: workOrder.tranid,
        type: workOrder.type,
        trandate: workOrder.trandate,
        status: workOrder.status,
        entity: workOrder.entity,
        totalLineItems: lineResponse.items?.length || 0,
      },
    });
  } catch (error) {
    console.error('Error fetching work order:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch work order',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
