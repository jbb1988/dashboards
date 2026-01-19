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

    // Test different approaches
    const approaches = {
      current_name_based: 0,
      zero_cost_check: 0,
      hybrid: 0,
    };

    for (const line of lines || []) {
      const itemName = line.item_name || '';
      const itemType = line.item_type || '';
      const quantity = parseFloat(String(line.quantity || 0));
      const lineCost = parseFloat(String(line.line_cost || 0));

      // Approach 1: Current name-based
      if (itemName.includes('Expense Report') ||
          itemName.includes('-MATERIAL') ||
          itemName.includes('-FREIGHT')) {
        approaches.current_name_based += Math.abs(quantity);
      } else {
        approaches.current_name_based += Math.abs(lineCost);
      }

      // Approach 2: Zero cost check
      if (Math.abs(lineCost) < 0.01 && Math.abs(quantity) > 0.01) {
        approaches.zero_cost_check += Math.abs(quantity);
      } else {
        approaches.zero_cost_check += Math.abs(lineCost);
      }

      // Approach 3: Hybrid - OthCharge with zero cost and quantity > 1
      if (itemType === 'OthCharge' &&
          Math.abs(lineCost) < 0.01 &&
          Math.abs(quantity) > 1.0) {
        approaches.hybrid += Math.abs(quantity);
      } else {
        approaches.hybrid += Math.abs(lineCost);
      }
    }

    return NextResponse.json({
      approaches: {
        current_name_based: Math.round(approaches.current_name_based),
        zero_cost_check: Math.round(approaches.zero_cost_check),
        hybrid_othcharge_qty_gt_1: Math.round(approaches.hybrid),
      },
      excel_target: 34852,
      differences: {
        current: Math.round(approaches.current_name_based) - 34852,
        zero_cost: Math.round(approaches.zero_cost_check) - 34852,
        hybrid: Math.round(approaches.hybrid) - 34852,
      },
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Failed',
      message: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
