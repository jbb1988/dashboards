import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/apiAuth';

export const maxDuration = 300; // 5 minutes for AI processing

// POST: Extract obligations from contract text using AI
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      contract_text,
      contract_id,
      contract_review_id,
      contract_name,
      counterparty_name,
      effective_date,
    } = body;

    if (!contract_text?.trim()) {
      return NextResponse.json(
        { error: 'Contract text is required' },
        { status: 400 }
      );
    }

    // Build the extraction prompt
    const extractionPrompt = `You are a contract analysis expert. Extract all time-sensitive obligations and deadlines from the following contract text.

CONTRACT DETAILS:
- Contract Name: ${contract_name || 'Unknown'}
- Counterparty: ${counterparty_name || 'Unknown'}
- Effective Date: ${effective_date || 'Not specified'}

CONTRACT TEXT:
${contract_text.substring(0, 50000)}

EXTRACT THE FOLLOWING TYPES OF OBLIGATIONS:
1. Payment obligations (due dates, payment schedules)
2. Delivery obligations (deliverable deadlines)
3. Notice requirements (termination notice, renewal notice periods)
4. Renewal/Termination windows (auto-renewal, opt-out dates)
5. Reporting requirements (periodic reports, certifications)
6. Insurance requirements (certificate renewals)
7. Compliance requirements (certifications, audits)
8. Milestone dates (project milestones)
9. Any other time-sensitive obligations

FOR EACH OBLIGATION PROVIDE:
- title: Brief descriptive title
- description: Detailed description
- obligation_type: One of [payment, delivery, notice, renewal, termination, reporting, insurance, compliance, audit, milestone, other]
- due_date: Specific date if mentioned (YYYY-MM-DD format), or null if relative/unclear
- recurrence: One of [daily, weekly, monthly, quarterly, annually, custom, null]
- assigned_party: Which party is responsible ("MARS", "counterparty", "both")
- priority: [low, medium, high, critical] based on financial/operational impact
- financial_impact: Estimated financial impact if known
- source_text: The exact text from which this obligation was extracted
- confidence: 0-1 confidence score in extraction accuracy

OUTPUT FORMAT (JSON array):
[
  {
    "title": "Quarterly Revenue Report",
    "description": "Submit quarterly revenue reports within 30 days of quarter end",
    "obligation_type": "reporting",
    "due_date": null,
    "recurrence": "quarterly",
    "assigned_party": "MARS",
    "priority": "medium",
    "financial_impact": null,
    "source_text": "Client shall provide quarterly revenue reports within thirty (30) days following the end of each calendar quarter.",
    "confidence": 0.95
  }
]

RULES:
- Only extract genuine time-sensitive obligations
- Be specific about dates and deadlines
- If a date is relative (e.g., "30 days after signing"), note it in description
- Include both MARS obligations and counterparty obligations we need to track
- Flag high-priority items that could have significant financial or legal consequences
- Include exact source text for audit trail`;

    // Call AI to extract obligations
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://mars-contracts.vercel.app',
        'X-Title': 'MARS Contracts - Obligation Extraction',
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
    let extractedObligations: Array<{
      title: string;
      description: string;
      obligation_type: string;
      due_date: string | null;
      recurrence: string | null;
      assigned_party: string;
      priority: string;
      financial_impact: number | null;
      source_text: string;
      confidence: number;
    }> = [];

    try {
      const jsonMatch = aiContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        extractedObligations = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      return NextResponse.json(
        { error: 'Failed to parse extracted obligations' },
        { status: 500 }
      );
    }

    const admin = getSupabaseAdmin();

    // Insert extracted obligations
    const obligationsToInsert = extractedObligations
      .filter(o => o.assigned_party === 'MARS' || o.assigned_party === 'both')
      .map(o => ({
        contract_id: contract_id || null,
        contract_review_id: contract_review_id || null,
        contract_name: contract_name || 'Unknown Contract',
        counterparty_name: counterparty_name || null,
        title: o.title,
        description: o.description,
        obligation_type: o.obligation_type || 'other',
        due_date: o.due_date || null,
        recurrence: o.recurrence || null,
        priority: o.priority || 'medium',
        financial_impact: o.financial_impact || null,
        source_text: o.source_text,
        ai_extracted: true,
        ai_confidence: o.confidence,
        extraction_review_status: 'pending_review',
        created_by: user.email || 'system',
      }));

    let insertedCount = 0;
    let insertedObligations: Array<{ id: string }> = [];

    if (obligationsToInsert.length > 0) {
      const { data: inserted, error: insertError } = await admin
        .from('contract_obligations')
        .insert(obligationsToInsert)
        .select('id, title, obligation_type, due_date, priority, ai_confidence');

      if (insertError) {
        console.error('Failed to insert obligations:', insertError);
      } else {
        insertedCount = inserted?.length || 0;
        insertedObligations = inserted || [];
      }
    }

    return NextResponse.json({
      success: true,
      extracted: extractedObligations.length,
      mars_obligations: extractedObligations.filter(o => o.assigned_party === 'MARS' || o.assigned_party === 'both').length,
      counterparty_obligations: extractedObligations.filter(o => o.assigned_party === 'counterparty').length,
      inserted: insertedCount,
      obligations: insertedObligations,
      all_extracted: extractedObligations,
    });
  } catch (error) {
    console.error('Error extracting obligations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
