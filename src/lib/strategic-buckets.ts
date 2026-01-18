/**
 * Strategic Buckets Classification
 * Categorizes customers and actions into strategic focus areas
 */

import { ActionItem } from './action-classification';
import { CustomerAttritionScore, CustomerBehavior, CrossSellOpportunity } from './insights';

// ============================================
// TYPES
// ============================================

export type StrategicBucket =
  | 'urgent_intervention'
  | 'defend_and_grow'
  | 'nurture_up'
  | 'optimize_exit';

export interface BucketCustomer {
  customer_id: string;
  customer_name: string;
  customer_segment: string;
  bucket: StrategicBucket;
  bucket_reason: string;

  // Key metrics
  current_revenue_12mo: number;
  revenue_at_risk?: number;
  cross_sell_potential?: number;
  attrition_score?: number;
  days_since_last_order?: number;

  // Top action for this customer
  top_action?: ActionItem;
}

export interface StrategicBucketSummary {
  bucket: StrategicBucket;
  label: string;
  description: string;
  customer_count: number;
  total_revenue: number;
  total_at_risk: number;
  total_opportunity: number;
  top_customers: BucketCustomer[];
  actions: ActionItem[];
}

// ============================================
// BUCKET CLASSIFICATION
// ============================================

/**
 * Classify a customer into a strategic bucket
 *
 * RULES:
 * 1. Urgent Intervention (Leadership focus)
 *    - Revenue at risk >$100K OR
 *    - Attrition score >80 + current revenue >$50K OR
 *    - Customer status = churned
 *
 * 2. Defend & Grow (Expand now)
 *    - Steady repeater segment
 *    - Current revenue >$20K
 *    - Cross-sell potential >$10K
 *    - Days since last order <60
 *
 * 3. Nurture Up (Upsell path)
 *    - New account OR
 *    - Current revenue <$20K but cross-sell potential >$5K
 *
 * 4. Optimize / Exit (Decide, don't linger)
 *    - Irregular segment
 *    - Current revenue <$5K
 *    - Attrition score >60
 */
export function classifyCustomerBucket(params: {
  attrition?: CustomerAttritionScore;
  behavior?: CustomerBehavior;
  crossSell?: CrossSellOpportunity[];
  currentRevenue: number;
}): { bucket: StrategicBucket; reason: string } {
  const { attrition, behavior, crossSell, currentRevenue } = params;

  const revenueAtRisk = attrition?.revenue_at_risk || 0;
  const attritionScore = attrition?.attrition_score || 0;
  const status = attrition?.status || 'active';
  const segment = behavior?.segment || 'unknown';
  const daysSinceLast = attrition?.recency_days || behavior?.days_since_last_order || 0;

  // Calculate total cross-sell potential for this customer
  const crossSellPotential = crossSell?.reduce((sum, opp) => sum + opp.estimated_revenue, 0) || 0;

  // 1. URGENT INTERVENTION
  if (
    revenueAtRisk > 100000 ||
    (attritionScore > 80 && currentRevenue > 50000) ||
    status === 'churned'
  ) {
    return {
      bucket: 'urgent_intervention',
      reason:
        revenueAtRisk > 100000
          ? `$${(revenueAtRisk / 1000).toFixed(0)}K at risk`
          : attritionScore > 80
          ? `Attrition score ${attritionScore}`
          : 'Churned customer',
    };
  }

  // 2. DEFEND & GROW
  if (
    segment === 'steady_repeater' &&
    currentRevenue > 20000 &&
    crossSellPotential > 10000 &&
    daysSinceLast < 60
  ) {
    return {
      bucket: 'defend_and_grow',
      reason: `Steady repeater, $${(currentRevenue / 1000).toFixed(0)}K revenue, $${(crossSellPotential / 1000).toFixed(0)}K cross-sell potential`,
    };
  }

  // 3. NURTURE UP
  if (segment === 'new_account' || (currentRevenue < 20000 && crossSellPotential > 5000)) {
    return {
      bucket: 'nurture_up',
      reason:
        segment === 'new_account'
          ? 'New account - build relationship'
          : `$${(crossSellPotential / 1000).toFixed(0)}K upsell potential`,
    };
  }

  // 4. OPTIMIZE / EXIT
  if (segment === 'irregular' && currentRevenue < 5000 && attritionScore > 60) {
    return {
      bucket: 'optimize_exit',
      reason: `Irregular buyer, low revenue ($${(currentRevenue / 1000).toFixed(0)}K), declining`,
    };
  }

  // Default: Defend & Grow for active customers, Nurture Up for smaller ones
  if (currentRevenue > 20000 && daysSinceLast < 90) {
    return {
      bucket: 'defend_and_grow',
      reason: 'Active mid-size account',
    };
  }

  return {
    bucket: 'nurture_up',
    reason: 'Growth opportunity',
  };
}

/**
 * Group actions by strategic bucket
 */
export function groupActionsByBucket(
  actions: ActionItem[],
  customerData: Map<
    string,
    {
      attrition?: CustomerAttritionScore;
      behavior?: CustomerBehavior;
      crossSell?: CrossSellOpportunity[];
      currentRevenue: number;
    }
  >
): StrategicBucketSummary[] {
  // Initialize buckets
  const buckets = new Map<StrategicBucket, StrategicBucketSummary>();

  const bucketLabels: Record<StrategicBucket, { label: string; description: string }> = {
    urgent_intervention: {
      label: 'Urgent Intervention',
      description: 'Leadership focus - high-value at risk',
    },
    defend_and_grow: {
      label: 'Defend & Grow',
      description: 'Expand active accounts now',
    },
    nurture_up: {
      label: 'Nurture Up',
      description: 'Upsell path defined',
    },
    optimize_exit: {
      label: 'Optimize / Exit',
      description: 'Decide, don\'t linger',
    },
  };

  for (const bucketType of Object.keys(bucketLabels) as StrategicBucket[]) {
    buckets.set(bucketType, {
      bucket: bucketType,
      label: bucketLabels[bucketType].label,
      description: bucketLabels[bucketType].description,
      customer_count: 0,
      total_revenue: 0,
      total_at_risk: 0,
      total_opportunity: 0,
      top_customers: [],
      actions: [],
    });
  }

  // Classify each action's customer into a bucket
  const customerBuckets = new Map<string, BucketCustomer>();

  for (const action of actions) {
    const custData = customerData.get(action.customer_id);
    if (!custData) continue;

    // Check if already classified
    if (!customerBuckets.has(action.customer_id)) {
      const classification = classifyCustomerBucket(custData);

      customerBuckets.set(action.customer_id, {
        customer_id: action.customer_id,
        customer_name: action.customer_name,
        customer_segment: action.customer_segment,
        bucket: classification.bucket,
        bucket_reason: classification.reason,
        current_revenue_12mo: custData.currentRevenue,
        revenue_at_risk: custData.attrition?.revenue_at_risk,
        cross_sell_potential: custData.crossSell?.reduce((sum, c) => sum + c.estimated_revenue, 0),
        attrition_score: custData.attrition?.attrition_score,
        days_since_last_order: custData.attrition?.recency_days || custData.behavior?.days_since_last_order,
        top_action: action, // First action for this customer
      });
    }

    // Add action to bucket
    const bucketCust = customerBuckets.get(action.customer_id)!;
    const bucket = buckets.get(bucketCust.bucket)!;
    bucket.actions.push(action);
  }

  // Aggregate metrics for each bucket
  for (const [customerId, bucketCust] of customerBuckets) {
    const bucket = buckets.get(bucketCust.bucket)!;

    bucket.customer_count += 1;
    bucket.total_revenue += bucketCust.current_revenue_12mo;
    bucket.total_at_risk += bucketCust.revenue_at_risk || 0;
    bucket.total_opportunity += bucketCust.cross_sell_potential || 0;
    bucket.top_customers.push(bucketCust);
  }

  // Sort top customers by revenue at risk (descending)
  for (const bucket of buckets.values()) {
    bucket.top_customers.sort((a, b) => {
      const aValue = a.revenue_at_risk || a.cross_sell_potential || a.current_revenue_12mo;
      const bValue = b.revenue_at_risk || b.cross_sell_potential || b.current_revenue_12mo;
      return bValue - aValue;
    });

    // Keep only top 10 per bucket
    bucket.top_customers = bucket.top_customers.slice(0, 10);

    // Sort actions by ROI
    bucket.actions.sort((a, b) => (b.roi_score || 0) - (a.roi_score || 0));
  }

  // Return in priority order
  return [
    buckets.get('urgent_intervention')!,
    buckets.get('defend_and_grow')!,
    buckets.get('nurture_up')!,
    buckets.get('optimize_exit')!,
  ];
}

/**
 * Get bucket color for UI
 */
export function getBucketColor(bucket: StrategicBucket): string {
  switch (bucket) {
    case 'urgent_intervention':
      return 'red';
    case 'defend_and_grow':
      return 'green';
    case 'nurture_up':
      return 'blue';
    case 'optimize_exit':
      return 'gray';
    default:
      return 'gray';
  }
}

/**
 * Get bucket icon for UI
 */
export function getBucketIcon(bucket: StrategicBucket): string {
  switch (bucket) {
    case 'urgent_intervention':
      return '🚨';
    case 'defend_and_grow':
      return '🎯';
    case 'nurture_up':
      return '🌱';
    case 'optimize_exit':
      return '⚙️';
    default:
      return '📊';
  }
}
