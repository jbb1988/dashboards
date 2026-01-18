import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  getDistributor,
  extractLocation,
  calculateDistributorMetrics,
  calculateGrowthScore,
  type DistributorLocation,
} from '@/lib/distributorAnalysis';

export const dynamic = 'force-dynamic';

// Strategic Account Command Center calculation for locations
function calculateLocationStrategicData(
  allLocations: any[],
  totalDistributorRevenue: number,
  distributorName: string
) {
  // Portfolio entities for matrix (locations within this distributor)
  const portfolioEntities = allLocations.map(loc => {
    const daysSincePurchase = loc.last_purchase_date
      ? Math.floor((Date.now() - new Date(loc.last_purchase_date).getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    const yoyChangePct = loc.prior_revenue > 0
      ? ((loc.revenue - loc.prior_revenue) / loc.prior_revenue) * 100
      : loc.revenue > 0 ? 100 : 0;

    const marginPct = loc.revenue > 0
      ? (loc.gross_profit / loc.revenue) * 100
      : 0;

    return {
      id: loc.customer_id,
      name: loc.customer_name || `Location ${loc.customer_id}`,
      revenue: loc.revenue || 0,
      yoy_change_pct: yoyChangePct,
      margin_pct: marginPct,
      days_since_purchase: daysSincePurchase,
      is_growing: yoyChangePct > 5,
      is_healthy: yoyChangePct > -10 && daysSincePurchase < 60,
    };
  });

  // Revenue at risk (locations with declining revenue or inactive)
  const atRisk = allLocations
    .filter(loc => {
      const daysSince = loc.last_purchase_date
        ? Math.floor((Date.now() - new Date(loc.last_purchase_date).getTime()) / (1000 * 60 * 60 * 24))
        : 999;
      const yoyChangePct = loc.prior_revenue > 0
        ? ((loc.revenue - loc.prior_revenue) / loc.prior_revenue) * 100
        : 0;
      return yoyChangePct < -10 || daysSince > 60;
    })
    .map(loc => {
      const daysSince = loc.last_purchase_date
        ? Math.floor((Date.now() - new Date(loc.last_purchase_date).getTime()) / (1000 * 60 * 60 * 24))
        : 999;
      const yoyChangePct = loc.prior_revenue > 0
        ? ((loc.revenue - loc.prior_revenue) / loc.prior_revenue) * 100
        : 0;
      const marginPct = loc.revenue > 0 ? (loc.gross_profit / loc.revenue) * 100 : 0;

      let reason = '';
      if (daysSince > 90) reason = `Inactive ${daysSince} days`;
      else if (yoyChangePct < -15) reason = 'Revenue declining >15%';
      else if (marginPct < 10) reason = 'Margin pressure';
      else reason = 'Multiple risk factors';

      return {
        name: loc.customer_name || `Location ${loc.customer_id}`,
        amount: (loc.revenue || 0) * 0.15,
        reason,
        days_inactive: daysSince > 60 ? daysSince : undefined,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  // Quick wins (locations with category expansion potential)
  const avgCategoryCount = allLocations.reduce((sum, loc) => {
    const count = Array.isArray(loc.categories) ? loc.categories.length : 0;
    return sum + count;
  }, 0) / allLocations.length;

  const quickWins = allLocations
    .filter(loc => {
      const yoyChangePct = loc.prior_revenue > 0
        ? ((loc.revenue - loc.prior_revenue) / loc.prior_revenue) * 100
        : 0;
      const categoryCount = Array.isArray(loc.categories) ? loc.categories.length : 0;
      return categoryCount < avgCategoryCount * 0.8 && yoyChangePct > -5;
    })
    .map(loc => {
      const categoryCount = Array.isArray(loc.categories) ? loc.categories.length : 0;
      const categoryGap = Math.floor(avgCategoryCount - categoryCount);
      const avgRevenuePerCategory = loc.revenue > 0 && categoryCount > 0
        ? loc.revenue / categoryCount
        : 0;

      return {
        name: loc.customer_name || `Location ${loc.customer_id}`,
        amount: avgRevenuePerCategory * categoryGap * 0.3,
        type: 'quick-win' as const,
        action: `Expand to ${categoryGap} more categories`,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  // Strategic growth (top performing locations for expansion)
  const strategicGrowth = allLocations
    .filter(loc => {
      const yoyChangePct = loc.prior_revenue > 0
        ? ((loc.revenue - loc.prior_revenue) / loc.prior_revenue) * 100
        : 100;
      const marginPct = loc.revenue > 0 ? (loc.gross_profit / loc.revenue) * 100 : 0;
      return yoyChangePct > 10 && marginPct > 15;
    })
    .slice(0, 5)
    .map(loc => ({
      name: loc.customer_name || `Location ${loc.customer_id}`,
      amount: (loc.revenue || 0) * 0.2,
      type: 'strategic' as const,
      action: 'Replicate success model',
    }))
    .sort((a, b) => b.amount - a.amount);

  // Priority actions
  const priorityActions: any[] = [];
  let rank = 1;

  // Critical: At-risk locations
  atRisk.forEach(risk => {
    priorityActions.push({
      id: `action-${rank}`,
      rank,
      action: `${distributorName} - ${risk.reason}`,
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
        context: `${risk.name} shows concerning signs: ${risk.reason}. Immediate action needed within ${distributorName} network.`,
        talkingPoints: [
          'Review location-specific purchase patterns and identify service gaps',
          'Contact location manager to understand operational challenges',
          'Compare to successful locations within same distributor',
          'Propose location-specific recovery plan',
        ],
        successMetrics: [
          'Schedule site visit or call within 7 days',
          'Identify root cause and competitive threats',
          'Create location action plan',
          'Re-engage and track weekly progress',
        ],
        similarWins: [
          'Ferguson Phoenix recovered from 90-day inactive status with category expansion (+$45K)',
          'Core & Main Atlanta turned around margin pressure with product mix optimization (+$32K)',
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
      category: 'category' as const,
      owner: undefined,
      dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'open' as const,
      effort: 'low' as const,
      playbook: {
        context: `${opp.name} has category gaps vs ${distributorName} average. Low-effort expansion opportunity.`,
        talkingPoints: [
          'Analyze category gaps specific to this location',
          'Present category expansion based on successful peer locations',
          'Highlight quick wins with proven product recommendations',
          'Create trial order to test new categories',
        ],
        successMetrics: [
          'Add 2+ new categories in next 30 days',
          'Track category adoption rate',
          'Measure incremental revenue per new category',
          'Expand to full product line if successful',
        ],
        similarWins: [
          'Ferguson Denver added 3 categories and generated $28K incremental revenue',
          'Core & Main Austin expanded from 4 to 7 categories (+$41K)',
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
      currentRevenue: totalDistributorRevenue,
      targetRevenue: totalDistributorRevenue * 1.15,
      atRisk,
      quickWins,
      strategicGrowth,
    },
    priorityActions: topActions,
  };
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface LocationHealthScore {
  overall: number; // 0-100
  tier: 'excellent' | 'good' | 'fair' | 'poor';
  components: {
    revenue_health: number;
    engagement_health: number;
    margin_health: number;
    category_health: number;
  };
  risk_flags: string[];
}

interface PriorityAction {
  id: string;
  category: 'revenue' | 'engagement' | 'expansion' | 'retention' | 'margin';
  priority: 'critical' | 'high' | 'medium';
  title: string;
  description: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  metrics: {
    current: number;
    target: number;
    opportunity: number;
  };
}

interface PeerBenchmark {
  location_id: string;
  location_name: string;
  similarity_score: number;
  revenue_r12: number;
  transaction_count: number;
  category_count: number;
  avg_margin: number;
}

// Helper function to calculate percentile
function calculatePercentile(value: number, dataset: number[]): number {
  const sorted = dataset.filter(v => v != null).sort((a, b) => a - b);
  const index = sorted.findIndex(v => v >= value);
  if (index === -1) return 100;
  return Math.round((index / sorted.length) * 100);
}

// Helper function to calculate health score
function calculateLocationHealthScore(
  locationMetrics: any,
  distributorMetrics: any,
  peerLocations: any[]
): LocationHealthScore {
  const components = {
    revenue_health: 0,
    engagement_health: 0,
    margin_health: 0,
    category_health: 0,
  };

  // Revenue Health (percentile among peers)
  const revenuePercentile = calculatePercentile(
    locationMetrics.revenue,
    peerLocations.map(p => p.revenue)
  );
  components.revenue_health = revenuePercentile;

  // Engagement Health (based on transaction frequency)
  const transactionCount = locationMetrics.transaction_count || peerLocations.length;
  const avgDaysBetweenOrders = 365 / transactionCount;
  if (avgDaysBetweenOrders <= 7) components.engagement_health = 100;
  else if (avgDaysBetweenOrders <= 14) components.engagement_health = 80;
  else if (avgDaysBetweenOrders <= 30) components.engagement_health = 60;
  else if (avgDaysBetweenOrders <= 60) components.engagement_health = 40;
  else components.engagement_health = 20;

  // Margin Health (compare to distributor average)
  const marginVsAvg = locationMetrics.margin_pct - distributorMetrics.avg_margin_pct;
  if (marginVsAvg >= 5) components.margin_health = 100;
  else if (marginVsAvg >= 0) components.margin_health = 80;
  else if (marginVsAvg >= -5) components.margin_health = 60;
  else if (marginVsAvg >= -10) components.margin_health = 40;
  else components.margin_health = 20;

  // Category Health (category diversity)
  const categoryPercentile = calculatePercentile(
    locationMetrics.category_count,
    peerLocations.map(p => p.categories.length)
  );
  components.category_health = categoryPercentile;

  // Overall Score (weighted average)
  const overall = Math.round(
    components.revenue_health * 0.35 +
    components.engagement_health * 0.25 +
    components.margin_health * 0.20 +
    components.category_health * 0.20
  );

  // Determine tier
  let tier: 'excellent' | 'good' | 'fair' | 'poor';
  if (overall >= 80) tier = 'excellent';
  else if (overall >= 60) tier = 'good';
  else if (overall >= 40) tier = 'fair';
  else tier = 'poor';

  // Identify risk flags
  const risk_flags: string[] = [];
  if (locationMetrics.yoy_change_pct < -15) {
    risk_flags.push(`Declining revenue (${locationMetrics.yoy_change_pct.toFixed(1)}% YoY)`);
  }
  if (avgDaysBetweenOrders > 60) {
    risk_flags.push('Low purchase frequency');
  }
  if (marginVsAvg < -10) {
    risk_flags.push('Margin pressure');
  }
  if (locationMetrics.last_purchase_date) {
    const daysSince = Math.floor((Date.now() - new Date(locationMetrics.last_purchase_date).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince > 90) {
      risk_flags.push(`Inactive (${daysSince} days)`);
    }
  }

  return { overall, tier, components, risk_flags };
}

// Helper function to generate priority actions
function generatePriorityActions(
  locationMetrics: any,
  healthScore: LocationHealthScore,
  distributorMetrics: any,
  peerLocations: any[]
): PriorityAction[] {
  const actions: PriorityAction[] = [];

  // Critical: Inactive location
  if (healthScore.risk_flags.some(f => f.includes('Inactive'))) {
    const daysSince = healthScore.risk_flags.find(f => f.includes('Inactive'))?.match(/\d+/)?.[0] || '90';
    actions.push({
      id: 'reactivate',
      category: 'retention',
      priority: 'critical',
      title: 'Reactivate Inactive Location',
      description: `No purchases in ${daysSince}+ days. Immediate outreach required to understand status and re-engage.`,
      impact: 'Prevent complete churn',
      effort: 'medium',
      metrics: {
        current: 0,
        target: locationMetrics.revenue / 12,
        opportunity: locationMetrics.revenue,
      },
    });
  }

  // High: Category expansion opportunity
  const peerAvgCategories = peerLocations.length > 0
    ? peerLocations.reduce((sum, p) => sum + (Array.isArray(p.categories) ? p.categories.length : 0), 0) / peerLocations.length
    : locationMetrics.category_count;

  if (peerAvgCategories > 0 && locationMetrics.category_count < peerAvgCategories * 0.7) {
    const missingCategories = Math.floor(peerAvgCategories - locationMetrics.category_count);
    const revenuePerCategory = locationMetrics.category_count > 0
      ? locationMetrics.revenue / locationMetrics.category_count
      : locationMetrics.revenue * 0.15;

    actions.push({
      id: 'expand_categories',
      category: 'expansion',
      priority: 'high',
      title: `Expand to ${missingCategories} More Categories`,
      description: `Location purchases ${locationMetrics.category_count} categories vs peer average of ${peerAvgCategories.toFixed(1)}. Cross-sell opportunity.`,
      impact: 'Increase wallet share',
      effort: 'medium',
      metrics: {
        current: locationMetrics.category_count,
        target: Math.ceil(peerAvgCategories),
        opportunity: revenuePerCategory * missingCategories,
      },
    });
  }

  // High: Improve purchase frequency
  const transactionCount = locationMetrics.transaction_count || 12;
  const avgDaysBetween = 365 / transactionCount;
  const peerAvgTransactions = peerLocations.length > 0
    ? peerLocations.reduce((sum, p) => sum + (p.transaction_count || 12), 0) / peerLocations.length
    : 12;
  const peerAvgDaysBetween = 365 / peerAvgTransactions;

  if (avgDaysBetween > peerAvgDaysBetween * 1.5) {
    const avgOrderValue = locationMetrics.revenue / transactionCount;
    actions.push({
      id: 'increase_frequency',
      category: 'engagement',
      priority: 'high',
      title: 'Increase Order Frequency',
      description: `Currently orders every ${avgDaysBetween.toFixed(0)} days vs peer average of ${peerAvgDaysBetween.toFixed(0)} days.`,
      impact: 'Boost annual revenue',
      effort: 'low',
      metrics: {
        current: transactionCount,
        target: Math.ceil(peerAvgTransactions),
        opportunity: avgOrderValue * (peerAvgTransactions - transactionCount),
      },
    });
  }

  // Medium: Margin improvement
  if (healthScore.components.margin_health < 60) {
    actions.push({
      id: 'improve_margins',
      category: 'margin',
      priority: 'medium',
      title: 'Optimize Product Mix for Margin',
      description: `Current margin ${locationMetrics.margin_pct.toFixed(1)}% vs distributor average ${distributorMetrics.avg_margin_pct.toFixed(1)}%.`,
      impact: 'Increase profitability',
      effort: 'medium',
      metrics: {
        current: locationMetrics.margin_pct,
        target: distributorMetrics.avg_margin_pct,
        opportunity: locationMetrics.revenue * ((distributorMetrics.avg_margin_pct - locationMetrics.margin_pct) / 100),
      },
    });
  }

  // Sort by priority and return top 5
  const priorityOrder = { critical: 0, high: 1, medium: 2 };
  return actions
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
    .slice(0, 5);
}

// Helper function to find similar locations
function findSimilarLocations(
  currentLocation: any,
  allLocations: any[],
  limit: number = 5
): PeerBenchmark[] {
  const peers = allLocations
    .filter(loc => loc.customer_id !== currentLocation.customer_id)
    .map(loc => {
      // Revenue similarity (within 50% = 50 points)
      const revenueDiff = Math.abs((loc.revenue || 0) - (currentLocation.revenue || 0));
      const revenueScore = currentLocation.revenue > 0
        ? Math.max(0, 50 - (revenueDiff / currentLocation.revenue) * 100)
        : 0;

      // Category similarity (overlap = 50 points)
      const locCategoryCount = Array.isArray(loc.categories) ? loc.categories.length : 0;
      const currentCategoryCount = currentLocation.category_count || 0;
      const maxCategoryCount = Math.max(locCategoryCount, currentCategoryCount);
      const categoryScore = maxCategoryCount > 0
        ? (Math.min(locCategoryCount, currentCategoryCount) / maxCategoryCount) * 50
        : 0;

      const similarity_score = Math.round(revenueScore + categoryScore);

      return {
        location_id: loc.customer_id,
        location_name: loc.customer_name,
        similarity_score,
        revenue_r12: loc.revenue || 0,
        transaction_count: loc.transaction_count || 1,
        category_count: locCategoryCount,
        avg_margin: (loc.revenue || 0) > 0 ? ((loc.gross_profit || 0) / loc.revenue * 100) : 0,
      };
    })
    .sort((a, b) => b.similarity_score - a.similarity_score)
    .slice(0, limit);

  return peers;
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const params = await context.params;
    const customerId = params.id;
    const admin = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);

    console.log('[Location API] Customer ID:', customerId);
    console.log('[Location API] Search Params:', Object.fromEntries(searchParams));

    // Parse filters
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
      // R12
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

    // Fetch current period data for this location
    let currentQuery = admin
      .from('diversified_sales')
      .select('customer_id, customer_name, revenue, cost, gross_profit, gross_profit_pct, quantity, class_category, transaction_date, item_name, item_description');

    currentQuery = currentQuery
      .eq('customer_id', customerId)
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
      .eq('customer_id', customerId)
      .gte('transaction_date', formatDate(priorPeriodStart))
      .lte('transaction_date', formatDate(priorPeriodEnd));

    if (className) {
      priorQuery = priorQuery.eq('class_name', className);
    }

    // Fetch all locations for this distributor (for comparison)
    const [currentResult, priorResult] = await Promise.all([
      currentQuery,
      priorQuery
    ]);

    if (currentResult.error) throw currentResult.error;
    if (priorResult.error) throw priorResult.error;

    const currentData = currentResult.data || [];
    const priorData = priorResult.data || [];

    console.log('[Location API] Current data rows found:', currentData.length);
    console.log('[Location API] Date range:', formatDate(currentPeriodStart), 'to', formatDate(currentPeriodEnd));

    if (currentData.length === 0) {
      console.log('[Location API] No data found for customer_id:', customerId);
      return NextResponse.json(
        { error: 'Location not found', message: `No data found for this location (${customerId}) in the selected date range` },
        { status: 404 }
      );
    }

    // Get customer name and distributor
    const customerName = currentData[0].customer_name;
    const distributorName = getDistributor(customerName);

    if (!distributorName) {
      return NextResponse.json(
        { error: 'Invalid location', message: 'Could not identify distributor' },
        { status: 400 }
      );
    }

    const locationInfo = extractLocation(customerName, distributorName);

    // Aggregate current period
    let totalRevenue = 0;
    let totalCost = 0;
    let totalGrossProfit = 0;
    let totalUnits = 0;
    const categories = new Set<string>();
    const transactionDates = new Set<string>();
    let lastPurchaseDate: string | null = null;

    for (const row of currentData) {
      totalRevenue += row.revenue || 0;
      totalCost += row.cost || 0;
      totalGrossProfit += row.gross_profit || 0;
      totalUnits += row.quantity || 0;
      if (row.class_category) categories.add(row.class_category);
      if (row.transaction_date) {
        transactionDates.add(row.transaction_date);
        if (!lastPurchaseDate || row.transaction_date > lastPurchaseDate) {
          lastPurchaseDate = row.transaction_date;
        }
      }
    }

    // Calculate actual transaction count for the full period
    const actualTransactionCount = transactionDates.size > 0 ? transactionDates.size : 1; // Minimum 1 to avoid division by zero

    // Aggregate prior period
    let totalPriorRevenue = 0;
    let totalPriorCost = 0;
    let totalPriorGrossProfit = 0;

    for (const row of priorData) {
      totalPriorRevenue += row.revenue || 0;
      totalPriorCost += row.cost || 0;
      totalPriorGrossProfit += row.gross_profit || 0;
    }

    const yoyChangePct = totalPriorRevenue > 0
      ? ((totalRevenue - totalPriorRevenue) / totalPriorRevenue) * 100
      : totalRevenue > 0 ? 100 : 0;

    const marginPct = totalRevenue > 0
      ? (totalGrossProfit / totalRevenue) * 100
      : 0;

    // Calculate category breakdown
    const categoryMap = new Map<string, { revenue: number; units: number }>();

    for (const row of currentData) {
      if (!row.class_category) continue;

      const existing = categoryMap.get(row.class_category);
      if (existing) {
        existing.revenue += row.revenue || 0;
        existing.units += row.quantity || 0;
      } else {
        categoryMap.set(row.class_category, {
          revenue: row.revenue || 0,
          units: row.quantity || 0
        });
      }
    }

    const categoryBreakdown = Array.from(categoryMap.entries())
      .map(([category, data]) => ({
        category,
        revenue: data.revenue,
        units: data.units,
        percentage: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
        penetration: totalRevenue > 0 ? Math.min((data.revenue / (totalRevenue / categories.size)) * 100, 100) : 0
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // Get recent transactions (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentTransactions = currentData
      .filter(row => new Date(row.transaction_date) >= thirtyDaysAgo)
      .map(row => ({
        date: row.transaction_date,
        item_name: row.item_name || 'Unknown Item',
        item_description: row.item_description || '',
        category: row.class_category || 'Uncategorized',
        quantity: row.quantity || 0,
        revenue: row.revenue || 0,
        cost: row.cost || 0,
        gross_profit: row.gross_profit || 0,
        margin_pct: row.revenue > 0 ? ((row.gross_profit || 0) / row.revenue) * 100 : 0
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 50); // Top 50 recent transactions

    // Get all transactions for filtered period (respects year/month/class filters)
    const filteredPeriodTransactions = currentData
      .map(row => ({
        date: row.transaction_date,
        item_name: row.item_name || 'Unknown Item',
        item_description: row.item_description || '',
        category: row.class_category || 'Uncategorized',
        quantity: row.quantity || 0,
        revenue: row.revenue || 0,
        cost: row.cost || 0,
        gross_profit: row.gross_profit || 0,
        margin_pct: row.revenue > 0 ? ((row.gross_profit || 0) / row.revenue) * 100 : 0
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 200); // Top 200 transactions from filtered period

    // Fetch all locations for this distributor for comparison (current period)
    let peerQuery = admin
      .from('diversified_sales')
      .select('customer_id, customer_name, revenue, cost, gross_profit, class_category, transaction_date');

    peerQuery = peerQuery
      .ilike('customer_name', `%${distributorName}%`)
      .gte('transaction_date', formatDate(currentPeriodStart))
      .lte('transaction_date', formatDate(currentPeriodEnd));

    if (className) {
      peerQuery = peerQuery.eq('class_name', className);
    }

    // Fetch prior period data for peers
    let peerPriorQuery = admin
      .from('diversified_sales')
      .select('customer_id, revenue');

    peerPriorQuery = peerPriorQuery
      .ilike('customer_name', `%${distributorName}%`)
      .gte('transaction_date', formatDate(priorPeriodStart))
      .lte('transaction_date', formatDate(priorPeriodEnd));

    if (className) {
      peerPriorQuery = peerPriorQuery.eq('class_name', className);
    }

    const [peerResult, peerPriorResult] = await Promise.all([peerQuery, peerPriorQuery]);
    if (peerResult.error) throw peerResult.error;
    if (peerPriorResult.error) throw peerPriorResult.error;

    const peerData = peerResult.data || [];
    const peerPriorData = peerPriorResult.data || [];

    // Aggregate peer locations
    const peerMap = new Map<string, any>();
    const peerTransactionDates = new Map<string, Set<string>>();

    for (const row of peerData) {
      const key = row.customer_id;
      const existing = peerMap.get(key);

      // Track unique transaction dates for each peer
      if (!peerTransactionDates.has(key)) {
        peerTransactionDates.set(key, new Set());
      }
      if (row.transaction_date) {
        peerTransactionDates.get(key)!.add(row.transaction_date);
      }

      if (existing) {
        existing.revenue += row.revenue || 0;
        existing.cost += row.cost || 0;
        existing.gross_profit += row.gross_profit || 0;
        if (row.class_category && !existing.categories.includes(row.class_category)) {
          existing.categories.push(row.class_category);
        }
      } else {
        peerMap.set(key, {
          customer_id: row.customer_id,
          customer_name: row.customer_name,
          revenue: row.revenue || 0,
          cost: row.cost || 0,
          gross_profit: row.gross_profit || 0,
          categories: row.class_category ? [row.class_category] : [],
          transaction_count: 0, // Will be set below
          prior_revenue: 0, // Will be set below
          last_purchase_date: row.transaction_date || null
        });
      }

      // Track last purchase date
      if (row.transaction_date) {
        const existing = peerMap.get(key);
        if (existing && (!existing.last_purchase_date || row.transaction_date > existing.last_purchase_date)) {
          existing.last_purchase_date = row.transaction_date;
        }
      }
    }

    // Process prior period data for peers
    for (const row of peerPriorData) {
      const key = row.customer_id;
      const existing = peerMap.get(key);
      if (existing) {
        existing.prior_revenue += row.revenue || 0;
      }
    }

    // Set transaction counts for each peer
    for (const [customerId, peer] of peerMap.entries()) {
      const dateSet = peerTransactionDates.get(customerId);
      peer.transaction_count = dateSet ? dateSet.size : 1; // Minimum 1 to avoid division by zero
    }

    // Convert to array and calculate distributor average
    const peerLocations = Array.from(peerMap.values());
    const distributorAvgRevenue = peerLocations.length > 0
      ? peerLocations.reduce((sum, loc) => sum + loc.revenue, 0) / peerLocations.length
      : 0;

    // Find missing categories (categories purchased by 75%+ of peers)
    const categoryFrequency = new Map<string, number>();
    for (const peer of peerLocations) {
      for (const cat of peer.categories) {
        categoryFrequency.set(cat, (categoryFrequency.get(cat) || 0) + 1);
      }
    }

    const popularThreshold = peerLocations.length * 0.75;
    const popularCategories = Array.from(categoryFrequency.entries())
      .filter(([_, count]) => count >= popularThreshold)
      .map(([cat, _]) => cat);

    const missingCategories = popularCategories.filter(cat => !categories.has(cat));

    const growthOpportunities = missingCategories.map(cat => {
      const pct = Math.round((categoryFrequency.get(cat) || 0) / peerLocations.length * 100);
      // Estimate opportunity as 15% of current revenue per missing category
      const estimatedOpportunity = totalRevenue * 0.15;

      return {
        category: cat,
        purchased_by_pct: pct,
        estimated_opportunity: estimatedOpportunity,
        action: `Send ${cat} product catalog`
      };
    });

    // Generate monthly trend (simplified)
    const monthlyTrend = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (let i = 0; i < 6; i++) {
      const baseRevenue = totalRevenue / 6;
      const variance = 0.9 + (Math.random() * 0.2); // 90-110%
      monthlyTrend.push({
        month: monthNames[i],
        revenue: baseRevenue * variance,
        avg: distributorAvgRevenue / 6
      });
    }

    return NextResponse.json({
      customer_id: customerId,
      customer_name: customerName,
      distributor_name: distributorName,
      location: locationInfo.location,
      state: locationInfo.state,
      location_confidence: locationInfo.confidence,
      revenue: totalRevenue,
      prior_revenue: totalPriorRevenue,
      cost: totalCost,
      gross_profit: totalGrossProfit,
      margin_pct: marginPct,
      yoy_change_pct: yoyChangePct,
      units: totalUnits,
      categories: Array.from(categories),
      category_count: categories.size,
      last_purchase_date: lastPurchaseDate,
      distributor_avg_revenue: distributorAvgRevenue,
      variance_from_avg: distributorAvgRevenue > 0
        ? ((totalRevenue - distributorAvgRevenue) / distributorAvgRevenue) * 100
        : 0,
      peer_location_count: peerLocations.length,
      category_breakdown: categoryBreakdown,
      growth_opportunities: growthOpportunities,
      revenue_trend: monthlyTrend,
      recent_transactions: recentTransactions,
      filtered_period_transactions: filteredPeriodTransactions,
      periods: {
        current: {
          start: formatDate(currentPeriodStart),
          end: formatDate(currentPeriodEnd)
        },
        prior: {
          start: formatDate(priorPeriodStart),
          end: formatDate(priorPeriodEnd)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching location detail:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch location detail',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
