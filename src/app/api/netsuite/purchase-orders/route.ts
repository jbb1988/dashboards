import { NextRequest, NextResponse } from 'next/server';
import { getPurchaseOrders, getPurchaseOrder } from '@/lib/netsuite';

export const dynamic = 'force-dynamic';

// In-memory cache
let cachedData: { data: any; timestamp: number } | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const search = searchParams.get('q') || undefined;
    const bust = searchParams.get('bust') === 'true';

    // If specific ID requested, fetch single PO
    if (id) {
      const purchaseOrder = await getPurchaseOrder(id);
      return NextResponse.json({ purchaseOrder });
    }

    // Check cache for list requests
    const cacheKey = `purchase-orders-${limit}-${offset}-${search || ''}`;
    const now = Date.now();
    if (!bust && cachedData && cachedData.timestamp && (now - cachedData.timestamp) < CACHE_DURATION) {
      return NextResponse.json(cachedData.data);
    }

    // Fetch purchase orders from NetSuite
    const result = await getPurchaseOrders({ limit, offset, q: search });

    const responseData = {
      purchaseOrders: result.purchaseOrders,
      total: result.total,
      hasMore: result.hasMore,
      limit,
      offset,
      lastUpdated: new Date().toISOString(),
    };

    // Cache result
    cachedData = { data: responseData, timestamp: now };

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Error fetching NetSuite purchase orders:', error);
    return NextResponse.json({
      error: 'Failed to fetch purchase orders',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
