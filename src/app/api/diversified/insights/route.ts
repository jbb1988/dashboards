import { NextRequest, NextResponse } from 'next/server';
import {
  calculateCustomerAttrition,
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
    const cacheKey = getCacheKey({ years });

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

    // Fetch all data in parallel
    const [attrition, concentration, crossSell, yoyCustomers, yoyClasses, alerts] = await Promise.all([
      calculateCustomerAttrition(filters),
      calculateConcentrationMetrics(filters),
      generateCrossSellOpportunities(filters),
      calculateYoYPerformance('customer', { currentYear: years[0] }),
      calculateYoYPerformance('class', { currentYear: years[0] }),
      generateInsightAlerts(filters),
    ]);

    // Calculate summary metrics
    const atRiskCustomers = attrition.filter(c => c.status === 'at_risk').length;
    const atRiskRevenue = attrition
      .filter(c => c.status === 'at_risk')
      .reduce((sum, c) => sum + c.revenue_at_risk, 0);
    const churnedCustomers = attrition.filter(c => c.status === 'churned').length;
    const churnedRevenue = attrition
      .filter(c => c.status === 'churned')
      .reduce((sum, c) => sum + c.revenue_at_risk, 0);

    // Calculate overall YoY
    const totalCurrentRevenue = yoyCustomers.reduce((sum, c) => sum + c.current_revenue, 0);
    const totalPriorRevenue = yoyCustomers.reduce((sum, c) => sum + c.prior_revenue, 0);
    const yoyChangePct = totalPriorRevenue > 0
      ? ((totalCurrentRevenue - totalPriorRevenue) / totalPriorRevenue) * 100
      : 0;

    // Calculate margin change
    const totalCurrentCost = yoyCustomers.reduce((sum, c) => sum + c.current_cost, 0);
    const totalPriorCost = yoyCustomers.reduce((sum, c) => sum + c.prior_cost, 0);
    const currentMarginPct = totalCurrentRevenue > 0
      ? ((totalCurrentRevenue - totalCurrentCost) / totalCurrentRevenue) * 100
      : 0;
    const priorMarginPct = totalPriorRevenue > 0
      ? ((totalPriorRevenue - totalPriorCost) / totalPriorRevenue) * 100
      : 0;
    const yoyMarginChangePct = currentMarginPct - priorMarginPct;

    // New customers (those with no prior year revenue)
    const newCustomers = yoyCustomers.filter(c => c.prior_revenue === 0 && c.current_revenue > 0).length;

    // Cross-sell potential
    const crossSellPotential = crossSell.reduce((sum, o) => sum + o.estimated_revenue, 0);

    // Build summary object that matches dashboard expectations
    const summary = {
      at_risk_customers: atRiskCustomers,
      at_risk_revenue: atRiskRevenue,
      churned_customers: churnedCustomers,
      churned_revenue: churnedRevenue,
      yoy_revenue_change_pct: yoyChangePct,
      yoy_margin_change_pct: yoyMarginChangePct,
      cross_sell_potential: crossSellPotential,
      hhi_index: concentration.hhi_index,
      hhi_interpretation: concentration.hhi_interpretation,
      new_customers_12mo: newCustomers,
    };

    // Combine yoy data into single array for dashboard
    const yoy = [
      ...yoyCustomers.map(c => ({ ...c, entity_type: 'customer' as const })),
      ...yoyClasses.map(c => ({ ...c, entity_type: 'class' as const })),
    ];

    const response = {
      summary,
      alerts,
      attrition,
      yoy,
      crossSell,
      concentration,
    };

    // Include metric explainers if requested
    if (includeExplainers) {
      (response as Record<string, unknown>).explainers = METRIC_EXPLAINERS;
    }

    // Cache the response
    setCache(cacheKey, response);

    return NextResponse.json({
      ...response,
      filters: { years },
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
