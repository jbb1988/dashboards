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

const SALES_INTELLIGENCE_CONTEXT = `
You are a sales intelligence analyst for MARS, a B2B industrial products company specializing in water infrastructure equipment.

COMPANY CONTEXT:
- Products: Diversified industrial products including VEROflow meters, Spools, Strainers, Valves, and water infrastructure components
- Customers: Utilities, municipalities, industrial distributors (Ferguson, Core & Main, etc.)
- Sales model: Direct sales and through distribution partners
- Typical contract values: $10K - $500K annually per customer
- Business environment: Long sales cycles, relationship-driven, technical products

YOUR ROLE:
- Analyze sales data and provide actionable recommendations
- Focus on: Preventing customer churn, identifying growth opportunities, optimizing product mix, managing revenue concentration risk
- Be specific with customer names, dollar amounts, and concrete action steps
- Prioritize recommendations by potential revenue impact
- Consider seasonality and industry-specific factors
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

  const prompt = `${SALES_INTELLIGENCE_CONTEXT}

ATTRITION RISK DATA:
${JSON.stringify(customerSummaries, null, 2)}

SUMMARY:
- At-risk/declining customers: ${atRiskCustomers.length}
- Total revenue at risk: ${formatCurrency(totalRevenueAtRisk)}
- Highest risk customer: ${atRiskCustomers[0].customer_name} (score: ${atRiskCustomers[0].attrition_score})

TASK:
Analyze this attrition data and provide 2-3 specific, actionable recommendations.

For each recommendation:
1. Identify the most critical customer(s) to focus on
2. Explain the root cause of the decline (based on the data patterns)
3. Provide specific retention strategies
4. Include quick wins that could be implemented this week

Return as JSON:
{
  "recommendations": [
    {
      "priority": "high" | "medium" | "low",
      "title": "Brief title (max 60 chars)",
      "problem": "What's the issue - be specific with customer names and numbers",
      "recommendation": "What to do - specific, actionable steps",
      "expected_impact": "Quantified impact (e.g., 'Prevent $200K churn')",
      "action_items": ["Step 1", "Step 2", "Step 3"],
      "category": "attrition"
    }
  ]
}

Focus on the highest-value opportunities. Respond ONLY with JSON.`;

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

YEAR-OVER-YEAR PERFORMANCE DATA:

GROWING CUSTOMERS (replicate success):
${JSON.stringify(growing.map(c => ({
  name: c.entity_name,
  current_revenue: c.current_revenue,
  prior_revenue: c.prior_revenue,
  change_pct: c.revenue_change_pct,
  margin_change_bps: c.margin_change_bps,
})), null, 2)}

DECLINING CUSTOMERS (investigate and reverse):
${JSON.stringify(declining.map(c => ({
  name: c.entity_name,
  current_revenue: c.current_revenue,
  prior_revenue: c.prior_revenue,
  change_pct: c.revenue_change_pct,
  margin_change_bps: c.margin_change_bps,
})), null, 2)}

TASK:
Provide 2-3 recommendations focusing on:
1. How to replicate success from growing customers
2. How to reverse decline in declining customers
3. Specific talking points for sales conversations

Return as JSON:
{
  "recommendations": [
    {
      "priority": "high" | "medium" | "low",
      "title": "Brief title (max 60 chars)",
      "problem": "What's the issue or opportunity",
      "recommendation": "What to do",
      "expected_impact": "Quantified impact",
      "action_items": ["Step 1", "Step 2", "Step 3"],
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

  const prompt = `${SALES_INTELLIGENCE_CONTEXT}

CROSS-SELL OPPORTUNITIES:
${JSON.stringify(topOpportunities.map(o => ({
  customer: o.customer_name,
  currently_buys: o.current_classes.slice(0, 3).join(', '),
  recommended_product: o.recommended_class,
  affinity_score: o.affinity_score,
  estimated_revenue: o.estimated_revenue,
  similar_customers: o.similar_customer_count,
})), null, 2)}

SUMMARY:
- Total opportunities: ${topOpportunities.length}
- Potential revenue: ${formatCurrency(totalPotential)}
- Top recommendation: ${topOpportunities[0].customer_name} for ${topOpportunities[0].recommended_class}

TASK:
Provide 2-3 recommendations for the highest-value cross-sell opportunities.

Include:
1. Which customers to approach first
2. Specific talking points for the sales conversation
3. Why this product makes sense for them (based on what similar customers buy)
4. Timing recommendations

Return as JSON:
{
  "recommendations": [
    {
      "priority": "high" | "medium" | "low",
      "title": "Brief title (max 60 chars)",
      "problem": "The opportunity (e.g., 'Customer X only buys Y, missing Z')",
      "recommendation": "How to approach this opportunity",
      "expected_impact": "Quantified impact",
      "action_items": ["Step 1", "Step 2", "Step 3"],
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

REVENUE CONCENTRATION DATA:
- HHI Index: ${concentration.hhi_index} (${concentration.hhi_interpretation})
- Top customer: ${concentration.top_customer_name} (${concentration.top_customer_pct.toFixed(1)}% of revenue)
- Top 3 concentration: ${concentration.top_3_concentration.toFixed(1)}% (${concentration.top_3_names.join(', ')})
- Customers for 80% of revenue: ${concentration.customers_for_80_pct}
- Single customer risk: ${concentration.single_customer_risk ? 'YES - HIGH RISK' : 'No'}

CUSTOMER SEGMENTS:
${JSON.stringify(concentration.segments, null, 2)}

TASK:
Provide 1-2 recommendations for managing concentration risk.

Focus on:
1. Diversification strategies (without alienating top customers)
2. Risk mitigation if a top customer leaves
3. Growing mid-tier customers to reduce concentration

Return as JSON:
{
  "recommendations": [
    {
      "priority": "high" | "medium" | "low",
      "title": "Brief title (max 60 chars)",
      "problem": "The concentration risk",
      "recommendation": "How to address it",
      "expected_impact": "Risk mitigation benefit",
      "action_items": ["Step 1", "Step 2", "Step 3"],
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

  const prompt = `${SALES_INTELLIGENCE_CONTEXT}

SALES INTELLIGENCE SUMMARY:
- Customers at risk: ${summary.atRiskCount} (${formatCurrency(summary.atRiskRevenue)} at risk)
- YoY Revenue Change: ${summary.yoyChange > 0 ? '+' : ''}${summary.yoyChange.toFixed(1)}%
- Concentration Risk: ${summary.concentrationRisk}
- Cross-sell Potential: ${formatCurrency(summary.crossSellPotential)}
- High Priority Actions: ${highPriority.length}

TOP RECOMMENDATIONS:
${highPriority.slice(0, 3).map(r => `- ${r.title}: ${r.problem}`).join('\n')}

TASK:
Write a 2-3 sentence executive summary for the VP of Sales.
Be direct, quantify the opportunity, and state the #1 priority action.

Return as JSON:
{
  "executive_summary": "Your 2-3 sentence summary"
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
