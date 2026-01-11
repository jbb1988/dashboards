import { NextResponse } from 'next/server';
import { classifyCustomerBehavior } from '@/lib/insights';

export const dynamic = 'force-dynamic';

/**
 * GET - Fetch customer segment distribution
 * Returns counts and examples for each behavioral segment
 */
export async function GET() {
  try {
    const behaviors = await classifyCustomerBehavior();

    // Calculate segment distribution
    const segmentCounts: Record<string, number> = {};
    const focusCounts: Record<string, number> = {};
    const eligibilityCounts = {
      attrition_eligible: 0,
      cross_sell_eligible: 0,
      repeat_order_eligible: 0,
    };

    for (const b of behaviors) {
      // Count segments
      segmentCounts[b.segment] = (segmentCounts[b.segment] || 0) + 1;

      // Count product focus
      focusCounts[b.product_focus] = (focusCounts[b.product_focus] || 0) + 1;

      // Count eligibility
      if (b.attrition_eligible) eligibilityCounts.attrition_eligible++;
      if (b.cross_sell_eligible) eligibilityCounts.cross_sell_eligible++;
      if (b.repeat_order_eligible) eligibilityCounts.repeat_order_eligible++;
    }

    // Get top examples for each segment
    const segmentExamples: Record<string, string[]> = {};
    for (const segment of Object.keys(segmentCounts)) {
      segmentExamples[segment] = behaviors
        .filter(b => b.segment === segment)
        .sort((a, b) => b.total_revenue_24mo - a.total_revenue_24mo)
        .slice(0, 3)
        .map(b => b.customer_name);
    }

    return NextResponse.json({
      total_customers: behaviors.length,
      segments: segmentCounts,
      product_focus: focusCounts,
      eligibility: eligibilityCounts,
      examples: segmentExamples,
      generated_at: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error fetching segments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch segments', segments: {} },
      { status: 500 }
    );
  }
}
