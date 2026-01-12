import { NextRequest, NextResponse } from 'next/server';
import DiffMatchPatch from 'diff-match-patch';
import { parseContractSections, groupSectionsForAnalysis, ContractSection } from '@/lib/contractParser';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const DEFAULT_MODEL = 'anthropic/claude-sonnet-4';

// Allow longer timeout for sectioned analysis
export const maxDuration = 300;

/**
 * Normalize Unicode to ASCII
 */
function normalizeToASCII(text: string): string {
  return text
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036\u00AB\u00BB]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035\u2039\u203A]/g, "'")
    .replace(/[\u2013\u2014\u2015\u2212]/g, '-')
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, ' ')
    .replace(/\u2026/g, '...')
    .replace(/[\u2022\u2023\u2043]/g, '*')
    .replace(/\u00BD/g, '1/2')
    .replace(/\u00BC/g, '1/4')
    .replace(/\u00BE/g, '3/4');
}

/**
 * Generate diff display
 */
function generateDiffDisplay(original: string, modified: string): string {
  const dmp = new DiffMatchPatch();
  const normalizedOriginal = normalizeToASCII(original);
  const normalizedModified = normalizeToASCII(modified);
  const diffs = dmp.diff_main(normalizedOriginal, normalizedModified);
  dmp.diff_cleanupSemantic(diffs);

  const result: string[] = [];
  for (const [operation, text] of diffs) {
    if (operation === 0) {
      result.push(text);
    } else if (operation === -1) {
      if (text.trim()) {
        result.push(`[strikethrough]${text}[/strikethrough]`);
      } else {
        result.push(text);
      }
    } else if (operation === 1) {
      if (text.trim()) {
        result.push(`[underline]${text}[/underline]`);
      } else {
        result.push(text);
      }
    }
  }
  return result.join('');
}

const SECTION_ANALYSIS_PROMPT = `You are an expert contract attorney reviewing this section for MARS Company (the Contractor/Vendor).

MARS STANDARD POSITIONS:
- Liability: Cap at contract value, direct damages only, exclude consequential
- Indemnification: Mutual and proportionate to fault
- IP: MARS retains pre-existing IP; only specific deliverables transfer
- Termination: Payment for work performed + wind-down costs
- Warranty: Max 1 year
- Payment: Net 30+
- Audit: Annual with reasonable notice

TASK: Analyze this section and identify material risks to MARS.

OUTPUT JSON FORMAT:
{
  "sectionNumber": "the section number",
  "sectionTitle": "the section title",
  "hasMaterialIssues": true/false,
  "materiality": "high" | "medium" | "low" | "none",
  "originalText": "exact original text if changes needed",
  "revisedText": "revised text with **bold** for additions and ~~strikethrough~~ for deletions",
  "cleanRevisedText": "revised text without any markdown - plain text only",
  "rationale": "brief explanation of why changes protect MARS",
  "summaryPoints": ["bullet point 1", "bullet point 2"]
}

If no changes needed, set hasMaterialIssues: false and leave revisedText empty.

SECTION TO ANALYZE:
`;

interface SectionAnalysisResult {
  sectionNumber: string;
  sectionTitle: string;
  hasMaterialIssues: boolean;
  materiality: 'high' | 'medium' | 'low' | 'none';
  originalText?: string;
  revisedText?: string;
  cleanRevisedText?: string;
  rationale?: string;
  summaryPoints?: string[];
  error?: string;
}

/**
 * Analyze a single section or group of sections
 */
async function analyzeSection(
  sections: ContractSection[],
  model: string
): Promise<SectionAnalysisResult[]> {
  const combinedContent = sections
    .map(s => `[${s.number}] ${s.title}\n${s.content}`)
    .join('\n\n---\n\n');

  const prompt = SECTION_ANALYSIS_PROMPT + combinedContent;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://mars-contracts.vercel.app',
        'X-Title': 'MARS Contract Review',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4000,
        temperature: 0.2,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Section analysis failed: ${response.status}`, errorText);
      return sections.map(s => ({
        sectionNumber: s.number,
        sectionTitle: s.title,
        hasMaterialIssues: false,
        materiality: 'none' as const,
        error: `API error: ${response.status}`,
      }));
    }

    // Stream response
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response stream');
    }

    const decoder = new TextDecoder();
    let fullContent = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || '';
              if (content) fullContent += content;
            } catch {
              // Skip malformed chunks
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Parse result
    try {
      let jsonStr = fullContent.trim();
      jsonStr = jsonStr.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '');

      const firstBrace = jsonStr.indexOf('{');
      const lastBrace = jsonStr.lastIndexOf('}');

      if (firstBrace !== -1 && lastBrace > firstBrace) {
        jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
        const result = JSON.parse(jsonStr);

        // Handle both single result and array of results
        if (Array.isArray(result)) {
          return result;
        }
        return [result];
      }
    } catch (parseErr) {
      console.error('Failed to parse section result:', parseErr);
    }

    // Return default if parsing fails
    return sections.map(s => ({
      sectionNumber: s.number,
      sectionTitle: s.title,
      hasMaterialIssues: false,
      materiality: 'none' as const,
      error: 'Failed to parse AI response',
    }));

  } catch (err) {
    console.error('Section analysis error:', err);
    return sections.map(s => ({
      sectionNumber: s.number,
      sectionTitle: s.title,
      hasMaterialIssues: false,
      materiality: 'none' as const,
      error: err instanceof Error ? err.message : 'Unknown error',
    }));
  }
}

export async function POST(request: NextRequest) {
  console.log('=== SECTIONED CONTRACT REVIEW API ===');
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { text, contractId, provisionName, model = DEFAULT_MODEL } = body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'Contract text is required' }, { status: 400 });
    }

    if (!OPENROUTER_API_KEY) {
      return NextResponse.json({ error: 'OpenRouter API key not configured' }, { status: 500 });
    }

    // Normalize input
    const normalizedInput = normalizeToASCII(text);
    console.log(`Input: ${normalizedInput.length} chars`);

    // Parse into sections
    const sections = parseContractSections(normalizedInput);
    console.log(`Parsed ${sections.length} sections`);

    // Group sections for efficient API calls
    const sectionGroups = groupSectionsForAnalysis(sections, 4000);
    console.log(`Grouped into ${sectionGroups.length} API calls`);

    // Process groups in parallel (max 5 concurrent)
    const CONCURRENCY = 5;
    const allResults: SectionAnalysisResult[] = [];

    for (let i = 0; i < sectionGroups.length; i += CONCURRENCY) {
      const batch = sectionGroups.slice(i, i + CONCURRENCY);
      console.log(`Processing batch ${Math.floor(i / CONCURRENCY) + 1}/${Math.ceil(sectionGroups.length / CONCURRENCY)}`);

      const batchPromises = batch.map(group => analyzeSection(group, model));
      const batchResults = await Promise.all(batchPromises);

      for (const results of batchResults) {
        allResults.push(...results);
      }
    }

    console.log(`Completed ${allResults.length} section analyses in ${(Date.now() - startTime) / 1000}s`);

    // Build modified text by applying changes
    let modifiedText = normalizedInput;
    const materialSections = allResults.filter(r => r.hasMaterialIssues && r.cleanRevisedText);

    // Apply changes (in reverse order to preserve indices)
    for (const section of sections.reverse()) {
      const result = materialSections.find(
        r => r.sectionNumber === section.number || r.sectionTitle === section.title
      );
      if (result?.cleanRevisedText && result.originalText) {
        modifiedText = modifiedText.replace(result.originalText, result.cleanRevisedText);
      }
    }

    // Clean up any markdown in modifiedText
    modifiedText = modifiedText
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/~~([^~]+)~~/g, '');

    // Generate diff
    const redlinedText = generateDiffDisplay(normalizedInput, modifiedText);

    // Build summary
    const summary: string[] = [];
    for (const result of allResults) {
      if (result.hasMaterialIssues && result.summaryPoints) {
        for (const point of result.summaryPoints) {
          summary.push(`[${result.sectionTitle}] ${point}`);
        }
      }
    }

    // Build sections for frontend
    const analyzedSections = allResults
      .filter(r => r.hasMaterialIssues)
      .map(r => ({
        sectionNumber: r.sectionNumber,
        sectionTitle: r.sectionTitle,
        materiality: r.materiality,
        originalText: r.originalText || '',
        revisedText: r.revisedText || '',
        rationale: r.rationale || '',
      }));

    const hasVisibleChanges = redlinedText.includes('[strikethrough]') || redlinedText.includes('[underline]');

    console.log(`Found ${materialSections.length} sections with issues, ${summary.length} summary points`);
    console.log(`Total time: ${(Date.now() - startTime) / 1000}s`);

    return NextResponse.json({
      redlinedText,
      originalText: normalizedInput,
      modifiedText,
      summary: summary.length > 0 ? summary : ['No material issues identified requiring changes.'],
      sections: analyzedSections,
      hasVisibleChanges,
      contractId,
      provisionName,
      metadata: {
        sectionsAnalyzed: sections.length,
        sectionsWithIssues: materialSections.length,
        processingTimeMs: Date.now() - startTime,
      },
    });

  } catch (error) {
    console.error('Sectioned review error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}
