import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getSupabaseAdmin();

  // Get WOs for Seattle
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
      status,
      total_actual_cost,
      netsuite_work_order_lines (
        line_number,
        item_name,
        line_cost,
        actual_cost,
        cost_estimate
      )
    `)
    .in('wo_number', woNumbers);

  const woSummary = (nsWOs || []).map((wo: any) => {
    const lines = wo.netsuite_work_order_lines || [];
    const totalLineCost = lines.reduce((sum: number, line: any) => sum + Math.abs(line.line_cost || 0), 0);
    const totalActualCost = lines.reduce((sum: number, line: any) => sum + Math.abs(line.actual_cost || 0), 0);
    const totalCostEstimate = lines.reduce((sum: number, line: any) => sum + Math.abs(line.cost_estimate || 0), 0);

    return {
      wo_number: wo.wo_number,
      status: wo.status,
      total_actual_cost: wo.total_actual_cost,
      calculated_line_cost: totalLineCost,
      calculated_actual_cost: totalActualCost,
      calculated_cost_estimate: totalCostEstimate,
      line_count: lines.length,
    };
  });

  const grandTotal = {
    totalLineCost: woSummary.reduce((sum, wo) => sum + wo.calculated_line_cost, 0),
    totalActualCost: woSummary.reduce((sum, wo) => sum + wo.calculated_actual_cost, 0),
    totalCostEstimate: woSummary.reduce((sum, wo) => sum + wo.calculated_cost_estimate, 0),
  };

  return NextResponse.json({
    woCount: woSummary.length,
    woSummary,
    grandTotal,
  });
}
