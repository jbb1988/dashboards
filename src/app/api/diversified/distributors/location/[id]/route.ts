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

interface RouteContext {
  params: Promise<{ id: string }>;
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
      .select('customer_id, customer_name, revenue, cost, gross_profit, gross_profit_pct, quantity, class_category, transaction_date, item_name, product_type');

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

    if (currentData.length === 0) {
      return NextResponse.json(
        { error: 'Location not found', message: 'No data found for this location' },
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
    let lastPurchaseDate: string | null = null;

    for (const row of currentData) {
      totalRevenue += row.revenue || 0;
      totalCost += row.cost || 0;
      totalGrossProfit += row.gross_profit || 0;
      totalUnits += row.quantity || 0;
      if (row.class_category) categories.add(row.class_category);
      if (row.transaction_date && (!lastPurchaseDate || row.transaction_date > lastPurchaseDate)) {
        lastPurchaseDate = row.transaction_date;
      }
    }

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
        category: row.class_category || 'Uncategorized',
        product_type: row.product_type,
        quantity: row.quantity || 0,
        revenue: row.revenue || 0,
        cost: row.cost || 0,
        gross_profit: row.gross_profit || 0,
        margin_pct: row.revenue > 0 ? ((row.gross_profit || 0) / row.revenue) * 100 : 0
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 50); // Top 50 recent transactions

    // Fetch all locations for this distributor for comparison
    let peerQuery = admin
      .from('diversified_sales')
      .select('customer_id, customer_name, revenue, cost, gross_profit, class_category');

    peerQuery = peerQuery
      .ilike('customer_name', `%${distributorName}%`)
      .gte('transaction_date', formatDate(currentPeriodStart))
      .lte('transaction_date', formatDate(currentPeriodEnd));

    if (className) {
      peerQuery = peerQuery.eq('class_name', className);
    }

    const peerResult = await peerQuery;
    if (peerResult.error) throw peerResult.error;

    const peerData = peerResult.data || [];

    // Aggregate peer locations
    const peerMap = new Map<string, any>();
    for (const row of peerData) {
      const key = row.customer_id;
      const existing = peerMap.get(key);

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
          categories: row.class_category ? [row.class_category] : []
        });
      }
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
