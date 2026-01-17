/**
 * API Route: /api/netsuite/get-work-orders
 * Get work orders using correct lowercase 'workorder' record type
 */

import { NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const woNumber = url.searchParams.get('woNumber');

    console.log('Fetching work orders from REST Record API...');

    let response: any;

    if (woNumber) {
      // Try to get specific WO by ID/number
      console.log(`Searching for specific WO: ${woNumber}`);
      response = await netsuiteRequest<any>(
        '/services/rest/record/v1/workorder',
        {
          method: 'GET',
          params: {
            q: `tranid IS "${woNumber}"`,
            limit: '5',
          },
        }
      );
    } else {
      // Get all WOs
      response = await netsuiteRequest<any>(
        '/services/rest/record/v1/workorder',
        {
          method: 'GET',
          params: {
            limit: limit.toString(),
            offset: '0',
          },
        }
      );
    }

    console.log(`Found ${response.items?.length || 0} work orders`);

    return NextResponse.json({
      success: true,
      count: response.count || 0,
      totalResults: response.totalResults || 0,
      hasMore: response.hasMore || false,
      workOrders: response.items || [],
      firstWorkOrderFields: response.items?.[0] ? Object.keys(response.items[0]).sort() : [],
    });
  } catch (error) {
    console.error('Error fetching work orders:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch work orders',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
