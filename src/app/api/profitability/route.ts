import { NextRequest, NextResponse } from 'next/server';
import {
  getProjectProfitabilitySummary,
  getProjectProfitabilityByProject,
  getProjectProfitabilityMonthly,
  getProjectProfitabilityByType,
  getProjectProfitabilityFilterOptions,
  getProjectBudgets,
} from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// In-memory cache
let cache: Record<string, { data: any; timestamp: number }> = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'summary'; // summary | projects | monthly | types | filters
    const yearsParam = searchParams.get('years');
    const typesParam = searchParams.get('types');
    const bust = searchParams.get('bust') === 'true';

    // Parse filter parameters
    const years = yearsParam
      ? yearsParam.split(',').map(y => parseInt(y.trim())).filter(y => !isNaN(y))
      : undefined;
    const projectTypes = typesParam
      ? typesParam.split(',').map(t => t.trim()).filter(Boolean)
      : undefined;

    // Check cache
    const cacheKey = `profitability-${view}-${yearsParam || 'all'}-${typesParam || 'all'}`;
    const now = Date.now();
    if (!bust && cache[cacheKey] && (now - cache[cacheKey].timestamp) < CACHE_DURATION) {
      return NextResponse.json(cache[cacheKey].data);
    }

    let responseData: any;

    switch (view) {
      case 'summary': {
        // Get KPI summary data
        const summary = await getProjectProfitabilitySummary({ years, projectTypes });
        const budgets = await getProjectBudgets({ year: years?.[0] || new Date().getFullYear() });

        // Calculate budget variance
        const budgetTotals = budgets.reduce(
          (acc, b) => ({
            revenue: acc.revenue + (b.budget_revenue || 0),
            cogs: acc.cogs + (b.budget_cogs || 0),
            gp: acc.gp + (b.budget_gp || 0),
          }),
          { revenue: 0, cogs: 0, gp: 0 }
        );

        responseData = {
          kpis: {
            totalRevenue: summary.totalRevenue,
            totalCogs: summary.totalCogs,
            grossProfit: summary.grossProfit,
            grossProfitPct: summary.grossProfitPct,
            projectCount: summary.projectCount,
            atRiskCount: summary.atRiskCount,
          },
          budgetVariance: {
            revenueVariance: summary.totalRevenue - budgetTotals.revenue,
            cogsVariance: summary.totalCogs - budgetTotals.cogs,
            gpVariance: summary.grossProfit - budgetTotals.gp,
            budgetRevenue: budgetTotals.revenue,
            budgetCogs: budgetTotals.cogs,
            budgetGp: budgetTotals.gp,
          },
          lastUpdated: new Date().toISOString(),
        };
        break;
      }

      case 'projects': {
        // Get project-level data
        const projects = await getProjectProfitabilityByProject({ years, projectTypes });
        const budgets = await getProjectBudgets({ year: years?.[0] || new Date().getFullYear() });

        // Merge budget data with actuals
        const budgetMap = new Map(budgets.map(b => [b.customer_name, b]));
        const projectsWithBudget = projects.map(p => {
          const budget = budgetMap.get(p.customer_name);
          return {
            ...p,
            budget_revenue: budget?.budget_revenue || 0,
            budget_cogs: budget?.budget_cogs || 0,
            budget_gp: budget?.budget_gp || 0,
            revenue_variance: p.total_revenue - (budget?.budget_revenue || 0),
            gp_variance: p.gross_profit - (budget?.budget_gp || 0),
            is_at_risk: p.gross_profit_pct < 50 || (budget && p.gross_profit < (budget.budget_gp * 0.9)),
          };
        });

        responseData = {
          projects: projectsWithBudget,
          count: projects.length,
          lastUpdated: new Date().toISOString(),
        };
        break;
      }

      case 'monthly': {
        // Get monthly trend data
        const monthly = await getProjectProfitabilityMonthly({ years, projectTypes });

        responseData = {
          monthly,
          count: monthly.length,
          lastUpdated: new Date().toISOString(),
        };
        break;
      }

      case 'types': {
        // Get by project type
        const types = await getProjectProfitabilityByType({ years });

        responseData = {
          types,
          count: types.length,
          lastUpdated: new Date().toISOString(),
        };
        break;
      }

      case 'filters': {
        // Get filter options
        const options = await getProjectProfitabilityFilterOptions();

        responseData = {
          ...options,
          lastUpdated: new Date().toISOString(),
        };
        break;
      }

      case 'dashboard': {
        // Get all data for dashboard in one call
        const [summary, projects, monthly, types, options] = await Promise.all([
          getProjectProfitabilitySummary({ years, projectTypes }),
          getProjectProfitabilityByProject({ years, projectTypes }),
          getProjectProfitabilityMonthly({ years, projectTypes }),
          getProjectProfitabilityByType({ years }),
          getProjectProfitabilityFilterOptions(),
        ]);

        const budgets = await getProjectBudgets({ year: years?.[0] || new Date().getFullYear() });

        // Calculate budget totals
        const budgetTotals = budgets.reduce(
          (acc, b) => ({
            revenue: acc.revenue + (b.budget_revenue || 0),
            cogs: acc.cogs + (b.budget_cogs || 0),
            gp: acc.gp + (b.budget_gp || 0),
          }),
          { revenue: 0, cogs: 0, gp: 0 }
        );

        // Merge budget data with project actuals
        const budgetMap = new Map(budgets.map(b => [b.customer_name, b]));
        const projectsWithBudget = projects.map(p => {
          const budget = budgetMap.get(p.customer_name);
          return {
            ...p,
            budget_revenue: budget?.budget_revenue || 0,
            budget_cogs: budget?.budget_cogs || 0,
            budget_gp: budget?.budget_gp || 0,
            revenue_variance: p.total_revenue - (budget?.budget_revenue || 0),
            gp_variance: p.gross_profit - (budget?.budget_gp || 0),
            is_at_risk: p.gross_profit_pct < 50 || (budget && p.gross_profit < (budget.budget_gp * 0.9)),
          };
        });

        responseData = {
          summary: {
            totalRevenue: summary.totalRevenue,
            totalCogs: summary.totalCogs,
            grossProfit: summary.grossProfit,
            grossProfitPct: summary.grossProfitPct,
            projectCount: summary.projectCount,
            atRiskCount: summary.atRiskCount,
          },
          budgetVariance: {
            revenueVariance: summary.totalRevenue - budgetTotals.revenue,
            cogsVariance: summary.totalCogs - budgetTotals.cogs,
            gpVariance: summary.grossProfit - budgetTotals.gp,
            budgetRevenue: budgetTotals.revenue,
            budgetCogs: budgetTotals.cogs,
            budgetGp: budgetTotals.gp,
          },
          projects: projectsWithBudget,
          monthly,
          types,
          filterOptions: options,
          lastUpdated: new Date().toISOString(),
        };
        break;
      }

      default:
        return NextResponse.json(
          { error: `Unknown view: ${view}` },
          { status: 400 }
        );
    }

    // Cache result
    cache[cacheKey] = { data: responseData, timestamp: now };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error fetching profitability data:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch profitability data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Clear cache endpoint
export async function DELETE() {
  cache = {};
  return NextResponse.json({ success: true, message: 'Cache cleared' });
}
