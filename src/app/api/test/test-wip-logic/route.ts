import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

/**
 * Test WIP report logic on Seattle work orders
 * Using the exact formulas from the saved search
 */
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

    // Apply WIP report formulas
    const laborItems = [
      'Maintenance Calibration / Certification Labor',
      'Assembly Labor', 'Electrical Labor', 'Fab Labor', 'Fab Tank Labor',
      'CA Maintenance Calibration / Certification Labor',
      'Hardware Install & Training Labor', 'Crating & Shipping Labor',
      'Service Call Labor', 'Software Install & Training Labor',
      'Saw Labor', 'Test Labor'
    ];

    const overheadItems = [
      'Assembly Overhead', 'Crating & Shipping Overhead',
      'Electrical Overhead', 'Fab Overhead', 'Fab Tank Overhead',
      'Hardware Install & Training Overhead',
      'Maintenance Calibration / Certification Overhead',
      'Saw Overhead', 'Service Call Overhead',
      'Overhead - Software Install & Training', 'Test OH'
    ];

    const expenseItems = [
      'Test Bench Expense Report',
      'Test Bench Outside Services'
    ];

    const freightItems = [
      'Test Bench Crating & Shipping-FREIGHT',
      'Test Bench Crating & Shipping-MATERIAL'
    ];

    const miscMaterialItems = [
      'Test Bench Misc Material',
      'Non Stock Purchases'
    ];

    const costs = {
      labor_hours: 0,
      labor_cost: 0,
      expense_cost: 0,
      material_cost: 0,
      freight_cost: 0,
    };

    for (const line of lines || []) {
      const itemName = line.item_name || '';
      const itemType = line.item_type || '';
      const quantity = parseFloat(String(line.quantity || 0));
      const amount = parseFloat(String(line.line_cost || 0));

      // Labor Hours - use quantity
      if (laborItems.includes(itemName)) {
        costs.labor_hours += Math.abs(quantity);
      }

      // Labor $ - labor items + overhead items, use amount
      if (laborItems.includes(itemName) || overheadItems.includes(itemName)) {
        costs.labor_cost += Math.abs(amount);
      }

      // Expense Report $ - use amount
      if (expenseItems.includes(itemName)) {
        costs.expense_cost += Math.abs(amount);
      }

      // Material $ - Assembly, InvtPart, NonInvtPart OR misc material items
      if (['Assembly', 'InvtPart', 'NonInvtPart'].includes(itemType) ||
          miscMaterialItems.includes(itemName)) {
        costs.material_cost += Math.abs(amount);
      }

      // Freight $ - use amount
      if (freightItems.includes(itemName)) {
        costs.freight_cost += Math.abs(amount);
      }
    }

    const total_cost = costs.labor_cost + costs.expense_cost + costs.material_cost + costs.freight_cost;

    return NextResponse.json({
      wip_logic: {
        labor_hours: Math.round(costs.labor_hours * 100) / 100,
        labor_cost: Math.round(costs.labor_cost * 100) / 100,
        expense_cost: Math.round(costs.expense_cost * 100) / 100,
        material_cost: Math.round(costs.material_cost * 100) / 100,
        freight_cost: Math.round(costs.freight_cost * 100) / 100,
        total_cost: Math.round(total_cost * 100) / 100,
      },
      excel_target: {
        material: 17800,
        labor_oh: 7074,
        exp_rpts: 7281,
        shipping: 1797,
        total: 34852,
      },
      current_logic: {
        material: 18752,
        labor_oh: 7256,
        exp_rpts: 6989,
        shipping: 1798,
        total: 34795,
      },
      note: 'WIP report uses {amount} field (line_cost), not quantity for expense/freight items',
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Failed',
      message: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
