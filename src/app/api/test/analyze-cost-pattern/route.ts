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

    // Get all line items
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

    // Analyze pattern: when is quantity used vs line_cost?
    const patterns = {
      zero_cost_with_qty: [] as any[],
      non_zero_cost_with_qty: [] as any[],
      zero_cost_zero_qty: [] as any[],
    };

    for (const line of lines || []) {
      const itemName = line.item_name || '';
      const quantity = parseFloat(String(line.quantity || 0));
      const lineCost = parseFloat(String(line.line_cost || 0));

      if (Math.abs(lineCost) < 0.01 && Math.abs(quantity) > 0.01) {
        // Cost is zero but quantity has value
        patterns.zero_cost_with_qty.push({
          item: itemName,
          type: line.item_type,
          qty: quantity,
          cost: lineCost,
        });
      } else if (Math.abs(lineCost) > 0.01 && Math.abs(quantity) > 0.01) {
        // Both have values
        patterns.non_zero_cost_with_qty.push({
          item: itemName,
          type: line.item_type,
          qty: quantity,
          cost: lineCost,
        });
      } else if (Math.abs(lineCost) < 0.01 && Math.abs(quantity) < 0.01) {
        // Both are zero
        patterns.zero_cost_zero_qty.push({
          item: itemName,
          type: line.item_type,
        });
      }
    }

    // Calculate what we'd get with each approach
    const approach1_name_based = lines?.reduce((sum, line) => {
      const itemName = line.item_name || '';
      const quantity = parseFloat(String(line.quantity || 0));
      const lineCost = parseFloat(String(line.line_cost || 0));

      if (itemName.includes('Expense Report') ||
          itemName.includes('-MATERIAL') ||
          itemName.includes('-FREIGHT')) {
        return sum + Math.abs(quantity);
      }
      return sum + Math.abs(lineCost);
    }, 0);

    const approach2_zero_cost_check = lines?.reduce((sum, line) => {
      const quantity = parseFloat(String(line.quantity || 0));
      const lineCost = parseFloat(String(line.line_cost || 0));

      // If line_cost is zero/negligible but quantity has value, use quantity
      if (Math.abs(lineCost) < 0.01 && Math.abs(quantity) > 0.01) {
        return sum + Math.abs(quantity);
      }
      // Otherwise use line_cost
      return sum + Math.abs(lineCost);
    }, 0);

    return NextResponse.json({
      patterns: {
        zero_cost_with_qty: {
          count: patterns.zero_cost_with_qty.length,
          total_qty: patterns.zero_cost_with_qty.reduce((s, l) => s + Math.abs(l.qty), 0),
          samples: patterns.zero_cost_with_qty.slice(0, 5),
        },
        non_zero_cost_with_qty: {
          count: patterns.non_zero_cost_with_qty.length,
          samples: patterns.non_zero_cost_with_qty.slice(0, 5),
        },
        zero_cost_zero_qty: {
          count: patterns.zero_cost_zero_qty.length,
        },
      },
      totals: {
        approach1_name_based: Math.round(approach1_name_based || 0),
        approach2_zero_cost_check: Math.round(approach2_zero_cost_check || 0),
        excel_target: 34852,
      },
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Failed',
      message: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
