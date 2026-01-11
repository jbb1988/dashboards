import { NextRequest, NextResponse } from 'next/server';
import {
  calculateCustomerAttrition,
  calculateRolling12Performance,
  calculateYoYPerformance,
  generateCrossSellOpportunities,
  calculateConcentrationMetrics,
  generateInsightAlerts,
  METRIC_EXPLAINERS,
} from '@/lib/insights';

export const dynamic = 'force-dynamic';

// In-memory cache for expensive calculations (5 minute TTL)
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCacheKey(params: Record<string, unknown>): string {
  return JSON.stringify(params);
}

function getFromCache<T>(key: string): T | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as T;
  }
  cache.delete(key);
  return null;
}

function setCache(key: string, data: unknown): void {
  cache.set(key, { data, timestamp: Date.now() });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse query params
    const yearsParam = searchParams.get('years');
    const bustCache = searchParams.get('bust') === 'true';
    const includeExplainers = searchParams.get('explainers') === 'true';
    // Mode: 'rolling12' (default) or 'yoy' for calendar year comparison
    const mode = searchParams.get('mode') || 'rolling12';
    // For YoY mode: specify which years to compare (e.g., currentYear=2025&priorYear=2024)
    const currentYearParam = searchParams.get('currentYear');
    const priorYearParam = searchParams.get('priorYear');

    // Parse years - if "3" is passed, use last 3 years
    let years: number[];
    if (yearsParam === '3') {
      const currentYear = new Date().getFullYear();
      years = [currentYear, currentYear - 1, currentYear - 2];
    } else if (yearsParam) {
      years = yearsParam.split(',').map(Number);
    } else {
      const currentYear = new Date().getFullYear();
      years = [currentYear, currentYear - 1, currentYear - 2];
    }

    const filters = { years };
    const cacheKey = getCacheKey({ years, mode, currentYearParam, priorYearParam });

    // Check cache unless bust=true
    if (!bustCache) {
      const cached = getFromCache<Record<string, unknown>>(cacheKey);
      if (cached) {
        return NextResponse.json({
          ...cached,
          fromCache: true,
          lastUpdated: new Date().toISOString(),
        });
      }
    }

    // Determine which years to use for YoY comparison
    const currentYear = currentYearParam ? parseInt(currentYearParam) : new Date().getFullYear();
    const priorYear = priorYearParam ? parseInt(priorYearParam) : currentYear - 1;

    // Fetch all data in parallel based on mode
    const [attrition, concentration, crossSell, alerts] = await Promise.all([
      calculateCustomerAttrition(filters),
      calculateConcentrationMetrics(filters),
      generateCrossSellOpportunities(filters),
      generateInsightAlerts(filters),
    ]);

    let comparisonData: {
      customers: Array<{
        entity_type: 'customer' | 'class';
        entity_id: string;
        entity_name: string;
        current_revenue: number;
        current_cost: number;
        prior_revenue: number;
        prior_cost: number;
        revenue_change_pct: number;
        trend: 'growing' | 'stable' | 'declining';
        current_margin_pct: number;
        prior_margin_pct: number;
      }>;
      classes: Array<{
        entity_type: 'customer' | 'class';
        entity_id: string;
        entity_name: string;
        current_revenue: number;
        current_cost: number;
        prior_revenue: number;
        prior_cost: number;
        revenue_change_pct: number;
        trend: 'growing' | 'stable' | 'declining';
        current_margin_pct: number;
        prior_margin_pct: number;
      }>;
      comparisonType: string;
      currentPeriod: { start: string; end: string } | { year: number };
      priorPeriod: { start: string; end: string } | { year: number };
    };

    if (mode === 'yoy') {
      // Calendar Year YoY comparison (e.g., 2024 vs 2025)
      const [yoyCustomers, yoyClasses] = await Promise.all([
        calculateYoYPerformance('customer', { currentYear, priorYear }),
        calculateYoYPerformance('class', { currentYear, priorYear }),
      ]);

      comparisonData = {
        customers: yoyCustomers.map(c => ({
          entity_type: 'customer' as const,
          entity_id: c.entity_id,
          entity_name: c.entity_name,
          current_revenue: c.current_revenue,
          current_cost: c.current_cost,
          prior_revenue: c.prior_revenue,
          prior_cost: c.prior_cost,
          revenue_change_pct: c.revenue_change_pct,
          trend: c.trend,
          current_margin_pct: c.current_margin_pct,
          prior_margin_pct: c.prior_margin_pct,
        })),
        classes: yoyClasses.map(c => ({
          entity_type: 'class' as const,
          entity_id: c.entity_id,
          entity_name: c.entity_name,
          current_revenue: c.current_revenue,
          current_cost: c.current_cost,
          prior_revenue: c.prior_revenue,
          prior_cost: c.prior_cost,
          revenue_change_pct: c.revenue_change_pct,
          trend: c.trend,
          current_margin_pct: c.current_margin_pct,
          prior_margin_pct: c.prior_margin_pct,
        })),
        comparisonType: 'calendar_year_yoy',
        currentPeriod: { year: currentYear },
        priorPeriod: { year: priorYear },
      };
    } else {
      // Rolling 12-month comparison (default)
      const [rolling12Customers, rolling12Classes] = await Promise.all([
        calculateRolling12Performance('customer'),
        calculateRolling12Performance('class'),
      ]);

      comparisonData = {
        customers: rolling12Customers.map(c => ({
          entity_type: 'customer' as const,
          entity_id: c.entity_id,
          entity_name: c.entity_name,
          current_revenue: c.current_revenue,
          current_cost: c.current_cost,
          prior_revenue: c.prior_revenue,
          prior_cost: c.prior_cost,
          revenue_change_pct: c.revenue_change_pct,
          trend: c.trend,
          current_margin_pct: c.current_margin_pct,
          prior_margin_pct: c.prior_margin_pct,
        })),
        classes: rolling12Classes.map(c => ({
          entity_type: 'class' as const,
          entity_id: c.entity_id,
          entity_name: c.entity_name,
          current_revenue: c.current_revenue,
          current_cost: c.current_cost,
          prior_revenue: c.prior_revenue,
          prior_cost: c.prior_cost,
          revenue_change_pct: c.revenue_change_pct,
          trend: c.trend,
          current_margin_pct: c.current_margin_pct,
          prior_margin_pct: c.prior_margin_pct,
        })),
        comparisonType: 'rolling_12_months',
        currentPeriod: rolling12Customers[0] ? {
          start: rolling12Customers[0].current_period_start,
          end: rolling12Customers[0].current_period_end,
        } : { start: '', end: '' },
        priorPeriod: rolling12Customers[0] ? {
          start: rolling12Customers[0].prior_period_start,
          end: rolling12Customers[0].prior_period_end,
        } : { start: '', end: '' },
      };
    }

    // Calculate summary metrics from comparison data
    const atRiskCustomers = attrition.filter(c => c.status === 'at_risk').length;
    const atRiskRevenue = attrition
      .filter(c => c.status === 'at_risk')
      .reduce((sum, c) => sum + c.revenue_at_risk, 0);
    const churnedCustomers = attrition.filter(c => c.status === 'churned').length;
    const churnedRevenue = attrition
      .filter(c => c.status === 'churned')
      .reduce((sum, c) => sum + c.revenue_at_risk, 0);

    // Calculate overall change from comparison data
    const totalCurrentRevenue = comparisonData.customers.reduce((sum, c) => sum + c.current_revenue, 0);
    const totalPriorRevenue = comparisonData.customers.reduce((sum, c) => sum + c.prior_revenue, 0);
    const revenueChangePct = totalPriorRevenue > 0
      ? ((totalCurrentRevenue - totalPriorRevenue) / totalPriorRevenue) * 100
      : 0;

    // Calculate margin change
    const totalCurrentCost = comparisonData.customers.reduce((sum, c) => sum + c.current_cost, 0);
    const totalPriorCost = comparisonData.customers.reduce((sum, c) => sum + c.prior_cost, 0);
    const currentMarginPct = totalCurrentRevenue > 0
      ? ((totalCurrentRevenue - totalCurrentCost) / totalCurrentRevenue) * 100
      : 0;
    const priorMarginPct = totalPriorRevenue > 0
      ? ((totalPriorRevenue - totalPriorCost) / totalPriorRevenue) * 100
      : 0;
    const marginChangePct = currentMarginPct - priorMarginPct;

    // New customers (those with no prior period revenue)
    const newCustomers = comparisonData.customers.filter(c => c.prior_revenue === 0 && c.current_revenue > 0).length;

    // Cross-sell potential
    const crossSellPotential = crossSell.reduce((sum, o) => sum + o.estimated_revenue, 0);

    // Build summary object
    const summary = {
      at_risk_customers: atRiskCustomers,
      at_risk_revenue: atRiskRevenue,
      churned_customers: churnedCustomers,
      churned_revenue: churnedRevenue,
      rolling12_revenue_change_pct: revenueChangePct,
      rolling12_margin_change_pct: marginChangePct,
      // Keep legacy names for backward compatibility
      yoy_revenue_change_pct: revenueChangePct,
      yoy_margin_change_pct: marginChangePct,
      cross_sell_potential: crossSellPotential,
      hhi_index: concentration.hhi_index,
      hhi_interpretation: concentration.hhi_interpretation,
      new_customers_12mo: newCustomers,
      // Period info
      comparison_type: comparisonData.comparisonType,
      current_period: comparisonData.currentPeriod,
      prior_period: comparisonData.priorPeriod,
    };

    // Combine comparison data into single array for dashboard
    const combinedComparison = [
      ...comparisonData.customers,
      ...comparisonData.classes,
    ];

    const response = {
      summary,
      alerts,
      attrition,
      rolling12: combinedComparison,
      // Keep 'yoy' key for backward compatibility
      yoy: combinedComparison,
      crossSell,
      concentration,
      // Include mode info
      mode,
      comparisonPeriods: {
        type: comparisonData.comparisonType,
        current: comparisonData.currentPeriod,
        prior: comparisonData.priorPeriod,
      },
    };

    // Include metric explainers if requested
    if (includeExplainers) {
      (response as Record<string, unknown>).explainers = METRIC_EXPLAINERS;
    }

    // Cache the response
    setCache(cacheKey, response);

    return NextResponse.json({
      ...response,
      filters: { years, mode, currentYear, priorYear },
      fromCache: false,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching insights data:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch insights data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
