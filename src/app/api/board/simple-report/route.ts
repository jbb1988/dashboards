import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get('year') || '2025';

  const supabase = getSupabaseAdmin();

  try {
    // Get ALL 2025 sales orders (use range to override default 1000 limit)
    const { data: salesOrders } = await supabase
      .from('netsuite_sales_orders')
      .select('id, customer_name, so_number, so_date')
      .gte('so_date', `${year}-01-01`)
      .lte('so_date', `${year}-12-31`)
      .range(0, 9999); // Get up to 10k records

    console.log(`Found ${salesOrders?.length || 0} SOs for ${year}`);

    // Get ALL lines for these SOs
    const soIds = (salesOrders || []).map(so => so.id);

    const { data: allLines } = await supabase
      .from('netsuite_sales_order_lines')
      .select('sales_order_id, item_name, amount, quantity')
      .in('sales_order_id', soIds)
      .range(0, 49999); // Get up to 50k lines

    console.log(`Found ${allLines?.length || 0} lines for these SOs`);

    // Group by customer
    const projectMap = new Map();

    for (const so of salesOrders || []) {
      const customer = so.customer_name;
      if (!projectMap.has(customer)) {
        projectMap.set(customer, {
          project_name: customer,
          total_revenue: 0,
          line_count: 0,
          so_count: 0,
        });
      }

      const project = projectMap.get(customer);
      project.so_count++;

      // Find lines for this SO
      const soLines = (allLines || []).filter(l => l.sales_order_id === so.id);

      for (const line of soLines) {
        project.line_count++;
        project.total_revenue += parseFloat(line.amount || 0);
      }
    }

    const projects = Array.from(projectMap.values())
      .filter(p => p.total_revenue !== 0)
      .sort((a, b) => Math.abs(b.total_revenue) - Math.abs(a.total_revenue))
      .slice(0, 50);

    const summary = {
      year,
      total_projects: projects.length,
      total_sos: salesOrders?.length || 0,
      total_lines: allLines?.length || 0,
      total_revenue: projects.reduce((sum, p) => sum + p.total_revenue, 0),
    };

    return NextResponse.json({
      success: true,
      summary,
      projects,
    });
  } catch (error) {
    console.error('Board report error:', error);
    return NextResponse.json({
      success: false,
      error: String(error),
    }, { status: 500 });
  }
}
