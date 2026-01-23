import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const supabase = getSupabaseAdmin();

  try {
    // Get Fairfax 2025 work orders with line items
    const { data: workOrders } = await supabase
      .from('netsuite_work_orders')
      .select(`
        *,
        netsuite_work_order_lines(*)
      `)
      .ilike('linked_so_number', 'SO3009');

    if (!workOrders || workOrders.length === 0) {
      return NextResponse.json({ error: 'No work orders found for SO3009' }, { status: 404 });
    }

    const costBreakdown: any[] = [];
    let totalCostStandard = 0;
    let totalCostOthCharge = 0;

    for (const wo of workOrders) {
      const lines = wo.netsuite_work_order_lines || [];

      let woCostStandard = 0;
      let woCostOthCharge = 0;
      const othChargeLines: any[] = [];

      for (const line of lines) {
        const itemType = line.item_type || '';

        if (itemType === 'OthCharge') {
          // For OthCharge items, cost is stored in quantity field (negative = cost)
          const quantity = parseFloat(line.quantity) || 0;
          const costAmount = quantity < 0 ? Math.abs(quantity) : 0;

          if (costAmount > 0) {
            woCostOthCharge += costAmount;
            othChargeLines.push({
              item_name: line.item_name,
              quantity: quantity,
              cost: costAmount,
            });
          }
        } else {
          // For standard items, use line_cost
          const lineCost = parseFloat(line.line_cost) || 0;
          woCostStandard += lineCost;
        }
      }

      totalCostStandard += woCostStandard;
      totalCostOthCharge += woCostOthCharge;

      costBreakdown.push({
        wo_number: wo.wo_number,
        total_lines: lines.length,
        cost_standard: woCostStandard,
        cost_othcharge: woCostOthCharge,
        cost_total: woCostStandard + woCostOthCharge,
        othcharge_detail: othChargeLines.slice(0, 5), // Show first 5
      });
    }

    return NextResponse.json({
      work_order_count: workOrders.length,
      total_cost_standard_items: totalCostStandard,
      total_cost_othcharge_items: totalCostOthCharge,
      total_cost_all: totalCostStandard + totalCostOthCharge,
      breakdown: costBreakdown,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
