import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getSupabaseAdmin();

  // Get Seattle projects
  const { data: projects } = await supabase
    .from('closeout_projects')
    .select('id, project_name, project_year')
    .ilike('project_name', '%Seattle%')
    .gte('project_year', 2025);

  if (!projects || projects.length === 0) {
    return NextResponse.json({ error: 'No Seattle projects found' }, { status: 404 });
  }

  // Get work orders with actual costs from Excel
  const { data: workOrders } = await supabase
    .from('closeout_work_orders')
    .select('*')
    .in('closeout_project_id', projects.map(p => p.id));

  const summary = {
    projects: projects.length,
    workOrders: (workOrders || []).length,
    totalBudgetRevenue: (workOrders || []).reduce((sum, wo) => sum + (wo.budget_revenue || 0), 0),
    totalBudgetCost: (workOrders || []).reduce((sum, wo) => sum + (wo.budget_cost || 0), 0),
    totalActualRevenue: (workOrders || []).reduce((sum, wo) => sum + (wo.actual_revenue || 0), 0),
    totalActualCost: (workOrders || []).reduce((sum, wo) => sum + (wo.actual_cost || 0), 0),
    workOrderDetails: workOrders || [],
  };

  return NextResponse.json(summary);
}
