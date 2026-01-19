import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getSupabaseAdmin();

  // First find WOs linked to Seattle project
  const { data: excelProjects } = await supabase
    .from('closeout_projects')
    .select('id, project_name, project_year')
    .ilike('project_name', '%Seattle%')
    .gte('project_year', 2025);

  if (!excelProjects || excelProjects.length === 0) {
    return NextResponse.json({ error: 'Seattle project not found' }, { status: 404 });
  }

  const { data: excelWOs } = await supabase
    .from('closeout_work_orders')
    .select('wo_number, closeout_project_id')
    .in('closeout_project_id', excelProjects.map(p => p.id))
    .not('wo_number', 'is', null)
    .neq('wo_number', '');

  const woNumbers = [...new Set((excelWOs || []).map(wo => `WO${wo.wo_number}`))];

  // Get NetSuite WOs with line items
  const { data: nsWOs } = await supabase
    .from('netsuite_work_orders')
    .select(`
      wo_number,
      status,
      total_actual_cost,
      created_from_so_number,
      netsuite_work_order_lines (
        line_number,
        item_name,
        quantity,
        quantity_completed,
        unit_cost,
        line_cost,
        cost_estimate,
        actual_cost
      )
    `)
    .in('wo_number', woNumbers);

  // Also get SO line cost estimates
  const { data: soLines } = await supabase
    .from('netsuite_sales_orders')
    .select(`
      so_number,
      netsuite_sales_order_lines (
        line_number,
        item_name,
        amount,
        cost_estimate,
        account_number
      )
    `)
    .eq('so_number', 'SO7150');

  return NextResponse.json({
    excelProjects,
    woNumbers,
    workOrders: nsWOs || [],
    soLineEstimates: soLines?.[0]?.netsuite_sales_order_lines || [],
  });
}
