/**
 * Action Classification Library
 * Transforms vague AI recommendations into specific, actionable items
 */

import { CustomerAttritionScore, CustomerBehavior, QuickWinOpportunity, CustomerContext } from './insights';

// ============================================
// TYPES
// ============================================

export type ActionType =
  | 'call_to_recover_po'
  | 'price_margin_reset'
  | 'category_expansion'
  | 'exec_escalation'
  | 'repeat_order_reminder'
  | 'cross_sell_pitch';

export interface ActionItem {
  id: string;
  action_type: ActionType;
  customer_id: string;
  customer_name: string;
  customer_segment: string;

  // Action details
  action_title: string; // Specific, not vague - e.g., "Call re: VEROflow renewal"
  action_description: string;
  call_script?: string;

  // Business context
  product_stopped?: string;
  days_stopped?: number;
  recommended_product?: string;

  // $ Impact
  revenue_at_risk?: number;  // Total customer revenue (for context)
  product_revenue?: number;  // Revenue from THIS specific product
  expected_recovery?: number;
  cross_sell_potential?: number;

  // Timing & Priority
  speed_to_impact_days: number; // How fast can this close?
  risk_level: 'critical' | 'high' | 'medium' | 'low';
  roi_score?: number; // Calculated later

  // Ownership
  owner?: string;
  owner_email?: string;
  due_date?: string;
  status: 'pending' | 'in_progress' | 'completed';

  // Source
  source_type: 'attrition' | 'quick_win' | 'cross_sell' | 'ai_recommendation';
  source_id?: string;
  created_at: string;
}

// ============================================
// ACTION CLASSIFICATION LOGIC
// ============================================

/**
 * Classify an attrition customer into a specific action
 */
export function classifyAttritionAction(
  customer: CustomerAttritionScore,
  behavior?: CustomerBehavior,
  context?: CustomerContext
): ActionItem | null {
  // Skip if not eligible for attrition actions
  if (behavior && !behavior.attrition_eligible) {
    return null;
  }

  const segment = behavior?.segment || 'unknown';
  const daysInactive = customer.recency_days;

  // Get product details with revenue
  const topProductsWithRevenue = context?.top_products_with_descriptions || [];
  const topProductsFormatted = topProductsWithRevenue.map(p => p.item_description);

  // Use the revenue from the TOP product they buy (highest revenue product)
  const productRevenue = topProductsWithRevenue.length > 0 ? topProductsWithRevenue[0].revenue_12mo : 0;

  // Determine action type based on severity
  let actionType: ActionType;
  let speedToImpact: number;
  let riskLevel: 'critical' | 'high' | 'medium' | 'low';

  if (customer.status === 'churned' || (customer.attrition_score > 80 && productRevenue > 100000)) {
    // Critical case - needs executive escalation
    actionType = 'exec_escalation';
    speedToImpact = 3; // Exec can move fast
    riskLevel = 'critical';
  } else if (customer.status === 'at_risk' && daysInactive > 120) {
    // High-value at-risk customer
    actionType = 'call_to_recover_po';
    speedToImpact = 7;
    riskLevel = 'high';
  } else if (customer.monetary_change_pct < -30) {
    // Significant revenue decline - pricing issue?
    actionType = 'price_margin_reset';
    speedToImpact = 14;
    riskLevel = 'high';
  } else if (customer.product_mix_current < customer.product_mix_prior) {
    // Narrowing product mix - cross-sell opportunity
    actionType = 'category_expansion';
    speedToImpact = 21;
    riskLevel = 'medium';
  } else {
    // General follow-up
    actionType = 'call_to_recover_po';
    speedToImpact = 7;
    riskLevel = 'medium';
  }

  // Build specific action title
  const actionTitle = buildActionTitle(actionType, customer.customer_name, {
    daysInactive,
    segment,
    topProducts: topProductsFormatted,
  });

  // Build call script
  const callScript = buildCallScript(actionType, {
    customerName: customer.customer_name,
    daysInactive,
    segment,
    revenueAtRisk: productRevenue,  // Use product revenue in script
    topProducts: topProductsFormatted,
  });

  return {
    id: `attrition-${customer.customer_id}-${Date.now()}`,
    action_type: actionType,
    customer_id: customer.customer_id,
    customer_name: customer.customer_name,
    customer_segment: segment,
    action_title: actionTitle,
    action_description: `${customer.customer_name} has not ordered in ${daysInactive} days (attrition score: ${customer.attrition_score})`,
    call_script: callScript,
    product_stopped: topProductsFormatted.length > 0 ? topProductsFormatted[0] : undefined,
    days_stopped: daysInactive,
    revenue_at_risk: customer.revenue_at_risk,  // Total customer revenue
    product_revenue: productRevenue,  // Revenue from THIS specific product
    expected_recovery: productRevenue * getRecoveryProbability(segment),
    speed_to_impact_days: speedToImpact,
    risk_level: riskLevel,
    status: 'pending',
    source_type: 'attrition',
    source_id: customer.customer_id,
    created_at: new Date().toISOString(),
  };
}

/**
 * Classify a quick win opportunity into a specific action
 */
export function classifyQuickWinAction(
  quickWin: QuickWinOpportunity,
  behavior?: CustomerBehavior,
  context?: CustomerContext
): ActionItem | null {
  const segment = behavior?.segment || quickWin.customer_type;

  let actionType: ActionType;
  let speedToImpact: number;
  let riskLevel: 'critical' | 'high' | 'medium' | 'low';

  if (quickWin.type === 'repeat_order') {
    actionType = 'repeat_order_reminder';
    speedToImpact = 7; // Easy win - they already buy from us
    riskLevel = quickWin.priority === 'high' ? 'high' : 'medium';
  } else {
    // cross_sell
    actionType = 'cross_sell_pitch';
    speedToImpact = 21; // Takes longer to convince on new products
    riskLevel = quickWin.priority === 'high' ? 'medium' : 'low';
  }

  // Use ONLY item description (item number is irrelevant)
  let products: string[];
  let productRevenue = 0;

  if (quickWin.typical_products && quickWin.typical_products.length > 0) {
    products = quickWin.typical_products;
    // For quick wins, use the estimated value as product revenue
    productRevenue = quickWin.estimated_value;
  } else if (context?.top_products_with_descriptions && context.top_products_with_descriptions.length > 0) {
    // Use ONLY the description, not the item number
    products = context.top_products_with_descriptions.map(p => p.item_description);
    productRevenue = context.top_products_with_descriptions[0].revenue_12mo;
  } else {
    products = context?.top_products || [];
  }

  const productName = products.length > 0 ? products[0] : undefined;

  const actionTitle = quickWin.type === 'repeat_order'
    ? `Call ${quickWin.customer_name} re: ${productName || 'repeat order'} (${quickWin.days_overdue}d overdue)`
    : `Pitch ${quickWin.recommended_products?.[0] || 'new products'} to ${quickWin.customer_name}`;

  return {
    id: `quickwin-${quickWin.customer_id}-${Date.now()}`,
    action_type: actionType,
    customer_id: quickWin.customer_id,
    customer_name: quickWin.customer_name,
    customer_segment: segment,
    action_title: actionTitle,
    action_description: quickWin.action_summary,
    call_script: quickWin.call_script,
    product_stopped: productName,
    days_stopped: quickWin.days_overdue,
    recommended_product: quickWin.recommended_products?.[0],
    product_revenue: productRevenue,  // Revenue from THIS specific product
    expected_recovery: quickWin.type === 'repeat_order' ? quickWin.estimated_value : undefined,
    cross_sell_potential: quickWin.type === 'cross_sell' ? quickWin.estimated_value : undefined,
    speed_to_impact_days: speedToImpact,
    risk_level: riskLevel,
    status: 'pending',
    source_type: 'quick_win',
    source_id: quickWin.customer_id,
    created_at: new Date().toISOString(),
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Build specific action title (no vague "follow up")
 */
function buildActionTitle(
  actionType: ActionType,
  customerName: string,
  context: { daysInactive?: number; segment?: string; topProducts?: string[] }
): string {
  const productInfo = context.topProducts && context.topProducts.length > 0
    ? context.topProducts[0]
    : 'usual products';

  switch (actionType) {
    case 'call_to_recover_po':
      return `Call ${customerName} re: ${productInfo} (inactive ${context.daysInactive}d)`;
    case 'price_margin_reset':
      return `Discuss pricing with ${customerName} re: ${productInfo}`;
    case 'category_expansion':
      return `Pitch new categories to ${customerName} (currently buying ${productInfo})`;
    case 'exec_escalation':
      return `URGENT: Executive call with ${customerName} re: ${productInfo} (churn risk)`;
    case 'repeat_order_reminder':
      return `Remind ${customerName} about ${productInfo}`;
    case 'cross_sell_pitch':
      return `Cross-sell pitch to ${customerName}`;
    default:
      return `Follow up with ${customerName}`;
  }
}

/**
 * Build specific call script
 */
function buildCallScript(
  actionType: ActionType,
  context: {
    customerName: string;
    daysInactive?: number;
    segment?: string;
    revenueAtRisk?: number;
    topProducts?: string[];
  }
): string {
  const weeksInactive = context.daysInactive ? Math.round(context.daysInactive / 7) : 0;
  const productNames = context.topProducts && context.topProducts.length > 0
    ? context.topProducts.slice(0, 2).join(' and ')
    : 'your usual items';

  switch (actionType) {
    case 'call_to_recover_po':
      return `Hi, it's been about ${weeksInactive} weeks since your last order of ${productNames}. I wanted to check in - is there anything we can help with? Any projects coming up that need quotes?`;

    case 'price_margin_reset':
      return `Hi, I noticed your orders for ${productNames} have dropped off. Are we still competitive on pricing? I'd like to review your account and see if we can do better.`;

    case 'category_expansion':
      return `Hi, I noticed you've been ordering ${productNames} from us but only in a couple categories. Most customers like you also buy [other products]. Would you like me to send over pricing on those?`;

    case 'exec_escalation':
      return `[EXEC] Major account at risk. ${context.customerName} - $${((context.revenueAtRisk || 0) / 1000).toFixed(0)}K revenue, no orders for ${productNames} in ${weeksInactive} weeks. Immediate action needed.`;

    case 'repeat_order_reminder':
      return `Hi, just wanted to check in on your usual order of ${productNames}. Need me to send over a quote for your standard items?`;

    case 'cross_sell_pitch':
      return `Hi, I wanted to let you know we also carry [product]. Most customers like you use both. Would you like me to send pricing?`;

    default:
      return `Hi, checking in with ${context.customerName}.`;
  }
}

/**
 * Get recovery probability by customer segment
 */
function getRecoveryProbability(segment: string): number {
  switch (segment) {
    case 'steady_repeater':
      return 0.80; // High chance - they were buying regularly
    case 'seasonal':
      return 0.70; // Good chance if in season
    case 'irregular':
      return 0.50; // Moderate
    case 'new_account':
      return 0.60; // Still building relationship
    case 'project_buyer':
      return 0.10; // Very low - they're done
    default:
      return 0.40; // Default moderate
  }
}

/**
 * Get speed to impact by action type (in days)
 */
export function getSpeedToImpact(actionType: ActionType): number {
  switch (actionType) {
    case 'exec_escalation':
      return 3; // Execs can move fast
    case 'call_to_recover_po':
    case 'repeat_order_reminder':
      return 7; // Quick phone call
    case 'price_margin_reset':
      return 14; // Need to review pricing, get approval
    case 'category_expansion':
    case 'cross_sell_pitch':
      return 21; // Longer sales cycle for new products
    default:
      return 14;
  }
}

/**
 * Deduplicate actions for the same customer
 * Keep the highest priority action per customer
 */
export function deduplicateActions(actions: ActionItem[]): ActionItem[] {
  const customerMap = new Map<string, ActionItem>();

  // Priority order for action types
  const typePriority: Record<ActionType, number> = {
    exec_escalation: 1,
    call_to_recover_po: 2,
    price_margin_reset: 3,
    repeat_order_reminder: 4,
    category_expansion: 5,
    cross_sell_pitch: 6,
  };

  for (const action of actions) {
    const existing = customerMap.get(action.customer_id);

    if (!existing) {
      customerMap.set(action.customer_id, action);
      continue;
    }

    // Keep the higher priority action
    const existingPriority = typePriority[existing.action_type] || 999;
    const newPriority = typePriority[action.action_type] || 999;

    if (newPriority < existingPriority) {
      customerMap.set(action.customer_id, action);
    } else if (newPriority === existingPriority) {
      // Same priority - keep the one with higher expected value
      const existingValue = existing.expected_recovery || existing.cross_sell_potential || 0;
      const newValue = action.expected_recovery || action.cross_sell_potential || 0;
      if (newValue > existingValue) {
        customerMap.set(action.customer_id, action);
      }
    }
  }

  return Array.from(customerMap.values());
}
