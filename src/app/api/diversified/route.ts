import { NextRequest, NextResponse } from 'next/server';
import {
  getDiversifiedDashboardSummary,
  getDiversifiedSalesByClass,
  getDiversifiedSalesByCustomer,
  getDiversifiedFilterOptions,
  getDiversifiedBudgets,
  getDiversifiedSales as getSupabaseSales,
  getDiversifiedMonthlySummary,
  getDiversifiedClassMonthlySummary,
} from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse filters from query params
    const yearsParam = searchParams.get('years');
    const monthsParam = searchParams.get('months');
    const classNameParam = searchParams.get('className');
    const customerIdParam = searchParams.get('customerId');
    const viewParam = searchParams.get('view') || 'class'; // 'class', 'customer', or 'charts'
    const includeDetails = searchParams.get('details') === 'true';
    const includeCharts = searchParams.get('charts') === 'true' || viewParam === 'charts';

    const years = yearsParam ? yearsParam.split(',').map(Number) : undefined;
    const months = monthsParam ? monthsParam.split(',').map(Number) : undefined;

    // Run initial queries in parallel for better performance
    const [filterOptions, summary] = await Promise.all([
      getDiversifiedFilterOptions(),
      getDiversifiedDashboardSummary({ years, months }),
    ]);

    // Get aggregated data based on view
    let byClass;
    let byCustomer;

    if (viewParam === 'class' || !classNameParam || includeCharts) {
      byClass = await getDiversifiedSalesByClass({ years, months });

      // If a class is selected, get customers for that class WITH item breakdown
      if (classNameParam) {
        byCustomer = await getDiversifiedSalesByCustomer({
          years,
          months,
          className: classNameParam,
        });

        // Get raw sales to extract item data per customer
        const classSales = await getSupabaseSales({
          years,
          months,
          className: classNameParam,
        });

        // Group by customer + item to get item totals (use item_id as key, description for display)
        const customerItemMap = new Map<string, Map<string, { item_name: string; quantity: number; revenue: number }>>();

        for (const sale of classSales) {
          if (!customerItemMap.has(sale.customer_id)) {
            customerItemMap.set(sale.customer_id, new Map());
          }
          const itemMap = customerItemMap.get(sale.customer_id)!;

          // Use item_id as key for grouping, but display item_description (or fallback to item_name, then item_id)
          const itemKey = sale.item_id || sale.item_name || 'Unknown';
          const displayName = sale.item_description || sale.item_name || sale.item_id || 'Unknown Item';

          if (!itemMap.has(itemKey)) {
            itemMap.set(itemKey, { item_name: displayName, quantity: 0, revenue: 0 });
          }
          const item = itemMap.get(itemKey)!;
          item.quantity += sale.quantity || 0;
          item.revenue += sale.revenue || 0;
        }

        // Attach top 5 items to each customer
        byCustomer = byCustomer.map(customer => {
          const itemMap = customerItemMap.get(customer.customer_id);
          if (!itemMap) {
            return { ...customer, top_items: [], item_count: 0 };
          }

          const allItems = Array.from(itemMap.values())
            .sort((a, b) => b.revenue - a.revenue);

          return {
            ...customer,
            top_items: allItems.slice(0, 5),
            item_count: allItems.length,
          };
        });
      }
    }

    // Always fetch customer data for charts (needed for CustomerDonut)
    if (includeCharts && !byCustomer) {
      byCustomer = await getDiversifiedSalesByCustomer({ years, months });
    }

    if (viewParam === 'customer' || customerIdParam) {
      byCustomer = await getDiversifiedSalesByCustomer({ years, months, className: classNameParam || undefined });

      // If fetching customers for a specific class, add item breakdown
      if (classNameParam && !customerIdParam) {
        const classSales = await getSupabaseSales({
          years,
          months,
          className: classNameParam,
        });

        // Group by customer + item to get item totals (use item_id as key, description for display)
        const customerItemMap = new Map<string, Map<string, { item_name: string; quantity: number; revenue: number }>>();

        for (const sale of classSales) {
          if (!customerItemMap.has(sale.customer_id)) {
            customerItemMap.set(sale.customer_id, new Map());
          }
          const itemMap = customerItemMap.get(sale.customer_id)!;

          // Use item_id as key for grouping, but display item_description (or fallback to item_name, then item_id)
          const itemKey = sale.item_id || sale.item_name || 'Unknown';
          const displayName = sale.item_description || sale.item_name || sale.item_id || 'Unknown Item';

          if (!itemMap.has(itemKey)) {
            itemMap.set(itemKey, { item_name: displayName, quantity: 0, revenue: 0 });
          }
          const item = itemMap.get(itemKey)!;
          item.quantity += sale.quantity || 0;
          item.revenue += sale.revenue || 0;
        }

        // Attach top 5 items to each customer
        byCustomer = byCustomer.map(customer => {
          const itemMap = customerItemMap.get(customer.customer_id);
          if (!itemMap) {
            return { ...customer, top_items: [], item_count: 0 };
          }

          const allItems = Array.from(itemMap.values())
            .sort((a, b) => b.revenue - a.revenue);

          return {
            ...customer,
            top_items: allItems.slice(0, 5),
            item_count: allItems.length,
          };
        });
      }

      // If a customer is selected, we can get their classes WITH item breakdown
      if (customerIdParam) {
        // Get class breakdown for this customer
        const customerSales = await getSupabaseSales({
          years,
          months,
          customerId: customerIdParam,
        });

        // Aggregate by class for this customer
        const classMap = new Map<string, {
          class_name: string;
          class_category: string;
          total_units: number;
          total_revenue: number;
          total_cost: number;
          total_gross_profit: number;
        }>();

        // Also track items per class for this customer
        const classItemMap = new Map<string, Map<string, { item_name: string; quantity: number; revenue: number }>>();

        for (const sale of customerSales) {
          if (!classMap.has(sale.class_name)) {
            classMap.set(sale.class_name, {
              class_name: sale.class_name,
              class_category: sale.class_category,
              total_units: 0,
              total_revenue: 0,
              total_cost: 0,
              total_gross_profit: 0,
            });
          }
          const agg = classMap.get(sale.class_name)!;
          agg.total_units += sale.quantity || 0;
          agg.total_revenue += sale.revenue || 0;
          agg.total_cost += sale.cost || 0;
          agg.total_gross_profit += sale.gross_profit || 0;

          // Track items per class
          if (!classItemMap.has(sale.class_name)) {
            classItemMap.set(sale.class_name, new Map());
          }
          const itemMap = classItemMap.get(sale.class_name)!;

          // Use item_id as key for grouping, but display item_description
          const itemKey = sale.item_id || sale.item_name || 'Unknown';
          const displayName = sale.item_description || sale.item_name || sale.item_id || 'Unknown Item';

          if (!itemMap.has(itemKey)) {
            itemMap.set(itemKey, { item_name: displayName, quantity: 0, revenue: 0 });
          }
          const item = itemMap.get(itemKey)!;
          item.quantity += sale.quantity || 0;
          item.revenue += sale.revenue || 0;
        }

        // Attach top 5 items to each class
        byClass = Array.from(classMap.values())
          .map(c => {
            const itemMap = classItemMap.get(c.class_name);
            const allItems = itemMap ? Array.from(itemMap.values()).sort((a, b) => b.revenue - a.revenue) : [];

            return {
              ...c,
              avg_gross_profit_pct: c.total_revenue > 0 ? (c.total_gross_profit / c.total_revenue) * 100 : 0,
              transaction_count: 0,
              top_items: allItems.slice(0, 5),
              item_count: allItems.length,
            };
          })
          .sort((a, b) => b.total_revenue - a.total_revenue);
      }
    }

    // Get budget data for variance
    const budgets = await getDiversifiedBudgets({ years, months });

    // Calculate budget totals
    const budgetTotals = budgets.reduce(
      (acc, b) => ({
        revenue: acc.revenue + (b.budget_revenue || 0),
        units: acc.units + (b.budget_units || 0),
        cost: acc.cost + (b.budget_cost || 0),
        grossProfit: acc.grossProfit + (b.budget_gross_profit || 0),
      }),
      { revenue: 0, units: 0, cost: 0, grossProfit: 0 }
    );

    // Calculate variance
    const variance = budgetTotals.revenue > 0
      ? ((summary.totalRevenue - budgetTotals.revenue) / budgetTotals.revenue) * 100
      : null;

    // Include detail transactions if requested
    let details;
    if (includeDetails) {
      details = await getSupabaseSales({
        years,
        months,
        className: classNameParam || undefined,
        customerId: customerIdParam || undefined,
      });
    }

    // Include chart data if requested
    let chartData;
    if (includeCharts) {
      const [monthly, classMonthly] = await Promise.all([
        getDiversifiedMonthlySummary({ years }),
        getDiversifiedClassMonthlySummary({ years }),
      ]);
      chartData = {
        monthly,
        classMonthly,
      };
    }

    return NextResponse.json({
      summary: {
        ...summary,
        budgetRevenue: budgetTotals.revenue,
        budgetUnits: budgetTotals.units,
        budgetCost: budgetTotals.cost,
        budgetGrossProfit: budgetTotals.grossProfit,
        variancePct: variance,
      },
      byClass: byClass || [],
      byCustomer: byCustomer || [],
      filterOptions,
      filters: {
        years,
        months,
        className: classNameParam,
        customerId: customerIdParam,
        view: viewParam,
      },
      details,
      chartData,
      dataNote: 'Revenue from invoice line items. May vary slightly from Income Statement due to GL adjustments.',
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching diversified dashboard data:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch diversified data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
