import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  getDistributor,
  calculateDistributorMetrics,
  calculateGrowthScore,
  type DistributorLocation,
} from '@/lib/distributorAnalysis';

export const dynamic = 'force-dynamic';

interface ProductContext {
  top_categories: Array<{
    name: string;
    revenue: number;
    percentage: number;
  }>;
  category_count: number;
  last_purchase_date: string;
  recent_activity: {
    days_since_purchase: number;
    transaction_count_30d: number;
    status: 'active' | 'warning' | 'inactive';
  };
  missing_categories?: Array<{
    name: string;
    peer_penetration_pct: number;
    estimated_opportunity: number;
  }>;
}

interface AIRecommendation {
  priority: 'high' | 'medium' | 'low';
  title: string;
  problem: string;
  recommendation: string;
  expected_impact: string;
  action_items: string[];
  category: 'attrisk' | 'growth' | 'categorygap' | 'expansion';
  distributor_name?: string;
  customer_id?: string;
  customer_name?: string;
  product_context?: ProductContext;
}

export async function GET(request: NextRequest) {
  try {
    const admin = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);

    // Parse filters (same as main distributors API)
    const yearsParam = searchParams.get('years');
    const monthsParam = searchParams.get('months');
    const className = searchParams.get('className');

    const years = yearsParam ? yearsParam.split(',').map(Number).filter(n => !isNaN(n)) : [];
    const months = monthsParam ? monthsParam.split(',').map(Number).filter(n => !isNaN(n)) : [];

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    // Calculate date ranges
    let currentPeriodStart: Date;
    let currentPeriodEnd: Date;
    let priorPeriodStart: Date;
    let priorPeriodEnd: Date;

    if (years.length > 0) {
      const selectedYears = [...years].sort((a, b) => a - b);
      const minYear = selectedYears[0];
      const maxYear = selectedYears[selectedYears.length - 1];

      if (months.length > 0) {
        const selectedMonths = [...months].sort((a, b) => a - b);
        const minMonth = selectedMonths[0];
        const maxMonth = selectedMonths[selectedMonths.length - 1];

        currentPeriodStart = new Date(Date.UTC(minYear, minMonth - 1, 1));
        currentPeriodEnd = new Date(Date.UTC(maxYear, maxMonth, 0, 23, 59, 59, 999));

        priorPeriodStart = new Date(Date.UTC(minYear - 1, minMonth - 1, 1));
        priorPeriodEnd = new Date(Date.UTC(maxYear - 1, maxMonth, 0, 23, 59, 59, 999));
      } else {
        currentPeriodStart = new Date(Date.UTC(minYear, 0, 1));
        currentPeriodEnd = new Date(Date.UTC(maxYear, 11, 31, 23, 59, 59, 999));

        priorPeriodStart = new Date(Date.UTC(minYear - 1, 0, 1));
        priorPeriodEnd = new Date(Date.UTC(maxYear - 1, 11, 31, 23, 59, 59, 999));
      }
    } else {
      // Use R12
      const now = new Date();
      currentPeriodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
      currentPeriodStart = new Date(currentPeriodEnd);
      currentPeriodStart.setUTCMonth(currentPeriodStart.getUTCMonth() - 12);
      currentPeriodStart.setUTCHours(0, 0, 0, 0);

      priorPeriodEnd = new Date(currentPeriodStart);
      priorPeriodEnd.setUTCMilliseconds(priorPeriodEnd.getUTCMilliseconds() - 1);
      priorPeriodStart = new Date(priorPeriodEnd);
      priorPeriodStart.setUTCMonth(priorPeriodStart.getUTCMonth() - 12);
      priorPeriodStart.setUTCHours(0, 0, 0, 0);
    }

    // Fetch current period data
    let currentQuery = admin
      .from('diversified_sales')
      .select('customer_id, customer_name, revenue, cost, gross_profit, quantity, class_category, transaction_date');

    currentQuery = currentQuery
      .gte('transaction_date', formatDate(currentPeriodStart))
      .lte('transaction_date', formatDate(currentPeriodEnd));

    if (className) {
      currentQuery = currentQuery.eq('class_name', className);
    }

    // Fetch prior period data
    let priorQuery = admin
      .from('diversified_sales')
      .select('customer_id, revenue, cost, gross_profit, quantity');

    priorQuery = priorQuery
      .gte('transaction_date', formatDate(priorPeriodStart))
      .lte('transaction_date', formatDate(priorPeriodEnd));

    if (className) {
      priorQuery = priorQuery.eq('class_name', className);
    }

    const [currentResult, priorResult] = await Promise.all([
      currentQuery,
      priorQuery
    ]);

    if (currentResult.error) throw currentResult.error;
    if (priorResult.error) throw priorResult.error;

    const currentData = currentResult.data || [];
    const priorData = priorResult.data || [];

    // Aggregate by customer and group by distributor
    const locationMap = new Map<string, any>();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    for (const row of currentData) {
      const key = row.customer_id;
      const existing = locationMap.get(key);

      if (existing) {
        existing.current_revenue += row.revenue || 0;
        existing.current_cost += row.cost || 0;
        existing.current_gross_profit += row.gross_profit || 0;
        existing.current_units += row.quantity || 0;

        // Track category-level revenue
        if (row.class_category) {
          if (!existing.categories.includes(row.class_category)) {
            existing.categories.push(row.class_category);
          }
          existing.category_revenue.set(
            row.class_category,
            (existing.category_revenue.get(row.class_category) || 0) + (row.revenue || 0)
          );
        }

        // Track transaction dates for recent activity
        if (row.transaction_date) {
          existing.transaction_dates.push(row.transaction_date);
          if (!existing.last_purchase_date || row.transaction_date > existing.last_purchase_date) {
            existing.last_purchase_date = row.transaction_date;
          }
        }
      } else {
        const categoryRevenue = new Map<string, number>();
        if (row.class_category) {
          categoryRevenue.set(row.class_category, row.revenue || 0);
        }

        locationMap.set(key, {
          customer_id: row.customer_id,
          customer_name: row.customer_name,
          current_revenue: row.revenue || 0,
          current_cost: row.cost || 0,
          current_gross_profit: row.gross_profit || 0,
          current_units: row.quantity || 0,
          prior_revenue: 0,
          prior_cost: 0,
          prior_gross_profit: 0,
          categories: row.class_category ? [row.class_category] : [],
          category_revenue: categoryRevenue,
          transaction_dates: row.transaction_date ? [row.transaction_date] : [],
          last_purchase_date: row.transaction_date || null
        });
      }
    }

    for (const row of priorData) {
      const key = row.customer_id;
      const existing = locationMap.get(key);

      if (existing) {
        existing.prior_revenue += row.revenue || 0;
      }
    }

    // Group by distributor
    const distributorMap = new Map<string, any[]>();

    for (const [_, metrics] of locationMap) {
      const distributorName = getDistributor(metrics.customer_name);
      if (!distributorName) continue;

      const yoyChangePct = metrics.prior_revenue > 0
        ? ((metrics.current_revenue - metrics.prior_revenue) / metrics.prior_revenue) * 100
        : metrics.current_revenue > 0 ? 100 : 0;

      const marginPct = metrics.current_revenue > 0
        ? (metrics.current_gross_profit / metrics.current_revenue) * 100
        : 0;

      const location = {
        customer_id: metrics.customer_id,
        customer_name: metrics.customer_name,
        revenue: metrics.current_revenue,
        prior_revenue: metrics.prior_revenue,
        yoy_change_pct: yoyChangePct,
        margin_pct: marginPct,
        categories: metrics.categories,
        category_count: metrics.categories.length,
        last_purchase_date: metrics.last_purchase_date,
      };

      if (!distributorMap.has(distributorName)) {
        distributorMap.set(distributorName, []);
      }
      distributorMap.get(distributorName)!.push({ distributorName, location });
    }

    // Helper function to build product context
    const buildProductContext = (
      metrics: any,
      distributorLocations: any[],
      distributorName: string
    ): ProductContext => {
      // Build top categories sorted by revenue
      const topCategories = Array.from(metrics.category_revenue.entries())
        .map(([name, revenue]: [string, number]) => ({
          name,
          revenue,
          percentage: metrics.current_revenue > 0 ? (revenue / metrics.current_revenue) * 100 : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      // Calculate days since purchase
      const daysSincePurchase = metrics.last_purchase_date
        ? Math.floor((new Date().getTime() - new Date(metrics.last_purchase_date).getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      // Count recent transactions (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const transactionCount30d = metrics.transaction_dates.filter(
        (date: string) => new Date(date) >= thirtyDaysAgo
      ).length;

      // Determine activity status
      let activityStatus: 'active' | 'warning' | 'inactive';
      if (daysSincePurchase <= 30) activityStatus = 'active';
      else if (daysSincePurchase <= 90) activityStatus = 'warning';
      else activityStatus = 'inactive';

      // Find missing categories
      const allCategories = new Map<string, number>();
      for (const loc of distributorLocations) {
        for (const cat of loc.location.categories) {
          allCategories.set(cat, (allCategories.get(cat) || 0) + 1);
        }
      }

      const popularThreshold = distributorLocations.length * 0.75;
      const missingCategories = Array.from(allCategories.entries())
        .filter(([cat, count]) => count >= popularThreshold && !metrics.categories.includes(cat))
        .map(([name, count]) => ({
          name,
          peer_penetration_pct: Math.round((count / distributorLocations.length) * 100),
          estimated_opportunity: metrics.current_revenue * 0.15, // Rough estimate
        }))
        .slice(0, 3);

      return {
        top_categories: topCategories,
        category_count: metrics.categories.length,
        last_purchase_date: metrics.last_purchase_date || '',
        recent_activity: {
          days_since_purchase: daysSincePurchase,
          transaction_count_30d: transactionCount30d,
          status: activityStatus,
        },
        missing_categories: missingCategories.length > 0 ? missingCategories : undefined,
      };
    };

    // Generate insights
    const recommendations: AIRecommendation[] = [];

    // 1. AT-RISK LOCATIONS (>25% YoY decline OR inactive 90+ days)
    const now = new Date();
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    for (const [distributorName, locations] of distributorMap) {
      for (const { location } of locations) {
        const daysSincePurchase = location.last_purchase_date
          ? Math.floor((now.getTime() - new Date(location.last_purchase_date).getTime()) / (1000 * 60 * 60 * 24))
          : 999;

        const isDecline = location.yoy_change_pct < -25;
        const isInactive = daysSincePurchase > 90;

        if (isDecline || isInactive) {
          const priority: 'high' | 'medium' | 'low' =
            (isDecline && isInactive) ? 'high' :
            isDecline ? 'high' :
            'medium';

          const problem = isDecline && isInactive
            ? `Revenue declined ${Math.abs(location.yoy_change_pct).toFixed(1)}% YoY AND no purchases in ${daysSincePurchase} days`
            : isDecline
            ? `Revenue declined ${Math.abs(location.yoy_change_pct).toFixed(1)}% YoY`
            : `No purchases in ${daysSincePurchase} days`;

          // Get original metrics for product context
          const metrics = locationMap.get(location.customer_id);
          const productContext = metrics ? buildProductContext(metrics, locations, distributorName) : undefined;

          recommendations.push({
            priority,
            title: `At-Risk: ${location.customer_name}`,
            problem,
            recommendation: `Immediate outreach required. Schedule a call with the location manager to understand the decline and address any issues. Review recent order history for pattern changes.`,
            expected_impact: `Prevent potential churn of $${(location.revenue / 1000).toFixed(0)}K annual revenue. Early intervention could restore purchasing levels.`,
            action_items: [
              'Call location manager within 48 hours',
              'Review recent order history for pattern changes',
              'Prepare competitive pricing comparison',
              'Schedule on-site visit if needed',
            ],
            category: 'attrisk',
            distributor_name: distributorName,
            customer_id: location.customer_id,
            customer_name: location.customer_name,
            product_context: productContext,
          });
        }
      }
    }

    // 2. GROWTH OPPORTUNITIES (bottom 25% revenue vs distributor peers)
    for (const [distributorName, locations] of distributorMap) {
      if (locations.length < 4) continue; // Need enough locations for meaningful analysis

      const revenues = locations.map(l => l.location.revenue).sort((a, b) => b - a);
      const avgRevenue = revenues.reduce((sum, r) => sum + r, 0) / revenues.length;
      const threshold = avgRevenue * 0.75; // Bottom 25%

      for (const { location } of locations) {
        if (location.revenue < threshold && location.revenue > 0) {
          const gap = avgRevenue - location.revenue;
          const gapPct = ((gap / avgRevenue) * 100);

          // Get original metrics for product context
          const metrics = locationMap.get(location.customer_id);
          const productContext = metrics ? buildProductContext(metrics, locations, distributorName) : undefined;

          recommendations.push({
            priority: gapPct > 50 ? 'high' : 'medium',
            title: `Growth: ${location.customer_name}`,
            problem: `Revenue is ${gapPct.toFixed(0)}% below ${distributorName} average ($${(location.revenue / 1000).toFixed(0)}K vs $${(avgRevenue / 1000).toFixed(0)}K avg)`,
            recommendation: `This location has significant growth potential. Analyze top-performing locations to identify products and strategies that could be replicated here.`,
            expected_impact: `Potential revenue increase of $${(gap / 1000).toFixed(0)}K by matching peer performance levels.`,
            action_items: [
              'Compare product mix with top-performing locations',
              'Review pricing and discount structures',
              'Identify cross-sell opportunities',
              'Schedule quarterly business review',
            ],
            category: 'growth',
            distributor_name: distributorName,
            customer_id: location.customer_id,
            customer_name: location.customer_name,
            product_context: productContext,
          });
        }
      }
    }

    // 3. CATEGORY GAPS (missing categories purchased by 75%+ of peers)
    for (const [distributorName, locations] of distributorMap) {
      if (locations.length < 4) continue;

      // Find all categories across this distributor
      const categoryFrequency = new Map<string, number>();
      for (const { location } of locations) {
        for (const cat of location.categories) {
          categoryFrequency.set(cat, (categoryFrequency.get(cat) || 0) + 1);
        }
      }

      // Find categories purchased by 75%+ of locations
      const popularThreshold = locations.length * 0.75;
      const popularCategories = Array.from(categoryFrequency.entries())
        .filter(([_, count]) => count >= popularThreshold)
        .map(([cat, _]) => cat);

      // Check each location for missing popular categories
      for (const { location } of locations) {
        const missingCategories = popularCategories.filter(
          cat => !location.categories.includes(cat)
        );

        if (missingCategories.length > 0) {
          const categoryList = missingCategories.join(', ');
          const pct = Math.round((categoryFrequency.get(missingCategories[0]) || 0) / locations.length * 100);

          // Get original metrics for product context
          const metrics = locationMap.get(location.customer_id);
          const productContext = metrics ? buildProductContext(metrics, locations, distributorName) : undefined;

          recommendations.push({
            priority: missingCategories.length >= 3 ? 'high' : 'medium',
            title: `Category Gap: ${location.customer_name}`,
            problem: `Missing ${missingCategories.length} popular categor${missingCategories.length > 1 ? 'ies' : 'y'}: ${categoryList} (purchased by ${pct}% of ${distributorName} locations)`,
            recommendation: `Introduce these product categories through targeted marketing. Send product catalogs and offer introductory pricing.`,
            expected_impact: `Cross-sell opportunity estimated at $${((location.revenue * 0.15) / 1000).toFixed(0)}K based on peer purchasing patterns.`,
            action_items: [
              `Send ${missingCategories[0]} product catalog`,
              'Offer sample products or demo',
              'Provide competitive pricing comparison',
              'Schedule product training session',
            ],
            category: 'categorygap',
            distributor_name: distributorName,
            customer_id: location.customer_id,
            customer_name: location.customer_name,
            product_context: productContext,
          });
        }
      }
    }

    // Generate executive summary
    const totalInsights = recommendations.length;
    const highPriority = recommendations.filter(r => r.priority === 'high').length;
    const atRiskCount = recommendations.filter(r => r.category === 'attrisk').length;
    const growthCount = recommendations.filter(r => r.category === 'growth').length;
    const categoryGapCount = recommendations.filter(r => r.category === 'categorygap').length;

    const executiveSummary = `Analysis of ${distributorMap.size} distributors identified ${totalInsights} actionable insights (${highPriority} high priority).

AT-RISK LOCATIONS (${atRiskCount}): These locations require immediate attention due to revenue decline or inactivity. Priority should be given to locations with both declining revenue and extended inactivity periods.

GROWTH OPPORTUNITIES (${growthCount}): Locations performing below their distributor's average represent significant revenue expansion potential through product mix optimization and strategic engagement.

CATEGORY GAPS (${categoryGapCount}): Cross-sell opportunities exist where locations are not purchasing popular categories bought by their peers. Targeted product introduction campaigns could capture this whitespace.

RECOMMENDED ACTIONS: Focus on high-priority at-risk locations first to prevent churn, then pursue growth opportunities and category gaps systematically. Consider creating dedicated outreach campaigns for each category.`;

    // Sort recommendations by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return NextResponse.json({
      recommendations: recommendations.slice(0, 50), // Limit to top 50
      executive_summary: executiveSummary,
      metadata: {
        total_distributors: distributorMap.size,
        total_locations: Array.from(distributorMap.values()).reduce((sum, locs) => sum + locs.length, 0),
        insights_by_category: {
          attrisk: atRiskCount,
          growth: growthCount,
          categorygap: categoryGapCount,
          expansion: 0,
        },
        insights_by_priority: {
          high: highPriority,
          medium: recommendations.filter(r => r.priority === 'medium').length,
          low: recommendations.filter(r => r.priority === 'low').length,
        },
      },
    });

  } catch (error) {
    console.error('Error generating distributor insights:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate insights',
        message: error instanceof Error ? error.message : 'Unknown error',
        recommendations: [],
        executive_summary: '',
      },
      { status: 500 }
    );
  }
}
