import { NextRequest, NextResponse } from 'next/server';

// Simple help analytics endpoint
// In production, this could log to a database, analytics service, etc.

interface HelpAnalyticsEvent {
  type: 'guide_view' | 'search' | 'ai_query' | 'feedback' | 'drawer_open' | 'drawer_close';
  data: Record<string, unknown>;
  timestamp: number;
}

export async function POST(request: NextRequest) {
  try {
    const event: HelpAnalyticsEvent = await request.json();

    // Log the event (in production, send to analytics service)
    console.log('[Help Analytics]', {
      type: event.type,
      data: event.data,
      timestamp: new Date(event.timestamp).toISOString(),
    });

    // Here you could:
    // - Store in database (Supabase, etc.)
    // - Send to analytics service (Mixpanel, Amplitude, etc.)
    // - Log to external service

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Help Analytics] Error:', error);
    // Don't fail the request - analytics should never break the app
    return NextResponse.json({ success: false });
  }
}
