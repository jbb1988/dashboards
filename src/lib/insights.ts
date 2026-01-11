/**
 * Sales Intelligence & Insights Library
 * Provides analytics calculations for customer attrition, YoY trends,
 * cross-sell opportunities, and concentration metrics
 */

import { getSupabaseAdmin } from './supabase';

// ============================================
// TYPES
// ============================================

export interface CustomerAttritionScore {
  customer_id: string;
  customer_name: string;
  attrition_score: number; // 0-100 (higher = more at-risk)
  status: 'active' | 'declining' | 'at_risk' | 'churned';

  // RFM Metrics
  recency_days: number;
  recency_score: number;
  frequency_current: number;
  frequency_prior: number;
  frequency_change_pct: number;
  frequency_score: number;
  monetary_current: number;
  monetary_prior: number;
  monetary_change_pct: number;
  monetary_score: number;
  product_mix_current: number;
  product_mix_prior: number;
  product_mix_score: number;

  // Revenue at risk
  revenue_at_risk: number;
  last_purchase_date: string | null;

  // Detailed breakdown for explainer
  score_breakdown: {
    recency_weight: number;
    frequency_weight: number;
    monetary_weight: number;
    product_mix_weight: number;
  };
}

export interface YoYPerformance {
  entity_type: 'customer' | 'class' | 'product';
  entity_id: string;
  entity_name: string;

  current_year: number;
  prior_year: number;

  current_revenue: number;
  current_units: number;
  current_margin_pct: number;
  current_cost: number;

  prior_revenue: number;
  prior_units: number;
  prior_margin_pct: number;
  prior_cost: number;

  revenue_change: number;
  revenue_change_pct: number;
  units_change: number;
  units_change_pct: number;
  margin_change_bps: number; // Basis points

  trend: 'growing' | 'stable' | 'declining';
}

export interface CrossSellOpportunity {
  customer_id: string;
  customer_name: string;
  current_classes: string[];
  recommended_class: string;
  affinity_score: number; // 0-100
  similar_customer_count: number;
  similar_customer_coverage_pct: number;
  estimated_revenue: number;
  avg_margin_pct: number;
  reasoning: string;
}

export interface ConcentrationMetrics {
  // Pareto analysis
  top_10_pct_revenue: number;
  top_10_pct_customer_count: number;
  top_20_pct_revenue: number;
  top_20_pct_customer_count: number;
  customers_for_80_pct: number;

  // HHI Index (0-10000)
  hhi_index: number;
  hhi_interpretation: 'diversified' | 'moderate' | 'concentrated';

  // Risk assessment
  single_customer_risk: boolean;
  top_customer_pct: number;
  top_customer_name: string;
  top_3_concentration: number;
  top_3_names: string[];

  // Customer segments
  segments: {
    tier: 'platinum' | 'gold' | 'silver' | 'bronze';
    customer_count: number;
    total_revenue: number;
    pct_of_total: number;
    threshold_description: string;
  }[];

  // Total customers
  total_customers: number;
  total_revenue: number;
}

export interface InsightsSummary {
  at_risk_customers: number;
  at_risk_revenue: number;
  declining_customers: number;
  churned_customers: number;
  yoy_revenue_change_pct: number;
  concentration_risk: 'low' | 'medium' | 'high';
  cross_sell_opportunities: number;
  cross_sell_potential_revenue: number;
  new_customers_12mo: number;
}

export interface InsightAlert {
  id: string;
  type: 'attrition' | 'yoy' | 'concentration' | 'crosssell';
  priority: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  metric_value: number;
  metric_label: string;
  entity_id?: string;
  entity_name?: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function differenceInDays(date1: Date, date2: Date): number {
  const diffTime = Math.abs(date1.getTime() - date2.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function getYearsToAnalyze(yearsBack: number = 3): number[] {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: yearsBack }, (_, i) => currentYear - i);
}

// ============================================
// ATTRITION CALCULATION
// ============================================

export async function calculateCustomerAttrition(filters?: {
  years?: number[];
}): Promise<CustomerAttritionScore[]> {
  const admin = getSupabaseAdmin();
  const now = new Date();
  const currentYear = now.getFullYear();
  const priorYear = currentYear - 1;

  // Get the years to analyze (default last 3 years)
  const yearsToQuery = filters?.years || getYearsToAnalyze(3);

  // Fetch all transaction data with batching
  const allData: Array<{
    customer_id: string;
    customer_name: string;
    class_name: string;
    transaction_date: string;
    year: number;
    month: number;
    revenue: number;
    quantity: number;
  }> = [];

  for (const year of yearsToQuery) {
    let offset = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await admin
        .from('diversified_sales')
        .select('customer_id, customer_name, class_name, transaction_date, year, month, revenue, quantity')
        .eq('year', year)
        .range(offset, offset + batchSize - 1);

      if (error) {
        console.error(`Error fetching year ${year} data:`, error);
        break;
      }

      if (data && data.length > 0) {
        allData.push(...data);
        offset += batchSize;
        hasMore = data.length === batchSize;
      } else {
        hasMore = false;
      }
    }
  }

  if (allData.length === 0) {
    return [];
  }

  // Group by customer
  const customerMap = new Map<string, {
    customer_id: string;
    customer_name: string;
    transactions: typeof allData;
    lastTransactionDate: Date | null;
    currentYearRevenue: number;
    priorYearRevenue: number;
    currentYearOrders: number;
    priorYearOrders: number;
    currentYearClasses: Set<string>;
    priorYearClasses: Set<string>;
  }>();

  for (const row of allData) {
    const key = row.customer_id || row.customer_name;
    if (!key) continue;

    if (!customerMap.has(key)) {
      customerMap.set(key, {
        customer_id: row.customer_id,
        customer_name: row.customer_name,
        transactions: [],
        lastTransactionDate: null,
        currentYearRevenue: 0,
        priorYearRevenue: 0,
        currentYearOrders: 0,
        priorYearOrders: 0,
        currentYearClasses: new Set(),
        priorYearClasses: new Set(),
      });
    }

    const customer = customerMap.get(key)!;
    customer.transactions.push(row);

    // Track last transaction date
    const txDate = new Date(row.transaction_date);
    if (!customer.lastTransactionDate || txDate > customer.lastTransactionDate) {
      customer.lastTransactionDate = txDate;
    }

    // Aggregate by year
    if (row.year === currentYear) {
      customer.currentYearRevenue += row.revenue || 0;
      customer.currentYearOrders += 1;
      if (row.class_name) customer.currentYearClasses.add(row.class_name);
    } else if (row.year === priorYear) {
      customer.priorYearRevenue += row.revenue || 0;
      customer.priorYearOrders += 1;
      if (row.class_name) customer.priorYearClasses.add(row.class_name);
    }
  }

  // Calculate attrition scores
  const attritionScores: CustomerAttritionScore[] = [];
  const weights = {
    recency: 0.35,
    frequency: 0.30,
    monetary: 0.25,
    product_mix: 0.10,
  };

  for (const [, customer] of customerMap) {
    // 1. Recency Score (0-100, higher = worse)
    const daysSinceLast = customer.lastTransactionDate
      ? differenceInDays(now, customer.lastTransactionDate)
      : 999;
    const recencyScore = Math.min(100, (daysSinceLast / 365) * 100);

    // 2. Frequency Decline Score (0-100)
    const frequencyChange = customer.priorYearOrders > 0
      ? ((customer.currentYearOrders - customer.priorYearOrders) / customer.priorYearOrders)
      : customer.currentYearOrders > 0 ? -1 : 0; // New customer = no decline
    const frequencyScore = frequencyChange < 0 ? Math.min(100, Math.abs(frequencyChange) * 100) : 0;

    // 3. Monetary Decline Score (0-100)
    const revenueChange = customer.priorYearRevenue > 0
      ? ((customer.currentYearRevenue - customer.priorYearRevenue) / customer.priorYearRevenue)
      : customer.currentYearRevenue > 0 ? -1 : 0;
    const monetaryScore = revenueChange < 0 ? Math.min(100, Math.abs(revenueChange) * 100) : 0;

    // 4. Product Mix Score (0-100) - Narrowing = bad
    const classesCurrent = customer.currentYearClasses.size;
    const classesPrior = customer.priorYearClasses.size;
    const productMixScore = classesPrior > classesCurrent
      ? ((classesPrior - classesCurrent) / Math.max(1, classesPrior)) * 100
      : 0;

    // Weighted final score
    const attritionScore =
      (recencyScore * weights.recency) +
      (frequencyScore * weights.frequency) +
      (monetaryScore * weights.monetary) +
      (productMixScore * weights.product_mix);

    // Determine status
    let status: 'active' | 'declining' | 'at_risk' | 'churned';
    if (daysSinceLast > 365) {
      status = 'churned';
    } else if (attritionScore > 70 || daysSinceLast > 180) {
      status = 'at_risk';
    } else if (attritionScore > 40 && (frequencyChange < 0 || revenueChange < 0)) {
      status = 'declining';
    } else {
      status = 'active';
    }

    attritionScores.push({
      customer_id: customer.customer_id,
      customer_name: customer.customer_name,
      attrition_score: Math.round(attritionScore),
      status,
      recency_days: daysSinceLast,
      recency_score: Math.round(recencyScore),
      frequency_current: customer.currentYearOrders,
      frequency_prior: customer.priorYearOrders,
      frequency_change_pct: Math.round(frequencyChange * 100),
      frequency_score: Math.round(frequencyScore),
      monetary_current: customer.currentYearRevenue,
      monetary_prior: customer.priorYearRevenue,
      monetary_change_pct: Math.round(revenueChange * 100),
      monetary_score: Math.round(monetaryScore),
      product_mix_current: classesCurrent,
      product_mix_prior: classesPrior,
      product_mix_score: Math.round(productMixScore),
      revenue_at_risk: customer.priorYearRevenue > 0 ? customer.priorYearRevenue : customer.currentYearRevenue,
      last_purchase_date: customer.lastTransactionDate?.toISOString() || null,
      score_breakdown: {
        recency_weight: weights.recency,
        frequency_weight: weights.frequency,
        monetary_weight: weights.monetary,
        product_mix_weight: weights.product_mix,
      },
    });
  }

  // Sort by attrition score descending
  return attritionScores.sort((a, b) => b.attrition_score - a.attrition_score);
}

// ============================================
// YOY PERFORMANCE
// ============================================

export async function calculateYoYPerformance(
  entityType: 'customer' | 'class',
  filters?: { currentYear?: number; priorYear?: number }
): Promise<YoYPerformance[]> {
  const admin = getSupabaseAdmin();
  const currentYear = filters?.currentYear || new Date().getFullYear();
  const priorYear = filters?.priorYear || currentYear - 1;

  // Fetch data for both years
  const allData: Array<{
    customer_id: string;
    customer_name: string;
    class_name: string;
    year: number;
    revenue: number;
    cost: number;
    quantity: number;
  }> = [];

  for (const year of [currentYear, priorYear]) {
    let offset = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await admin
        .from('diversified_sales')
        .select('customer_id, customer_name, class_name, year, revenue, cost, quantity')
        .eq('year', year)
        .range(offset, offset + batchSize - 1);

      if (error) {
        console.error(`Error fetching year ${year} data:`, error);
        break;
      }

      if (data && data.length > 0) {
        allData.push(...data);
        offset += batchSize;
        hasMore = data.length === batchSize;
      } else {
        hasMore = false;
      }
    }
  }

  // Aggregate by entity
  const entityMap = new Map<string, {
    id: string;
    name: string;
    currentRevenue: number;
    currentCost: number;
    currentUnits: number;
    priorRevenue: number;
    priorCost: number;
    priorUnits: number;
  }>();

  for (const row of allData) {
    const key = entityType === 'customer'
      ? row.customer_id || row.customer_name
      : row.class_name;
    const name = entityType === 'customer' ? row.customer_name : row.class_name;

    if (!key) continue;

    if (!entityMap.has(key)) {
      entityMap.set(key, {
        id: key,
        name: name || key,
        currentRevenue: 0,
        currentCost: 0,
        currentUnits: 0,
        priorRevenue: 0,
        priorCost: 0,
        priorUnits: 0,
      });
    }

    const entity = entityMap.get(key)!;
    if (row.year === currentYear) {
      entity.currentRevenue += row.revenue || 0;
      entity.currentCost += row.cost || 0;
      entity.currentUnits += row.quantity || 0;
    } else {
      entity.priorRevenue += row.revenue || 0;
      entity.priorCost += row.cost || 0;
      entity.priorUnits += row.quantity || 0;
    }
  }

  // Calculate YoY metrics
  const results: YoYPerformance[] = [];

  for (const [, entity] of entityMap) {
    const currentMargin = entity.currentRevenue > 0
      ? ((entity.currentRevenue - entity.currentCost) / entity.currentRevenue) * 100
      : 0;
    const priorMargin = entity.priorRevenue > 0
      ? ((entity.priorRevenue - entity.priorCost) / entity.priorRevenue) * 100
      : 0;

    const revenueChange = entity.currentRevenue - entity.priorRevenue;
    const revenueChangePct = entity.priorRevenue > 0
      ? (revenueChange / entity.priorRevenue) * 100
      : entity.currentRevenue > 0 ? 100 : 0;

    const unitsChange = entity.currentUnits - entity.priorUnits;
    const unitsChangePct = entity.priorUnits > 0
      ? (unitsChange / entity.priorUnits) * 100
      : entity.currentUnits > 0 ? 100 : 0;

    const marginChangeBps = Math.round((currentMargin - priorMargin) * 100);

    // Determine trend
    let trend: 'growing' | 'stable' | 'declining';
    if (revenueChangePct >= 5) {
      trend = 'growing';
    } else if (revenueChangePct <= -5) {
      trend = 'declining';
    } else {
      trend = 'stable';
    }

    results.push({
      entity_type: entityType,
      entity_id: entity.id,
      entity_name: entity.name,
      current_year: currentYear,
      prior_year: priorYear,
      current_revenue: entity.currentRevenue,
      current_units: entity.currentUnits,
      current_margin_pct: currentMargin,
      current_cost: entity.currentCost,
      prior_revenue: entity.priorRevenue,
      prior_units: entity.priorUnits,
      prior_margin_pct: priorMargin,
      prior_cost: entity.priorCost,
      revenue_change: revenueChange,
      revenue_change_pct: revenueChangePct,
      units_change: unitsChange,
      units_change_pct: unitsChangePct,
      margin_change_bps: marginChangeBps,
      trend,
    });
  }

  return results.sort((a, b) => b.current_revenue - a.current_revenue);
}

// ============================================
// CROSS-SELL OPPORTUNITIES
// ============================================

export async function generateCrossSellOpportunities(filters?: {
  years?: number[];
  minSimilarity?: number;
}): Promise<CrossSellOpportunity[]> {
  const admin = getSupabaseAdmin();
  const yearsToQuery = filters?.years || getYearsToAnalyze(2);
  const minSimilarity = filters?.minSimilarity || 0.25;

  // Fetch customer-class purchase data
  const allData: Array<{
    customer_id: string;
    customer_name: string;
    class_name: string;
    revenue: number;
    cost: number;
  }> = [];

  for (const year of yearsToQuery) {
    let offset = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await admin
        .from('diversified_sales')
        .select('customer_id, customer_name, class_name, revenue, cost')
        .eq('year', year)
        .range(offset, offset + batchSize - 1);

      if (error) {
        console.error(`Error fetching year ${year} data:`, error);
        break;
      }

      if (data && data.length > 0) {
        allData.push(...data);
        offset += batchSize;
        hasMore = data.length === batchSize;
      } else {
        hasMore = false;
      }
    }
  }

  // Build customer-class matrix
  const customerClasses = new Map<string, {
    customer_id: string;
    customer_name: string;
    classes: Set<string>;
  }>();

  // Also track class-level stats for estimating revenue
  const classStats = new Map<string, {
    total_revenue: number;
    total_cost: number;
    customer_count: number;
  }>();

  for (const row of allData) {
    const key = row.customer_id || row.customer_name;
    if (!key || !row.class_name) continue;

    if (!customerClasses.has(key)) {
      customerClasses.set(key, {
        customer_id: row.customer_id,
        customer_name: row.customer_name,
        classes: new Set(),
      });
    }
    customerClasses.get(key)!.classes.add(row.class_name);

    // Track class stats
    if (!classStats.has(row.class_name)) {
      classStats.set(row.class_name, { total_revenue: 0, total_cost: 0, customer_count: 0 });
    }
    const stats = classStats.get(row.class_name)!;
    stats.total_revenue += row.revenue || 0;
    stats.total_cost += row.cost || 0;
  }

  // Count unique customers per class
  for (const [, customer] of customerClasses) {
    for (const className of customer.classes) {
      classStats.get(className)!.customer_count += 1;
    }
  }

  // Find cross-sell opportunities using Jaccard similarity
  const opportunities: CrossSellOpportunity[] = [];
  const customersArray = Array.from(customerClasses.values());

  for (const target of customersArray) {
    // Find similar customers
    const similarCustomers: { customer: typeof target; similarity: number }[] = [];

    for (const other of customersArray) {
      if (target.customer_id === other.customer_id) continue;

      // Jaccard similarity
      const intersection = new Set([...target.classes].filter(x => other.classes.has(x)));
      const union = new Set([...target.classes, ...other.classes]);
      const similarity = intersection.size / union.size;

      if (similarity >= minSimilarity) {
        similarCustomers.push({ customer: other, similarity });
      }
    }

    if (similarCustomers.length === 0) continue;

    // Find classes that similar customers buy but target doesn't
    const recommendedClasses = new Map<string, { count: number; similarities: number[] }>();

    for (const { customer: similar } of similarCustomers) {
      for (const className of similar.classes) {
        if (!target.classes.has(className)) {
          if (!recommendedClasses.has(className)) {
            recommendedClasses.set(className, { count: 0, similarities: [] });
          }
          const rec = recommendedClasses.get(className)!;
          rec.count += 1;
        }
      }
    }

    // Score and create opportunities
    for (const [className, data] of recommendedClasses) {
      const coverage = data.count / similarCustomers.length;
      if (coverage < 0.3) continue; // Must be common among similar customers

      const stats = classStats.get(className);
      if (!stats) continue;

      const avgRevenue = stats.customer_count > 0
        ? stats.total_revenue / stats.customer_count
        : 0;
      const avgMargin = stats.total_revenue > 0
        ? ((stats.total_revenue - stats.total_cost) / stats.total_revenue) * 100
        : 0;

      opportunities.push({
        customer_id: target.customer_id,
        customer_name: target.customer_name,
        current_classes: Array.from(target.classes),
        recommended_class: className,
        affinity_score: Math.round(coverage * 100),
        similar_customer_count: data.count,
        similar_customer_coverage_pct: Math.round(coverage * 100),
        estimated_revenue: avgRevenue,
        avg_margin_pct: avgMargin,
        reasoning: `${data.count} similar customers (${Math.round(coverage * 100)}% of ${similarCustomers.length}) purchase ${className}`,
      });
    }
  }

  // Sort by estimated revenue and dedupe (keep highest affinity per customer-class combo)
  const deduped = new Map<string, CrossSellOpportunity>();
  for (const opp of opportunities) {
    const key = `${opp.customer_id}-${opp.recommended_class}`;
    if (!deduped.has(key) || deduped.get(key)!.affinity_score < opp.affinity_score) {
      deduped.set(key, opp);
    }
  }

  return Array.from(deduped.values())
    .sort((a, b) => b.estimated_revenue - a.estimated_revenue)
    .slice(0, 100); // Top 100 opportunities
}

// ============================================
// CONCENTRATION METRICS
// ============================================

export async function calculateConcentrationMetrics(filters?: {
  years?: number[];
}): Promise<ConcentrationMetrics> {
  const admin = getSupabaseAdmin();
  const yearsToQuery = filters?.years || getYearsToAnalyze(1); // Default to current year

  // Fetch customer revenue data
  const allData: Array<{
    customer_id: string;
    customer_name: string;
    revenue: number;
  }> = [];

  for (const year of yearsToQuery) {
    let offset = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await admin
        .from('diversified_sales')
        .select('customer_id, customer_name, revenue')
        .eq('year', year)
        .range(offset, offset + batchSize - 1);

      if (error) {
        console.error(`Error fetching year ${year} data:`, error);
        break;
      }

      if (data && data.length > 0) {
        allData.push(...data);
        offset += batchSize;
        hasMore = data.length === batchSize;
      } else {
        hasMore = false;
      }
    }
  }

  // Aggregate by customer
  const customerRevenue = new Map<string, { id: string; name: string; revenue: number }>();
  let totalRevenue = 0;

  for (const row of allData) {
    const key = row.customer_id || row.customer_name;
    if (!key) continue;

    if (!customerRevenue.has(key)) {
      customerRevenue.set(key, {
        id: row.customer_id,
        name: row.customer_name || key,
        revenue: 0,
      });
    }
    customerRevenue.get(key)!.revenue += row.revenue || 0;
    totalRevenue += row.revenue || 0;
  }

  const customers = Array.from(customerRevenue.values())
    .sort((a, b) => b.revenue - a.revenue);

  const totalCustomers = customers.length;

  if (totalCustomers === 0 || totalRevenue === 0) {
    return {
      top_10_pct_revenue: 0,
      top_10_pct_customer_count: 0,
      top_20_pct_revenue: 0,
      top_20_pct_customer_count: 0,
      customers_for_80_pct: 0,
      hhi_index: 0,
      hhi_interpretation: 'diversified',
      single_customer_risk: false,
      top_customer_pct: 0,
      top_customer_name: '',
      top_3_concentration: 0,
      top_3_names: [],
      segments: [],
      total_customers: 0,
      total_revenue: 0,
    };
  }

  // Pareto analysis
  const top10Count = Math.ceil(totalCustomers * 0.1);
  const top20Count = Math.ceil(totalCustomers * 0.2);

  const top10Revenue = customers.slice(0, top10Count).reduce((sum, c) => sum + c.revenue, 0);
  const top20Revenue = customers.slice(0, top20Count).reduce((sum, c) => sum + c.revenue, 0);

  // How many customers for 80% revenue
  let cumulativeRevenue = 0;
  let customersFor80 = 0;
  for (const customer of customers) {
    cumulativeRevenue += customer.revenue;
    customersFor80 += 1;
    if (cumulativeRevenue >= totalRevenue * 0.8) break;
  }

  // HHI calculation
  let hhi = 0;
  for (const customer of customers) {
    const share = (customer.revenue / totalRevenue) * 100;
    hhi += share * share;
  }

  let hhiInterpretation: 'diversified' | 'moderate' | 'concentrated';
  if (hhi < 1500) {
    hhiInterpretation = 'diversified';
  } else if (hhi < 2500) {
    hhiInterpretation = 'moderate';
  } else {
    hhiInterpretation = 'concentrated';
  }

  // Top customer risk
  const topCustomer = customers[0];
  const topCustomerPct = (topCustomer.revenue / totalRevenue) * 100;
  const singleCustomerRisk = topCustomerPct > 25;

  // Top 3 concentration
  const top3Revenue = customers.slice(0, 3).reduce((sum, c) => sum + c.revenue, 0);
  const top3Concentration = (top3Revenue / totalRevenue) * 100;
  const top3Names = customers.slice(0, 3).map(c => c.name);

  // Customer segments (Platinum/Gold/Silver/Bronze)
  const segments: ConcentrationMetrics['segments'] = [];

  // Platinum: Top 5% of customers
  const platinumCount = Math.max(1, Math.ceil(totalCustomers * 0.05));
  const platinumCustomers = customers.slice(0, platinumCount);
  const platinumRevenue = platinumCustomers.reduce((sum, c) => sum + c.revenue, 0);
  segments.push({
    tier: 'platinum',
    customer_count: platinumCount,
    total_revenue: platinumRevenue,
    pct_of_total: (platinumRevenue / totalRevenue) * 100,
    threshold_description: 'Top 5% of customers',
  });

  // Gold: Next 15% (5-20%)
  const goldStart = platinumCount;
  const goldEnd = Math.ceil(totalCustomers * 0.20);
  const goldCustomers = customers.slice(goldStart, goldEnd);
  const goldRevenue = goldCustomers.reduce((sum, c) => sum + c.revenue, 0);
  segments.push({
    tier: 'gold',
    customer_count: goldCustomers.length,
    total_revenue: goldRevenue,
    pct_of_total: (goldRevenue / totalRevenue) * 100,
    threshold_description: 'Top 6-20% of customers',
  });

  // Silver: Next 30% (20-50%)
  const silverStart = goldEnd;
  const silverEnd = Math.ceil(totalCustomers * 0.50);
  const silverCustomers = customers.slice(silverStart, silverEnd);
  const silverRevenue = silverCustomers.reduce((sum, c) => sum + c.revenue, 0);
  segments.push({
    tier: 'silver',
    customer_count: silverCustomers.length,
    total_revenue: silverRevenue,
    pct_of_total: (silverRevenue / totalRevenue) * 100,
    threshold_description: 'Top 21-50% of customers',
  });

  // Bronze: Bottom 50%
  const bronzeStart = silverEnd;
  const bronzeCustomers = customers.slice(bronzeStart);
  const bronzeRevenue = bronzeCustomers.reduce((sum, c) => sum + c.revenue, 0);
  segments.push({
    tier: 'bronze',
    customer_count: bronzeCustomers.length,
    total_revenue: bronzeRevenue,
    pct_of_total: (bronzeRevenue / totalRevenue) * 100,
    threshold_description: 'Bottom 50% of customers',
  });

  return {
    top_10_pct_revenue: (top10Revenue / totalRevenue) * 100,
    top_10_pct_customer_count: top10Count,
    top_20_pct_revenue: (top20Revenue / totalRevenue) * 100,
    top_20_pct_customer_count: top20Count,
    customers_for_80_pct: customersFor80,
    hhi_index: Math.round(hhi),
    hhi_interpretation: hhiInterpretation,
    single_customer_risk: singleCustomerRisk,
    top_customer_pct: topCustomerPct,
    top_customer_name: topCustomer.name,
    top_3_concentration: top3Concentration,
    top_3_names: top3Names,
    segments,
    total_customers: totalCustomers,
    total_revenue: totalRevenue,
  };
}

// ============================================
// INSIGHTS SUMMARY & ALERTS
// ============================================

export async function getInsightsSummary(filters?: {
  years?: number[];
}): Promise<InsightsSummary> {
  const [attrition, concentration, crossSell, yoyCustomers] = await Promise.all([
    calculateCustomerAttrition(filters),
    calculateConcentrationMetrics(filters),
    generateCrossSellOpportunities(filters),
    calculateYoYPerformance('customer', {
      currentYear: filters?.years?.[0] || new Date().getFullYear()
    }),
  ]);

  const atRiskCustomers = attrition.filter(c => c.status === 'at_risk').length;
  const atRiskRevenue = attrition
    .filter(c => c.status === 'at_risk')
    .reduce((sum, c) => sum + c.revenue_at_risk, 0);
  const decliningCustomers = attrition.filter(c => c.status === 'declining').length;
  const churnedCustomers = attrition.filter(c => c.status === 'churned').length;

  // Calculate overall YoY
  const totalCurrentRevenue = yoyCustomers.reduce((sum, c) => sum + c.current_revenue, 0);
  const totalPriorRevenue = yoyCustomers.reduce((sum, c) => sum + c.prior_revenue, 0);
  const yoyChangePct = totalPriorRevenue > 0
    ? ((totalCurrentRevenue - totalPriorRevenue) / totalPriorRevenue) * 100
    : 0;

  // Concentration risk level
  let concentrationRisk: 'low' | 'medium' | 'high';
  if (concentration.hhi_index > 2500 || concentration.single_customer_risk) {
    concentrationRisk = 'high';
  } else if (concentration.hhi_index > 1500) {
    concentrationRisk = 'medium';
  } else {
    concentrationRisk = 'low';
  }

  // New customers (those with no prior year revenue)
  const newCustomers = yoyCustomers.filter(c => c.prior_revenue === 0 && c.current_revenue > 0).length;

  return {
    at_risk_customers: atRiskCustomers,
    at_risk_revenue: atRiskRevenue,
    declining_customers: decliningCustomers,
    churned_customers: churnedCustomers,
    yoy_revenue_change_pct: yoyChangePct,
    concentration_risk: concentrationRisk,
    cross_sell_opportunities: crossSell.length,
    cross_sell_potential_revenue: crossSell.reduce((sum, o) => sum + o.estimated_revenue, 0),
    new_customers_12mo: newCustomers,
  };
}

export async function generateInsightAlerts(filters?: {
  years?: number[];
}): Promise<InsightAlert[]> {
  const [attrition, concentration, yoyCustomers] = await Promise.all([
    calculateCustomerAttrition(filters),
    calculateConcentrationMetrics(filters),
    calculateYoYPerformance('customer', {
      currentYear: filters?.years?.[0] || new Date().getFullYear()
    }),
  ]);

  const alerts: InsightAlert[] = [];

  // High-priority attrition alerts
  const highRiskCustomers = attrition
    .filter(c => c.status === 'at_risk' && c.revenue_at_risk > 100000)
    .slice(0, 3);

  for (const customer of highRiskCustomers) {
    alerts.push({
      id: `attrition-${customer.customer_id}`,
      type: 'attrition',
      priority: 'high',
      title: `${customer.customer_name} at high churn risk`,
      message: `Score: ${customer.attrition_score}/100. Last purchase: ${customer.recency_days} days ago. Revenue at risk: $${(customer.revenue_at_risk / 1000).toFixed(0)}K`,
      metric_value: customer.attrition_score,
      metric_label: 'Attrition Score',
      entity_id: customer.customer_id,
      entity_name: customer.customer_name,
    });
  }

  // Concentration risk alert
  if (concentration.single_customer_risk) {
    alerts.push({
      id: 'concentration-single',
      type: 'concentration',
      priority: 'high',
      title: 'High customer concentration risk',
      message: `${concentration.top_customer_name} represents ${concentration.top_customer_pct.toFixed(1)}% of total revenue`,
      metric_value: concentration.top_customer_pct,
      metric_label: 'Single Customer %',
      entity_name: concentration.top_customer_name,
    });
  }

  // YoY decline alerts
  const decliningCustomers = yoyCustomers
    .filter(c => c.revenue_change_pct < -20 && c.prior_revenue > 50000)
    .slice(0, 3);

  for (const customer of decliningCustomers) {
    alerts.push({
      id: `yoy-${customer.entity_id}`,
      type: 'yoy',
      priority: 'medium',
      title: `${customer.entity_name} down ${Math.abs(customer.revenue_change_pct).toFixed(0)}% YoY`,
      message: `Revenue dropped from $${(customer.prior_revenue / 1000).toFixed(0)}K to $${(customer.current_revenue / 1000).toFixed(0)}K`,
      metric_value: customer.revenue_change_pct,
      metric_label: 'YoY Change %',
      entity_id: customer.entity_id,
      entity_name: customer.entity_name,
    });
  }

  return alerts.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

// ============================================
// METRIC EXPLAINERS
// ============================================

export const METRIC_EXPLAINERS = {
  attrition_score: {
    title: 'Attrition Score',
    description: 'How likely this customer is to stop buying. Score 0-100 where higher = more risk.',
    calculation: 'Based on: how recently they ordered (35%), if order frequency is dropping (30%), if spend is declining (25%), and if they\'re buying fewer product types (10%).',
    thresholds: [
      { label: 'Active', range: '0-40', description: 'Healthy customer, no immediate risk' },
      { label: 'Declining', range: '40-70', description: 'Negative trends, needs attention' },
      { label: 'At-Risk', range: '70+', description: 'High churn probability, immediate action needed' },
      { label: 'Churned', range: 'N/A', description: 'No purchase in 12+ months' },
    ],
  },
  affinity_score: {
    title: 'Cross-Sell Affinity Score',
    description: 'Likelihood this customer would buy this product. Score 0-100 where higher = stronger match.',
    calculation: 'Based on what percentage of similar customers (those with overlapping purchase patterns) buy this product.',
    thresholds: [
      { label: 'Strong', range: '70-100', description: 'High confidence recommendation' },
      { label: 'Moderate', range: '50-70', description: 'Good potential match' },
      { label: 'Weak', range: '30-50', description: 'Worth exploring' },
    ],
  },
  hhi_index: {
    title: 'HHI Concentration Index',
    description: 'Measures how spread out revenue is across customers. Like a diversity score.',
    calculation: 'Sum of squared market shares for all customers. Range 0-10,000.',
    thresholds: [
      { label: 'Diversified', range: '<1,500', description: 'Healthy distribution, low risk' },
      { label: 'Moderate', range: '1,500-2,500', description: 'Some concentration, monitor closely' },
      { label: 'Concentrated', range: '>2,500', description: 'High risk, too dependent on few customers' },
    ],
  },
  yoy_change: {
    title: 'Year-over-Year Change',
    description: 'Percent change compared to the same period last year.',
    calculation: '((Current Year - Prior Year) / Prior Year) * 100',
    thresholds: [
      { label: 'Growing', range: '>5%', description: 'Positive growth trend' },
      { label: 'Stable', range: '-5% to 5%', description: 'Consistent performance' },
      { label: 'Declining', range: '<-5%', description: 'Negative trend, needs investigation' },
    ],
  },
  customer_status: {
    title: 'Customer Status',
    description: 'Overall health classification based on purchase patterns and attrition score.',
    calculation: 'Combines recency, frequency, monetary value, and product mix trends.',
    thresholds: [
      { label: 'Active', range: 'N/A', description: 'Healthy engagement, score <40, positive/stable trends' },
      { label: 'Declining', range: 'N/A', description: 'Score 40-70 with negative trends' },
      { label: 'At-Risk', range: 'N/A', description: 'Score >70 or no purchase in 6+ months' },
      { label: 'Churned', range: 'N/A', description: 'No purchase in 12+ months' },
    ],
  },
};
