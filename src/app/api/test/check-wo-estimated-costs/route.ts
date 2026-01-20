import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Check if work order lines have estimated cost data
 */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    // Sample some work order lines to check cost_estimate field
    const { data: woLines, error } = await supabase
      .from('netsuite_work_order_lines')
      .select('id, work_order_id, item_name, cost_estimate, line_cost, quantity')
      .not('cost_estimate', 'is', null)
      .limit(100);

    if (error) throw error;

    const analysis = {
      totalSampled: woLines?.length || 0,
      withEstimatedCost: woLines?.filter(l => (l.cost_estimate || 0) !== 0).length || 0,
      withZeroEstimatedCost: woLines?.filter(l => (l.cost_estimate || 0) === 0).length || 0,
      samples: woLines?.slice(0, 10).map(l => ({
        itemName: l.item_name,
        costEstimate: l.cost_estimate,
        lineCost: l.line_cost,
        quantity: l.quantity,
      })),
    };

    // Check aggregates
    const { data: aggregates } = await supabase
      .from('netsuite_work_order_lines')
      .select('cost_estimate, line_cost')
      .limit(1000);

    const stats = {
      totalLines: aggregates?.length || 0,
      nonZeroEstimatedCost: aggregates?.filter(l => (l.cost_estimate || 0) !== 0).length || 0,
      nonZeroLineCost: aggregates?.filter(l => (l.line_cost || 0) !== 0).length || 0,
      percentWithEstimatedCost: aggregates
        ? ((aggregates.filter(l => (l.cost_estimate || 0) !== 0).length / aggregates.length) * 100).toFixed(1) + '%'
        : '0%',
    };

    return NextResponse.json({
      analysis,
      stats,
      recommendation:
        stats.nonZeroEstimatedCost === 0
          ? 'REMOVE - No work orders have estimated cost data'
          : `KEEP - ${stats.percentWithEstimatedCost} of work orders have estimated cost`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Check failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
