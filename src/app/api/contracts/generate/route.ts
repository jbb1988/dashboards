import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/apiAuth';

export const maxDuration = 300; // 5 minutes for AI generation

// POST: Generate a contract from a template
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { template_id, field_values } = body;

    if (!template_id) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    // Get the template
    const { data: template, error: templateError } = await admin
      .from('contract_templates')
      .select('*')
      .eq('id', template_id)
      .single();

    if (templateError || !template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    // Validate required fields
    const requiredFields = (template.fields as TemplateField[])
      .filter(f => f.required)
      .map(f => f.name);

    const missingFields = requiredFields.filter(name => !field_values?.[name]);
    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }

    // Get relevant clauses from clause library for this template category
    const { data: clauses } = await admin
      .from('clause_library')
      .select('*')
      .eq('is_active', true)
      .order('usage_count', { ascending: false })
      .limit(20);

    // Build the generation prompt
    const generationPrompt = buildGenerationPrompt(template, field_values, clauses || []);

    // Call AI to generate the contract
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://mars-contracts.vercel.app',
        'X-Title': 'MARS Contracts - Contract Generation',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4',
        messages: [{ role: 'user', content: generationPrompt }],
        max_tokens: 16000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiResult = await response.json();
    const generatedContent = aiResult.choices?.[0]?.message?.content || '';

    // Assess risk level based on template and field values
    const riskAssessment = assessRisk(template, field_values);

    // Determine approval routing
    const approvalRouting = determineApprovalRouting(template, field_values, riskAssessment);

    // Store the generation
    const { data: generation, error: genError } = await admin
      .from('template_generations')
      .insert({
        template_id,
        field_values,
        generated_content: generatedContent,
        risk_score: riskAssessment.score,
        risk_factors: riskAssessment.factors,
        approval_status: approvalRouting.autoApprove ? 'auto_approved' : 'pending',
        approver_email: approvalRouting.approvers[0] || null,
        generated_by: user.email || 'unknown',
      })
      .select()
      .single();

    if (genError) {
      console.error('Failed to store generation:', genError);
    }

    return NextResponse.json({
      success: true,
      generation: {
        id: generation?.id,
        content: generatedContent,
        risk_score: riskAssessment.score,
        risk_factors: riskAssessment.factors,
        approval_status: generation?.approval_status,
        approval_required: !approvalRouting.autoApprove,
        approvers: approvalRouting.approvers,
      },
    });
  } catch (error) {
    console.error('Error generating contract:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

interface TemplateField {
  name: string;
  type: string;
  label: string;
  required?: boolean;
  default?: string | number | boolean;
  options?: string[];
}

interface RiskAssessment {
  score: number;
  factors: Array<{
    factor: string;
    impact: number;
    description: string;
  }>;
}

interface ApprovalRouting {
  autoApprove: boolean;
  approvers: string[];
}

function buildGenerationPrompt(
  template: { name: string; category: string; fields: TemplateField[]; base_document_content?: string },
  fieldValues: Record<string, unknown>,
  clauses: Array<{ name: string; primary_text: string; category_id: string }>
): string {
  const templateType = template.category.toUpperCase();
  const clauseExamples = clauses.slice(0, 5).map(c => `- ${c.name}: ${c.primary_text.substring(0, 200)}...`).join('\n');

  return `You are a contract drafting expert for MARS Company. Generate a professional ${templateType} contract using the provided information.

TEMPLATE: ${template.name}
CATEGORY: ${template.category}

FIELD VALUES:
${Object.entries(fieldValues).map(([key, value]) => `- ${key}: ${value}`).join('\n')}

MARS STANDARD POSITIONS (use these as guidelines):
- Limitation of Liability: Cap at contract value, limit to direct damages only
- Indemnification: Must be mutual and proportionate to fault
- IP/Work Product: MARS retains pre-existing IP, owns custom work product
- Termination: Either party may terminate with 30 days notice; immediate for material breach
- Warranty: Standard 1-year warranty
- Payment Terms: Net 30
- Governing Law: Virginia

APPROVED CLAUSE EXAMPLES:
${clauseExamples}

GENERATION INSTRUCTIONS:
1. Generate a complete, professional ${templateType} contract
2. Use all provided field values appropriately
3. Follow MARS standard negotiating positions
4. Include all standard sections for this contract type
5. Use clear, unambiguous legal language
6. Format with proper section numbering
7. Include signature blocks for both parties

${template.base_document_content ? `BASE DOCUMENT STRUCTURE TO FOLLOW:\n${template.base_document_content.substring(0, 5000)}` : ''}

Generate the complete contract now:`;
}

function assessRisk(
  template: { risk_threshold: number; category: string },
  fieldValues: Record<string, unknown>
): RiskAssessment {
  const factors: RiskAssessment['factors'] = [];
  let baseScore = 30; // Start with low base

  // Assess based on contract value if provided
  const value = Number(fieldValues.total_value || fieldValues.contract_value || 0);
  if (value > 250000) {
    factors.push({
      factor: 'High Contract Value',
      impact: 25,
      description: `Contract value of $${value.toLocaleString()} exceeds threshold`,
    });
    baseScore += 25;
  } else if (value > 100000) {
    factors.push({
      factor: 'Moderate Contract Value',
      impact: 15,
      description: `Contract value of $${value.toLocaleString()} requires review`,
    });
    baseScore += 15;
  }

  // Assess based on contract type
  if (['msa', 'license'].includes(template.category)) {
    factors.push({
      factor: 'Complex Contract Type',
      impact: 10,
      description: `${template.category.toUpperCase()} contracts require careful review`,
    });
    baseScore += 10;
  }

  // Assess based on term length
  const termMonths = Number(fieldValues.term_months || fieldValues.initial_term || 12);
  if (termMonths > 24) {
    factors.push({
      factor: 'Long Term Agreement',
      impact: 10,
      description: `${termMonths} month term exceeds standard duration`,
    });
    baseScore += 10;
  }

  // Cap score at 100
  const score = Math.min(baseScore, 100);

  return { score, factors };
}

function determineApprovalRouting(
  template: { approval_rules: Record<string, unknown>; risk_threshold: number },
  fieldValues: Record<string, unknown>,
  riskAssessment: RiskAssessment
): ApprovalRouting {
  const rules = template.approval_rules || {};
  const approvers: string[] = [];

  // Check if auto-approve based on risk
  const autoApproveThreshold = (rules.auto_approve_below_risk as number) || template.risk_threshold;
  if (riskAssessment.score < autoApproveThreshold) {
    return { autoApprove: true, approvers: [] };
  }

  // Check value thresholds
  const value = Number(fieldValues.total_value || fieldValues.contract_value || 0);
  const valueThresholds = (rules.value_thresholds as Array<{ above: number; approvers: string[] }>) || [];

  for (const threshold of valueThresholds.sort((a, b) => b.above - a.above)) {
    if (value >= threshold.above) {
      approvers.push(...threshold.approvers);
      break;
    }
  }

  // Check risk thresholds
  const riskThresholds = (rules.risk_thresholds as Record<string, string[]>) || {};
  if (riskAssessment.score >= 70 && riskThresholds.high) {
    approvers.push(...riskThresholds.high);
  } else if (riskAssessment.score >= 40 && riskThresholds.medium) {
    approvers.push(...riskThresholds.medium);
  }

  // Add default approver if no specific rules matched
  if (approvers.length === 0 && rules.default_approver) {
    approvers.push(rules.default_approver as string);
  }

  // Deduplicate
  const uniqueApprovers = [...new Set(approvers)];

  return {
    autoApprove: uniqueApprovers.length === 0,
    approvers: uniqueApprovers,
  };
}
