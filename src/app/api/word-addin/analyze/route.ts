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
}

interface ClauseSuggestion {
  id: string;
  name: string;
  category: string;
  risk_level: string;
  primary_text: string;
  fallback_text?: string;
}

// Verify token helper
function verifyToken(request: NextRequest): { email: string; name: string } | null {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) return null;

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

    // Log the analysis
    const admin = getSupabaseAdmin();
    await admin.from('word_addin_analyses').insert({
      user_email: user.email,
      document_length: document_text.length,
      risk_score: analysisResult.overall_risk_score,
      risk_count: analysisResult.risks.length,
      analyzed_at: new Date().toISOString(),
    }).catch(() => {/* Logging failure is non-critical */});

    return NextResponse.json({
      overall_risk_score: analysisResult.overall_risk_score,
      risk_level: analysisResult.risk_level,
      risks: analysisResult.risks,
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
      "suggestion": "<recommended alternative language or action>",
      "location": "<short excerpt from document where issue is found, max 50 chars>"
    }
  ]
}

Focus on:
1. Unlimited liability exposure
2. Broad indemnification requirements
3. Unfavorable termination terms
4. IP ownership issues
5. Payment terms and penalties
6. Missing or weak confidentiality protections
7. Warranty disclaimers
8. Governing law and jurisdiction

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
