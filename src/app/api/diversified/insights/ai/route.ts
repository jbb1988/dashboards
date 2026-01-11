import { NextRequest, NextResponse } from 'next/server';
import {
  calculateCustomerAttrition,
  calculateYoYPerformance,
  generateCrossSellOpportunities,
  calculateConcentrationMetrics,
  CustomerAttritionScore,
  YoYPerformance,
  CrossSellOpportunity,
  ConcentrationMetrics,
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

IGNORE:
- Low-dollar commodity items are not worth chasing (Zinc Caps, Drill Taps, etc.)
- If a customer only buys small items, pitch them VEROflow or Strainers instead
`;

// ============================================================================
// INSIGHT GENERATORS
// ============================================================================

async function generateAttritionInsights(
  attrition: CustomerAttritionScore[]
): Promise<AIRecommendation[]> {
  const atRiskCustomers = attrition
    .filter(c => c.status === 'at_risk' || c.status === 'declining')
    .slice(0, 10);

  if (atRiskCustomers.length === 0) {
    return [];
  }

  const totalRevenueAtRisk = atRiskCustomers.reduce((sum, c) => sum + c.revenue_at_risk, 0);

  const customerSummaries = atRiskCustomers.map(c => ({
    name: c.customer_name,
    score: c.attrition_score,
    status: c.status,
    days_since_purchase: c.recency_days,
    revenue_at_risk: c.revenue_at_risk,
    frequency_change: c.frequency_change_pct,
    monetary_change: c.monetary_change_pct,
    product_mix_shrinking: c.product_mix_current < c.product_mix_prior,
  }));

  // Get our sales tactics for win-back
  const { salesTactics } = DIVERSIFIED_PRODUCTS;

  const prompt = `${SALES_INTELLIGENCE_CONTEXT}

WIN-BACK TACTICS:
- Lost customer: ${salesTactics.lostCustomer.action}
- Declining customer: ${salesTactics.decliningCustomer.action}

CUSTOMERS WHO STOPPED OR SLOWED ORDERING:
${JSON.stringify(customerSummaries, null, 2)}

Total at risk: ${formatCurrency(totalRevenueAtRisk)}

TASK: Give me 2-3 action items, but ONLY for customers who were buying high-value products:
- VEROflow equipment or calibration services
- Strainers (especially larger sizes)
- Fabricated Spools

SKIP customers who only bought low-dollar items (Zinc Caps, Drill Taps, etc.) - not worth the effort.

For each recommendation:
- Who to call (only if they bought high-value products)
- What high-value product they stopped buying
- What to say or offer

Return JSON:
{
  "recommendations": [
    {
      "priority": "high" | "medium" | "low",
      "title": "Call [Customer] about reorders",
      "problem": "Short description of the issue",
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
  opportunities: CrossSellOpportunity[]
): Promise<AIRecommendation[]> {
  const topOpportunities = opportunities.slice(0, 15);

  if (topOpportunities.length === 0) {
    return [];
  }

  const totalPotential = topOpportunities.reduce((sum, o) => sum + o.estimated_revenue, 0);

  // Get our cross-sell rules
  const crossSellRules = DIVERSIFIED_PRODUCTS.crossSellRules;

  const prompt = `${SALES_INTELLIGENCE_CONTEXT}

OUR CROSS-SELL RULES:
${crossSellRules.map(r => `- If buying ${r.when}, suggest ${r.suggest.join(', ')} (${r.reason})`).join('\n')}

CUSTOMERS WHO COULD BUY MORE PRODUCTS:
${JSON.stringify(topOpportunities.slice(0, 8).map(o => ({
  customer: o.customer_name,
  buys: o.current_classes.slice(0, 3).join(', '),
  should_also_buy: o.recommended_class,
  potential: formatCurrency(o.estimated_revenue),
})), null, 2)}

Total potential: ${formatCurrency(totalPotential)}

TASK: Give me 2-3 customers to call about HIGH-VALUE products.
- Pitch VEROflow, Strainers, or Spools to customers buying commodity items
- For Strainer/Spool buyers: cross-sell Flanges and Gaskets
- VEROflow owners: push annual calibration service
- DON'T recommend cross-selling low-dollar items
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
      type?: 'all' | 'attrition' | 'growth' | 'crosssell' | 'concentration';
      years?: number[];
    };

    const filters = { years: years || [new Date().getFullYear(), new Date().getFullYear() - 1] };

    console.log('='.repeat(60));
    console.log('[AI INSIGHTS] Starting analysis');
    console.log(`[AI INSIGHTS] Type: ${type}, Years: ${filters.years.join(', ')}`);
    console.log('='.repeat(60));

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
      const atRisk = attrition.filter(c => c.status === 'at_risk');
      atRiskCount = atRisk.length;
      atRiskRevenue = atRisk.reduce((sum, c) => sum + c.revenue_at_risk, 0);

      const attritionInsights = await generateAttritionInsights(attrition);
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

      const crossSellInsights = await generateCrossSellInsights(crossSell);
      allRecommendations.push(...crossSellInsights);
    }

    if (type === 'all' || type === 'concentration') {
      console.log('[AI INSIGHTS] Analyzing concentration...');
      const concentration = await calculateConcentrationMetrics(filters);
      concentrationRisk = concentration.hhi_interpretation;

      const concentrationInsights = await generateConcentrationInsights(concentration);
      allRecommendations.push(...concentrationInsights);
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
