import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const supabase = getSupabaseAdmin();

  try {
    // Get Fairfax 2025 from closeout_projects
    const { data: project } = await supabase
      .from('closeout_projects')
      .select('*')
      .ilike('project_name', '%fairfax%')
      .eq('project_year', 2025)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Fairfax 2025 not found' }, { status: 404 });
    }

    // Get work orders
    const { data: workOrders } = await supabase
      .from('closeout_work_orders')
      .select('*')
      .eq('project_id', project.id);

    return NextResponse.json({
      project: {
        id: project.id,
        project_name: project.project_name,
        project_year: project.project_year,
        project_month: project.project_month,
        actual_revenue: project.actual_revenue,
        actual_cost: project.actual_cost,
        budget_revenue: project.budget_revenue,
        budget_cost: project.budget_cost,
        variance: project.variance,
        actual_gp_pct: project.actual_gp_pct,
      },
      workOrders: workOrders?.map(wo => ({
        wo_number: wo.wo_number,
        description: wo.description,
        actual_revenue: wo.actual_revenue,
        actual_cost: wo.actual_cost,
        variance: wo.variance,
      })) || [],
      totalWOCost: workOrders?.reduce((sum, wo) => sum + (wo.actual_cost || 0), 0) || 0,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
