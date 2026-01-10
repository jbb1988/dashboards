import { NextRequest, NextResponse } from 'next/server';
import {
  getDiversifiedDashboardSummary,
  getDiversifiedSalesByClass,
  getDiversifiedSalesByCustomer,
  getDiversifiedFilterOptions,
  getDiversifiedBudgets,
  getDiversifiedSales as getSupabaseSales,
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
    const viewParam = searchParams.get('view') || 'class'; // 'class' or 'customer'
    const includeDetails = searchParams.get('details') === 'true';

    const years = yearsParam ? yearsParam.split(',').map(Number) : undefined;
    const months = monthsParam ? monthsParam.split(',').map(Number) : undefined;

    // Get filter options (always include these)
    const filterOptions = await getDiversifiedFilterOptions();

    // Get summary KPIs
    const summary = await getDiversifiedDashboardSummary({ years, months });

    // Get aggregated data based on view
    let byClass;
    let byCustomer;

    if (viewParam === 'class' || !classNameParam) {
      byClass = await getDiversifiedSalesByClass({ years, months });

      // If a class is selected, get customers for that class
      if (classNameParam) {
        byCustomer = await getDiversifiedSalesByCustomer({
          years,
          months,
          className: classNameParam,
        });
      }
    }

    if (viewParam === 'customer' || customerIdParam) {
      byCustomer = await getDiversifiedSalesByCustomer({ years, months });

      // If a customer is selected, we can get their classes
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
        }

        byClass = Array.from(classMap.values())
          .map(c => ({
            ...c,
            avg_gross_profit_pct: c.total_revenue > 0 ? (c.total_gross_profit / c.total_revenue) * 100 : 0,
            transaction_count: 0,
          }))
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
