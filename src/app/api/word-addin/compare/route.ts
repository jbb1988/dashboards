import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'mars-word-addin-secret';

interface Deviation {
  id: string;
  section: string;
  severity: 'high' | 'medium' | 'low';
  their_language: string;
  mars_standard: string;
  explanation: string;
  recommendation: string;
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

// POST: Compare document against a playbook
export async function POST(request: NextRequest) {
  try {
    const user = verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { document_text, playbook_id } = body;

    if (!document_text || document_text.trim().length < 100) {
      return NextResponse.json(
        { error: 'Document text is required (minimum 100 characters)' },
        { status: 400 }
      );
    }

    if (!playbook_id) {
      return NextResponse.json(
        { error: 'Playbook ID is required' },
        { status: 400 }
      );
    }

    // Get the playbook and its content
    const admin = getSupabaseAdmin();

    const { data: playbook, error: playbookError } = await admin
      .from('playbooks')
      .select('*')
      .eq('id', playbook_id)
      .single();

    if (playbookError || !playbook) {
      return NextResponse.json(
        { error: 'Playbook not found' },
        { status: 404 }
      );
    }

    // Get current version content
    const { data: version } = await admin
      .from('playbook_versions')
      .select('content')
      .eq('playbook_id', playbook_id)
      .eq('version', playbook.current_version)
      .single();

    const playbookContent = version?.content || '';

    if (!playbookContent) {
      return NextResponse.json(
        { error: 'Playbook has no content' },
        { status: 400 }
      );
    }

    // Use AI to compare the documents
    const comparisonResult = await compareWithAI(document_text, playbookContent, playbook.name);

    // Log the comparison (non-critical, ignore errors)
    try {
      await admin.from('word_addin_analyses').insert({
        user_email: user.email,
        document_length: document_text.length,
        risk_score: comparisonResult.deviation_score,
        risk_count: comparisonResult.deviations.length,
        analyzed_at: new Date().toISOString(),
      });
    } catch {
      // Logging failure is non-critical
    }

    return NextResponse.json({
      playbook_name: playbook.name,
      deviation_score: comparisonResult.deviation_score,
      summary: comparisonResult.summary,
      deviations: comparisonResult.deviations,
    });
  } catch (error) {
    console.error('Comparison error:', error);
    return NextResponse.json(
      { error: 'Comparison failed' },
      { status: 500 }
    );
  }
}

// AI Comparison function
async function compareWithAI(
  documentText: string,
  playbookText: string,
  playbookName: string
): Promise<{
  deviation_score: number;
  summary: string;
  deviations: Deviation[];
}> {
  const openrouterApiKey = process.env.OPENROUTER_API_KEY;

  if (!openrouterApiKey) {
    // Fallback to basic comparison if no API key
    return basicComparison(documentText, playbookText, playbookName);
  }

  const prompt = `You are a contract analyst comparing a third-party contract against the MARS standard agreement (${playbookName}).

MARS STANDARD AGREEMENT (${playbookName}):
${playbookText.substring(0, 8000)}

THIRD-PARTY CONTRACT TO REVIEW:
${documentText.substring(0, 8000)}

Compare the third-party contract against the MARS standard and identify deviations. Provide your analysis in the following JSON format:
{
  "deviation_score": <number 0-100, where 100 means completely different from MARS standard>,
  "summary": "<brief 2-3 sentence summary of how the contract compares to MARS standard>",
  "deviations": [
    {
      "section": "<section name, e.g., Liability, Indemnification, Termination>",
      "severity": "<high|medium|low>",
      "their_language": "<EXACT text from their contract that deviates - copy verbatim>",
      "mars_standard": "<the corresponding MARS standard language>",
      "explanation": "<why this deviation matters>",
      "recommendation": "<what to do about it>"
    }
  ]
}

Focus on identifying:
1. Clauses that are MORE restrictive than MARS standard (high severity)
2. Clauses that are MISSING from their contract that MARS requires (medium severity)
3. Clauses that use different language but may be acceptable (low severity)

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
      throw new Error('AI comparison failed');
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

    // Add IDs to deviations
    result.deviations = result.deviations.map((deviation: Omit<Deviation, 'id'>, index: number) => ({
      ...deviation,
      id: `deviation-${index}`,
    }));

    return result;
  } catch (error) {
    console.error('AI comparison error:', error);
    return basicComparison(documentText, playbookText, playbookName);
  }
}

// Basic comparison fallback
function basicComparison(
  documentText: string,
  playbookText: string,
  playbookName: string
): {
  deviation_score: number;
  summary: string;
  deviations: Deviation[];
} {
  const docLower = documentText.toLowerCase();
  const playbookLower = playbookText.toLowerCase();
  const deviations: Deviation[] = [];

  // Check for common clause patterns
  const clauseChecks = [
    {
      section: 'Limitation of Liability',
      playbookPattern: /liability.*shall not exceed|maximum liability/i,
      docPattern: /unlimited liability|no limit on liability/i,
      severity: 'high' as const,
      explanation: 'Their contract may have unlimited liability while MARS standard limits it.',
      recommendation: 'Negotiate to add liability caps matching MARS standard.',
    },
    {
      section: 'Indemnification',
      playbookPattern: /indemnif/i,
      docPattern: /indemnif.*any.*all|broad indemnification/i,
      severity: 'high' as const,
      explanation: 'Their indemnification clause may be broader than MARS standard.',
      recommendation: 'Limit indemnification to direct damages from breach.',
    },
    {
      section: 'Termination',
      playbookPattern: /terminat.*30 days|terminat.*notice/i,
      docPattern: /terminate.*immediately|terminate.*without notice/i,
      severity: 'medium' as const,
      explanation: 'Their termination terms may differ from MARS standard notice periods.',
      recommendation: 'Negotiate mutual termination rights with adequate notice.',
    },
  ];

  let deviationCount = 0;

  clauseChecks.forEach((check, index) => {
    const playbookHas = check.playbookPattern.test(playbookLower);
    const docHas = check.docPattern.test(docLower);

    if (docHas && playbookHas) {
      const docMatch = docLower.match(check.docPattern);
      deviations.push({
        id: `deviation-${index}`,
        section: check.section,
        severity: check.severity,
        their_language: docMatch ? docMatch[0].substring(0, 100) : 'See contract',
        mars_standard: `See ${playbookName} for standard language`,
        explanation: check.explanation,
        recommendation: check.recommendation,
      });
      deviationCount++;
    }
  });

  // Calculate deviation score based on findings
  const deviationScore = Math.min(30 + deviationCount * 15, 100);

  return {
    deviation_score: deviationScore,
    summary: `Compared against ${playbookName}. Found ${deviations.length} potential deviations from MARS standard. ${deviations.length > 0 ? 'Review highlighted differences before proceeding.' : 'Document appears generally consistent with standards.'}`,
    deviations,
  };
}
