import { NextRequest, NextResponse } from 'next/server';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const MODEL = 'anthropic/claude-sonnet-4';

// ============================================================================
// TYPES
// ============================================================================

interface SectionChange {
  description: string;
  original: string;
  revised: string;
  impact: string;
}

interface SectionComparison {
  sectionNumber: string;
  sectionTitle: string;
  status: 'unchanged' | 'changed' | 'added' | 'removed';
  significance: 'high' | 'medium' | 'low' | 'none';
  reasoning?: string;
  changes: SectionChange[];
}

interface SectionCompareResult {
  mode: 'section-by-section';
  documentInfo: {
    originalTitle: string;
    revisedTitle: string;
    originalDate: string;
    revisedDate: string;
  };
  summary: {
    totalSections: number;
    sectionsChanged: number;
    sectionsAdded: number;
    sectionsRemoved: number;
    sectionsUnchanged: number;
    keyTakeaways: string[];
  };
  sections: SectionComparison[];
  addedSections: string[];
  removedSections: string[];
}

interface ComparisonRecommendation {
  sectionNumber: string;
  sectionTitle: string;
  verdict: 'accept' | 'negotiate' | 'push_back';
  reasoning: string;
  suggestedLanguage?: string;
  riskLevel: 'low' | 'medium' | 'high';
}

interface ComparisonAnalysisResult {
  recommendations: ComparisonRecommendation[];
  overallAssessment: string;
  criticalIssues: string[];
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
      temperature: 0,
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

// ============================================================================
// MARS LEGAL POSITIONS FOR ANALYSIS
// ============================================================================

const MARS_POSITIONS = `
MARS STANDARD NEGOTIATING POSITIONS:
- Liability: Cap at contract value, limit to direct damages only, exclude consequential/indirect damages
- Indemnification: Must be mutual and proportionate to fault; never indemnify for County/Client's own negligence
- IP/Work Product: MARS retains all pre-existing IP, tools, methodologies, templates; only deliverables specifically created become client property
- Termination: Require payment for work performed plus reasonable wind-down costs if terminated without cause
- Warranty: Should not exceed 1 year
- Payment: Net 30 or longer preferred
- Audit Rights: Reasonable notice, limited frequency (annually), scope limited to records related to the agreement
- Disputes: Preserve right to legal remedies, no unilateral final decisions by client
- Term Extensions: Multi-year commitments should include rate locks or limited escalation
- Insurance: Standard commercial coverage, limits proportionate to contract value
`;

// ============================================================================
// ANALYZE SECTIONS
// ============================================================================

async function analyzeSection(section: SectionComparison): Promise<ComparisonRecommendation> {
  // Skip unchanged sections
  if (section.status === 'unchanged') {
    return {
      sectionNumber: section.sectionNumber,
      sectionTitle: section.sectionTitle,
      verdict: 'accept',
      reasoning: 'Section unchanged - no action needed.',
      riskLevel: 'low',
    };
  }

  const changesDescription = section.changes
    .map(c => `- ${c.description}\n  Original: ${c.original}\n  Revised: ${c.revised}\n  Impact: ${c.impact}`)
    .join('\n\n');

  const prompt = `You are an expert contract attorney advising MARS Company (the Contractor/Vendor) on contract negotiations.

${MARS_POSITIONS}

ANALYZE THIS CONTRACT SECTION CHANGE:
Section: ${section.sectionNumber}. ${section.sectionTitle}
Status: ${section.status}
Significance: ${section.significance}

CHANGES IDENTIFIED:
${changesDescription}

YOUR TASK:
1. Evaluate whether this change is favorable, neutral, or unfavorable to MARS
2. Provide a verdict: "accept", "negotiate", or "push_back"
3. Explain your reasoning briefly
4. If verdict is "negotiate" or "push_back", provide specific COUNTER-LANGUAGE that MARS should propose
5. Assess the risk level

VERDICT GUIDELINES:
- "accept": Change is favorable to MARS, neutral, or industry standard with no material risk
- "negotiate": Change has some risk but could be improved with modifications
- "push_back": Change is materially unfavorable and should be rejected or significantly revised

Return your analysis as JSON:
{
  "verdict": "accept" | "negotiate" | "push_back",
  "reasoning": "Brief explanation of why this verdict was chosen",
  "suggestedLanguage": "If negotiate/push_back: The specific counter-language MARS should propose. Include the full revised clause text.",
  "riskLevel": "low" | "medium" | "high"
}

Respond ONLY with the JSON, no other text.`;

  try {
    const response = await callAI(prompt, 2000);
    const result = extractJSON(response) as {
      verdict: 'accept' | 'negotiate' | 'push_back';
      reasoning: string;
      suggestedLanguage?: string;
      riskLevel: 'low' | 'medium' | 'high';
    };

    return {
      sectionNumber: section.sectionNumber,
      sectionTitle: section.sectionTitle,
      verdict: result.verdict,
      reasoning: result.reasoning,
      suggestedLanguage: result.suggestedLanguage,
      riskLevel: result.riskLevel,
    };
  } catch (error) {
    console.error(`[ANALYZE] Error analyzing section ${section.sectionNumber}:`, error);
    return {
      sectionNumber: section.sectionNumber,
      sectionTitle: section.sectionTitle,
      verdict: 'negotiate',
      reasoning: 'Unable to analyze automatically - manual review recommended.',
      riskLevel: 'medium',
    };
  }
}

async function generateOverallAssessment(
  recommendations: ComparisonRecommendation[],
  comparisonResult: SectionCompareResult
): Promise<{ overallAssessment: string; criticalIssues: string[] }> {
  const pushBackCount = recommendations.filter(r => r.verdict === 'push_back').length;
  const negotiateCount = recommendations.filter(r => r.verdict === 'negotiate').length;
  const acceptCount = recommendations.filter(r => r.verdict === 'accept').length;
  const highRiskCount = recommendations.filter(r => r.riskLevel === 'high').length;

  const criticalSections = recommendations
    .filter(r => r.verdict === 'push_back' || r.riskLevel === 'high')
    .map(r => `[${r.sectionTitle}] ${r.reasoning}`);

  const prompt = `You are summarizing contract analysis results for MARS Company.

ANALYSIS SUMMARY:
- Total sections analyzed: ${recommendations.length}
- Accept (no changes needed): ${acceptCount}
- Negotiate (needs modification): ${negotiateCount}
- Push Back (reject/significantly revise): ${pushBackCount}
- High Risk Sections: ${highRiskCount}

KEY TAKEAWAYS FROM COMPARISON:
${comparisonResult.summary.keyTakeaways.join('\n')}

CRITICAL SECTIONS:
${criticalSections.join('\n') || 'None identified'}

Write a brief (2-3 sentence) overall assessment of this contract revision from MARS's perspective.
Focus on: Is this revision generally favorable? What are the main concerns? What's the recommended next step?

Return as JSON:
{
  "overallAssessment": "Your 2-3 sentence assessment"
}

Respond ONLY with the JSON.`;

  try {
    const response = await callAI(prompt, 500);
    const result = extractJSON(response) as { overallAssessment: string };
    return {
      overallAssessment: result.overallAssessment,
      criticalIssues: criticalSections,
    };
  } catch {
    return {
      overallAssessment: `This contract revision includes ${pushBackCount} sections requiring rejection, ${negotiateCount} sections requiring negotiation, and ${acceptCount} sections that are acceptable. ${highRiskCount > 0 ? `There are ${highRiskCount} high-risk items requiring immediate attention.` : 'No critical risks identified.'}`,
      criticalIssues: criticalSections,
    };
  }
}

// ============================================================================
// MAIN API HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { comparisonResult } = body as { comparisonResult: SectionCompareResult };

    if (!comparisonResult || !comparisonResult.sections) {
      return NextResponse.json(
        { error: 'Comparison result is required' },
        { status: 400 }
      );
    }

    console.log('='.repeat(60));
    console.log('[ANALYZE] Starting AI Comparison Analysis');
    console.log(`[ANALYZE] Sections to analyze: ${comparisonResult.sections.length}`);
    console.log('='.repeat(60));

    // Filter to only analyze changed/added/removed sections
    const sectionsToAnalyze = comparisonResult.sections.filter(
      s => s.status !== 'unchanged'
    );

    console.log(`[ANALYZE] Sections with changes: ${sectionsToAnalyze.length}`);

    // Analyze sections in parallel (with rate limiting)
    const batchSize = 5;
    const recommendations: ComparisonRecommendation[] = [];

    for (let i = 0; i < sectionsToAnalyze.length; i += batchSize) {
      const batch = sectionsToAnalyze.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(analyzeSection));
      recommendations.push(...batchResults);
      console.log(`[ANALYZE] Completed batch ${Math.floor(i / batchSize) + 1}`);
    }

    // Add unchanged sections as "accept"
    const unchangedSections = comparisonResult.sections
      .filter(s => s.status === 'unchanged')
      .map(s => ({
        sectionNumber: s.sectionNumber,
        sectionTitle: s.sectionTitle,
        verdict: 'accept' as const,
        reasoning: 'Section unchanged - no action needed.',
        riskLevel: 'low' as const,
      }));

    recommendations.push(...unchangedSections);

    // Sort recommendations by section number
    recommendations.sort((a, b) => {
      const numA = parseInt(a.sectionNumber.replace(/\D/g, '')) || 0;
      const numB = parseInt(b.sectionNumber.replace(/\D/g, '')) || 0;
      return numA - numB;
    });

    // Generate overall assessment
    const { overallAssessment, criticalIssues } = await generateOverallAssessment(
      recommendations,
      comparisonResult
    );

    const result: ComparisonAnalysisResult = {
      recommendations,
      overallAssessment,
      criticalIssues,
    };

    console.log('='.repeat(60));
    console.log('[ANALYZE] Analysis complete!');
    console.log(`[ANALYZE] Accept: ${recommendations.filter(r => r.verdict === 'accept').length}`);
    console.log(`[ANALYZE] Negotiate: ${recommendations.filter(r => r.verdict === 'negotiate').length}`);
    console.log(`[ANALYZE] Push Back: ${recommendations.filter(r => r.verdict === 'push_back').length}`);
    console.log('='.repeat(60));

    return NextResponse.json(result);

  } catch (error) {
    console.error('[ANALYZE] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}
