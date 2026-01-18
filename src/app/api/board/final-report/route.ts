import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get('year') || '2025';

  const supabase = getSupabaseAdmin();

  try {
    // Paginate to get ALL sales orders (Supabase defaults to 1000 row limit)
    let allSalesOrders: any[] = [];
    let page = 0;
    const PAGE_SIZE = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('netsuite_sales_orders')
        .select('id, customer_name, so_number, so_date')
        .gte('so_date', `${year}-01-01`)
        .lte('so_date', `${year}-12-31`)
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) throw error;

      allSalesOrders = allSalesOrders.concat(data || []);
      hasMore = (data?.length || 0) === PAGE_SIZE;
      page++;
    }

    console.log(`Fetched ${allSalesOrders.length} SOs for ${year}`);

    // Get ALL lines (paginate)
    let allLines: any[] = [];
    page = 0;
    hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('netsuite_sales_order_lines')
        .select('sales_order_id, item_name, amount, quantity')
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) throw error;

      allLines = allLines.concat(data || []);
      hasMore = (data?.length || 0) === PAGE_SIZE;
      page++;
    }

    console.log(`Fetched ${allLines.length} total lines`);

    // Filter lines to only those for our year's SOs
    const soIds = new Set(allSalesOrders.map(so => so.id));
    const yearLines = allLines.filter(line => soIds.has(line.sales_order_id));

    console.log(`${yearLines.length} lines match ${year} SOs`);

    // Group by customer
    const projectMap = new Map();

    for (const so of allSalesOrders) {
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
      const soLines = yearLines.filter(l => l.sales_order_id === so.id);

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
      total_sos: allSalesOrders.length,
      total_lines: yearLines.length,
      total_revenue: projects.reduce((sum, p) => sum + p.total_revenue, 0),
    };

    // Get line item details with revenue dates for top 10 projects
    const topProjectCustomers = projects.slice(0, 10).map(p => p.project_name);

    const { data: topProjectLines } = await supabase
      .from('netsuite_sales_order_lines')
      .select(`
        item_name,
        item_description,
        amount,
        revrecstartdate,
        revrecenddate,
        netsuite_sales_orders!inner(customer_name, so_number)
      `)
      .in('netsuite_sales_orders.customer_name', topProjectCustomers)
      .gte('amount', 1000) // Only material line items
      .order('amount', { ascending: false })
      .limit(100);

    // Enrich with future revenue indicators
    const currentYear = parseInt(year);
    const lineItemPreview = (topProjectLines || []).map((l: any) => {
      let hasFutureRevenue = 'No';
      let revenueYears = 'N/A';

      if (l.revrecstartdate && l.revrecenddate) {
        const startYear = new Date(l.revrecstartdate).getFullYear();
        const endYear = new Date(l.revrecenddate).getFullYear();

        if (endYear > currentYear) {
          hasFutureRevenue = 'Yes';
        }

        revenueYears = `${startYear}`;
        if (startYear !== endYear) {
          revenueYears += `-${endYear}`;
        }
      }

      const salesOrder = Array.isArray(l.netsuite_sales_orders)
        ? l.netsuite_sales_orders[0]
        : l.netsuite_sales_orders;

      return {
        customer: salesOrder?.customer_name,
        so_number: salesOrder?.so_number,
        item: l.item_name,
        item_description: l.item_description,
        amount: l.amount,
        future_revenue: hasFutureRevenue,
        revenue_years: revenueYears,
      };
    });

    const futureRevenueCount = lineItemPreview.filter(l => l.future_revenue === 'Yes').length;
    const futureRevenueTotal = lineItemPreview
      .filter(l => l.future_revenue === 'Yes')
      .reduce((sum, l) => sum + (l.amount || 0), 0);

    return NextResponse.json({
      success: true,
      summary,
      top_projects: projects.slice(0, 10),
      line_item_summary: {
        total_items_shown: lineItemPreview.length,
        items_with_future_revenue: futureRevenueCount,
        future_revenue_total: futureRevenueTotal,
      },
      line_item_preview: lineItemPreview,
      message: `Board report ready: ${projects.length} projects with revenue`,
    });
  } catch (error) {
    console.error('Board report error:', error);
    return NextResponse.json({
      success: false,
      error: String(error),
    }, { status: 500 });
  }
}
