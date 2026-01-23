import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'mars-word-addin-secret';

interface Risk {
  id: string;
  type: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  suggestion: string;
  location?: string;
  context_before?: string; // 50 chars before the problematic text for better matching
  context_after?: string;  // 50 chars after the problematic text for better matching
  clause_category?: string; // Maps to clause_categories.name
  matched_clause?: MatchedClause | null;
}

interface MatchedClause {
  id: string;
  name: string;
  category: string;
  category_id: string;
  risk_level: string;
  primary_text: string;
  fallback_text: string | null;
  last_resort_text: string | null;
}

interface ClauseSuggestion {
  id: string;
  name: string;
  category: string;
  risk_level: string;
  primary_text: string;
  fallback_text?: string;
}

// Verify token helper (allows test mode)
function verifyToken(request: NextRequest): { email: string; name: string } | null {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) return null;

  // Allow test mode token
  if (token === 'test-mode-token') {
    return { email: 'test@mars.com', name: 'Test User' };
  }

  try {
    return jwt.verify(token, JWT_SECRET) as { email: string; name: string };
  } catch {
    return null;
  }
}

// POST: Analyze document
export async function POST(request: NextRequest) {
  try {
    const user = verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { document_text } = body;

    if (!document_text || document_text.trim().length < 100) {
      return NextResponse.json(
        { error: 'Document text is required (minimum 100 characters)' },
        { status: 400 }
      );
    }

    // Call AI for analysis
    const analysisResult = await analyzeWithAI(document_text);

    // Get relevant clause suggestions from library
    const clauseSuggestions = await getClauseSuggestions(analysisResult.identified_clause_types);

    // Match each risk to a Clause Library entry based on clause_category
    const admin = getSupabaseAdmin();
    const risksWithMatchedClauses = await matchRisksToClauses(admin, analysisResult.risks);

    // Log the analysis (non-critical, ignore errors)
    try {
      await admin.from('word_addin_analyses').insert({
        user_email: user.email,
        document_length: document_text.length,
        risk_score: analysisResult.overall_risk_score,
        risk_count: analysisResult.risks.length,
        analyzed_at: new Date().toISOString(),
      });
    } catch {
      // Logging failure is non-critical
    }

    return NextResponse.json({
      overall_risk_score: analysisResult.overall_risk_score,
      risk_level: analysisResult.risk_level,
      risks: risksWithMatchedClauses,
      clause_suggestions: clauseSuggestions,
      summary: analysisResult.summary,
    });
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: 'Analysis failed' },
      { status: 500 }
    );
  }
}

// AI Analysis function
async function analyzeWithAI(documentText: string): Promise<{
  overall_risk_score: number;
  risk_level: string;
  risks: Risk[];
  summary: string;
  identified_clause_types: string[];
}> {
  const openrouterApiKey = process.env.OPENROUTER_API_KEY;

  if (!openrouterApiKey) {
    // Fallback to basic analysis if no API key
    return basicAnalysis(documentText);
  }

  const prompt = `You are a contract risk analyst. Analyze this contract document and identify potential risks and issues.

Document:
${documentText.substring(0, 15000)}

Provide your analysis in the following JSON format:
{
  "overall_risk_score": <number 0-100, where 100 is highest risk>,
  "risk_level": "<high|medium|low>",
  "summary": "<brief 2-3 sentence summary of the contract and main concerns>",
  "identified_clause_types": ["<clause type 1>", "<clause type 2>", ...],
  "risks": [
    {
      "type": "<category: liability|indemnification|termination|ip|payment|confidentiality|warranty|other>",
      "severity": "<high|medium|low>",
      "title": "<brief title>",
      "description": "<explanation of the risk>",
      "location": "<EXACT text from the document that is problematic - copy it VERBATIM including all punctuation, quotes, and whitespace so it can be found and replaced>",
      "context_before": "<the 50 characters that appear IMMEDIATELY BEFORE the problematic text in the document>",
      "context_after": "<the 50 characters that appear IMMEDIATELY AFTER the problematic text in the document>",
      "suggestion": "<the EXACT replacement text that should replace the problematic text - write complete clause language ready to insert>",
      "clause_category": "<MUST be one of: Limitation of Liability, Indemnification, Intellectual Property, Confidentiality, Termination, Warranty, Payment Terms, Insurance, Compliance, Dispute Resolution, Force Majeure, Assignment, Notices, Governing Law, General>"
    }
  ]
}

CRITICAL: For each risk:
- "location" must be the EXACT problematic text copied VERBATIM from the document (not a summary or paraphrase)
  - Include the exact punctuation, quotes (whether smart or straight), and spacing from the document
  - Copy the complete clause or sentence, not just a few words
- "context_before" and "context_after" help locate the exact position in documents with similar clauses
- "suggestion" must be the COMPLETE replacement clause text ready to insert (not advice, but actual contract language)
- "clause_category" must map to one of the MARS Clause Library categories so we can suggest pre-approved language

Focus on:
1. Unlimited liability exposure (clause_category: "Limitation of Liability")
2. Broad indemnification requirements (clause_category: "Indemnification")
3. Unfavorable termination terms (clause_category: "Termination")
4. IP ownership issues (clause_category: "Intellectual Property")
5. Payment terms and penalties (clause_category: "Payment Terms")
6. Missing or weak confidentiality protections (clause_category: "Confidentiality")
7. Warranty disclaimers (clause_category: "Warranty")
8. Governing law and jurisdiction (clause_category: "Governing Law" or "Dispute Resolution")

Return ONLY valid JSON, no additional text.`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openrouterApiKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://mars-contracts.vercel.app',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      throw new Error('AI analysis failed');
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No response from AI');
    }

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid JSON response');
    }

    const result = JSON.parse(jsonMatch[0]);

    // Add IDs to risks
    result.risks = result.risks.map((risk: Omit<Risk, 'id'>, index: number) => ({
      ...risk,
      id: `risk-${index}`,
    }));

    return result;
  } catch (error) {
    console.error('AI analysis error:', error);
    return basicAnalysis(documentText);
  }
}

// Basic analysis fallback
function basicAnalysis(documentText: string): {
  overall_risk_score: number;
  risk_level: string;
  risks: Risk[];
  summary: string;
  identified_clause_types: string[];
} {
  const text = documentText.toLowerCase();
  const risks: Risk[] = [];
  let riskScore = 30; // Base score

  // Check for high-risk patterns
  const patterns = [
    {
      regex: /unlimited liability|no limit on liability/i,
      type: 'liability',
      severity: 'high' as const,
      title: 'Unlimited Liability',
      description: 'Contract contains unlimited liability provisions which could expose you to significant financial risk.',
      suggestion: 'Consider adding a liability cap tied to contract value or a fixed amount.',
      points: 20,
    },
    {
      regex: /indemnif(y|ication).*(?:any|all|third.?party)/i,
      type: 'indemnification',
      severity: 'high' as const,
      title: 'Broad Indemnification',
      description: 'Indemnification clause appears overly broad and may include third-party claims.',
      suggestion: 'Limit indemnification to direct claims arising from your breach or negligence.',
      points: 15,
    },
    {
      regex: /terminate.*(?:convenience|any reason|without cause)/i,
      type: 'termination',
      severity: 'medium' as const,
      title: 'Termination for Convenience',
      description: 'Counterparty can terminate without cause, which may leave you without recourse.',
      suggestion: 'Negotiate mutual termination rights or require notice period and wind-down provisions.',
      points: 10,
    },
    {
      regex: /(?:all|any).*intellectual property.*(?:transfer|assign|belong)/i,
      type: 'ip',
      severity: 'high' as const,
      title: 'IP Ownership Transfer',
      description: 'Contract may transfer all IP rights to the counterparty.',
      suggestion: 'Retain ownership of pre-existing IP and negotiate joint ownership for co-developed materials.',
      points: 15,
    },
    {
      regex: /(?:as.?is|no warranty|without warranty)/i,
      type: 'warranty',
      severity: 'medium' as const,
      title: 'Warranty Disclaimer',
      description: 'Contract disclaims warranties which may limit your remedies.',
      suggestion: 'Negotiate basic warranties for merchantability and fitness for purpose.',
      points: 10,
    },
  ];

  patterns.forEach((pattern) => {
    if (pattern.regex.test(text)) {
      const match = text.match(pattern.regex);
      risks.push({
        id: `risk-${risks.length}`,
        type: pattern.type,
        severity: pattern.severity,
        title: pattern.title,
        description: pattern.description,
        suggestion: pattern.suggestion,
        location: match ? match[0].substring(0, 50) : undefined,
      });
      riskScore += pattern.points;
    }
  });

  // Cap at 100
  riskScore = Math.min(riskScore, 100);

  // Determine risk level
  let riskLevel = 'low';
  if (riskScore >= 70) riskLevel = 'high';
  else if (riskScore >= 40) riskLevel = 'medium';

  return {
    overall_risk_score: riskScore,
    risk_level: riskLevel,
    risks,
    summary: `Document analyzed with ${risks.length} potential issues identified. ${riskLevel === 'high' ? 'Significant risks require attention before signing.' : riskLevel === 'medium' ? 'Some concerns should be reviewed.' : 'Document appears relatively standard.'}`,
    identified_clause_types: ['general'],
  };
}

// Match risks to Clause Library entries based on clause_category
async function matchRisksToClauses(
  admin: ReturnType<typeof getSupabaseAdmin>,
  risks: Risk[]
): Promise<Risk[]> {
  try {
    // Get all unique clause categories from risks
    const categories = [...new Set(risks.map(r => r.clause_category).filter(Boolean))];

    if (categories.length === 0) {
      return risks;
    }

    // Get category IDs by name (case-insensitive match)
    const { data: categoryData } = await admin
      .from('clause_categories')
      .select('id, name');

    if (!categoryData || categoryData.length === 0) {
      return risks;
    }

    // Build category name to ID map (case-insensitive)
    const categoryNameToId = new Map<string, string>();
    categoryData.forEach(cat => {
      categoryNameToId.set(cat.name.toLowerCase(), cat.id);
    });

    // Get all clauses for matching categories
    const categoryIds = categories
      .map(c => categoryNameToId.get(c?.toLowerCase() || ''))
      .filter(Boolean) as string[];

    if (categoryIds.length === 0) {
      return risks;
    }

    const { data: clauses } = await admin
      .from('clause_library')
      .select(`
        id,
        name,
        category_id,
        risk_level,
        primary_text,
        fallback_text,
        last_resort_text,
        usage_count
      `)
      .in('category_id', categoryIds)
      .eq('is_active', true)
      .order('usage_count', { ascending: false });

    if (!clauses || clauses.length === 0) {
      return risks;
    }

    // Build category ID to name map
    const categoryIdToName = new Map<string, string>();
    categoryData.forEach(cat => {
      categoryIdToName.set(cat.id, cat.name);
    });

    // Match each risk to the best clause
    return risks.map(risk => {
      if (!risk.clause_category) {
        return risk;
      }

      const categoryId = categoryNameToId.get(risk.clause_category.toLowerCase());
      if (!categoryId) {
        return risk;
      }

      // Find the best clause for this category (highest usage count)
      const matchingClause = clauses.find(c => c.category_id === categoryId);
      if (!matchingClause) {
        return risk;
      }

      return {
        ...risk,
        matched_clause: {
          id: matchingClause.id,
          name: matchingClause.name,
          category: categoryIdToName.get(matchingClause.category_id) || 'Unknown',
          category_id: matchingClause.category_id,
          risk_level: matchingClause.risk_level || 'medium',
          primary_text: matchingClause.primary_text,
          fallback_text: matchingClause.fallback_text,
          last_resort_text: matchingClause.last_resort_text,
        },
      };
    });
  } catch (error) {
    console.error('Failed to match risks to clauses:', error);
    return risks;
  }
}

// Get clause suggestions from library
async function getClauseSuggestions(clauseTypes: string[]): Promise<ClauseSuggestion[]> {
  try {
    const admin = getSupabaseAdmin();

    // Get relevant clauses based on identified types
    let query = admin
      .from('clause_library')
      .select('id, name, category_id, risk_level, primary_text, fallback_text')
      .eq('is_active', true)
      .order('usage_count', { ascending: false })
      .limit(5);

    // If we have specific clause types, try to match them
    if (clauseTypes.length > 0 && clauseTypes[0] !== 'general') {
      // Get category IDs for the clause types
      const { data: categories } = await admin
        .from('clause_categories')
        .select('id, name')
        .in('name', clauseTypes.map(t => t.toLowerCase()));

      if (categories && categories.length > 0) {
        query = query.in('category_id', categories.map(c => c.id));
      }
    }

    const { data: clauses } = await query;

    if (!clauses || clauses.length === 0) {
      return [];
    }

    // Get category names
    const categoryIds = [...new Set(clauses.map(c => c.category_id).filter(Boolean))];
    const { data: categories } = await admin
      .from('clause_categories')
      .select('id, name')
      .in('id', categoryIds);

    const categoryMap = new Map(categories?.map(c => [c.id, c.name]) || []);

    return clauses.map(clause => ({
      id: clause.id,
      name: clause.name,
      category: categoryMap.get(clause.category_id) || 'General',
      risk_level: clause.risk_level || 'medium',
      primary_text: clause.primary_text,
      fallback_text: clause.fallback_text,
    }));
  } catch (error) {
    console.error('Failed to get clause suggestions:', error);
    return [];
  }
}
