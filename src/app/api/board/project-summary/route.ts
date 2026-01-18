import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getSupabaseAdmin();

  try {
    // Board-ready project profitability summary
    const { data: projects, error } = await supabase.rpc('get_board_project_summary');

    if (error) {
      // If RPC doesn't exist, run the query directly
      const { data: directData, error: directError } = await supabase
        .from('netsuite_sales_orders')
        .select(`
          customer_name,
          id,
          so_date,
          class_name,
          netsuite_sales_order_lines (
            id,
            amount,
            item_name
          )
        `)
        .gte('so_date', '2024-01-01')
        .or('class_name.ilike.%TB%,class_name.ilike.%MCC%,class_name.ilike.%M3%');

      if (directError) throw directError;

      // Process the data
      const projectMap = new Map();

      for (const so of directData || []) {
        const project = so.customer_name;
        if (!projectMap.has(project)) {
          projectMap.set(project, {
            project_name: project,
            sales_orders: new Set(),
            so_line_items: 0,
            total_revenue: 0,
          });
        }

        const p = projectMap.get(project);
        p.sales_orders.add(so.id);

        for (const line of so.netsuite_sales_order_lines || []) {
          p.so_line_items++;
          p.total_revenue += parseFloat(line.amount || 0);
        }
      }

      // Now get work order data
      const { data: woData } = await supabase
        .from('netsuite_work_orders')
        .select(`
          id,
          customer_name,
          created_from_so_number,
          netsuite_work_order_lines (
            id,
            line_cost,
            item_name
          )
        `)
        .gte('wo_date', '2024-01-01');

      // Add work order data to projects
      for (const wo of woData || []) {
        const project = wo.customer_name;
        if (projectMap.has(project)) {
          const p = projectMap.get(project);
          if (!p.work_orders) p.work_orders = new Set();
          if (!p.wo_line_items) p.wo_line_items = 0;
          if (!p.total_component_costs) p.total_component_costs = 0;

          p.work_orders.add(wo.id);

          for (const line of wo.netsuite_work_order_lines || []) {
            p.wo_line_items++;
            p.total_component_costs += parseFloat(line.line_cost || 0);
          }
        }
      }

      // Convert to array and calculate margins
      const results = Array.from(projectMap.values())
        .map(p => ({
          project_name: p.project_name,
          sales_orders: p.sales_orders.size,
          work_orders: (p.work_orders || new Set()).size,
          so_line_items: p.so_line_items,
          wo_line_items: p.wo_line_items || 0,
          total_revenue: p.total_revenue,
          total_component_costs: p.total_component_costs || 0,
          gross_profit: p.total_revenue - (p.total_component_costs || 0),
          margin_pct: p.total_revenue > 0
            ? ((p.total_revenue - (p.total_component_costs || 0)) / p.total_revenue * 100)
            : 0,
        }))
        .filter(p => p.total_revenue > 0)
        .sort((a, b) => b.total_revenue - a.total_revenue)
        .slice(0, 20);

      return NextResponse.json({
        success: true,
        data: results,
        summary: {
          total_projects: results.length,
          total_revenue: results.reduce((sum, p) => sum + p.total_revenue, 0),
          total_costs: results.reduce((sum, p) => sum + p.total_component_costs, 0),
          total_profit: results.reduce((sum, p) => sum + p.gross_profit, 0),
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: projects,
    });
  } catch (error) {
    console.error('Board summary error:', error);
    return NextResponse.json(
      {
        success: false,
        error: String(error),
        message: 'Failed to generate board summary',
      },
      { status: 500 }
    );
  }
}
