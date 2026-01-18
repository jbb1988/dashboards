/**
 * ROI Calculation Library
 * Calculates ROI scores for prioritizing sales actions
 */

import { ActionItem, ActionType } from './action-classification';

// ============================================
// TYPES
// ============================================

export interface ROIMetrics {
  expected_value: number; // Expected $ recovery or gain
  speed_factor: number; // 0-1, higher is faster
  risk_multiplier: number; // Amplifies score based on urgency
  roi_score: number; // Final calculated score
}

// ============================================
// ROI CALCULATION
// ============================================

/**
 * Calculate ROI score for an action item
 *
 * Formula: ROI Score = (Expected Value) × (Speed Factor) × (Risk Multiplier)
 *
 * Where:
 * - Expected Value = Revenue at Risk × Recovery Probability OR Cross-sell Potential
 * - Speed Factor = 1 / (Speed to Impact Days / 30) — rewards faster actions
 * - Risk Multiplier = { critical: 2.0, high: 1.5, medium: 1.0, low: 0.8 }
 */
export function calculateROI(action: ActionItem): ROIMetrics {
  // 1. Expected Value
  const expectedValue = action.expected_recovery || action.cross_sell_potential || 0;

  // 2. Speed Factor (normalized to 0-1 range, where 1 = can close in 1 day)
  // Speed to impact is in days, so we normalize by 30 days
  const speedFactor = Math.min(1, 30 / action.speed_to_impact_days);

  // 3. Risk Multiplier (amplifies urgent/critical actions)
  const riskMultiplier = getRiskMultiplier(action.risk_level);

  // Final ROI Score
  const roiScore = expectedValue * speedFactor * riskMultiplier;

  return {
    expected_value: expectedValue,
    speed_factor: speedFactor,
    risk_multiplier: riskMultiplier,
    roi_score: Math.round(roiScore),
  };
}

/**
 * Get risk multiplier based on risk level
 */
function getRiskMultiplier(riskLevel: 'critical' | 'high' | 'medium' | 'low'): number {
  switch (riskLevel) {
    case 'critical':
      return 2.0; // Double the score for critical actions
    case 'high':
      return 1.5; // 50% boost for high priority
    case 'medium':
      return 1.0; // Baseline
    case 'low':
      return 0.8; // Slight penalty for low priority
    default:
      return 1.0;
  }
}

/**
 * Calculate ROI for all actions and sort by priority
 */
export function prioritizeActions(actions: ActionItem[]): ActionItem[] {
  // Calculate ROI for each action
  const actionsWithROI = actions.map(action => {
    const roiMetrics = calculateROI(action);
    return {
      ...action,
      roi_score: roiMetrics.roi_score,
    };
  });

  // Sort by ROI score descending (highest ROI first)
  return actionsWithROI.sort((a, b) => {
    // Primary sort: ROI score
    if (b.roi_score !== a.roi_score) {
      return (b.roi_score || 0) - (a.roi_score || 0);
    }

    // Tie-breaker 1: Risk level
    const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const riskDiff = riskOrder[a.risk_level] - riskOrder[b.risk_level];
    if (riskDiff !== 0) return riskDiff;

    // Tie-breaker 2: Expected value
    const aValue = a.expected_recovery || a.cross_sell_potential || 0;
    const bValue = b.expected_recovery || b.cross_sell_potential || 0;
    return bValue - aValue;
  });
}

/**
 * Get recovery probability by customer segment
 * (Used for calculating expected recovery)
 */
export function getRecoveryProbability(segment: string): number {
  switch (segment) {
    case 'steady_repeater':
      return 0.80; // 80% - they were buying regularly
    case 'seasonal':
      return 0.70; // 70% - if in their season
    case 'irregular':
      return 0.50; // 50% - unpredictable
    case 'new_account':
      return 0.60; // 60% - still building relationship
    case 'project_buyer':
      return 0.10; // 10% - very low, they're done with project
    default:
      return 0.40; // 40% - default moderate
  }
}

/**
 * Categorize actions into ROI quadrants for visualization
 */
export interface ROIQuadrant {
  name: 'Do First' | 'Quick Wins' | 'Big Bets' | 'Defer';
  description: string;
  actions: ActionItem[];
}

export function categorizeIntoQuadrants(actions: ActionItem[]): ROIQuadrant[] {
  // Calculate medians for $ impact and speed
  const actionsWithValues = actions.filter(a => {
    const value = a.expected_recovery || a.cross_sell_potential || 0;
    return value > 0;
  });

  if (actionsWithValues.length === 0) {
    return [
      { name: 'Do First', description: 'High $ + Fast', actions: [] },
      { name: 'Quick Wins', description: 'Low $ + Fast', actions: [] },
      { name: 'Big Bets', description: 'High $ + Slow', actions: [] },
      { name: 'Defer', description: 'Low $ + Slow', actions: [] },
    ];
  }

  // Calculate medians
  const sortedByValue = [...actionsWithValues].sort((a, b) => {
    const aVal = a.expected_recovery || a.cross_sell_potential || 0;
    const bVal = b.expected_recovery || b.cross_sell_potential || 0;
    return bVal - aVal;
  });
  const sortedBySpeed = [...actionsWithValues].sort((a, b) =>
    a.speed_to_impact_days - b.speed_to_impact_days
  );

  const medianValue =
    sortedByValue[Math.floor(sortedByValue.length / 2)].expected_recovery ||
    sortedByValue[Math.floor(sortedByValue.length / 2)].cross_sell_potential ||
    0;

  const medianSpeed =
    sortedBySpeed[Math.floor(sortedBySpeed.length / 2)].speed_to_impact_days;

  // Categorize into quadrants
  const doFirst: ActionItem[] = [];
  const quickWins: ActionItem[] = [];
  const bigBets: ActionItem[] = [];
  const defer: ActionItem[] = [];

  for (const action of actionsWithValues) {
    const value = action.expected_recovery || action.cross_sell_potential || 0;
    const speed = action.speed_to_impact_days;

    const isHighValue = value >= medianValue;
    const isFast = speed <= medianSpeed;

    if (isHighValue && isFast) {
      doFirst.push(action);
    } else if (!isHighValue && isFast) {
      quickWins.push(action);
    } else if (isHighValue && !isFast) {
      bigBets.push(action);
    } else {
      defer.push(action);
    }
  }

  return [
    {
      name: 'Do First',
      description: 'High $ + Fast',
      actions: doFirst.sort((a, b) => (b.roi_score || 0) - (a.roi_score || 0)),
    },
    {
      name: 'Quick Wins',
      description: 'Low $ + Fast',
      actions: quickWins.sort((a, b) => (b.roi_score || 0) - (a.roi_score || 0)),
    },
    {
      name: 'Big Bets',
      description: 'High $ + Slow',
      actions: bigBets.sort((a, b) => (b.roi_score || 0) - (a.roi_score || 0)),
    },
    {
      name: 'Defer',
      description: 'Low $ + Slow',
      actions: defer.sort((a, b) => (b.roi_score || 0) - (a.roi_score || 0)),
    },
  ];
}

/**
 * Get action type display label
 */
export function getActionTypeLabel(actionType: ActionType): string {
  switch (actionType) {
    case 'call_to_recover_po':
      return 'Recover PO';
    case 'price_margin_reset':
      return 'Price Reset';
    case 'category_expansion':
      return 'Category Expansion';
    case 'exec_escalation':
      return 'Exec Escalation';
    case 'repeat_order_reminder':
      return 'Repeat Order';
    case 'cross_sell_pitch':
      return 'Cross-Sell';
    default:
      return 'General';
  }
}

/**
 * Get risk level color for UI
 */
export function getRiskLevelColor(riskLevel: 'critical' | 'high' | 'medium' | 'low'): string {
  switch (riskLevel) {
    case 'critical':
      return 'red';
    case 'high':
      return 'amber';
    case 'medium':
      return 'blue';
    case 'low':
      return 'gray';
    default:
      return 'gray';
  }
}
