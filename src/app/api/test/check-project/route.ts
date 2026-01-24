import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: Request) {
  const supabase = getSupabaseAdmin();

  // Get project name from query params
  const { searchParams } = new URL(request.url);
  const projectName = searchParams.get('name');

  if (!projectName) {
    return NextResponse.json({ error: 'Missing "name" query parameter' }, { status: 400 });
  }

  try {
    // Search for any project with matching name
    const { data: projects, error } = await supabase
      .from('closeout_projects')
      .select('*')
      .ilike('project_name', `%${projectName}%`)
      .order('project_year', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      search: projectName,
      count: projects?.length || 0,
      projects: projects?.map(p => ({
        id: p.id,
        project_name: p.project_name,
        project_year: p.project_year,
        project_month: p.project_month,
        project_type: p.project_type,
        actual_revenue: p.actual_revenue,
        actual_cost: p.actual_cost,
        budget_revenue: p.budget_revenue,
        budget_cost: p.budget_cost,
        variance: p.variance,
        actual_gp_pct: p.actual_gp_pct,
        netsuite_enriched: p.netsuite_enriched,
        created_at: p.created_at,
        updated_at: p.updated_at,
      })) || [],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
