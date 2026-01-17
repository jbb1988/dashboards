import { NextRequest, NextResponse } from 'next/server';
import {
  calculateCustomerAttrition,
  calculateYoYPerformance,
  generateCrossSellOpportunities,
  calculateConcentrationMetrics,
  generateQuickWins,
  classifyCustomerBehavior,
  CustomerAttritionScore,
  YoYPerformance,
  CrossSellOpportunity,
  ConcentrationMetrics,
  QuickWinOpportunity,
  CustomerBehavior,
} from '@/lib/insights';
import { generateProductContext, DIVERSIFIED_PRODUCTS } from '@/lib/diversified-business-context';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const MODEL = 'anthropic/claude-sonnet-4';

// ============================================================================
// TYPES
// ============================================================================

interface AIRecommendation {
  priority: 'high' | 'medium' | 'low';
  title: string;
  problem: string;
  recommendation: string;
  expected_impact: string;
  action_items: string[];
  category: 'attrition' | 'growth' | 'crosssell' | 'concentration' | 'general';
}

interface AIInsightResponse {
  recommendations: AIRecommendation[];
  executive_summary: string;
  generated_at: string;
}

// ============================================================================
// AI HELPER
// ============================================================================

async function callAI(prompt: string, maxTokens: number = 4000): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://mars-contracts.vercel.app',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: 0.3, // Slightly higher for more creative recommendations
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[AI] API error:', response.status, error);
    throw new Error(`AI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

function extractJSON(text: string): unknown {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error('[AI] JSON parse error:', e);
    }
  }
  throw new Error('No valid JSON found in AI response');
}

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

// ============================================================================
// SALES INTELLIGENCE CONTEXT
// ============================================================================

// Generate product context from our business knowledge
const PRODUCT_CONTEXT = generateProductContext();

const SALES_INTELLIGENCE_CONTEXT = `
You are a sales rep for MARS Diversified Products - water infrastructure supplies.

${PRODUCT_CONTEXT}

YOUR ROLE:
- Give simple, practical sales actions a rep can do TODAY
- Focus on HIGH-VALUE opportunities only
- Action items should be specific phone calls, emails, or quotes to send

PRIORITY (in order):
1. VEROflow equipment sales and calibration services (best margins)
2. Z-Plate Strainers (equipment-level pricing)
3. Fabricated Spools (custom work, good margins)

CRITICAL RULE - CALIBRATION = OWNERSHIP:
- If a customer buys calibration services, they ALREADY OWN VEROflow equipment!
- Calibration means they send us THEIR equipment to calibrate - can't calibrate what you don't own.
- NEVER recommend VEROflow equipment to calibration customers - they already have it!
- The equipment purchase may be before our data history, but calibration proves ownership.
- For calibration customers: upsell MORE calibrations, parts, accessories - NOT the base equipment.

IGNORE:
- Low-dollar commodity items are not worth chasing (Zinc Caps, Drill Taps, etc.)
- If a customer only buys small items, pitch them VEROflow or Strainers instead

CUSTOMER SEGMENTS - Very Important:
Understanding customer buying patterns helps you recommend the RIGHT action:

- STEADY REPEATER: Orders regularly (every few weeks/months), predictable pattern.
  → These are your core accounts. If they stop ordering, it's a REAL problem - act fast!
  → Great for repeat orders, cross-sell, and upsell.

- PROJECT BUYER: Made 1-3 large purchases for a specific project, then stopped.
  → NOT a churn risk - they're done with their project!
  → DON'T waste time calling to "win back" - they're not lost.
  → ONLY reach out if you hear about a new similar project.

- SEASONAL: Only orders during certain months/quarters (e.g., spring construction season).
  → Don't alert on "no orders" during their off-season.
  → Contact them BEFORE their buying season starts.

- NEW ACCOUNT: Started buying recently (< 6 months or < 3 orders).
  → Focus on building relationship and expanding what they buy.
  → Don't analyze trends yet - not enough history.

- SINGLE-PRODUCT: 80%+ of purchases are one product type.
  → Low cross-sell potential - they buy what they need.
  → Don't push products they clearly don't want.

- DIVERSE BUYER: Buys multiple product categories.
  → Best cross-sell candidates - already open to variety.
`;

// ============================================================================
// INSIGHT GENERATORS
// ============================================================================

async function generateAttritionInsights(
  attrition: CustomerAttritionScore[],
  behaviorMap?: Map<string, CustomerBehavior>
): Promise<AIRecommendation[]> {
  // Filter out project buyers and other non-eligible customers BEFORE sending to AI
  const atRiskCustomers = attrition
    .filter(c => {
      if (c.status !== 'at_risk' && c.status !== 'declining') return false;

      // If we have behavior data, only include attrition-eligible customers
      if (behaviorMap) {
        const behavior = behaviorMap.get(c.customer_id || c.customer_name);
        if (behavior && !behavior.attrition_eligible) {
          return false; // Skip project buyers, off-season seasonal, etc.
        }
      }
      return true;
    })
    .slice(0, 10);

  if (atRiskCustomers.length === 0) {
    return [];
  }

  const totalRevenueAtRisk = atRiskCustomers.reduce((sum, c) => sum + c.revenue_at_risk, 0);

  // Include segment information in customer summaries
  const customerSummaries = atRiskCustomers.map(c => {
    const behavior = behaviorMap?.get(c.customer_id || c.customer_name);
    return {
      name: c.customer_name,
      segment: behavior?.segment || 'unknown',
      segment_reason: behavior?.segment_reason || '',
      score: c.attrition_score,
      status: c.status,
      days_since_purchase: c.recency_days,
      revenue_at_risk: c.revenue_at_risk,
      frequency_change: c.frequency_change_pct,
      monetary_change: c.monetary_change_pct,
      product_mix_shrinking: c.product_mix_current < c.product_mix_prior,
      product_focus: behavior?.product_focus || 'unknown',
      order_consistency: behavior?.order_consistency || 0,
    };
  });

  // Get our sales tactics for win-back
  const { salesTactics } = DIVERSIFIED_PRODUCTS;

  const prompt = `${SALES_INTELLIGENCE_CONTEXT}

WIN-BACK TACTICS:
- Lost customer: ${salesTactics.lostCustomer.action}
- Declining customer: ${salesTactics.decliningCustomer.action}

CUSTOMERS WHO STOPPED OR SLOWED ORDERING (pre-filtered for relevance):
${JSON.stringify(customerSummaries, null, 2)}

Total at risk: ${formatCurrency(totalRevenueAtRisk)}

IMPORTANT CONTEXT:
- Each customer now includes their SEGMENT (steady_repeater, seasonal, new_account, irregular)
- STEADY REPEATERS who stop ordering are real churn risks - prioritize them!
- Segment reason explains why they're classified that way
- These customers have already been filtered - project buyers excluded

TASK: Give me 2-3 action items, but ONLY for customers who were buying high-value products:
- VEROflow equipment or calibration services
- Strainers (especially larger sizes)
- Fabricated Spools

SKIP customers who only bought low-dollar items (Zinc Caps, Drill Taps, etc.) - not worth the effort.

For each recommendation:
- Who to call (include their segment in context)
- What high-value product they stopped buying
- What to say or offer (tailor to their segment)

Return JSON:
{
  "recommendations": [
    {
      "priority": "high" | "medium" | "low",
      "title": "Call [Customer] about reorders",
      "problem": "Short description of the issue (mention segment if relevant)",
      "recommendation": "Call them and ask why orders stopped. Offer to match pricing.",
      "expected_impact": "Could recover $X in orders",
      "action_items": ["Call [name] at [company]", "Ask about recent orders", "Offer quote on their usual items"],
      "category": "attrition"
    }
  ]
}

Respond ONLY with JSON.`;

  try {
    const response = await callAI(prompt, 2000);
    const result = extractJSON(response) as { recommendations: AIRecommendation[] };
    return result.recommendations.map(r => ({ ...r, category: 'attrition' as const }));
  } catch (error) {
    console.error('[AI] Attrition analysis error:', error);
    return [];
  }
}

async function generateGrowthInsights(
  yoyData: YoYPerformance[]
): Promise<AIRecommendation[]> {
  const significantChanges = yoyData
    .filter(c => Math.abs(c.revenue_change_pct) > 15 && c.prior_revenue > 30000)
    .slice(0, 15);

  if (significantChanges.length === 0) {
    return [];
  }

  const growing = significantChanges.filter(c => c.trend === 'growing');
  const declining = significantChanges.filter(c => c.trend === 'declining');

  const prompt = `${SALES_INTELLIGENCE_CONTEXT}

CUSTOMERS BUYING MORE THIS YEAR:
${JSON.stringify(growing.map(c => ({
  name: c.entity_name,
  this_year: formatCurrency(c.current_revenue),
  last_year: formatCurrency(c.prior_revenue),
  change: c.revenue_change_pct.toFixed(0) + '%',
})), null, 2)}

CUSTOMERS BUYING LESS THIS YEAR:
${JSON.stringify(declining.map(c => ({
  name: c.entity_name,
  this_year: formatCurrency(c.current_revenue),
  last_year: formatCurrency(c.prior_revenue),
  change: c.revenue_change_pct.toFixed(0) + '%',
})), null, 2)}

TASK: Give me 2-3 actions focused on HIGH-VALUE opportunities:
- Growing customers: Can we sell them VEROflow, Strainers, or Spools?
- Declining customers: Only chase if they were buying high-value products
- IGNORE small declines on commodity items - not worth the effort

Return JSON:
{
  "recommendations": [
    {
      "priority": "high" | "medium" | "low",
      "title": "Follow up with [Customer]",
      "problem": "Brief issue",
      "recommendation": "Simple action to take",
      "expected_impact": "Potential $ impact",
      "action_items": ["Call X", "Send quote for Y", "Check on order Z"],
      "category": "growth"
    }
  ]
}

Respond ONLY with JSON.`;

  try {
    const response = await callAI(prompt, 2000);
    const result = extractJSON(response) as { recommendations: AIRecommendation[] };
    return result.recommendations.map(r => ({ ...r, category: 'growth' as const }));
  } catch (error) {
    console.error('[AI] Growth analysis error:', error);
    return [];
  }
}

async function generateCrossSellInsights(
  opportunities: CrossSellOpportunity[],
  behaviorMap?: Map<string, CustomerBehavior>
): Promise<AIRecommendation[]> {
  const topOpportunities = opportunities.slice(0, 15);

  if (topOpportunities.length === 0) {
    return [];
  }

  const totalPotential = topOpportunities.reduce((sum, o) => sum + o.estimated_revenue, 0);

  // Get our cross-sell rules
  const crossSellRules = DIVERSIFIED_PRODUCTS.crossSellRules;

  // Enrich opportunities with customer segment context
  const enrichedOpportunities = topOpportunities.slice(0, 8).map(o => {
    const behavior = behaviorMap?.get(o.customer_id || o.customer_name);
    return {
      customer: o.customer_name,
      segment: behavior?.segment || 'unknown',
      product_focus: behavior?.product_focus || 'unknown',
      class_count: behavior?.class_count || 0,
      buys: o.current_classes.slice(0, 3).join(', '),
      should_also_buy: o.recommended_class,
      potential: formatCurrency(o.estimated_revenue),
      eligible_for_crosssell: behavior?.cross_sell_eligible ?? true, // Use the built-in eligibility flag
    };
  });

  const prompt = `${SALES_INTELLIGENCE_CONTEXT}

CRITICAL CONTEXT:
- Each customer includes their SEGMENT (steady_repeater, project_buyer, seasonal, new_account, irregular)
- Each customer has PRODUCT_FOCUS (single_product, narrow, diverse) showing buying variety
- ONLY recommend cross-sells to customers with eligible_for_crosssell = true
- These are typically customers with diverse or narrow product focus, or steady repeaters
- SKIP single-product focused customers (they buy what they need by design, don't push)
- For each customer, you'll see their class_count (number of product categories they buy)

OUR CROSS-SELL RULES:
${crossSellRules.map(r => `- If buying ${r.when}, suggest ${r.suggest.join(', ')} (${r.reason})`).join('\n')}

CUSTOMERS WHO COULD BUY MORE PRODUCTS:
${JSON.stringify(enrichedOpportunities, null, 2)}

Total potential: ${formatCurrency(totalPotential)}

TASK: Give me 2-3 customers to call about HIGH-VALUE products.
- Pitch VEROflow, Strainers, or Spools to customers buying commodity items
- For Strainer/Spool buyers: cross-sell Flanges and Gaskets
- VEROflow owners: push annual calibration service
- DON'T recommend cross-selling low-dollar items
- CRITICAL: If a customer buys calibration, they ALREADY OWN VEROflow - NEVER pitch them equipment!
- Example: "Call X, they buy commodity items - pitch them VEROflow or Strainers"

Return JSON:
{
  "recommendations": [
    {
      "priority": "high" | "medium" | "low",
      "title": "Quote [Customer] on [Product]",
      "problem": "They buy X but not Y",
      "recommendation": "Send them a quote on Y",
      "expected_impact": "Could add $X/year",
      "action_items": ["Call customer", "Send quote on product", "Follow up next week"],
      "category": "crosssell"
    }
  ]
}

Respond ONLY with JSON.`;

  try {
    const response = await callAI(prompt, 2000);
    const result = extractJSON(response) as { recommendations: AIRecommendation[] };
    return result.recommendations.map(r => ({ ...r, category: 'crosssell' as const }));
  } catch (error) {
    console.error('[AI] Cross-sell analysis error:', error);
    return [];
  }
}

async function generateConcentrationInsights(
  concentration: ConcentrationMetrics
): Promise<AIRecommendation[]> {
  if (concentration.hhi_interpretation === 'diversified' && !concentration.single_customer_risk) {
    return [];
  }

  const prompt = `${SALES_INTELLIGENCE_CONTEXT}

CUSTOMER CONCENTRATION:
- Top customer: ${concentration.top_customer_name} (${concentration.top_customer_pct.toFixed(1)}% of sales)
- Top 3 customers: ${concentration.top_3_concentration.toFixed(1)}% of sales (${concentration.top_3_names.join(', ')})
- Need ${concentration.customers_for_80_pct} customers to make 80% of revenue

${concentration.single_customer_risk ? 'WARNING: Too much revenue from one customer!' : ''}

TASK: Give 1-2 simple actions to grow smaller accounts and reduce risk.
- Focus on which mid-size customers to call and grow
- Keep it practical

Return JSON:
{
  "recommendations": [
    {
      "priority": "high" | "medium" | "low",
      "title": "Grow [Customer] account",
      "problem": "Too dependent on top customers",
      "recommendation": "Focus on growing mid-tier accounts",
      "expected_impact": "Reduce risk, add revenue",
      "action_items": ["Call mid-tier customer", "Offer volume discount", "Set up regular orders"],
      "category": "concentration"
    }
  ]
}

Respond ONLY with JSON.`;

  try {
    const response = await callAI(prompt, 1500);
    const result = extractJSON(response) as { recommendations: AIRecommendation[] };
    return result.recommendations.map(r => ({ ...r, category: 'concentration' as const }));
  } catch (error) {
    console.error('[AI] Concentration analysis error:', error);
    return [];
  }
}

async function generateQuickWinInsights(
  quickWins: QuickWinOpportunity[],
  behaviorMap?: Map<string, CustomerBehavior>
): Promise<AIRecommendation[]> {
  if (quickWins.length === 0) {
    return [];
  }

  // Separate repeat orders and cross-sell
  const repeatOrders = quickWins.filter(q => q.type === 'repeat_order').slice(0, 8);
  const crossSells = quickWins.filter(q => q.type === 'cross_sell').slice(0, 8);

  const totalRepeatValue = repeatOrders.reduce((sum, q) => sum + q.estimated_value, 0);
  const totalCrossSellValue = crossSells.reduce((sum, q) => sum + q.estimated_value, 0);

  // Enrich with segment data if available
  const enrichRepeat = (q: QuickWinOpportunity) => {
    const behavior = behaviorMap?.get(q.customer_id || q.customer_name);
    return {
      customer: q.customer_name,
      type: q.customer_type,
      segment: behavior?.segment || 'unknown',
      order_consistency: behavior ? `${behavior.order_consistency}% of months` : 'unknown',
      usual_order_every: `${q.usual_frequency_days} days`,
      days_overdue: q.days_overdue,
      typical_order: formatCurrency(q.typical_order_value || 0),
      products: q.typical_products?.join(', '),
      script: q.call_script,
    };
  };

  const enrichCrossSell = (q: QuickWinOpportunity) => {
    const behavior = behaviorMap?.get(q.customer_id || q.customer_name);
    return {
      customer: q.customer_name,
      type: q.customer_type,
      segment: behavior?.segment || 'unknown',
      product_focus: behavior?.product_focus || 'unknown',
      buys_categories: behavior?.class_count || 0,
      missing: q.recommended_products?.slice(0, 3).join(', '),
      why: q.similar_customers_buy,
      potential: formatCurrency(q.estimated_value),
      script: q.call_script,
    };
  };

  const prompt = `${SALES_INTELLIGENCE_CONTEXT}

QUICK WINS - These customers are ready to buy TODAY.
NOTE: These have been PRE-FILTERED for eligibility based on customer segments.
- Repeat orders: Only steady repeaters (not project buyers)
- Cross-sell: Only diverse buyers (not single-product focused)

=== REPEAT ORDER OPPORTUNITIES ===
These are STEADY REPEATERS who usually order regularly but are OVERDUE. Easy win - just call and remind them.
${repeatOrders.length > 0 ? JSON.stringify(repeatOrders.map(enrichRepeat), null, 2) : 'None found'}
Total potential: ${formatCurrency(totalRepeatValue)}

=== CROSS-SELL OPPORTUNITIES ===
These are DIVERSE BUYERS who buy multiple product categories and are missing ones that similar customers carry.
IMPORTANT: Distributors get consumables (Flanges, Gaskets), Utilities get equipment (VEROflow).
CRITICAL: If a customer buys calibration, they ALREADY OWN VEROflow - NEVER pitch them new equipment!
${crossSells.length > 0 ? JSON.stringify(crossSells.map(enrichCrossSell), null, 2) : 'None found'}
Total potential: ${formatCurrency(totalCrossSellValue)}

TASK: Pick the TOP 3-4 QUICK WINS to call TODAY.

Rules:
- These customers have already been filtered for relevance - trust the segment classification
- Repeat orders are easier wins than cross-sell (customer already buys from us)
- High-value opportunities (>$3K) go first
- Include the specific call script for each
- Customer type matters: don't pitch VEROflow to distributors (they won't stock $20K equipment)

Return JSON:
{
  "recommendations": [
    {
      "priority": "high" | "medium" | "low",
      "title": "Quick Win: [Action] for [Customer]",
      "problem": "Why this is a quick win (reference segment if relevant)",
      "recommendation": "What to do - use the call script",
      "expected_impact": "Expected $ value",
      "action_items": ["Call script line 1", "Call script line 2", "Follow up action"],
      "category": "general"
    }
  ]
}

Focus on ACTIONABLE quick wins - these should close with one phone call.
Respond ONLY with JSON.`;

  try {
    const response = await callAI(prompt, 2500);
    const result = extractJSON(response) as { recommendations: AIRecommendation[] };

    // Validate recommendations and filter invalid ones
    const validRecommendations = result.recommendations.filter(r => {
      // Don't recommend VEROflow equipment to calibration-only customers
      // (calibration purchases indicate they already own VEROflow equipment)
      if (r.recommendation.toLowerCase().includes('veroflow equipment') ||
          r.recommendation.toLowerCase().includes('veroflow meter') ||
          r.recommendation.toLowerCase().includes('purchase veroflow')) {

        const customerName = r.title.match(/(?:Call|Contact|Follow up with|Quote|Quick Win:)\s+([^-–—]+?)(?:\s+(?:about|on|for|regarding|-|–|—)|$)/i)?.[1]?.trim();

        if (customerName) {
          const quickWin = quickWins.find(q => q.customer_name.includes(customerName));

          // If customer already buys calibration, they own VEROflow equipment
          if (quickWin?.typical_products?.some(p => p.toLowerCase().includes('calibration'))) {
            console.warn(`[AI VALIDATION] Filtered invalid recommendation: ${r.title} - Customer already owns VEROflow (buys calibration services)`);
            return false;
          }
        }
      }

      return true;
    });

    // Log quality metrics
    if (validRecommendations.length < result.recommendations.length) {
      console.log(`[AI INSIGHTS] Generated ${result.recommendations.length} recommendations`);
      console.log(`[AI INSIGHTS] Filtered ${result.recommendations.length - validRecommendations.length} invalid recommendations`);
    }

    // Mark these as general but with quick win context
    return validRecommendations.map(r => ({
      ...r,
      category: 'general' as const,
      title: r.title.includes('Quick Win') ? r.title : `Quick Win: ${r.title}`,
    }));
  } catch (error) {
    console.error('[AI] Quick wins analysis error:', error);
    return [];
  }
}

async function generateExecutiveSummary(
  recommendations: AIRecommendation[],
  summary: {
    atRiskCount: number;
    atRiskRevenue: number;
    yoyChange: number;
    concentrationRisk: string;
    crossSellPotential: number;
  }
): Promise<string> {
  const highPriority = recommendations.filter(r => r.priority === 'high');

  const prompt = `You are a sales strategist advising a VP of Sales at a commodity industrial distributor.

CURRENT BUSINESS STATE:
- Revenue at risk from declining customers: ${formatCurrency(summary.atRiskRevenue)} (${summary.atRiskCount} accounts)
- Year-over-year growth: ${summary.yoyChange > 0 ? '+' : ''}${summary.yoyChange.toFixed(1)}%
- Customer concentration: ${summary.concentrationRisk}
- Untapped cross-sell opportunity: ${formatCurrency(summary.crossSellPotential)}
- Urgent actions needed: ${highPriority.length}

TOP ISSUES:
${highPriority.slice(0, 3).map(r => `- ${r.title}`).join('\n')}

TASK:
Write a 3-4 sentence executive summary for scaling this business.
Focus on:
1. The biggest growth lever (cross-sell, win-back, or new customers)
2. The main risk to address
3. A specific revenue target to aim for

Be strategic but practical. This is commodity sales - growth comes from more volume, more products per customer, and winning back lost accounts.

Return JSON:
{
  "executive_summary": "Your strategic summary here"
}

Respond ONLY with JSON.`;

  try {
    const response = await callAI(prompt, 500);
    const result = extractJSON(response) as { executive_summary: string };
    return result.executive_summary;
  } catch {
    // Fallback summary
    return `Sales intelligence analysis identified ${summary.atRiskCount} at-risk customers representing ${formatCurrency(summary.atRiskRevenue)} in revenue. ${highPriority.length > 0 ? `Priority action: ${highPriority[0].title}.` : 'No immediate high-priority actions required.'}`;
  }
}

// ============================================================================
// MAIN API HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    if (!OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: 'OpenRouter API key not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { type = 'all', years } = body as {
      type?: 'all' | 'attrition' | 'growth' | 'crosssell' | 'concentration' | 'quickwins';
      years?: number[];
    };

    const filters = { years: years || [new Date().getFullYear(), new Date().getFullYear() - 1] };

    console.log('='.repeat(60));
    console.log('[AI INSIGHTS] Starting analysis');
    console.log(`[AI INSIGHTS] Type: ${type}, Years: ${filters.years.join(', ')}`);
    console.log('='.repeat(60));

    // Fetch customer behavioral classifications upfront
    // This is used to provide context to AI and filter out irrelevant insights
    console.log('[AI INSIGHTS] Fetching customer behavior classifications...');
    const customerBehaviors = await classifyCustomerBehavior();
    const behaviorMap = new Map<string, CustomerBehavior>();
    for (const behavior of customerBehaviors) {
      behaviorMap.set(behavior.customer_id || behavior.customer_name, behavior);
    }
    console.log(`[AI INSIGHTS] Classified ${customerBehaviors.length} customers by behavior`);

    // Log segment distribution
    const segmentCounts = customerBehaviors.reduce((acc, b) => {
      acc[b.segment] = (acc[b.segment] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log('[AI INSIGHTS] Segment distribution:', JSON.stringify(segmentCounts));

    // Fetch required data based on type
    const allRecommendations: AIRecommendation[] = [];
    let atRiskCount = 0;
    let atRiskRevenue = 0;
    let yoyChange = 0;
    let concentrationRisk = 'low';
    let crossSellPotential = 0;

    if (type === 'all' || type === 'attrition') {
      console.log('[AI INSIGHTS] Analyzing attrition...');
      const attrition = await calculateCustomerAttrition(filters);

      // Only count attrition-eligible customers as "at risk"
      const atRisk = attrition.filter(c => {
        if (c.status !== 'at_risk') return false;
        const behavior = behaviorMap.get(c.customer_id || c.customer_name);
        if (behavior && !behavior.attrition_eligible) return false;
        return true;
      });
      atRiskCount = atRisk.length;
      atRiskRevenue = atRisk.reduce((sum, c) => sum + c.revenue_at_risk, 0);

      const attritionInsights = await generateAttritionInsights(attrition, behaviorMap);
      allRecommendations.push(...attritionInsights);
    }

    if (type === 'all' || type === 'growth') {
      console.log('[AI INSIGHTS] Analyzing YoY growth...');
      const yoyData = await calculateYoYPerformance('customer', { currentYear: filters.years[0] });
      const totalCurrent = yoyData.reduce((sum, c) => sum + c.current_revenue, 0);
      const totalPrior = yoyData.reduce((sum, c) => sum + c.prior_revenue, 0);
      yoyChange = totalPrior > 0 ? ((totalCurrent - totalPrior) / totalPrior) * 100 : 0;

      const growthInsights = await generateGrowthInsights(yoyData);
      allRecommendations.push(...growthInsights);
    }

    if (type === 'all' || type === 'crosssell') {
      console.log('[AI INSIGHTS] Analyzing cross-sell opportunities...');
      const crossSell = await generateCrossSellOpportunities(filters);
      crossSellPotential = crossSell.reduce((sum, o) => sum + o.estimated_revenue, 0);

      const crossSellInsights = await generateCrossSellInsights(crossSell, behaviorMap);
      allRecommendations.push(...crossSellInsights);
    }

    if (type === 'all' || type === 'concentration') {
      console.log('[AI INSIGHTS] Analyzing concentration...');
      const concentration = await calculateConcentrationMetrics(filters);
      concentrationRisk = concentration.hhi_interpretation;

      const concentrationInsights = await generateConcentrationInsights(concentration);
      allRecommendations.push(...concentrationInsights);
    }

    // QUICK WINS - This runs by default with 'all' or explicitly with 'quickwins'
    // Quick wins are prioritized and added at the beginning
    // Note: generateQuickWins() already uses classifyCustomerBehavior internally for filtering
    if (type === 'all' || type === 'quickwins') {
      console.log('[AI INSIGHTS] Analyzing quick wins...');
      const quickWins = await generateQuickWins();
      console.log(`[AI INSIGHTS] Found ${quickWins.length} quick win opportunities (pre-filtered by segment)`);

      if (quickWins.length > 0) {
        const quickWinInsights = await generateQuickWinInsights(quickWins, behaviorMap);
        // Add quick wins at the beginning (they're the most actionable)
        allRecommendations.unshift(...quickWinInsights);
      }
    }

    // Sort by priority
    const sortedRecommendations = allRecommendations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    // Generate executive summary
    console.log('[AI INSIGHTS] Generating executive summary...');
    const executiveSummary = await generateExecutiveSummary(sortedRecommendations, {
      atRiskCount,
      atRiskRevenue,
      yoyChange,
      concentrationRisk,
      crossSellPotential,
    });

    const result: AIInsightResponse = {
      recommendations: sortedRecommendations,
      executive_summary: executiveSummary,
      generated_at: new Date().toISOString(),
    };

    console.log('='.repeat(60));
    console.log('[AI INSIGHTS] Analysis complete!');
    console.log(`[AI INSIGHTS] Total recommendations: ${result.recommendations.length}`);
    console.log(`[AI INSIGHTS] High priority: ${result.recommendations.filter(r => r.priority === 'high').length}`);
    console.log('='.repeat(60));

    return NextResponse.json(result);

  } catch (error) {
    console.error('[AI INSIGHTS] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI analysis failed' },
      { status: 500 }
    );
  }
}
