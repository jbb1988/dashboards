import { NextRequest, NextResponse } from 'next/server';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const MODEL = 'anthropic/claude-sonnet-4'; // Hardcoded - best model for legal tasks

// ============================================================================
// TYPES
// ============================================================================

interface SectionInfo {
  number: string;
  title: string;
  startPhrase: string; // First ~50 chars to locate in text
}

interface SectionMapping {
  documentInfo: {
    originalTitle: string;
    originalDate: string;
    revisedTitle: string;
    revisedDate: string;
  };
  originalSections: SectionInfo[];
  revisedSections: SectionInfo[];
  mapping: Array<{
    originalIndex: number | null;
    revisedIndex: number | null;
    confidence: 'high' | 'medium' | 'low';
    note?: string;
  }>;
}

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

interface ComparisonResult {
  mode: 'ai-first';
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

// ============================================================================
// AI HELPER FUNCTIONS
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
  // Try to find JSON in the response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error('[AI] JSON parse error:', e);
    }
  }

  // Try to find JSON array
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      return JSON.parse(arrayMatch[0]);
    } catch (e) {
      console.error('[AI] Array parse error:', e);
    }
  }

  throw new Error('No valid JSON found in AI response');
}

// ============================================================================
// PHASE 1: AI SECTION MAPPING
// ============================================================================

async function mapSectionsWithAI(originalText: string, revisedText: string): Promise<SectionMapping> {
  console.log('[PHASE 1] Starting AI section mapping...');
  console.log(`[PHASE 1] Original: ${originalText.length} chars, Revised: ${revisedText.length} chars`);

  const prompt = `You are an expert legal document analyst. I have two versions of a contract that I need to compare.

Your task:
1. Identify ALL sections/provisions in EACH document
2. Create a mapping showing which sections in the original correspond to which sections in the revised
3. Extract document metadata (title, date)

IMPORTANT INSTRUCTIONS:
- Look for section patterns like "SECTION I.", "SECTION 1.", "ARTICLE I", or numbered provisions
- Sections may have slightly different names between documents - match them by content/purpose
- Some sections may be added in the revised document (no match in original)
- Some sections may be removed in the revised document (no match in revised)
- For startPhrase, include the first ~50 characters of each section to help locate it

ORIGINAL DOCUMENT:
---
${originalText}
---

REVISED DOCUMENT:
---
${revisedText}
---

Return your analysis as JSON in this exact format:
{
  "documentInfo": {
    "originalTitle": "extracted title from original",
    "originalDate": "extracted date or empty string",
    "revisedTitle": "extracted title from revised",
    "revisedDate": "extracted date or empty string"
  },
  "originalSections": [
    {"number": "I", "title": "SERVICES", "startPhrase": "SECTION I. SERVICES The Company shall..."}
  ],
  "revisedSections": [
    {"number": "I", "title": "SERVICES", "startPhrase": "SECTION I. SERVICES The Company shall..."}
  ],
  "mapping": [
    {"originalIndex": 0, "revisedIndex": 0, "confidence": "high"},
    {"originalIndex": 1, "revisedIndex": 1, "confidence": "high"},
    {"originalIndex": null, "revisedIndex": 5, "confidence": "high", "note": "New section in revised"},
    {"originalIndex": 3, "revisedIndex": null, "confidence": "high", "note": "Section removed"}
  ]
}

Respond ONLY with the JSON, no other text.`;

  const response = await callAI(prompt, 8000);
  console.log('[PHASE 1] AI response length:', response.length);

  const result = extractJSON(response) as SectionMapping;

  console.log('[PHASE 1] Found sections:');
  console.log('  Original:', result.originalSections?.map(s => `${s.number}. ${s.title}`));
  console.log('  Revised:', result.revisedSections?.map(s => `${s.number}. ${s.title}`));
  console.log('  Mappings:', result.mapping?.length);

  return result;
}

// ============================================================================
// PHASE 2: EXTRACT SECTION CONTENT
// ============================================================================

function extractSectionContent(text: string, sections: SectionInfo[]): Map<number, string> {
  const contents = new Map<number, string>();

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const searchPhrase = section.startPhrase.substring(0, 30);

    // Find where this section starts
    const startIndex = text.indexOf(searchPhrase);
    if (startIndex === -1) {
      // Try case-insensitive search
      const lowerText = text.toLowerCase();
      const lowerPhrase = searchPhrase.toLowerCase();
      const altIndex = lowerText.indexOf(lowerPhrase);
      if (altIndex === -1) {
        console.log(`[EXTRACT] Could not find section ${section.number}. ${section.title}`);
        contents.set(i, `[Section ${section.number}. ${section.title} - content not found]`);
        continue;
      }
    }

    // Find where next section starts (or end of document)
    let endIndex = text.length;
    if (i + 1 < sections.length) {
      const nextPhrase = sections[i + 1].startPhrase.substring(0, 30);
      const nextIndex = text.indexOf(nextPhrase, startIndex + 50);
      if (nextIndex > startIndex) {
        endIndex = nextIndex;
      }
    }

    const content = text.substring(startIndex === -1 ? 0 : startIndex, endIndex).trim();
    contents.set(i, content);
  }

  return contents;
}

// ============================================================================
// PHASE 3: PER-SECTION AI COMPARISON
// ============================================================================

async function compareSectionPair(
  originalContent: string | null,
  revisedContent: string | null,
  sectionNumber: string,
  sectionTitle: string
): Promise<SectionComparison> {

  // Handle added sections
  if (!originalContent || originalContent.includes('[content not found]')) {
    return {
      sectionNumber,
      sectionTitle,
      status: 'added',
      significance: 'medium',
      reasoning: 'This section was added in the revised document',
      changes: [{
        description: `New section added: ${sectionTitle}`,
        original: '(Section not present in original)',
        revised: revisedContent?.substring(0, 200) + '...' || '',
        impact: 'New provisions added to agreement'
      }]
    };
  }

  // Handle removed sections
  if (!revisedContent || revisedContent.includes('[content not found]')) {
    return {
      sectionNumber,
      sectionTitle,
      status: 'removed',
      significance: 'medium',
      reasoning: 'This section was removed in the revised document',
      changes: [{
        description: `Section removed: ${sectionTitle}`,
        original: originalContent?.substring(0, 200) + '...' || '',
        revised: '(Section not present in revised)',
        impact: 'Provisions removed from agreement'
      }]
    };
  }

  // Compare the two sections with AI
  const prompt = `You are an expert legal contract analyst. Compare these two versions of the same contract section.

Use chain-of-thought reasoning:
1. First, identify what STAYED THE SAME (briefly)
2. Then, identify what CHANGED (in detail)
3. For each change, assess its legal/business significance
4. Rate overall significance: high (financial/legal risk), medium (operational impact), low (minor/formatting), none (identical)

ORIGINAL SECTION:
---
${originalContent}
---

REVISED SECTION:
---
${revisedContent}
---

Return your analysis as JSON:
{
  "status": "changed" or "unchanged",
  "significance": "high", "medium", "low", or "none",
  "reasoning": "Brief explanation of your assessment",
  "changes": [
    {
      "description": "What changed",
      "original": "Original text (brief excerpt)",
      "revised": "Revised text (brief excerpt)",
      "impact": "Legal/business impact of this change"
    }
  ]
}

If the sections are essentially identical (only whitespace/formatting differences), return:
{
  "status": "unchanged",
  "significance": "none",
  "reasoning": "Sections are substantially identical",
  "changes": []
}

Respond ONLY with the JSON, no other text.`;

  try {
    const response = await callAI(prompt, 2000);
    const result = extractJSON(response) as {
      status: string;
      significance: string;
      reasoning: string;
      changes: SectionChange[];
    };

    return {
      sectionNumber,
      sectionTitle,
      status: result.status as 'unchanged' | 'changed',
      significance: result.significance as 'high' | 'medium' | 'low' | 'none',
      reasoning: result.reasoning,
      changes: result.changes || []
    };
  } catch (error) {
    console.error(`[COMPARE] Error comparing section ${sectionNumber}:`, error);
    return {
      sectionNumber,
      sectionTitle,
      status: 'changed',
      significance: 'medium',
      reasoning: 'Comparison encountered an error - manual review recommended',
      changes: [{
        description: 'Unable to automatically compare this section',
        original: originalContent.substring(0, 100) + '...',
        revised: revisedContent.substring(0, 100) + '...',
        impact: 'Manual review required'
      }]
    };
  }
}

// ============================================================================
// PHASE 4: SYNTHESIZE RESULTS
// ============================================================================

function synthesizeResults(
  mapping: SectionMapping,
  comparisons: SectionComparison[]
): ComparisonResult {

  const sectionsChanged = comparisons.filter(c => c.status === 'changed').length;
  const sectionsAdded = comparisons.filter(c => c.status === 'added').length;
  const sectionsRemoved = comparisons.filter(c => c.status === 'removed').length;
  const sectionsUnchanged = comparisons.filter(c => c.status === 'unchanged').length;

  // Generate key takeaways from high/medium significance changes
  const keyTakeaways: string[] = [];
  const significantChanges = comparisons.filter(c =>
    c.significance === 'high' || c.significance === 'medium'
  );

  for (const section of significantChanges) {
    if (section.changes.length > 0) {
      const mainChange = section.changes[0];
      keyTakeaways.push(`[${section.sectionTitle}] ${mainChange.description}`);
    }
  }

  // Limit to top 5 takeaways
  const topTakeaways = keyTakeaways.slice(0, 5);

  // Add summary of added/removed if any
  if (sectionsAdded > 0) {
    const addedTitles = comparisons.filter(c => c.status === 'added').map(c => c.sectionTitle);
    topTakeaways.push(`New sections added: ${addedTitles.join(', ')}`);
  }
  if (sectionsRemoved > 0) {
    const removedTitles = comparisons.filter(c => c.status === 'removed').map(c => c.sectionTitle);
    topTakeaways.push(`Sections removed: ${removedTitles.join(', ')}`);
  }

  return {
    mode: 'ai-first',
    documentInfo: mapping.documentInfo,
    summary: {
      totalSections: comparisons.length,
      sectionsChanged,
      sectionsAdded,
      sectionsRemoved,
      sectionsUnchanged,
      keyTakeaways: topTakeaways
    },
    sections: comparisons,
    addedSections: comparisons.filter(c => c.status === 'added').map(c => c.sectionTitle),
    removedSections: comparisons.filter(c => c.status === 'removed').map(c => c.sectionTitle)
  };
}

// ============================================================================
// MAIN API HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { originalText, revisedText } = body;

    if (!originalText || !revisedText) {
      return NextResponse.json(
        { error: 'Both originalText and revisedText are required' },
        { status: 400 }
      );
    }

    console.log('='.repeat(60));
    console.log('[COMPARE] Starting AI-First Contract Comparison');
    console.log('[COMPARE] Using model:', MODEL);
    console.log(`[COMPARE] Original: ${originalText.length} chars`);
    console.log(`[COMPARE] Revised: ${revisedText.length} chars`);
    console.log('='.repeat(60));

    // PHASE 1: AI identifies sections in BOTH documents and creates mapping
    const mapping = await mapSectionsWithAI(originalText, revisedText);

    if (!mapping.originalSections?.length && !mapping.revisedSections?.length) {
      throw new Error('AI could not identify sections in either document');
    }

    // PHASE 2: Extract section content using AI-provided locations
    console.log('[PHASE 2] Extracting section content...');
    const originalContents = extractSectionContent(originalText, mapping.originalSections || []);
    const revisedContents = extractSectionContent(revisedText, mapping.revisedSections || []);

    // PHASE 3: Compare each mapped section pair (in parallel for speed)
    console.log('[PHASE 3] Comparing sections...');
    const comparisonPromises: Promise<SectionComparison>[] = [];

    for (const map of mapping.mapping || []) {
      const origSection = map.originalIndex !== null ? mapping.originalSections[map.originalIndex] : null;
      const revSection = map.revisedIndex !== null ? mapping.revisedSections[map.revisedIndex] : null;

      const origContent = map.originalIndex !== null ? originalContents.get(map.originalIndex) : null;
      const revContent = map.revisedIndex !== null ? revisedContents.get(map.revisedIndex) : null;

      const sectionNumber = origSection?.number || revSection?.number || '?';
      const sectionTitle = origSection?.title || revSection?.title || 'Unknown';

      comparisonPromises.push(
        compareSectionPair(origContent || null, revContent || null, sectionNumber, sectionTitle)
      );
    }

    const comparisons = await Promise.all(comparisonPromises);
    console.log('[PHASE 3] Completed', comparisons.length, 'section comparisons');

    // PHASE 4: Synthesize final results
    console.log('[PHASE 4] Synthesizing results...');
    const result = synthesizeResults(mapping, comparisons);

    console.log('='.repeat(60));
    console.log('[COMPARE] Comparison complete!');
    console.log(`[COMPARE] ${result.summary.sectionsChanged} changed, ${result.summary.sectionsAdded} added, ${result.summary.sectionsRemoved} removed, ${result.summary.sectionsUnchanged} unchanged`);
    console.log('='.repeat(60));

    return NextResponse.json(result);

  } catch (error) {
    console.error('[COMPARE] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Comparison failed' },
      { status: 500 }
    );
  }
}
