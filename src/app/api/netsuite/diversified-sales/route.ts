import { NextRequest, NextResponse } from 'next/server';
import { getDiversifiedSales } from '@/lib/netsuite';

export const dynamic = 'force-dynamic';

// In-memory cache
let cachedData: { data: any; timestamp: number; key: string } | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const bust = searchParams.get('bust') === 'true';

    // Check cache
    const cacheKey = `diversified-sales-${limit}-${offset}-${startDate || ''}-${endDate || ''}`;
    const now = Date.now();
    if (!bust && cachedData && cachedData.key === cacheKey && (now - cachedData.timestamp) < CACHE_DURATION) {
      return NextResponse.json(cachedData.data);
    }

    // Fetch diversified sales from NetSuite
    const result = await getDiversifiedSales({
      limit,
      offset,
      startDate,
      endDate
    });

    const responseData = {
      records: result.records,
      total: result.total,
      hasMore: result.hasMore,
      limit,
      offset,
      filters: {
        startDate,
        endDate,
      },
      lastUpdated: new Date().toISOString(),
    };

    // Cache result
    cachedData = { data: responseData, timestamp: now, key: cacheKey };

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Error fetching NetSuite diversified sales:', error);
    return NextResponse.json({
      error: 'Failed to fetch diversified sales',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
