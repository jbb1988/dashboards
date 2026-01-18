import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  getDistributor,
  extractLocation,
  calculateDistributorMetrics,
  calculateGrowthScore,
  isGrowthOpportunity,
  getAllDistributors,
  type DistributorLocation,
  type GrowthScore
} from '@/lib/distributorAnalysis';

export const dynamic = 'force-dynamic';

// Strategic Account Command Center calculation function
function calculateStrategicAccountData(distributors: DistributorData[], totalRevenue: number) {
  // Portfolio entities for matrix
  const portfolioEntities = distributors.map(dist => {
    const daysSincePurchase = dist.locations.reduce((max, loc) => {
      if (!loc.last_purchase_date) return 999;
      const days = Math.floor((Date.now() - new Date(loc.last_purchase_date).getTime()) / (1000 * 60 * 60 * 24));
      return Math.max(max, days);
    }, 0);

    return {
      id: dist.distributor_name.toLowerCase().replace(/\s+/g, '-'),
      name: dist.distributor_name,
      revenue: dist.total_revenue,
      yoy_change_pct: dist.yoy_change_pct,
      margin_pct: dist.total_margin_pct,
      days_since_purchase: daysSincePurchase,
      is_growing: dist.yoy_change_pct > 5,
      is_healthy: dist.yoy_change_pct > -10 && daysSincePurchase < 60,
    };
  });

  // Revenue at risk (distributors with declining revenue or inactive)
  const atRisk = distributors
    .filter(dist => {
      const avgDaysSince = dist.locations.reduce((sum, loc) => {
        if (!loc.last_purchase_date) return sum + 90;
        const days = Math.floor((Date.now() - new Date(loc.last_purchase_date).getTime()) / (1000 * 60 * 60 * 24));
        return sum + days;
      }, 0) / dist.locations.length;
      return dist.yoy_change_pct < -10 || avgDaysSince > 60;
    })
    .map(dist => {
      const avgDaysSince = Math.floor(dist.locations.reduce((sum, loc) => {
        if (!loc.last_purchase_date) return sum + 90;
        const days = Math.floor((Date.now() - new Date(loc.last_purchase_date).getTime()) / (1000 * 60 * 60 * 24));
        return sum + days;
      }, 0) / dist.locations.length);

      let reason = '';
      if (avgDaysSince > 90) reason = `Inactive ${avgDaysSince} days`;
      else if (dist.yoy_change_pct < -15) reason = 'Revenue declining >15%';
      else if (dist.total_margin_pct < 10) reason = 'Margin pressure';
      else reason = 'Multiple risk factors';

      return {
        name: dist.distributor_name,
        amount: dist.total_revenue * 0.15, // Estimate 15% at risk
        reason,
        days_inactive: avgDaysSince > 60 ? avgDaysSince : undefined,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  // Quick wins (distributors with growth potential)
  const quickWins = distributors
    .filter(dist => dist.growth_opportunities > 0 && dist.yoy_change_pct > -5)
    .map(dist => ({
      name: dist.distributor_name,
      amount: dist.avg_revenue_per_location * dist.growth_opportunities * 0.2, // 20% uplift estimate
      type: 'quick-win' as const,
      action: `${dist.growth_opportunities} location expansion opportunities`,
    }))
    .sort((a, b) => b.amount - a.amount);

  // Strategic growth (top performing distributors for expansion)
  const strategicGrowth = distributors
    .filter(dist => dist.yoy_change_pct > 10 && dist.total_margin_pct > 15)
    .slice(0, 5)
    .map(dist => ({
      name: dist.distributor_name,
      amount: dist.total_revenue * 0.15, // 15% growth potential
      type: 'strategic' as const,
      action: 'Strategic partnership expansion',
    }))
    .sort((a, b) => b.amount - a.amount);

  // Priority actions
  const priorityActions = [];
  let rank = 1;

  // Critical: At-risk distributors
  atRisk.forEach(risk => {
    priorityActions.push({
      id: `action-${rank}`,
      rank,
      action: `Intervention Required - ${risk.reason}`,
      entityName: risk.name,
      entityId: risk.name.toLowerCase().replace(/\s+/g, '-'),
      impact: risk.amount,
      riskLevel: risk.days_inactive && risk.days_inactive > 90 ? 'CRITICAL' : 'HIGH' as const,
      category: risk.days_inactive ? 'inactive' : 'margin' as const,
      owner: undefined,
      dueDate: new Date(Date.now() + (risk.days_inactive && risk.days_inactive > 90 ? 7 : 14) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'open' as const,
      effort: 'medium' as const,
      playbook: {
        context: `${risk.name} shows concerning signs: ${risk.reason}. Immediate action needed to prevent revenue loss.`,
        talkingPoints: [
          'Review recent activity and identify any service issues',
          'Schedule call with key stakeholder to understand concerns',
          'Identify competitive threats or internal challenges',
          'Propose recovery plan with specific value propositions',
        ],
        successMetrics: [
          'Schedule follow-up meeting within 7 days',
          'Identify root cause of decline',
          'Create action plan with quarterly targets',
          'Re-engage within 30 days',
        ],
      },
    });
    rank++;
  });

  // High: Quick wins
  quickWins.forEach(opp => {
    priorityActions.push({
      id: `action-${rank}`,
      rank,
      action: opp.action,
      entityName: opp.name,
      entityId: opp.name.toLowerCase().replace(/\s+/g, '-'),
      impact: opp.amount,
      riskLevel: 'HIGH' as const,
      category: 'expansion' as const,
      owner: undefined,
      dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'open' as const,
      effort: 'low' as const,
      playbook: {
        context: `${opp.name} has ${opp.action.split(' ')[0]} locations ready for expansion. Low-hanging fruit opportunity.`,
        talkingPoints: [
          'Identify top-performing locations as expansion models',
          'Analyze category gaps across all locations',
          'Present cross-sell opportunities with data',
          'Create location-specific expansion roadmap',
        ],
        successMetrics: [
          'Expand to 2+ new categories per location',
          'Increase average order frequency by 20%',
          'Track category adoption rate',
          'Measure incremental revenue per location',
        ],
      },
    });
    rank++;
  });

  // Limit to top 10 actions
  const topActions = priorityActions.slice(0, 10);

  return {
    portfolioEntities,
    revenueBridge: {
      currentRevenue: totalRevenue,
      targetRevenue: totalRevenue * 1.15, // 15% growth target
      atRisk,
      quickWins,
      strategicGrowth,
    },
    priorityActions: topActions,
  };
}

interface LocationMetrics {
  customer_id: string;
  customer_name: string;
  current_revenue: number;
  current_cost: number;
  current_gross_profit: number;
  current_margin_pct: number;
  current_units: number;
  prior_revenue: number;
  prior_cost: number;
  prior_gross_profit: number;
  categories: string[];
  category_count: number;
  last_purchase_date: string | null;
}

interface DistributorData {
  distributor_name: string;
  total_revenue: number;
  prior_revenue: number;
  yoy_change_pct: number;
  location_count: number;
  avg_revenue_per_location: number;
  total_margin_pct: number;
  category_penetration: number;
  growth_opportunities: number;
  locations: DistributorLocation[];
}

export async function GET(request: NextRequest) {
  try {
    const admin = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);

    // Parse filters
    const yearsParam = searchParams.get('years');
    const monthsParam = searchParams.get('months');
    const className = searchParams.get('className');
    const viewMode = searchParams.get('view') || 'distributor'; // 'distributor' or 'location'

    const years = yearsParam ? yearsParam.split(',').map(Number).filter(n => !isNaN(n)) : [];
    const months = monthsParam ? monthsParam.split(',').map(Number).filter(n => !isNaN(n)) : [];

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    // Calculate date ranges based on filters
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
      // No year filter - use R12
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

    // Build query for current period
    let currentQuery = admin
      .from('diversified_sales')
      .select('customer_id, customer_name, revenue, cost, gross_profit, gross_profit_pct, quantity, class_category, transaction_date');

    currentQuery = currentQuery
      .gte('transaction_date', formatDate(currentPeriodStart))
      .lte('transaction_date', formatDate(currentPeriodEnd));

    if (className) {
      currentQuery = currentQuery.eq('class_name', className);
    }

    // Build query for prior period
    let priorQuery = admin
      .from('diversified_sales')
      .select('customer_id, customer_name, revenue, cost, gross_profit, quantity');

    priorQuery = priorQuery
      .gte('transaction_date', formatDate(priorPeriodStart))
      .lte('transaction_date', formatDate(priorPeriodEnd));

    if (className) {
      priorQuery = priorQuery.eq('class_name', className);
    }

    // Execute queries
    const [currentResult, priorResult] = await Promise.all([
      currentQuery,
      priorQuery
    ]);

    if (currentResult.error) throw currentResult.error;
    if (priorResult.error) throw priorResult.error;

    const currentData = currentResult.data || [];
    const priorData = priorResult.data || [];

    // Query total diversified revenue (not filtered by distributor) for percentage calculation
    let totalDiversifiedQuery = admin
      .from('diversified_sales')
      .select('revenue');

    totalDiversifiedQuery = totalDiversifiedQuery
      .gte('transaction_date', formatDate(currentPeriodStart))
      .lte('transaction_date', formatDate(currentPeriodEnd));

    if (className) {
      totalDiversifiedQuery = totalDiversifiedQuery.eq('class_name', className);
    }

    const totalDiversifiedResult = await totalDiversifiedQuery;
    if (totalDiversifiedResult.error) throw totalDiversifiedResult.error;

    const totalDiversifiedRevenue = (totalDiversifiedResult.data || []).reduce(
      (sum, row) => sum + (row.revenue || 0),
      0
    );

    // Aggregate by customer (location)
    const locationMap = new Map<string, LocationMetrics>();

    // Process current period
    for (const row of currentData) {
      const key = row.customer_id;
      const existing = locationMap.get(key);

      if (existing) {
        existing.current_revenue += row.revenue || 0;
        existing.current_cost += row.cost || 0;
        existing.current_gross_profit += row.gross_profit || 0;
        existing.current_units += row.quantity || 0;
        if (row.class_category && !existing.categories.includes(row.class_category)) {
          existing.categories.push(row.class_category);
        }
        if (row.transaction_date && (!existing.last_purchase_date || row.transaction_date > existing.last_purchase_date)) {
          existing.last_purchase_date = row.transaction_date;
        }
      } else {
        locationMap.set(key, {
          customer_id: row.customer_id,
          customer_name: row.customer_name,
          current_revenue: row.revenue || 0,
          current_cost: row.cost || 0,
          current_gross_profit: row.gross_profit || 0,
          current_margin_pct: row.gross_profit_pct || 0,
          current_units: row.quantity || 0,
          prior_revenue: 0,
          prior_cost: 0,
          prior_gross_profit: 0,
          categories: row.class_category ? [row.class_category] : [],
          category_count: 0,
          last_purchase_date: row.transaction_date || null
        });
      }
    }

    // Process prior period
    for (const row of priorData) {
      const key = row.customer_id;
      const existing = locationMap.get(key);

      if (existing) {
        existing.prior_revenue += row.revenue || 0;
        existing.prior_cost += row.cost || 0;
        existing.prior_gross_profit += row.gross_profit || 0;
      } else {
        // Location existed in prior but not current - still include
        locationMap.set(key, {
          customer_id: row.customer_id,
          customer_name: row.customer_name,
          current_revenue: 0,
          current_cost: 0,
          current_gross_profit: 0,
          current_margin_pct: 0,
          current_units: 0,
          prior_revenue: row.revenue || 0,
          prior_cost: row.cost || 0,
          prior_gross_profit: row.gross_profit || 0,
          categories: [],
          category_count: 0,
          last_purchase_date: null
        });
      }
    }

    // Calculate derived metrics and group by distributor
    const distributorMap = new Map<string, DistributorLocation[]>();

    for (const [_, metrics] of locationMap) {
      // Identify distributor from customer name
      const distributorName = getDistributor(metrics.customer_name);
      if (!distributorName) continue;  // Skip non-distributor customers

      // Extract location info
      const locationInfo = extractLocation(metrics.customer_name, distributorName);

      // Calculate YoY change
      const yoyChangePct = metrics.prior_revenue > 0
        ? ((metrics.current_revenue - metrics.prior_revenue) / metrics.prior_revenue) * 100
        : metrics.current_revenue > 0 ? 100 : 0;

      // Calculate margin pct
      const marginPct = metrics.current_revenue > 0
        ? (metrics.current_gross_profit / metrics.current_revenue) * 100
        : 0;

      // Update category count
      metrics.category_count = metrics.categories.length;

      const location: DistributorLocation = {
        customer_id: metrics.customer_id,
        customer_name: metrics.customer_name,
        location: locationInfo.location,
        state: locationInfo.state,
        location_confidence: locationInfo.confidence,
        revenue: metrics.current_revenue,
        prior_revenue: metrics.prior_revenue,
        cost: metrics.current_cost,
        gross_profit: metrics.current_gross_profit,
        margin_pct: marginPct,
        yoy_change_pct: yoyChangePct,
        units: metrics.current_units,
        categories: metrics.categories,
        category_count: metrics.category_count,
        last_purchase_date: metrics.last_purchase_date,
        is_opportunity: false  // Will be calculated after we have all locations
      };

      // Group by distributor
      if (!distributorMap.has(distributorName)) {
        distributorMap.set(distributorName, []);
      }
      distributorMap.get(distributorName)!.push(location);
    }

    // Calculate distributor-level metrics and identify opportunities
    const distributors: DistributorData[] = [];

    for (const [distributorName, locations] of distributorMap) {
      if (locations.length === 0) continue;

      // Calculate distributor averages
      const distributorMetrics = calculateDistributorMetrics(locations);

      // Calculate growth scores and identify opportunities
      let opportunityCount = 0;

      for (const location of locations) {
        // Calculate growth score
        location.growth_score = calculateGrowthScore(location, distributorMetrics);

        // Determine if it's an opportunity
        location.is_opportunity = isGrowthOpportunity(location, locations);

        if (location.is_opportunity) {
          opportunityCount++;
        }
      }

      // Calculate distributor totals
      const totalRevenue = locations.reduce((sum, loc) => sum + loc.revenue, 0);
      const totalPriorRevenue = locations.reduce((sum, loc) => sum + loc.prior_revenue, 0);
      const totalGrossProfit = locations.reduce((sum, loc) => sum + loc.gross_profit, 0);

      const yoyChangePct = totalPriorRevenue > 0
        ? ((totalRevenue - totalPriorRevenue) / totalPriorRevenue) * 100
        : totalRevenue > 0 ? 100 : 0;

      const totalMarginPct = totalRevenue > 0
        ? (totalGrossProfit / totalRevenue) * 100
        : 0;

      distributors.push({
        distributor_name: distributorName,
        total_revenue: totalRevenue,
        prior_revenue: totalPriorRevenue,
        yoy_change_pct: yoyChangePct,
        location_count: locations.length,
        avg_revenue_per_location: locations.length > 0 ? totalRevenue / locations.length : 0,
        total_margin_pct: totalMarginPct,
        category_penetration: distributorMetrics.category_penetration,
        growth_opportunities: opportunityCount,
        locations: locations.sort((a, b) => b.revenue - a.revenue)  // Sort by revenue desc
      });
    }

    // Sort distributors by total revenue desc
    distributors.sort((a, b) => b.total_revenue - a.total_revenue);

    // Calculate summary
    const totalDistributors = distributors.length;
    const totalLocations = distributors.reduce((sum, d) => sum + d.location_count, 0);
    const totalRevenue = distributors.reduce((sum, d) => sum + d.total_revenue, 0);
    const avgRevenuePerLocation = totalLocations > 0 ? totalRevenue / totalLocations : 0;

    // Count opportunities by tier
    let highOpps = 0;
    let mediumOpps = 0;
    let lowOpps = 0;

    for (const dist of distributors) {
      for (const loc of dist.locations) {
        if (!loc.is_opportunity) continue;

        const tier = loc.growth_score?.tier || 'low';
        if (tier === 'high') highOpps++;
        else if (tier === 'medium') mediumOpps++;
        else lowOpps++;
      }
    }

    const totalOpportunities = highOpps + mediumOpps + lowOpps;

    // Get all unique categories
    const allCategories = new Set<string>();
    for (const dist of distributors) {
      for (const loc of dist.locations) {
        for (const cat of loc.categories) {
          allCategories.add(cat);
        }
      }
    }

    // Calculate Strategic Account Command Center data
    const strategicAccountData = calculateStrategicAccountData(distributors, totalRevenue);

    // Return different response based on view mode
    if (viewMode === 'location') {
      // Flatten all locations with distributor_name
      const allLocations = distributors.flatMap(dist =>
        dist.locations.map(loc => ({
          ...loc,
          distributor_name: dist.distributor_name,
        }))
      );

      // Sort locations by revenue descending
      allLocations.sort((a, b) => b.revenue - a.revenue);

      return NextResponse.json({
        locations: allLocations,
        summary: {
          total_distributors: totalDistributors,
          total_locations: totalLocations,
          total_revenue: totalRevenue,
          total_diversified_revenue: totalDiversifiedRevenue,
          avg_revenue_per_location: avgRevenuePerLocation,
          total_growth_opportunities: totalOpportunities,
          opportunities_by_tier: {
            high: highOpps,
            medium: mediumOpps,
            low: lowOpps
          }
        },
        periods: {
          current: {
            start: formatDate(currentPeriodStart),
            end: formatDate(currentPeriodEnd)
          },
          prior: {
            start: formatDate(priorPeriodStart),
            end: formatDate(priorPeriodEnd)
          }
        },
        categories: Array.from(allCategories).sort(),
        strategicAccountData
      });
    }

    // Default: Return distributor view
    return NextResponse.json({
      distributors,
      summary: {
        total_distributors: totalDistributors,
        total_locations: totalLocations,
        total_revenue: totalRevenue,
        total_diversified_revenue: totalDiversifiedRevenue,
        avg_revenue_per_location: avgRevenuePerLocation,
        total_growth_opportunities: totalOpportunities,
        opportunities_by_tier: {
          high: highOpps,
          medium: mediumOpps,
          low: lowOpps
        }
      },
      periods: {
        current: {
          start: formatDate(currentPeriodStart),
          end: formatDate(currentPeriodEnd)
        },
        prior: {
          start: formatDate(priorPeriodStart),
          end: formatDate(priorPeriodEnd)
        }
      },
      categories: Array.from(allCategories).sort(),
      strategicAccountData
    });

  } catch (error) {
    console.error('Error fetching distributor data:', error);

    const errorResponse = {
      error: 'Failed to fetch distributor data',
      message: error instanceof Error ? error.message : 'Unknown error',
      summary: {
        total_distributors: 0,
        total_locations: 0,
        total_revenue: 0,
        avg_revenue_per_location: 0,
        total_growth_opportunities: 0,
        opportunities_by_tier: { high: 0, medium: 0, low: 0 }
      }
    };

    // Add appropriate data field based on view mode
    const { searchParams: errorSearchParams } = new URL(request.url);
    if (errorSearchParams.get('view') === 'location') {
      return NextResponse.json({ ...errorResponse, locations: [] }, { status: 500 });
    } else {
      return NextResponse.json({ ...errorResponse, distributors: [] }, { status: 500 });
    }
  }
}
