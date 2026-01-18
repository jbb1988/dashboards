import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get('year') || '2024';

  const supabase = getSupabaseAdmin();

  try {
    // Get ALL sales orders for the year (no class filter since most are NULL)
    const { data: salesOrders } = await supabase
      .from('netsuite_sales_orders')
      .select(`
        id,
        customer_name,
        so_number,
        so_date,
        class_name,
        netsuite_sales_order_lines (
          item_name,
          amount,
          quantity,
          rate
        )
      `)
      .gte('so_date', `${year}-01-01`)
      .lte('so_date', `${year}-12-31`)
      .order('customer_name');

    // Get work orders for the year
    const { data: workOrders } = await supabase
      .from('netsuite_work_orders')
      .select(`
        id,
        customer_name,
        wo_number,
        created_from_so_number,
        netsuite_work_order_lines (
          item_name,
          line_cost,
          quantity,
          unit_cost
        )
      `)
      .gte('wo_date', `${year}-01-01`)
      .lte('wo_date', `${year}-12-31`)
      .order('customer_name');

    // Process data by customer
    const projectMap = new Map();

    // Add sales order data
    for (const so of salesOrders || []) {
      const customer = so.customer_name;
      if (!projectMap.has(customer)) {
        projectMap.set(customer, {
          project_name: customer,
          sales_orders: [],
          work_orders: [],
          total_revenue: 0,
          total_costs: 0,
          so_line_count: 0,
          wo_line_count: 0,
          so_null_items: 0,
          wo_null_items: 0,
        });
      }

      const project = projectMap.get(customer);
      project.sales_orders.push(so.so_number);

      for (const line of so.netsuite_sales_order_lines || []) {
        project.so_line_count++;
        if (!line.item_name) project.so_null_items++;
        project.total_revenue += parseFloat(line.amount || 0);
      }
    }

    // Add work order data
    for (const wo of workOrders || []) {
      const customer = wo.customer_name;
      if (projectMap.has(customer)) {
        const project = projectMap.get(customer);
        project.work_orders.push(wo.wo_number);

        for (const line of wo.netsuite_work_order_lines || []) {
          project.wo_line_count++;
          if (!line.item_name) project.wo_null_items++;
          project.total_costs += parseFloat(line.line_cost || 0);
        }
      }
    }

    // Convert to array and calculate margins
    const results = Array.from(projectMap.values())
      .map(p => ({
        project_name: p.project_name,
        sales_orders: p.sales_orders.length,
        work_orders: p.work_orders.length,
        so_line_items: p.so_line_count,
        wo_line_items: p.wo_line_count,
        total_revenue: Math.round(p.total_revenue * 100) / 100,
        total_costs: Math.round(p.total_costs * 100) / 100,
        gross_profit: Math.round((p.total_revenue - p.total_costs) * 100) / 100,
        margin_pct: p.total_revenue > 0
          ? Math.round(((p.total_revenue - p.total_costs) / p.total_revenue) * 1000) / 10
          : 0,
        data_quality: {
          so_null_items: p.so_null_items,
          wo_null_items: p.wo_null_items,
          so_null_pct: p.so_line_count > 0 ? Math.round((p.so_null_items / p.so_line_count) * 100) : 0,
          wo_null_pct: p.wo_line_count > 0 ? Math.round((p.wo_null_items / p.wo_line_count) * 100) : 0,
        }
      }))
      .filter(p => p.total_revenue > 0)
      .sort((a, b) => b.total_revenue - a.total_revenue)
      .slice(0, 50);

    const summary = {
      year,
      total_projects: results.length,
      total_revenue: results.reduce((sum, p) => sum + p.total_revenue, 0),
      total_costs: results.reduce((sum, p) => sum + p.total_costs, 0),
      total_profit: results.reduce((sum, p) => sum + p.gross_profit, 0),
      avg_margin: results.length > 0
        ? results.reduce((sum, p) => sum + p.margin_pct, 0) / results.length
        : 0,
      data_quality_warning: results.some(p => p.data_quality.so_null_pct > 20 || p.data_quality.wo_null_pct > 20),
    };

    return NextResponse.json({
      success: true,
      year,
      summary,
      projects: results,
      warning: "Many line items have NULL item_name - data quality issue needs addressing",
    });
  } catch (error) {
    console.error('Board data error:', error);
    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    );
  }
}
