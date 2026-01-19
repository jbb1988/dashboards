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

    // Get all line items with zero cost but non-zero quantity
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

    // Filter for zero cost with quantity
    const zeroCostItems = (lines || [])
      .filter(line => {
        const quantity = parseFloat(String(line.quantity || 0));
        const lineCost = parseFloat(String(line.line_cost || 0));
        return Math.abs(lineCost) < 0.01 && Math.abs(quantity) > 0.01;
      })
      .map(line => ({
        wo: (line as any).netsuite_work_orders?.wo_number,
        item: line.item_name,
        type: line.item_type,
        qty: parseFloat(String(line.quantity || 0)),
      }))
      .sort((a, b) => a.wo.localeCompare(b.wo));

    const total = zeroCostItems.reduce((sum, item) => sum + Math.abs(item.qty), 0);

    return NextResponse.json({
      items: zeroCostItems,
      count: zeroCostItems.length,
      total: Math.round(total * 100) / 100,
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Failed',
      message: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
