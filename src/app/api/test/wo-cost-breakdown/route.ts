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

    // Calculate costs using the correct fields:
    // - Material (InvtPart, Assembly): use line_cost
    // - Labor/Overhead (OthCharge with Labor/Overhead): use line_cost
    // - Expense Reports (OthCharge with "Expense Report"): use QUANTITY (absolute value)
    // - Shipping (OthCharge with "MATERIAL" or "FREIGHT"): use QUANTITY (absolute value)

    const costBreakdown = {
      material: { items: [] as any[], total: 0 },
      labor_overhead: { items: [] as any[], total: 0 },
      expense_reports: { items: [] as any[], total: 0 },
      shipping: { items: [] as any[], total: 0 },
    };

    for (const line of lines || []) {
      const itemName = line.item_name || '';
      const itemType = line.item_type || '';
      const quantity = parseFloat(String(line.quantity || 0));
      const lineCost = parseFloat(String(line.line_cost || 0));
      const woNumber = (line as any).netsuite_work_orders?.wo_number || '';

      if (itemType === 'InvtPart' || itemType === 'Assembly') {
        // Material costs from line_cost
        const cost = Math.abs(lineCost);
        costBreakdown.material.items.push({
          wo: woNumber,
          item: itemName,
          type: itemType,
          cost,
        });
        costBreakdown.material.total += cost;
      } else if (itemType === 'OthCharge') {
        if (itemName.includes('Expense Report')) {
          // Expense reports from quantity field
          const cost = Math.abs(quantity);
          costBreakdown.expense_reports.items.push({
            wo: woNumber,
            item: itemName,
            cost,
          });
          costBreakdown.expense_reports.total += cost;
        } else if (itemName.includes('-MATERIAL') || itemName.includes('-FREIGHT')) {
          // Shipping from quantity field
          const cost = Math.abs(quantity);
          costBreakdown.shipping.items.push({
            wo: woNumber,
            item: itemName,
            cost,
          });
          costBreakdown.shipping.total += cost;
        } else {
          // Labor and Overhead from line_cost
          const cost = Math.abs(lineCost);
          if (cost > 0) {
            costBreakdown.labor_overhead.items.push({
              wo: woNumber,
              item: itemName,
              cost,
            });
            costBreakdown.labor_overhead.total += cost;
          }
        }
      }
    }

    const grandTotal =
      costBreakdown.material.total +
      costBreakdown.labor_overhead.total +
      costBreakdown.expense_reports.total +
      costBreakdown.shipping.total;

    return NextResponse.json({
      breakdown: {
        material: {
          total: Math.round(costBreakdown.material.total * 100) / 100,
          count: costBreakdown.material.items.length,
        },
        labor_overhead: {
          total: Math.round(costBreakdown.labor_overhead.total * 100) / 100,
          count: costBreakdown.labor_overhead.items.length,
        },
        expense_reports: {
          total: Math.round(costBreakdown.expense_reports.total * 100) / 100,
          count: costBreakdown.expense_reports.items.length,
        },
        shipping: {
          total: Math.round(costBreakdown.shipping.total * 100) / 100,
          count: costBreakdown.shipping.items.length,
        },
      },
      grandTotal: Math.round(grandTotal * 100) / 100,
      excelComparison: {
        material: { netsuite: Math.round(costBreakdown.material.total), excel: 17800 },
        labor_oh: { netsuite: Math.round(costBreakdown.labor_overhead.total), excel: 7074 },
        exp_rpts: { netsuite: Math.round(costBreakdown.expense_reports.total), excel: 7281 },
        shipping: { netsuite: Math.round(costBreakdown.shipping.total), excel: 1797 },
        total: { netsuite: Math.round(grandTotal), excel: 34852 },
      },
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Failed',
      message: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
