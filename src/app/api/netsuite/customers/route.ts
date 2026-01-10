import { NextRequest, NextResponse } from 'next/server';
import { getCustomers, getCustomer } from '@/lib/netsuite';

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

    // If specific ID requested, fetch single customer
    if (id) {
      const customer = await getCustomer(id);
      return NextResponse.json({ customer });
    }

    // Check cache for list requests
    const cacheKey = `customers-${limit}-${offset}-${search || ''}`;
    const now = Date.now();
    if (!bust && cachedData && cachedData.timestamp && (now - cachedData.timestamp) < CACHE_DURATION) {
      return NextResponse.json(cachedData.data);
    }

    // Fetch customers from NetSuite
    const result = await getCustomers({ limit, offset, q: search });

    const responseData = {
      customers: result.customers,
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
    console.error('Error fetching NetSuite customers:', error);
    return NextResponse.json({
      error: 'Failed to fetch customers',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
