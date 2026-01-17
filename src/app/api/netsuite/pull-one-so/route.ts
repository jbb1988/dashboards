/**
 * API Route: /api/netsuite/pull-one-so
 * Pull ONE sales order with ALL details to see actual structure
 */

import { NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const soNumber = url.searchParams.get('soNumber');

    // Step 1: Get one recent sales order (or specific one if provided)
    let soQuery = '';
    if (soNumber) {
      soQuery = `
        SELECT *
        FROM Transaction
        WHERE type = 'SalesOrd'
          AND tranid = '${soNumber.replace(/'/g, "''")}'
      `;
    } else {
      soQuery = `
        SELECT *
        FROM Transaction
        WHERE type = 'SalesOrd'
          AND trandate >= TO_DATE('2025-01-01', 'YYYY-MM-DD')
        ORDER BY trandate DESC
      `;
    }

    const soResponse = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: soQuery },
        params: { limit: '1' },
      }
    );

    const salesOrder = soResponse.items?.[0];
    if (!salesOrder) {
      return NextResponse.json({ error: 'No sales order found' }, { status: 404 });
    }

    // Step 2: Get ALL line items for this sales order
    const lineQuery = `
      SELECT *
      FROM TransactionLine
      WHERE transaction = '${salesOrder.id}'
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
      salesOrder: {
        ...salesOrder,
        _allFields: Object.keys(salesOrder).sort(),
      },
      lineItems: lineResponse.items || [],
      lineItemFields: lineResponse.items?.[0] ? Object.keys(lineResponse.items[0]).sort() : [],
      summary: {
        soId: salesOrder.id,
        soNumber: salesOrder.tranid,
        soDate: salesOrder.trandate,
        soType: salesOrder.type,
        soStatus: salesOrder.status,
        totalLineItems: lineResponse.items?.length || 0,
        allSOFields: Object.keys(salesOrder).length,
        allLineFields: lineResponse.items?.[0] ? Object.keys(lineResponse.items[0]).length : 0,
      },
    });
  } catch (error) {
    console.error('Error pulling sales order:', error);
    return NextResponse.json(
      {
        error: 'Failed to pull sales order',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
