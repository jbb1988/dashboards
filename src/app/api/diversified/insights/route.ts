import { NextRequest, NextResponse } from 'next/server';
import {
  calculateCustomerAttrition,
  calculateYoYPerformance,
  generateCrossSellOpportunities,
  calculateConcentrationMetrics,
  getInsightsSummary,
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
    const insightType = searchParams.get('type') || 'all';
    const bustCache = searchParams.get('bust') === 'true';
    const includeExplainers = searchParams.get('explainers') === 'true';

    const years = yearsParam
      ? yearsParam.split(',').map(Number)
      : [new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2];

    const filters = { years };
    const cacheKey = getCacheKey({ years, insightType });

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

    // Build response based on requested type
    let response: Record<string, unknown> = {};

    if (insightType === 'all' || insightType === 'summary') {
      const summary = await getInsightsSummary(filters);
      response.summary = summary;
    }

    if (insightType === 'all' || insightType === 'alerts') {
      const alerts = await generateInsightAlerts(filters);
      response.alerts = alerts;
    }

    if (insightType === 'all' || insightType === 'attrition') {
      const attrition = await calculateCustomerAttrition(filters);
      response.attrition = attrition;

      // Include attrition stats
      response.attritionStats = {
        total_customers: attrition.length,
        active: attrition.filter(c => c.status === 'active').length,
        declining: attrition.filter(c => c.status === 'declining').length,
        at_risk: attrition.filter(c => c.status === 'at_risk').length,
        churned: attrition.filter(c => c.status === 'churned').length,
        total_revenue_at_risk: attrition
          .filter(c => c.status === 'at_risk' || c.status === 'churned')
          .reduce((sum, c) => sum + c.revenue_at_risk, 0),
      };
    }

    if (insightType === 'all' || insightType === 'yoy') {
      const [yoyCustomers, yoyClasses] = await Promise.all([
        calculateYoYPerformance('customer', { currentYear: years[0] }),
        calculateYoYPerformance('class', { currentYear: years[0] }),
      ]);
      response.yoyCustomers = yoyCustomers;
      response.yoyClasses = yoyClasses;

      // Include YoY stats
      const totalCurrentRevenue = yoyCustomers.reduce((sum, c) => sum + c.current_revenue, 0);
      const totalPriorRevenue = yoyCustomers.reduce((sum, c) => sum + c.prior_revenue, 0);
      response.yoyStats = {
        total_current_revenue: totalCurrentRevenue,
        total_prior_revenue: totalPriorRevenue,
        overall_change_pct: totalPriorRevenue > 0
          ? ((totalCurrentRevenue - totalPriorRevenue) / totalPriorRevenue) * 100
          : 0,
        growing_customers: yoyCustomers.filter(c => c.trend === 'growing').length,
        stable_customers: yoyCustomers.filter(c => c.trend === 'stable').length,
        declining_customers: yoyCustomers.filter(c => c.trend === 'declining').length,
        new_customers: yoyCustomers.filter(c => c.prior_revenue === 0 && c.current_revenue > 0).length,
      };
    }

    if (insightType === 'all' || insightType === 'crosssell') {
      const crossSell = await generateCrossSellOpportunities(filters);
      response.crossSell = crossSell;

      // Include cross-sell stats
      response.crossSellStats = {
        total_opportunities: crossSell.length,
        total_potential_revenue: crossSell.reduce((sum, o) => sum + o.estimated_revenue, 0),
        avg_affinity_score: crossSell.length > 0
          ? crossSell.reduce((sum, o) => sum + o.affinity_score, 0) / crossSell.length
          : 0,
        unique_customers: new Set(crossSell.map(o => o.customer_id)).size,
        unique_products: new Set(crossSell.map(o => o.recommended_class)).size,
      };
    }

    if (insightType === 'all' || insightType === 'concentration') {
      const concentration = await calculateConcentrationMetrics(filters);
      response.concentration = concentration;
    }

    // Include metric explainers if requested
    if (includeExplainers) {
      response.explainers = METRIC_EXPLAINERS;
    }

    // Cache the response
    setCache(cacheKey, response);

    return NextResponse.json({
      ...response,
      filters: { years, type: insightType },
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
