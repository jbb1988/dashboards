// Simple analytics tracking for help system events
// Tracks guide views, searches, AI queries, and feedback

export type HelpEventType = 'guide_view' | 'search' | 'ai_query' | 'feedback' | 'drawer_open' | 'drawer_close';

export interface HelpEvent {
  type: HelpEventType;
  data: Record<string, unknown>;
  timestamp?: number;
}

// Track a help event
export function trackHelpEvent(event: HelpEvent): void {
  const eventWithTimestamp = {
    ...event,
    timestamp: event.timestamp || Date.now(),
  };

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[Help Analytics]', eventWithTimestamp);
  }

  // Fire and forget - send to analytics endpoint in production
  if (typeof window !== 'undefined') {
    fetch('/api/analytics/help', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventWithTimestamp),
    }).catch(() => {
      // Silently fail - analytics should never break the app
    });
  }
}

// Convenience functions for common events
export function trackGuideView(guideId: string, guideTitle: string, category: string): void {
  trackHelpEvent({
    type: 'guide_view',
    data: { guideId, guideTitle, category },
  });
}

export function trackSearch(query: string, resultCount: number): void {
  trackHelpEvent({
    type: 'search',
    data: { query, resultCount },
  });
}

export function trackAIQuery(message: string, responseLength: number): void {
  trackHelpEvent({
    type: 'ai_query',
    data: {
      messageLength: message.length,
      responseLength,
      messagePreview: message.substring(0, 50), // Only first 50 chars for privacy
    },
  });
}

export function trackFeedback(helpful: boolean, guideId?: string, comment?: string): void {
  trackHelpEvent({
    type: 'feedback',
    data: {
      helpful,
      guideId,
      hasComment: !!comment,
    },
  });
}

export function trackDrawerOpen(page: string): void {
  trackHelpEvent({
    type: 'drawer_open',
    data: { page },
  });
}

export function trackDrawerClose(durationMs: number): void {
  trackHelpEvent({
    type: 'drawer_close',
    data: { durationMs },
  });
}
