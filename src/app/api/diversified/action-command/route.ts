import { NextRequest, NextResponse } from 'next/server';
import {
  calculateCustomerAttrition,
  generateQuickWins,
  generateCrossSellOpportunities,
  classifyCustomerBehavior,
  calculateRolling12Performance,
  calculateCustomerContext,
  CustomerAttritionScore,
  CustomerBehavior,
  QuickWinOpportunity,
  CrossSellOpportunity,
  CustomerContext,
} from '@/lib/insights';
import {
  ActionItem,
  classifyAttritionAction,
  classifyQuickWinAction,
  deduplicateActions,
} from '@/lib/action-classification';
import { prioritizeActions, categorizeIntoQuadrants, ROIQuadrant } from '@/lib/roi-calculation';
import {
  groupActionsByBucket,
  StrategicBucketSummary,
  BucketCustomer,
} from '@/lib/strategic-buckets';

// ============================================
// TYPES
// ============================================

interface ActionCommandResponse {
  summary: {
    total_revenue_at_risk: number;
    total_cross_sell_potential: number;
    total_actions: number;
    actions_by_time_bucket: {
      bucket_30d: number;
      bucket_60d: number;
      bucket_90d: number;
    };
    top_3_accounts_at_risk: Array<{
      customer_name: string;
      revenue_at_risk: number;
      days_inactive: number;
      attrition_score: number;
    }>;
  };

  revenue_at_risk: {
    bucket_30d: {
      total_revenue: number;
      customer_count: number;
      customers: Array<{
        customer_name: string;
        revenue_at_risk: number;
        days_inactive: number;
        segment: string;
      }>;
    };
    bucket_60d: {
      total_revenue: number;
      customer_count: number;
      customers: Array<{
        customer_name: string;
        revenue_at_risk: number;
        days_inactive: number;
        segment: string;
      }>;
    };
    bucket_90d: {
      total_revenue: number;
      customer_count: number;
      customers: Array<{
        customer_name: string;
        revenue_at_risk: number;
        days_inactive: number;
        segment: string;
      }>;
    };
  };

  required_actions: ActionItem[];
  roi_quadrants: ROIQuadrant[];
  strategic_buckets: StrategicBucketSummary[];

  target_gap_analysis: {
    current_run_rate: number;
    target_annual_revenue: number;
    net_gap: number;
    gap_coverage: {
      from_saves: number;
      from_quick_wins: number;
      from_growth: number;
      total_potential: number;
      coverage_pct: number;
    };
  };

  generated_at: string;
}

// ============================================
// TIME BUCKET LOGIC (30/60/90 days)
// ============================================

/**
 * Classify customers into 30/60/90 day time buckets based on urgency
 *
 * For steady repeaters: Based on expected frequency
 * - 30d bucket: >2× normal frequency overdue (ACT NOW)
 * - 60d bucket: >1.5× normal frequency overdue (PLAN)
 * - 90d bucket: Approaching overdue (MONITOR)
 *
 * For at-risk customers: Absolute thresholds
 * - 30d bucket: >120 days inactive (ACT NOW)
 * - 60d bucket: >60 days inactive (PLAN)
 * - 90d bucket: >30 days inactive (MONITOR)
 */
function classifyTimeBucket(
  daysInactive: number,
  segment: string,
  avgFrequencyDays?: number
): '30d' | '60d' | '90d' | 'none' {
  // For steady repeaters, use frequency-based bucketing
  if (segment === 'steady_repeater' && avgFrequencyDays && avgFrequencyDays > 0) {
    if (daysInactive > avgFrequencyDays * 2) return '30d'; // Way overdue
    if (daysInactive > avgFrequencyDays * 1.5) return '60d'; // Overdue
    if (daysInactive > avgFrequencyDays * 1.2) return '90d'; // Approaching overdue
    return 'none';
  }

  // For everyone else, use absolute thresholds
  if (daysInactive > 120) return '30d'; // ACT NOW
  if (daysInactive > 60) return '60d'; // PLAN
  if (daysInactive > 30) return '90d'; // MONITOR
  return 'none';
}

// ============================================
// MAIN API HANDLER
// ============================================

export async function GET(request: NextRequest) {
  try {
    console.log('='.repeat(60));
    console.log('[ACTION COMMAND] Starting data consolidation');
    console.log('='.repeat(60));

    // Parse query parameters for filters
    const searchParams = request.nextUrl.searchParams;
    const yearsParam = searchParams.get('years');
    const monthsParam = searchParams.get('months');

    const filters: { years?: number[]; months?: number[] } = {};
    if (yearsParam) {
      filters.years = yearsParam.split(',').map(Number);
    }
    if (monthsParam) {
      filters.months = monthsParam.split(',').map(Number);
    }

    console.log('[ACTION COMMAND] Filters:', filters);

    // Step 1: Fetch all customer data in parallel
    // Note: Not all functions support filters - only pass where supported
    console.log('[ACTION COMMAND] Fetching customer data...');
    const [attritionData, behaviorData, quickWins, crossSellData, rolling12Data, contextData] =
      await Promise.all([
        calculateCustomerAttrition(filters),
        classifyCustomerBehavior(),
        generateQuickWins(),
        generateCrossSellOpportunities(filters),
        calculateRolling12Performance('customer'),
        calculateCustomerContext(),
      ]);

    console.log(`[ACTION COMMAND] Fetched:`);
    console.log(`  - ${attritionData.length} customers with attrition scores`);
    console.log(`  - ${behaviorData.length} customers with behavior classification`);
    console.log(`  - ${quickWins.length} quick win opportunities`);
    console.log(`  - ${crossSellData.length} cross-sell opportunities`);
    console.log(`  - ${rolling12Data.length} customers with rolling 12-mo performance`);
    console.log(`  - ${contextData.length} customers with context (top products)`);

    // Step 2: Create lookup maps
    const behaviorMap = new Map<string, CustomerBehavior>();
    for (const behavior of behaviorData) {
      behaviorMap.set(behavior.customer_id || behavior.customer_name, behavior);
    }

    const attritionMap = new Map<string, CustomerAttritionScore>();
    for (const attrition of attritionData) {
      attritionMap.set(attrition.customer_id || attrition.customer_name, attrition);
    }

    const crossSellMap = new Map<string, CrossSellOpportunity[]>();
    for (const crossSell of crossSellData) {
      const key = crossSell.customer_id || crossSell.customer_name;
      if (!crossSellMap.has(key)) {
        crossSellMap.set(key, []);
      }
      crossSellMap.get(key)!.push(crossSell);
    }

    const rolling12Map = new Map<string, number>();
    for (const r12 of rolling12Data) {
      rolling12Map.set(r12.entity_id || r12.entity_name, r12.current_revenue);
    }

    const contextMap = new Map<string, CustomerContext>();
    for (const context of contextData) {
      contextMap.set(context.customer_id || context.customer_name, context);
    }

    // Step 3: Generate action items from attrition and quick wins
    console.log('[ACTION COMMAND] Generating action items...');
    const allActions: ActionItem[] = [];

    // From attrition data
    for (const attrition of attritionData) {
      if (attrition.status === 'active') continue; // Skip healthy customers

      const behavior = behaviorMap.get(attrition.customer_id || attrition.customer_name);
      const context = contextMap.get(attrition.customer_id || attrition.customer_name);
      const action = classifyAttritionAction(attrition, behavior, context);
      if (action) {
        allActions.push(action);
      }
    }

    // From quick wins
    for (const quickWin of quickWins) {
      const behavior = behaviorMap.get(quickWin.customer_id || quickWin.customer_name);
      const context = contextMap.get(quickWin.customer_id || quickWin.customer_name);
      const action = classifyQuickWinAction(quickWin, behavior, context);
      if (action) {
        allActions.push(action);
      }
    }

    console.log(`[ACTION COMMAND] Generated ${allActions.length} raw actions`);

    // Step 4: Deduplicate actions (one action per customer)
    const dedupedActions = deduplicateActions(allActions);
    console.log(`[ACTION COMMAND] After deduplication: ${dedupedActions.length} actions`);

    // Step 5: Calculate ROI and prioritize
    console.log('[ACTION COMMAND] Calculating ROI and prioritizing...');
    const prioritizedActions = prioritizeActions(dedupedActions);

    // Step 6: Categorize into ROI quadrants
    const roiQuadrants = categorizeIntoQuadrants(prioritizedActions);

    // Step 7: Group by strategic buckets
    console.log('[ACTION COMMAND] Classifying into strategic buckets...');
    const customerDataMap = new Map<
      string,
      {
        attrition?: CustomerAttritionScore;
        behavior?: CustomerBehavior;
        crossSell?: CrossSellOpportunity[];
        currentRevenue: number;
      }
    >();

    for (const action of prioritizedActions) {
      const key = action.customer_id || action.customer_name;
      if (!customerDataMap.has(key)) {
        customerDataMap.set(key, {
          attrition: attritionMap.get(key),
          behavior: behaviorMap.get(key),
          crossSell: crossSellMap.get(key),
          currentRevenue: rolling12Map.get(key) || 0,
        });
      }
    }

    const strategicBuckets = groupActionsByBucket(prioritizedActions, customerDataMap);

    // Step 8: Organize by 30/60/90 day time buckets
    console.log('[ACTION COMMAND] Organizing by time buckets...');
    const bucket30d: typeof prioritizedActions = [];
    const bucket60d: typeof prioritizedActions = [];
    const bucket90d: typeof prioritizedActions = [];

    const revenueBucket30d: Array<{
      customer_name: string;
      revenue_at_risk: number;
      days_inactive: number;
      segment: string;
    }> = [];
    const revenueBucket60d: Array<{
      customer_name: string;
      revenue_at_risk: number;
      days_inactive: number;
      segment: string;
    }> = [];
    const revenueBucket90d: Array<{
      customer_name: string;
      revenue_at_risk: number;
      days_inactive: number;
      segment: string;
    }> = [];

    for (const action of prioritizedActions) {
      const behavior = behaviorMap.get(action.customer_id);
      const attrition = attritionMap.get(action.customer_id);

      const daysInactive = action.days_stopped || attrition?.recency_days || 0;
      const avgFrequency = behavior?.avg_order_frequency_days;
      const timeBucket = classifyTimeBucket(
        daysInactive,
        action.customer_segment,
        avgFrequency
      );

      // Add to action buckets
      if (timeBucket === '30d') bucket30d.push(action);
      else if (timeBucket === '60d') bucket60d.push(action);
      else if (timeBucket === '90d') bucket90d.push(action);

      // Add to revenue buckets (only if has revenue at risk)
      if (action.revenue_at_risk && action.revenue_at_risk > 0) {
        const custData = {
          customer_name: action.customer_name,
          revenue_at_risk: action.revenue_at_risk,
          days_inactive: daysInactive,
          segment: action.customer_segment,
        };

        if (timeBucket === '30d') revenueBucket30d.push(custData);
        else if (timeBucket === '60d') revenueBucket60d.push(custData);
        else if (timeBucket === '90d') revenueBucket90d.push(custData);
      }
    }

    // Sort revenue buckets by revenue at risk
    revenueBucket30d.sort((a, b) => b.revenue_at_risk - a.revenue_at_risk);
    revenueBucket60d.sort((a, b) => b.revenue_at_risk - a.revenue_at_risk);
    revenueBucket90d.sort((a, b) => b.revenue_at_risk - a.revenue_at_risk);

    // Step 9: Calculate summary metrics
    console.log('[ACTION COMMAND] Calculating summary metrics...');
    const totalRevenueAtRisk = attritionData
      .filter(c => {
        const behavior = behaviorMap.get(c.customer_id || c.customer_name);
        return behavior?.attrition_eligible !== false;
      })
      .reduce((sum, c) => sum + (c.status !== 'active' ? c.revenue_at_risk : 0), 0);

    const totalCrossSellPotential = crossSellData.reduce(
      (sum, c) => sum + c.estimated_revenue,
      0
    );

    // Top 3 accounts at risk
    const top3AtRisk = attritionData
      .filter(c => {
        const behavior = behaviorMap.get(c.customer_id || c.customer_name);
        return c.status !== 'active' && behavior?.attrition_eligible !== false;
      })
      .sort((a, b) => b.revenue_at_risk - a.revenue_at_risk)
      .slice(0, 3)
      .map(c => ({
        customer_name: c.customer_name,
        revenue_at_risk: c.revenue_at_risk,
        days_inactive: c.recency_days,
        attrition_score: c.attrition_score,
      }));

    // Step 10: Calculate target gap analysis
    console.log('[ACTION COMMAND] Calculating target gap...');
    const currentRunRate = rolling12Data.reduce((sum, c) => sum + c.current_revenue, 0);

    // Assume target is 20% growth YoY (can be made configurable later)
    const targetAnnualRevenue = currentRunRate * 1.2;
    const netGap = targetAnnualRevenue - currentRunRate;

    // Calculate potential from each source
    const fromSaves = attritionData
      .filter(c => {
        const behavior = behaviorMap.get(c.customer_id || c.customer_name);
        return c.status !== 'active' && behavior?.attrition_eligible !== false;
      })
      .reduce((sum, c) => {
        const behavior = behaviorMap.get(c.customer_id || c.customer_name);
        const segment = behavior?.segment || 'unknown';
        const recoveryProb = getRecoveryProbability(segment);
        return sum + c.revenue_at_risk * recoveryProb;
      }, 0);

    const fromQuickWins = quickWins.reduce((sum, q) => sum + q.estimated_value, 0);
    const fromGrowth = totalCrossSellPotential * 0.3; // Assume 30% conversion on cross-sell

    const totalPotential = fromSaves + fromQuickWins + fromGrowth;
    const coveragePct = netGap > 0 ? (totalPotential / netGap) * 100 : 0;

    // Step 11: Build response
    const response: ActionCommandResponse = {
      summary: {
        total_revenue_at_risk: totalRevenueAtRisk,
        total_cross_sell_potential: totalCrossSellPotential,
        total_actions: prioritizedActions.length,
        actions_by_time_bucket: {
          bucket_30d: bucket30d.length,
          bucket_60d: bucket60d.length,
          bucket_90d: bucket90d.length,
        },
        top_3_accounts_at_risk: top3AtRisk,
      },

      revenue_at_risk: {
        bucket_30d: {
          total_revenue: revenueBucket30d.reduce((sum, c) => sum + c.revenue_at_risk, 0),
          customer_count: revenueBucket30d.length,
          customers: revenueBucket30d.slice(0, 10),
        },
        bucket_60d: {
          total_revenue: revenueBucket60d.reduce((sum, c) => sum + c.revenue_at_risk, 0),
          customer_count: revenueBucket60d.length,
          customers: revenueBucket60d.slice(0, 10),
        },
        bucket_90d: {
          total_revenue: revenueBucket90d.reduce((sum, c) => sum + c.revenue_at_risk, 0),
          customer_count: revenueBucket90d.length,
          customers: revenueBucket90d.slice(0, 10),
        },
      },

      required_actions: prioritizedActions,
      roi_quadrants: roiQuadrants,
      strategic_buckets: strategicBuckets,

      target_gap_analysis: {
        current_run_rate: currentRunRate,
        target_annual_revenue: targetAnnualRevenue,
        net_gap: netGap,
        gap_coverage: {
          from_saves: fromSaves,
          from_quick_wins: fromQuickWins,
          from_growth: fromGrowth,
          total_potential: totalPotential,
          coverage_pct: coveragePct,
        },
      },

      generated_at: new Date().toISOString(),
    };

    console.log('='.repeat(60));
    console.log('[ACTION COMMAND] Response ready!');
    console.log(`  - ${response.required_actions.length} total actions`);
    console.log(`  - $${(totalRevenueAtRisk / 1000).toFixed(0)}K at risk`);
    console.log(`  - $${(totalPotential / 1000).toFixed(0)}K recovery potential`);
    console.log(`  - ${coveragePct.toFixed(0)}% gap coverage`);
    console.log('='.repeat(60));

    return NextResponse.json(response);
  } catch (error) {
    console.error('[ACTION COMMAND] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate action command data' },
      { status: 500 }
    );
  }
}

// Helper function
function getRecoveryProbability(segment: string): number {
  switch (segment) {
    case 'steady_repeater':
      return 0.80;
    case 'seasonal':
      return 0.70;
    case 'irregular':
      return 0.50;
    case 'new_account':
      return 0.60;
    case 'project_buyer':
      return 0.10;
    default:
      return 0.40;
  }
}
