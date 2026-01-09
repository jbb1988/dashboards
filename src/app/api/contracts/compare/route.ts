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

function findSectionStart(text: string, section: SectionInfo): number {
  // Try multiple search strategies to find section start
  const strategies = [
    // Strategy 1: Exact startPhrase match
    () => text.indexOf(section.startPhrase.substring(0, 30)),

    // Strategy 2: Case-insensitive startPhrase
    () => text.toLowerCase().indexOf(section.startPhrase.substring(0, 30).toLowerCase()),

    // Strategy 3: Search for "SECTION {number}." pattern
    () => {
      const pattern = new RegExp(`SECTION\\s+${section.number}\\.`, 'i');
      const match = text.match(pattern);
      return match ? text.indexOf(match[0]) : -1;
    },

    // Strategy 4: Search for "{number}. {TITLE}" pattern (e.g., "I. SERVICES")
    () => {
      const escapedTitle = section.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`${section.number}\\.\\s*${escapedTitle}`, 'i');
      const match = text.match(pattern);
      return match ? text.indexOf(match[0]) : -1;
    },

    // Strategy 5: Search for just the title (case-insensitive)
    () => {
      const titleWords = section.title.split(/\s+/).slice(0, 3).join('\\s+');
      const pattern = new RegExp(titleWords, 'i');
      const match = text.match(pattern);
      return match ? text.indexOf(match[0]) : -1;
    },

    // Strategy 6: Normalize whitespace and search
    () => {
      const normalizedText = text.replace(/\s+/g, ' ');
      const normalizedPhrase = section.startPhrase.substring(0, 30).replace(/\s+/g, ' ');
      const idx = normalizedText.toLowerCase().indexOf(normalizedPhrase.toLowerCase());
      if (idx === -1) return -1;
      // Map back to original text position (approximate)
      let origPos = 0, normPos = 0;
      while (normPos < idx && origPos < text.length) {
        if (/\s/.test(text[origPos])) {
          while (origPos < text.length && /\s/.test(text[origPos])) origPos++;
          normPos++;
        } else {
          origPos++;
          normPos++;
        }
      }
      return origPos;
    }
  ];

  for (let i = 0; i < strategies.length; i++) {
    const index = strategies[i]();
    if (index !== -1) {
      console.log(`[EXTRACT] Found section ${section.number}. ${section.title} using strategy ${i + 1} at index ${index}`);
      return index;
    }
  }

  return -1;
}

function extractSectionContent(text: string, sections: SectionInfo[]): Map<number, string> {
  const contents = new Map<number, string>();
  const sectionStarts: Array<{index: number; sectionIdx: number}> = [];

  // First pass: find all section start positions
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const startIndex = findSectionStart(text, section);

    if (startIndex === -1) {
      console.log(`[EXTRACT] Could not find section ${section.number}. ${section.title}`);
    } else {
      sectionStarts.push({ index: startIndex, sectionIdx: i });
    }
  }

  // Sort by position in document
  sectionStarts.sort((a, b) => a.index - b.index);

  // Second pass: extract content between sections
  for (let i = 0; i < sectionStarts.length; i++) {
    const current = sectionStarts[i];
    const next = sectionStarts[i + 1];

    const startIdx = current.index;
    const endIdx = next ? next.index : text.length;

    const content = text.substring(startIdx, endIdx).trim();
    contents.set(current.sectionIdx, content);
    console.log(`[EXTRACT] Section ${sections[current.sectionIdx].number}: ${content.length} chars`);
  }

  // Fill in any sections that weren't found
  for (let i = 0; i < sections.length; i++) {
    if (!contents.has(i)) {
      contents.set(i, `[Section ${sections[i].number}. ${sections[i].title} - content not found]`);
    }
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
    mode: 'section-by-section',
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
