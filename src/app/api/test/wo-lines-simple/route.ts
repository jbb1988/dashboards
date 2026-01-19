import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const woNumbers = ['WO5967', 'WO5968', 'WO5969', 'WO5970', 'WO5971', 'WO5973', 'WO5974', 'WO6583'];

    // Get all line items for these WOs (join with work_orders to get wo_number)
    const { data: lines, error } = await supabase
      .from('netsuite_work_order_lines')
      .select(`
        item_name,
        item_type,
        quantity,
        line_cost,
        netsuite_work_orders!inner(wo_number)
      `)
      .in('netsuite_work_orders.wo_number', woNumbers);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Calculate total line_cost
    const total = (lines || []).reduce((sum, line) => {
      const cost = parseFloat(String(line.line_cost || 0));
      return sum + Math.abs(cost);
    }, 0);

    return NextResponse.json({
      lines: lines || [],
      count: (lines || []).length,
      totalLineCost: total,
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Failed',
      message: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
