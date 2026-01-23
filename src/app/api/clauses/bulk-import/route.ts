import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/apiAuth';

export const maxDuration = 300; // 5 minutes for AI processing

// POST: Process a contract text to extract and create clauses
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { contract_text, contract_name, source_contract_id } = body;

    if (!contract_text?.trim()) {
      return NextResponse.json(
        { error: 'Contract text is required' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    // Get existing categories for classification
    const { data: categories } = await admin
      .from('clause_categories')
      .select('id, name')
      .order('sort_order');

    const categoryMap = new Map(categories?.map(c => [c.name.toLowerCase(), c.id]) || []);

    // Call AI to extract clauses
    const extractionPrompt = `You are a contract analysis expert. Extract reusable clauses from the following contract text.

For each distinct clause you identify, provide:
1. A descriptive name
2. The clause category (one of: Limitation of Liability, Indemnification, Intellectual Property, Confidentiality, Termination, Warranties, Payment Terms, Insurance, Compliance, Dispute Resolution, Force Majeure, Assignment, Notices, Governing Law, General Provisions)
3. The full clause text
4. A risk assessment (low, medium, high) from MARS Company's perspective
5. A brief description of what the clause covers

CONTRACT TEXT:
${contract_text.substring(0, 50000)}

OUTPUT FORMAT (JSON array):
[
  {
    "name": "Limitation of Liability - Service Provider",
    "category": "Limitation of Liability",
    "text": "The full clause text...",
    "risk_level": "medium",
    "description": "Limits vendor liability to contract value"
  }
]

RULES:
- Only extract substantive legal clauses
- Ignore headers, signatures, and boilerplate
- Preserve exact wording from the contract
- Focus on clauses that could be reused in similar agreements
- Identify any unusual or non-standard language`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://mars-contracts.vercel.app',
        'X-Title': 'MARS Contracts - Clause Extraction',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4',
        messages: [{ role: 'user', content: extractionPrompt }],
        max_tokens: 8000,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiResult = await response.json();
    const aiContent = aiResult.choices?.[0]?.message?.content || '';

    // Parse AI response
    let extractedClauses: Array<{
      name: string;
      category: string;
      text: string;
      risk_level: string;
      description: string;
    }> = [];

    try {
      // Find JSON array in response
      const jsonMatch = aiContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        extractedClauses = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      return NextResponse.json(
        { error: 'Failed to parse extracted clauses' },
        { status: 500 }
      );
    }

    // Deduplicate against existing clauses
    const { data: existingClauses } = await admin
      .from('clause_library')
      .select('primary_text')
      .eq('is_active', true);

    const existingTexts = new Set(
      existingClauses?.map(c => normalizeText(c.primary_text)) || []
    );

    // Filter out duplicates (>90% similarity)
    const newClauses = extractedClauses.filter(clause => {
      const normalizedText = normalizeText(clause.text);
      for (const existing of existingTexts) {
        if (calculateSimilarity(normalizedText, existing) > 0.9) {
          return false;
        }
      }
      return true;
    });

    // Insert new clauses
    const clausesToInsert = newClauses.map(clause => ({
      category_id: categoryMap.get(clause.category.toLowerCase()) || null,
      name: clause.name,
      description: clause.description,
      primary_text: clause.text,
      risk_level: clause.risk_level?.toLowerCase() || 'medium',
      position_type: 'neutral',
      tags: [contract_name || 'imported'].filter(Boolean),
      source_contract_id: source_contract_id || null,
      source_contract_name: contract_name || null,
      created_by: user.email || 'bulk-import',
    }));

    let insertedCount = 0;
    if (clausesToInsert.length > 0) {
      const { data: inserted, error: insertError } = await admin
        .from('clause_library')
        .insert(clausesToInsert)
        .select();

      if (insertError) {
        console.error('Failed to insert clauses:', insertError);
      } else {
        insertedCount = inserted?.length || 0;
      }
    }

    return NextResponse.json({
      success: true,
      extracted: extractedClauses.length,
      duplicatesSkipped: extractedClauses.length - newClauses.length,
      inserted: insertedCount,
      clauses: clausesToInsert,
    });
  } catch (error) {
    console.error('Error in bulk import:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to normalize text for comparison
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();
}

// Simple similarity calculation (Jaccard index on words)
function calculateSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.split(' '));
  const words2 = new Set(text2.split(' '));

  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}
