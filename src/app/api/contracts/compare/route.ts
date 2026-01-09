import { NextRequest, NextResponse } from 'next/server';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';

// ============================================================================
// TYPES
// ============================================================================

interface Section {
  number: string;      // "I", "II", "III", "1", "2", etc.
  title: string;       // "PAYMENTS", "TERM", "INDEMNIFICATION"
  fullHeader: string;  // "SECTION III. PAYMENTS"
  content: string;     // The full text of the section
}

interface SectionComparison {
  sectionNumber: string;
  sectionTitle: string;
  status: 'unchanged' | 'changed' | 'added' | 'removed';
  significance: 'high' | 'medium' | 'low' | 'none';
  changes: Array<{
    description: string;
    original: string;
    revised: string;
    impact: string;
  }>;
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
// SECTION EXTRACTION
// ============================================================================

/**
 * Clean up PDF extracted text by removing page numbers, headers, footers
 */
function cleanPdfText(text: string): string {
  let cleaned = text;

  // Remove page numbers like "1 of 11", "Page 1 of 11", "1/11", etc.
  cleaned = cleaned.replace(/\b\d+\s+of\s+\d+\b/gi, ' ');
  cleaned = cleaned.replace(/\bPage\s+\d+\s*(of\s+\d+)?\b/gi, ' ');
  cleaned = cleaned.replace(/\b\d+\/\d+\b/g, ' ');

  // Remove standalone page numbers at start of lines
  cleaned = cleaned.replace(/^\s*\d{1,3}\s*$/gm, '');

  // Normalize multiple spaces and newlines
  cleaned = cleaned.replace(/[ \t]+/g, ' ');
  cleaned = cleaned.replace(/\n\s*\n\s*\n+/g, '\n\n');

  return cleaned.trim();
}

/**
 * Extract sections from a contract document.
 * Handles multiple formats: SECTION I., ARTICLE 1, numbered sections, etc.
 */
function extractSections(text: string): Section[] {
  const sections: Section[] = [];

  // Clean and normalize text
  let normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  normalizedText = cleanPdfText(normalizedText);

  // Find all section headers and their positions
  const headers: Array<{ index: number; number: string; title: string; fullHeader: string }> = [];

  // Pattern 1: SECTION I. TITLE or SECTION 1. TITLE (most common in MARS contracts)
  // More flexible - doesn't require start of line
  const sectionPattern = /SECTION\s+([IVXLCDM]+|\d+)\.?\s*[:\-]?\s*([A-Z][A-Z\s\/&,\-]+)/gi;
  let match;
  while ((match = sectionPattern.exec(normalizedText)) !== null) {
    const title = match[2].trim().replace(/\s+/g, ' ');
    // Skip if title is too short or looks like a sentence continuation
    if (title.length > 2 && title.length < 100) {
      headers.push({
        index: match.index,
        number: match[1].trim().toUpperCase(),
        title: title,
        fullHeader: match[0].trim()
      });
    }
  }

  // Pattern 2: ARTICLE I. TITLE or ARTICLE 1. TITLE
  const articlePattern = /ARTICLE\s+([IVXLCDM]+|\d+)\.?\s*[:\-]?\s*([A-Z][A-Z\s\/&,\-]+)/gi;
  while ((match = articlePattern.exec(normalizedText)) !== null) {
    const title = match[2].trim().replace(/\s+/g, ' ');
    const exists = headers.some(h => Math.abs(h.index - match!.index) < 20);
    if (!exists && title.length > 2 && title.length < 100) {
      headers.push({
        index: match.index,
        number: match[1].trim().toUpperCase(),
        title: title,
        fullHeader: match[0].trim()
      });
    }
  }

  // Pattern 3: Standalone Roman numeral headers like "I. SERVICES" or "II. TERM"
  // Must be preceded by newline or start of text
  const romanPattern = /(?:^|\n)\s*([IVXLCDM]+)\.\s+([A-Z][A-Z\s\/&,\-]+)/gi;
  while ((match = romanPattern.exec(normalizedText)) !== null) {
    const title = match[2].trim().replace(/\s+/g, ' ');
    const exists = headers.some(h => Math.abs(h.index - match!.index) < 20);
    if (!exists && title.length > 2 && title.length < 100) {
      headers.push({
        index: match.index,
        number: match[1].trim().toUpperCase(),
        title: title,
        fullHeader: match[0].trim()
      });
    }
  }

  // Pattern 4: Numbered sections like "1. SERVICES" or "2. TERM"
  const numberedPattern = /(?:^|\n)\s*(\d{1,2})\.\s+([A-Z][A-Z\s\/&,\-]+)/gi;
  while ((match = numberedPattern.exec(normalizedText)) !== null) {
    const title = match[2].trim().replace(/\s+/g, ' ');
    const num = parseInt(match[1]);
    const exists = headers.some(h => Math.abs(h.index - match!.index) < 20);
    // Skip page-like numbers
    if (!exists && title.length > 2 && title.length < 100 && num <= 30) {
      headers.push({
        index: match.index,
        number: match[1].trim(),
        title: title,
        fullHeader: match[0].trim()
      });
    }
  }

  // Remove duplicates and sort by position
  const uniqueHeaders = headers.filter((header, idx) => {
    // Check for duplicates by similar position or same number+title
    return !headers.slice(0, idx).some(h =>
      Math.abs(h.index - header.index) < 30 ||
      (normalizeNumber(h.number) === normalizeNumber(header.number) &&
       h.title.toLowerCase() === header.title.toLowerCase())
    );
  });

  uniqueHeaders.sort((a, b) => a.index - b.index);

  console.log(`[Section Extraction] Found ${uniqueHeaders.length} sections:`,
    uniqueHeaders.map(h => `${h.number}. ${h.title}`));

  // Extract content for each section
  for (let i = 0; i < uniqueHeaders.length; i++) {
    const current = uniqueHeaders[i];
    const nextIndex = i + 1 < uniqueHeaders.length ? uniqueHeaders[i + 1].index : normalizedText.length;
    const content = normalizedText.substring(current.index, nextIndex).trim();

    sections.push({
      number: current.number,
      title: current.title,
      fullHeader: current.fullHeader,
      content: content
    });
  }

  // If no sections found, log for debugging and return empty array (so AI fallback triggers)
  if (sections.length === 0) {
    console.log('[Section Extraction] No sections found with regex');
    console.log('[Section Extraction] First 1000 chars:', normalizedText.substring(0, 1000));
    // Return empty array - caller will try AI fallback
    return [];
  }

  return sections;
}

/**
 * Use AI to identify sections when regex fails
 */
async function extractSectionsWithAI(text: string): Promise<Section[]> {
  console.log('[AI Section Extraction] Using AI to identify sections...');

  // Take a sample of the document to identify structure
  const sample = text.substring(0, 8000);

  const prompt = `Analyze this legal contract text and identify ALL section headers.
Look for patterns like:
- "SECTION I. SERVICES" or "SECTION 1. SERVICES"
- "ARTICLE I" or "ARTICLE 1"
- Roman numerals followed by titles: "I. SERVICES", "II. TERM"
- Numbered sections: "1. SERVICES", "2. TERM"
- ALL CAPS headers that indicate new sections

Return a JSON array of section headers found, in order of appearance.
Format: [{"number": "I", "title": "SERVICES"}, {"number": "II", "title": "TERM"}, ...]

If you can't find clear sections, return an empty array: []

CONTRACT TEXT:
${sample}`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://mars-contracts.vercel.app',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      console.error('[AI Section Extraction] API error:', response.status);
      return [];
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Extract JSON from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.log('[AI Section Extraction] No JSON found in response');
      return [];
    }

    const headers = JSON.parse(jsonMatch[0]) as Array<{number: string; title: string}>;
    console.log('[AI Section Extraction] Found headers:', headers);

    if (headers.length === 0) {
      return [];
    }

    // Now find these sections in the actual text and extract content
    const sections: Section[] = [];
    const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      // Build regex to find this section in text
      const patterns = [
        new RegExp(`SECTION\\s+${header.number}\\.?\\s*[:\\-]?\\s*${header.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'),
        new RegExp(`${header.number}\\.\\s*${header.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'),
        new RegExp(`${header.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'),
      ];

      let matchIndex = -1;
      let matchedPattern = '';
      for (const pattern of patterns) {
        const match = normalizedText.match(pattern);
        if (match && match.index !== undefined) {
          matchIndex = match.index;
          matchedPattern = match[0];
          break;
        }
      }

      if (matchIndex >= 0) {
        // Find end of section (next section or end of doc)
        let endIndex = normalizedText.length;
        if (i + 1 < headers.length) {
          const nextHeader = headers[i + 1];
          for (const pattern of [
            new RegExp(`SECTION\\s+${nextHeader.number}\\.?\\s*[:\\-]?\\s*${nextHeader.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'),
            new RegExp(`${nextHeader.number}\\.\\s*${nextHeader.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'),
          ]) {
            const nextMatch = normalizedText.substring(matchIndex + 10).match(pattern);
            if (nextMatch && nextMatch.index !== undefined) {
              endIndex = matchIndex + 10 + nextMatch.index;
              break;
            }
          }
        }

        sections.push({
          number: header.number,
          title: header.title,
          fullHeader: matchedPattern,
          content: normalizedText.substring(matchIndex, endIndex).trim()
        });
      }
    }

    console.log('[AI Section Extraction] Extracted', sections.length, 'sections with content');
    return sections;

  } catch (error) {
    console.error('[AI Section Extraction] Error:', error);
    return [];
  }
}

/**
 * Normalize section number for matching (handle Roman numerals vs Arabic)
 */
function normalizeNumber(num: string): string {
  const romanToArabic: Record<string, number> = {
    'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5,
    'VI': 6, 'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10,
    'XI': 11, 'XII': 12, 'XIII': 13, 'XIV': 14, 'XV': 15,
    'XVI': 16, 'XVII': 17, 'XVIII': 18, 'XIX': 19, 'XX': 20
  };

  const upper = num.toUpperCase();
  if (romanToArabic[upper]) {
    return String(romanToArabic[upper]);
  }
  return num;
}

/**
 * Normalize title for fuzzy matching
 */
function normalizeTitle(title: string): string {
  return title
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim();
}

// ============================================================================
// SECTION MATCHING
// ============================================================================

interface MatchedPair {
  original: Section | null;
  revised: Section | null;
  matchType: 'exact' | 'fuzzy' | 'number' | 'added' | 'removed';
}

/**
 * Match sections between two documents
 */
function matchSections(originalSections: Section[], revisedSections: Section[]): MatchedPair[] {
  const pairs: MatchedPair[] = [];
  const matchedOriginal = new Set<number>();
  const matchedRevised = new Set<number>();

  // Pass 1: Exact title match
  for (let i = 0; i < originalSections.length; i++) {
    const orig = originalSections[i];
    for (let j = 0; j < revisedSections.length; j++) {
      if (matchedRevised.has(j)) continue;
      const rev = revisedSections[j];

      if (normalizeTitle(orig.title) === normalizeTitle(rev.title)) {
        pairs.push({ original: orig, revised: rev, matchType: 'exact' });
        matchedOriginal.add(i);
        matchedRevised.add(j);
        break;
      }
    }
  }

  // Pass 2: Number match for unmatched sections
  for (let i = 0; i < originalSections.length; i++) {
    if (matchedOriginal.has(i)) continue;
    const orig = originalSections[i];

    for (let j = 0; j < revisedSections.length; j++) {
      if (matchedRevised.has(j)) continue;
      const rev = revisedSections[j];

      if (normalizeNumber(orig.number) === normalizeNumber(rev.number)) {
        pairs.push({ original: orig, revised: rev, matchType: 'number' });
        matchedOriginal.add(i);
        matchedRevised.add(j);
        break;
      }
    }
  }

  // Pass 3: Fuzzy title match (contains)
  for (let i = 0; i < originalSections.length; i++) {
    if (matchedOriginal.has(i)) continue;
    const orig = originalSections[i];
    const origNorm = normalizeTitle(orig.title);

    for (let j = 0; j < revisedSections.length; j++) {
      if (matchedRevised.has(j)) continue;
      const rev = revisedSections[j];
      const revNorm = normalizeTitle(rev.title);

      // Check if one contains the other (for slight variations)
      if (origNorm.includes(revNorm) || revNorm.includes(origNorm)) {
        pairs.push({ original: orig, revised: rev, matchType: 'fuzzy' });
        matchedOriginal.add(i);
        matchedRevised.add(j);
        break;
      }
    }
  }

  // Remaining original sections = removed
  for (let i = 0; i < originalSections.length; i++) {
    if (!matchedOriginal.has(i)) {
      pairs.push({ original: originalSections[i], revised: null, matchType: 'removed' });
    }
  }

  // Remaining revised sections = added
  for (let j = 0; j < revisedSections.length; j++) {
    if (!matchedRevised.has(j)) {
      pairs.push({ original: null, revised: revisedSections[j], matchType: 'added' });
    }
  }

  return pairs;
}

// ============================================================================
// AI COMPARISON (Per Section)
// ============================================================================

const SECTION_COMPARE_PROMPT = `Compare these two versions of a contract section. Identify what changed.

RULES:
- Return ONLY valid JSON, no other text
- Be specific about what changed
- Keep excerpts brief (1-2 sentences max)
- If sections are identical or nearly identical, return empty changes array

OUTPUT FORMAT:
{
  "hasChanges": true/false,
  "significance": "high" | "medium" | "low" | "none",
  "changes": [
    {
      "description": "What changed in plain English",
      "original": "Brief excerpt from original",
      "revised": "Brief excerpt from revised",
      "impact": "Business/legal impact of this change"
    }
  ]
}

SIGNIFICANCE GUIDE:
- "high": Payment amounts, term length, liability caps, indemnification scope
- "medium": Notice periods, insurance amounts, procedural requirements
- "low": Formatting, contact info, minor clarifications
- "none": No meaningful changes

ORIGINAL SECTION:
`;

/**
 * Compare a single section pair using AI
 */
async function compareSectionPair(
  original: Section | null,
  revised: Section | null
): Promise<{ hasChanges: boolean; significance: string; changes: Array<{ description: string; original: string; revised: string; impact: string }> }> {

  // Handle added/removed sections without AI
  if (!original) {
    return {
      hasChanges: true,
      significance: 'medium',
      changes: [{
        description: `New section added: ${revised?.title || 'Unknown'}`,
        original: '(Section not present in original)',
        revised: revised?.content.substring(0, 200) + '...' || '',
        impact: 'New provisions added to agreement'
      }]
    };
  }

  if (!revised) {
    return {
      hasChanges: true,
      significance: 'medium',
      changes: [{
        description: `Section removed: ${original.title}`,
        original: original.content.substring(0, 200) + '...',
        revised: '(Section not present in revised)',
        impact: 'Provisions removed from agreement'
      }]
    };
  }

  // Quick check: if content is identical, skip AI
  if (original.content.trim() === revised.content.trim()) {
    return { hasChanges: false, significance: 'none', changes: [] };
  }

  // Use AI to compare
  const prompt = SECTION_COMPARE_PROMPT +
    original.content.substring(0, 8000) +
    '\n\nREVISED SECTION:\n' +
    revised.content.substring(0, 8000);

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://mars-contracts.vercel.app',
        'X-Title': 'MARS Contract Compare',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      console.error(`[SECTION COMPARE] API error for section ${original.number}: ${response.status}`);
      // Fallback: report as changed but unknown details
      return {
        hasChanges: true,
        significance: 'medium',
        changes: [{
          description: 'Section has changes (analysis unavailable)',
          original: original.content.substring(0, 100) + '...',
          revised: revised.content.substring(0, 100) + '...',
          impact: 'Review manually'
        }]
      };
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || '';

    // Parse JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        hasChanges: parsed.hasChanges ?? parsed.changes?.length > 0,
        significance: parsed.significance || 'medium',
        changes: parsed.changes || []
      };
    }

    // Fallback if no JSON
    return {
      hasChanges: true,
      significance: 'medium',
      changes: [{
        description: 'Section modified',
        original: original.content.substring(0, 100) + '...',
        revised: revised.content.substring(0, 100) + '...',
        impact: 'Review manually'
      }]
    };

  } catch (error) {
    console.error(`[SECTION COMPARE] Error comparing section ${original.number}:`, error);
    return {
      hasChanges: true,
      significance: 'medium',
      changes: [{
        description: 'Section has changes (analysis failed)',
        original: original.content.substring(0, 100) + '...',
        revised: revised.content.substring(0, 100) + '...',
        impact: 'Review manually'
      }]
    };
  }
}

// ============================================================================
// DOCUMENT INFO EXTRACTION
// ============================================================================

function extractDocumentInfo(text: string): { title: string; date: string } {
  // Try to find document title
  let title = 'Contract Document';
  const titleMatch = text.match(/(?:AGREEMENT|CONTRACT)[\s\S]{0,100}?(?:for|between)[\s\S]{0,200}?(?=\n\n|THIS)/i);
  if (titleMatch) {
    title = titleMatch[0].replace(/\n/g, ' ').trim().substring(0, 100);
  }

  // Try to find date
  let date = '';
  const datePatterns = [
    /effective\s+(?:as\s+of\s+)?(\w+\s+\d{1,2},?\s+\d{4})/i,
    /dated?\s+(?:as\s+of\s+)?(\w+\s+\d{1,2},?\s+\d{4})/i,
    /January\s+1(?:st)?,\s+(\d{4})/i,
    /(\d{4})\s+(?:agreement|contract)/i,
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      date = match[1] || match[0];
      break;
    }
  }

  // Extract year as fallback
  if (!date) {
    const yearMatch = text.match(/20\d{2}/);
    if (yearMatch) date = yearMatch[0];
  }

  return { title, date };
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

    console.log('[COMPARE] Starting section-by-section comparison...');
    console.log(`[COMPARE] Original: ${originalText.length} chars, Revised: ${revisedText.length} chars`);

    // Step 1: Extract sections from both documents
    // Try regex first, then AI fallback if needed
    let originalSections = extractSections(originalText);
    let revisedSections = extractSections(revisedText);

    console.log(`[COMPARE] Regex extraction: ${originalSections.length} from original, ${revisedSections.length} from revised`);

    // Use AI extraction as fallback for documents where regex failed
    if (originalSections.length === 0) {
      console.log('[COMPARE] Regex failed on original, trying AI extraction...');
      const aiSections = await extractSectionsWithAI(originalText);
      if (aiSections.length > 0) {
        originalSections = aiSections;
        console.log('[COMPARE] AI extracted', aiSections.length, 'sections from original');
      }
    }

    if (revisedSections.length === 0) {
      console.log('[COMPARE] Regex failed on revised, trying AI extraction...');
      const aiSections = await extractSectionsWithAI(revisedText);
      if (aiSections.length > 0) {
        revisedSections = aiSections;
        console.log('[COMPARE] AI extracted', aiSections.length, 'sections from revised');
      }
    }

    // Final fallback: if still no sections, create FULL DOCUMENT section
    if (originalSections.length === 0) {
      originalSections = [{ number: '0', title: 'FULL DOCUMENT', fullHeader: 'FULL DOCUMENT', content: originalText }];
    }
    if (revisedSections.length === 0) {
      revisedSections = [{ number: '0', title: 'FULL DOCUMENT', fullHeader: 'FULL DOCUMENT', content: revisedText }];
    }

    console.log(`[COMPARE] Final: ${originalSections.length} sections from original`);
    console.log(`[COMPARE] Final: ${revisedSections.length} sections from revised`);

    // Log section titles for debugging
    console.log('[COMPARE] Original sections:', originalSections.map(s => `${s.number}: ${s.title}`));
    console.log('[COMPARE] Revised sections:', revisedSections.map(s => `${s.number}: ${s.title}`));

    // Step 2: Match sections
    const pairs = matchSections(originalSections, revisedSections);
    console.log(`[COMPARE] Matched ${pairs.length} section pairs`);

    // Step 3: Compare each section pair (in parallel for speed)
    const comparisonPromises = pairs.map(async (pair): Promise<SectionComparison> => {
      const result = await compareSectionPair(pair.original, pair.revised);

      let status: 'unchanged' | 'changed' | 'added' | 'removed' = 'unchanged';
      if (pair.matchType === 'added') status = 'added';
      else if (pair.matchType === 'removed') status = 'removed';
      else if (result.hasChanges) status = 'changed';

      return {
        sectionNumber: pair.original?.number || pair.revised?.number || '?',
        sectionTitle: pair.original?.title || pair.revised?.title || 'Unknown Section',
        status,
        significance: result.significance as 'high' | 'medium' | 'low' | 'none',
        changes: result.changes
      };
    });

    const sectionComparisons = await Promise.all(comparisonPromises);

    // Step 4: Extract document info
    const originalInfo = extractDocumentInfo(originalText);
    const revisedInfo = extractDocumentInfo(revisedText);

    // Step 5: Generate summary
    const sectionsChanged = sectionComparisons.filter(s => s.status === 'changed').length;
    const sectionsAdded = sectionComparisons.filter(s => s.status === 'added').length;
    const sectionsRemoved = sectionComparisons.filter(s => s.status === 'removed').length;
    const sectionsUnchanged = sectionComparisons.filter(s => s.status === 'unchanged').length;

    // Generate key takeaways from high-significance changes
    const keyTakeaways: string[] = [];
    const highChanges = sectionComparisons.filter(s => s.significance === 'high' && s.changes.length > 0);
    for (const section of highChanges) {
      for (const change of section.changes.slice(0, 2)) {
        keyTakeaways.push(`[${section.sectionTitle}] ${change.description}`);
      }
    }

    // Add summary of added/removed sections
    if (sectionsAdded > 0) {
      const addedTitles = sectionComparisons.filter(s => s.status === 'added').map(s => s.sectionTitle);
      keyTakeaways.push(`New sections added: ${addedTitles.join(', ')}`);
    }
    if (sectionsRemoved > 0) {
      const removedTitles = sectionComparisons.filter(s => s.status === 'removed').map(s => s.sectionTitle);
      keyTakeaways.push(`Sections removed: ${removedTitles.join(', ')}`);
    }

    const result: ComparisonResult = {
      mode: 'section-by-section',
      documentInfo: {
        originalTitle: originalInfo.title,
        revisedTitle: revisedInfo.title,
        originalDate: originalInfo.date,
        revisedDate: revisedInfo.date
      },
      summary: {
        totalSections: sectionComparisons.length,
        sectionsChanged,
        sectionsAdded,
        sectionsRemoved,
        sectionsUnchanged,
        keyTakeaways: keyTakeaways.slice(0, 10) // Limit to 10 takeaways
      },
      sections: sectionComparisons,
      addedSections: sectionComparisons.filter(s => s.status === 'added').map(s => s.sectionTitle),
      removedSections: sectionComparisons.filter(s => s.status === 'removed').map(s => s.sectionTitle)
    };

    console.log(`[COMPARE] Complete: ${sectionsChanged} changed, ${sectionsAdded} added, ${sectionsRemoved} removed, ${sectionsUnchanged} unchanged`);

    return NextResponse.json(result);

  } catch (error) {
    console.error('[COMPARE] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Comparison failed: ${message}` },
      { status: 500 }
    );
  }
}
