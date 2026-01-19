import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getSupabaseAdmin();

  const { data: excelProjects } = await supabase
    .from('closeout_projects')
    .select('id')
    .ilike('project_name', '%Seattle%')
    .gte('project_year', 2025);

  const { data: excelWOs } = await supabase
    .from('closeout_work_orders')
    .select('wo_number')
    .in('closeout_project_id', (excelProjects || []).map(p => p.id))
    .not('wo_number', 'is', null);

  const woNumbers = [...new Set((excelWOs || []).map(wo => `WO${wo.wo_number}`))];

  const { data: nsWOs } = await supabase
    .from('netsuite_work_orders')
    .select(`
      wo_number,
      netsuite_work_order_lines (
        item_name,
        line_cost
      )
    `)
    .in('wo_number', woNumbers);

  let materialCost = 0;
  let laborCost = 0;
  let expenseCost = 0;
  let otherCost = 0;

  for (const wo of nsWOs || []) {
    for (const line of wo.netsuite_work_order_lines || []) {
      const cost = Math.abs(line.line_cost || 0);
      const itemName = (line.item_name || '').toLowerCase();

      if (itemName.includes('labor')) {
        laborCost += cost;
      } else if (itemName.includes('expense')) {
        expenseCost += cost;
      } else {
        // Material and other items
        materialCost += cost;
      }
    }
  }

  const totalCost = materialCost + laborCost + expenseCost + otherCost;

  return NextResponse.json({
    materialCost,
    laborCost,
    expenseCost,
    otherCost,
    totalCost,
    excelActualCost: 34852,
    gap: 34852 - totalCost,
  });
}
