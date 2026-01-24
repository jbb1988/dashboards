import { NextRequest, NextResponse } from 'next/server';
import DiffMatchPatch from 'diff-match-patch';
import { getClauseContextForPrompt } from '@/lib/clauseRetrieval';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';

// Default model if none specified
const DEFAULT_MODEL = 'anthropic/claude-sonnet-4';

// Increase timeout for Vercel - this requires vercel.json config as well
export const maxDuration = 300; // 5 minutes max for Pro plan

// ============================================
// TYPES FOR NEW ANCHOR-BASED SCHEMA
// ============================================

interface Edit {
  section: string;
  operation: 'replace_block';
  anchor_start: string;
  anchor_end: string;
  new_text: string;
}

interface SelfCheck {
  no_duplicate_sentence_starts: boolean;
  no_orphaned_fragments: boolean;
  no_duplicate_definitions: boolean;
  no_contradictory_modifiers: boolean;
  no_paragraph_starts_with_and: boolean;
}

interface AIResponse {
  edits: Edit[];
  self_check?: SelfCheck;
  error?: string;
}

interface QualityIssue {
  type: 'duplicate_sentence_start' | 'orphan_fragment' | 'duplicate_definition' | 'contradictory_modifiers' | 'dangling_conjunction' | 'anchor_not_found' | 'incomplete_sentence';
  severity: 'error' | 'warning';
  description: string;
  section?: string;
  evidence?: string;
}

// Legacy Section interface for backwards compatibility with frontend
interface LegacySection {
  sectionNumber?: string;
  sectionTitle?: string;
  originalText?: string;
  revisedText?: string;
  riskLevel?: string;
  materiality?: string;
  rationale?: string;
}

// ============================================
// QUALITY GATE VALIDATION (QA CHECKLIST)
// ============================================

/**
 * Quality Gate: Validate AI-generated edits against the QA checklist
 * Returns list of issues found. Empty list = passed validation.
 *
 * Checklist:
 * A) Structure / deletion integrity
 * B) Defined terms & parentheticals
 * C) Grammar mechanics
 * D) Scope consistency (contradiction killer)
 * E) Cap placement
 */
function validateEdits(
  edits: Edit[],
  originalContract: string,
  selfCheck?: SelfCheck
): QualityIssue[] {
  const issues: QualityIssue[] = [];

  for (const edit of edits) {
    const section = edit.section || 'Unknown';
    const newText = edit.new_text || '';

    // A) STRUCTURE / DELETION INTEGRITY

    // A1. No duplicate sentence starts
    const sentencePattern = /(?:^|[.!?]\s+)([A-Z][a-z]+(?:\s+[a-z]+){0,4})/g;
    const sentenceStarts: string[] = [];
    let match;
    while ((match = sentencePattern.exec(newText)) !== null) {
      sentenceStarts.push(match[1].toLowerCase());
    }
    const uniqueStarts = new Set(sentenceStarts);
    if (sentenceStarts.length > uniqueStarts.size) {
      const duplicates = sentenceStarts.filter((s, i) => sentenceStarts.indexOf(s) !== i);
      issues.push({
        type: 'duplicate_sentence_start',
        severity: 'error',
        description: `Duplicate sentence opening detected`,
        section,
        evidence: `"${duplicates[0]}..." appears multiple times`
      });
    }

    // A2. Check anchors exist and are unique in source
    const anchorStart = edit.anchor_start;
    const anchorEnd = edit.anchor_end;

    if (anchorStart) {
      const startCount = (originalContract.match(new RegExp(escapeRegExp(anchorStart), 'g')) || []).length;
      if (startCount === 0) {
        issues.push({
          type: 'anchor_not_found',
          severity: 'error',
          description: `anchor_start not found in contract`,
          section,
          evidence: `"${anchorStart.substring(0, 50)}..."`
        });
      } else if (startCount > 1) {
        issues.push({
          type: 'anchor_not_found',
          severity: 'warning',
          description: `anchor_start appears ${startCount} times (should be unique)`,
          section
        });
      }
    }

    if (anchorEnd) {
      const endCount = (originalContract.match(new RegExp(escapeRegExp(anchorEnd), 'g')) || []).length;
      if (endCount === 0) {
        issues.push({
          type: 'anchor_not_found',
          severity: 'error',
          description: `anchor_end not found in contract`,
          section,
          evidence: `"...${anchorEnd.slice(-50)}"`
        });
      }
    }

    // B) DEFINED TERMS & PARENTHETICALS

    // B1. Defined term parenthetical appears max once
    const definedTermPattern = /\(collectively[,]?\s*["'][^"']+["'][^)]*\)/gi;
    const definedTerms = newText.match(definedTermPattern) || [];
    if (definedTerms.length > 1) {
      issues.push({
        type: 'duplicate_definition',
        severity: 'error',
        description: `Defined term parenthetical appears ${definedTerms.length} times (max 1)`,
        section,
        evidence: definedTerms.join(' | ')
      });
    }

    // C) GRAMMAR MECHANICS

    // C1. No paragraph starts with "and/or/but" (dangling conjunction)
    const danglingPattern = /(?:^|\n\n)\s*(and\s|or\s|but\s)/i;
    if (danglingPattern.test(newText)) {
      const matchedConj = newText.match(danglingPattern);
      issues.push({
        type: 'dangling_conjunction',
        severity: 'error',
        description: `Paragraph starts with conjunction without antecedent`,
        section,
        evidence: matchedConj ? matchedConj[0].trim() : undefined
      });
    }

    // C2. Check for incomplete sentences (basic)
    const trimmedText = newText.trim();
    if (trimmedText && !trimmedText.endsWith('.') && !trimmedText.endsWith('"') && !trimmedText.endsWith(')')) {
      issues.push({
        type: 'incomplete_sentence',
        severity: 'warning',
        description: `new_text may not end with complete sentence`,
        section,
        evidence: `Ends with: "${trimmedText.slice(-30)}"`
      });
    }

    // D) SCOPE CONSISTENCY (THE CONTRADICTION KILLER)

    // D1. If limited causation, no broad causation phrases
    const hasLimitedCausation = /to the extent caused by|to the extent arising from|but only to the extent/i.test(newText);
    const broadCausationPhrases = [
      'however caused',
      'arising out of',
      'in any way connected with',
      'resulting from',
      'regardless of cause'
    ];

    if (hasLimitedCausation) {
      for (const phrase of broadCausationPhrases) {
        if (newText.toLowerCase().includes(phrase)) {
          issues.push({
            type: 'contradictory_modifiers',
            severity: 'error',
            description: `Contradictory scope: has "to the extent caused by" but also "${phrase}"`,
            section
          });
        }
      }
    }

    // D2. If limited to third-party claims, check for inconsistent first-party
    const thirdPartyOnly = /third[- ]party claims/i.test(newText);
    const hasFirstParty = /claims\s+(?:made\s+)?by\s+(?:FW|Client|County)/i.test(newText);
    if (thirdPartyOnly && hasFirstParty) {
      issues.push({
        type: 'contradictory_modifiers',
        severity: 'warning',
        description: `May have inconsistent scope: "third-party claims" but also mentions claims by FW/Client`,
        section
      });
    }
  }

  // Cross-check with AI's self-reported self_check
  if (selfCheck) {
    if (selfCheck.no_duplicate_sentence_starts === false) {
      const existing = issues.find(i => i.type === 'duplicate_sentence_start');
      if (!existing) {
        issues.push({
          type: 'duplicate_sentence_start',
          severity: 'warning',
          description: `AI self-reported duplicate sentence starts (not detected by validator)`,
          section: 'Self-Check'
        });
      }
    }
    if (selfCheck.no_contradictory_modifiers === false) {
      const existing = issues.find(i => i.type === 'contradictory_modifiers');
      if (!existing) {
        issues.push({
          type: 'contradictory_modifiers',
          severity: 'warning',
          description: `AI self-reported contradictory modifiers (not detected by validator)`,
          section: 'Self-Check'
        });
      }
    }
  }

  return issues;
}

/**
 * Format quality issues into feedback for retry prompt
 */
function formatQualityFeedback(issues: QualityIssue[]): string {
  if (issues.length === 0) return '';

  const errorIssues = issues.filter(i => i.severity === 'error');
  const warningIssues = issues.filter(i => i.severity === 'warning');

  let feedback = '\n\n=== QUALITY VALIDATION FAILED ===\n';
  feedback += 'Your output failed the QA checklist. Fix these issues:\n\n';

  if (errorIssues.length > 0) {
    feedback += 'ERRORS (must fix):\n';
    for (const issue of errorIssues) {
      feedback += `- [${issue.section}] ${issue.description}`;
      if (issue.evidence) feedback += `\n  Evidence: ${issue.evidence}`;
      feedback += '\n';
    }
    feedback += '\n';
  }

  if (warningIssues.length > 0) {
    feedback += 'WARNINGS:\n';
    for (const issue of warningIssues) {
      feedback += `- [${issue.section}] ${issue.description}`;
      if (issue.evidence) feedback += `\n  Evidence: ${issue.evidence}`;
      feedback += '\n';
    }
  }

  feedback += `
REMINDER - HARD RULES:
1. Replace means FULL replacement - no partial deletes, no leftovers
2. Never duplicate sentence openings (e.g., two "The Contractor covenants...")
3. Defined-term parentheticals appear MAX ONCE per section
4. If using "to the extent caused by negligence", REMOVE all "however caused", "arising out of", etc.
5. No paragraph starts with "and/or/but" unless continuing same sentence

Regenerate with these fixes.
`;

  return feedback;
}

// ============================================
// OPENROUTER API CALL
// ============================================

interface AIResult {
  edits: Edit[];
  selfCheck?: SelfCheck;
  error?: string;
  raw: string;
  // Legacy fields for backwards compatibility
  sections: LegacySection[];
  summary: string[];
}

/**
 * Call OpenRouter API with the given prompt
 * Returns structured edits using anchor-based schema
 */
async function callOpenRouterAPI(
  systemPrompt: string,
  userContent: string,
  model: string
): Promise<AIResult> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://mars-contracts.vercel.app',
      'X-Title': 'MARS Contract Review',
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userContent,
        },
      ],
      max_tokens: 8000,
      temperature: 0.1, // Lower temperature for more deterministic output
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API failed (${response.status}): ${errorText.substring(0, 200)}`);
  }

  // Collect streamed response
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Failed to get response stream');
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
            if (content) {
              fullContent += content;
            }
          } catch {
            // Skip malformed JSON chunks
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!fullContent) {
    throw new Error('AI returned empty response');
  }

  // Parse JSON from response
  let jsonStr = fullContent.trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  const firstBrace = jsonStr.indexOf('{');
  const lastBrace = jsonStr.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('No JSON object found in response');
  }

  jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);

  // Try parsing strategies
  let result: AIResponse;
  try {
    result = JSON.parse(jsonStr);
  } catch {
    // Try with escaped control characters
    try {
      const fixedJson = jsonStr
        .replace(/\t/g, '\\t')
        .replace(/\r/g, '\\r')
        .replace(/\n/g, '\\n');
      result = JSON.parse(fixedJson);
    } catch {
      throw new Error('Could not parse JSON response');
    }
  }

  // Check for error response
  if (result.error) {
    console.warn('AI returned error:', result.error);
  }

  const edits = Array.isArray(result.edits) ? result.edits : [];

  // Convert edits to legacy sections format for backwards compatibility
  const legacySections: LegacySection[] = edits.map(edit => ({
    sectionTitle: edit.section,
    originalText: '', // Will be filled in by anchor resolution
    revisedText: edit.new_text,
    riskLevel: 'high', // Default to high since these are flagged issues
    materiality: 'high',
    rationale: `Replace block from "${edit.anchor_start?.substring(0, 30)}..." to "...${edit.anchor_end?.slice(-30)}"`
  }));

  // Generate summary from edits
  const summary = edits.map(edit =>
    `[${edit.section}] Full block replacement with clean redline`
  );

  return {
    edits,
    selfCheck: result.self_check,
    error: result.error,
    raw: fullContent,
    sections: legacySections,
    summary: summary.length > 0 ? summary : ['No material issues identified'],
  };
}

/**
 * Normalize Unicode characters to ASCII equivalents.
 *
 * CRITICAL: This prevents Word Compare from showing spurious strike/reinsert
 * when comparing documents with different quote/dash styles.
 *
 * Root cause: PDF extraction preserves smart quotes (U+201C/201D) but AI
 * outputs straight quotes (ASCII 0x22). Word sees these as different chars.
 */
function normalizeToASCII(text: string): string {
  return text
    // === QUOTES ===
    // Smart double quotes → straight double quote
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036\u00AB\u00BB]/g, '"')
    // Smart single quotes, apostrophes → straight single quote
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035\u2039\u203A]/g, "'")

    // === DASHES ===
    // En dash, em dash, horizontal bar, minus sign → hyphen
    .replace(/[\u2013\u2014\u2015\u2212]/g, '-')

    // === SPACES ===
    // Non-breaking space, various Unicode spaces → regular space
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, ' ')

    // === ELLIPSIS ===
    .replace(/\u2026/g, '...')

    // === OTHER COMMON SUBSTITUTIONS ===
    // Bullet point variants → asterisk (for consistency)
    .replace(/[\u2022\u2023\u2043]/g, '*')
    // Fraction characters → spelled out
    .replace(/\u00BD/g, '1/2')
    .replace(/\u00BC/g, '1/4')
    .replace(/\u00BE/g, '3/4');
}

// Alias for backwards compatibility with diff display
const normalizeText = normalizeToASCII;

/**
 * Escape special regex characters in a string
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Generate a clean diff display showing ONLY the actual changes.
 * Uses diff-match-patch for accurate word-level comparison.
 *
 * Output format:
 * - Unchanged text: plain text
 * - Deleted text: [strikethrough]deleted words[/strikethrough]
 * - Inserted text: [underline]inserted words[/underline]
 */
function generateDiffDisplay(original: string, modified: string): string {
  const dmp = new DiffMatchPatch();

  // Normalize both texts to prevent spurious diffs from quote/dash styles
  const normalizedOriginal = normalizeText(original);
  const normalizedModified = normalizeText(modified);

  // Get character-level diff on NORMALIZED text
  const diffs = dmp.diff_main(normalizedOriginal, normalizedModified);

  // Clean up the diff for better readability
  dmp.diff_cleanupSemantic(diffs);

  // Build result string
  const result: string[] = [];

  for (const [operation, text] of diffs) {
    if (operation === 0) {
      // EQUAL - unchanged text
      result.push(text);
    } else if (operation === -1) {
      // DELETE - text removed from original
      // Skip if it's just whitespace changes
      if (text.trim()) {
        result.push(`[strikethrough]${text}[/strikethrough]`);
      } else {
        result.push(text); // Keep whitespace as-is
      }
    } else if (operation === 1) {
      // INSERT - text added in modified
      // Skip if it's just whitespace changes
      if (text.trim()) {
        result.push(`[underline]${text}[/underline]`);
      } else {
        result.push(text); // Keep whitespace as-is
      }
    }
  }

  return result.join('');
}

// ============================================
// SYSTEM PROMPT - MECHANICALLY PRECISE REDLINE ENGINE
// ============================================

const REDLINE_SYSTEM_PROMPT = `You are a contract redline engine. Your job is NOT to write legal advice. Your job is to output mechanically correct edits that can be applied to a Word document without leaving broken grammar, duplicate text, or orphaned fragments.

OUTPUT FORMAT (STRICT):
Return ONLY valid JSON. No markdown. No commentary.

JSON SCHEMA:
{
  "edits": [
    {
      "section": "string (e.g., INDEMNIFICATION)",
      "operation": "replace_block",
      "anchor_start": "exact substring that appears ONCE in the source block",
      "anchor_end": "exact substring that appears ONCE in the source block",
      "new_text": "full replacement text for the block (final clean text)"
    }
  ],
  "self_check": {
    "no_duplicate_sentence_starts": true/false,
    "no_orphaned_fragments": true/false,
    "no_duplicate_definitions": true/false,
    "no_contradictory_modifiers": true/false,
    "no_paragraph_starts_with_and": true/false
  }
}

HARD RULES (MUST FOLLOW):
1) Replace means FULL replacement: if you edit a sentence or paragraph, you must replace the entire block between anchor_start and anchor_end. Never partially delete. Never leave leftovers.
2) Never duplicate sentence openings (e.g., two "The Contractor covenants...").
3) Defined-term parentheticals (e.g., (collectively "FW"...)) may appear at most ONCE per section.
4) If the indemnity is limited (e.g., "to the extent caused by negligence"), you must REMOVE any contradictory broad causation modifiers remaining in the same section (e.g., "however caused," "arising out of," "in any way connected with").
5) Do not output any paragraph that starts with a conjunction ("and", "or", "but") unless it is truly a continuation of the same sentence inside the same paragraph.
6) The resulting new_text must read as a clean standalone section with correct grammar and punctuation.

ANCHORS:
- anchor_start and anchor_end must be exact substrings copied from the provided source text.
- Each anchor must appear exactly once in the block being replaced.
- anchor_start is typically the section heading or first words.
- anchor_end is typically the last sentence of the block (ending with period).

MARS NEGOTIATING POSITIONS (apply these to edits):
- Liability: Cap at contract value, exclude consequential/indirect damages
- Indemnification: Proportionate to fault ("to the extent caused by negligence"), add liability cap since municipalities cannot indemnify
- IP/Work Product: Contractor retains pre-existing IP, tools, methodologies, templates
- Termination: Payment for work performed if terminated without cause

If you cannot comply with any rule, output:
{ "edits": [], "error": "reason" }`;

// User prompt template for contract analysis
const MARS_USER_PROMPT_TEMPLATE = `Analyze this contract for MARS Company (the Contractor/Vendor). Identify material risks and output redline edits.

FOCUS ON THESE SECTIONS (if present):
1. INDEMNIFICATION - Limit to negligence, add liability cap, remove "however caused"
2. INTELLECTUAL PROPERTY / WORK PRODUCT - Add pre-existing IP carve-out
3. LIMITATION OF LIABILITY - If missing, flag it; if unlimited, add cap
4. TERMINATION - Ensure payment for work performed

For each material issue, output a replace_block edit with:
- anchor_start: The EXACT first words of the block (section heading or first sentence start)
- anchor_end: The EXACT last sentence of the block (must end with period)
- new_text: The COMPLETE clean replacement (no leftovers, no duplicates)

CONTRACT TEXT:
`;

// Legacy prompt for backwards compatibility (if new format fails)
const MARS_CONTRACT_PROMPT = REDLINE_SYSTEM_PROMPT;

export async function POST(request: NextRequest) {
  console.log('=== CONTRACT REVIEW API CALLED ===');
  console.log('Timestamp:', new Date().toISOString());

  try {
    const body = await request.json();
    const { text, contractId, provisionName, model, playbookContent } = body;

    console.log('Request received:');
    console.log('- Text length:', text?.length || 0);
    console.log('- Contract ID:', contractId || 'none');
    console.log('- Provision:', provisionName || 'none');
    console.log('- Model:', model);
    console.log('- Playbook comparison:', playbookContent ? `${playbookContent.length} chars` : 'none');

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Contract text is required' },
        { status: 400 }
      );
    }

    if (!OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: 'OpenRouter API key not configured' },
        { status: 500 }
      );
    }

    // CRITICAL: Normalize text BEFORE sending to AI
    // This ensures AI works with ASCII quotes/dashes, preventing mismatch
    // between original (smart quotes from PDF) and revised (AI output)
    const normalizedInput = normalizeToASCII(text);

    // DEBUG: Log normalization effect
    const hasSmartQuotes = /[\u201C\u201D\u2018\u2019]/.test(text);
    const hasSmartQuotesAfter = /[\u201C\u201D\u2018\u2019]/.test(normalizedInput);
    console.log(`[NORMALIZATION] Input had smart quotes: ${hasSmartQuotes}, After normalization: ${hasSmartQuotesAfter}`);

    // Fetch approved clauses for RAG (Retrieval Augmented Generation)
    let clauseContext = '';
    try {
      clauseContext = await getClauseContextForPrompt(false);
      if (clauseContext) {
        console.log(`RAG: Injecting ${clauseContext.length} chars of approved clause context`);
      }
    } catch (ragError) {
      console.error('RAG: Error fetching clause context (continuing without):', ragError);
    }

    // Build prompts using new system/user format
    const systemPrompt = REDLINE_SYSTEM_PROMPT;
    let userPrompt = MARS_USER_PROMPT_TEMPLATE + normalizedInput;

    // Add RAG clause context if available
    if (clauseContext) {
      userPrompt = clauseContext + '\n\n' + userPrompt;
    }

    // Add playbook comparison if provided
    if (playbookContent && typeof playbookContent === 'string' && playbookContent.trim().length > 0) {
      const normalizedPlaybook = normalizeToASCII(playbookContent);
      userPrompt += `\n\nPLAYBOOK COMPARISON:\nCompare against MARS's standard terms and flag deviations:\n${normalizedPlaybook}`;
      console.log('Added playbook comparison to prompt');
    }

    // Call OpenRouter API with quality gate validation and retry
    const openRouterModel = model || DEFAULT_MODEL;
    console.log(`Starting OpenRouter analysis with model: ${openRouterModel}...`);
    const startTime = Date.now();

    let result: AIResult;
    let qualityIssues: QualityIssue[] = [];
    let retryAttempted = false;

    // PASS 1: Initial AI call
    try {
      console.log('=== PASS 1: Initial AI Analysis (Anchor-Based) ===');
      result = await callOpenRouterAPI(systemPrompt, userPrompt, openRouterModel);
      console.log(`Pass 1 completed in ${(Date.now() - startTime) / 1000}s`);
      console.log(`Pass 1 edits: ${result.edits.length}`);

      if (result.error) {
        console.warn('AI reported error:', result.error);
      }

      // Run quality gates on the edits
      qualityIssues = validateEdits(result.edits, normalizedInput, result.selfCheck);

      if (qualityIssues.length > 0) {
        const errorCount = qualityIssues.filter(i => i.severity === 'error').length;
        const warningCount = qualityIssues.filter(i => i.severity === 'warning').length;
        console.log(`Quality gate: ${errorCount} errors, ${warningCount} warnings`);

        // Log self-check results
        if (result.selfCheck) {
          console.log('AI self-check:', JSON.stringify(result.selfCheck));
        }

        // If there are errors (not just warnings), retry with feedback
        if (errorCount > 0) {
          console.log('=== PASS 2: Retry with Quality Feedback ===');
          retryAttempted = true;

          const qualityFeedback = formatQualityFeedback(qualityIssues);
          const retryUserPrompt = userPrompt + qualityFeedback;

          try {
            const retryStartTime = Date.now();
            result = await callOpenRouterAPI(systemPrompt, retryUserPrompt, openRouterModel);
            console.log(`Pass 2 completed in ${(Date.now() - retryStartTime) / 1000}s`);
            console.log(`Pass 2 edits: ${result.edits.length}`);

            // Re-validate after retry
            qualityIssues = validateEdits(result.edits, normalizedInput, result.selfCheck);
            const retryErrorCount = qualityIssues.filter(i => i.severity === 'error').length;
            const retryWarningCount = qualityIssues.filter(i => i.severity === 'warning').length;
            console.log(`Quality gate (retry): ${retryErrorCount} errors, ${retryWarningCount} warnings`);

            if (retryErrorCount > 0) {
              console.warn('Quality issues persist after retry - proceeding with warnings');
            }
          } catch (retryError) {
            console.error('Retry failed:', retryError);
          }
        }
      } else {
        console.log('Quality gate: PASSED (no issues)');
      }
    } catch (apiError) {
      console.error('=== OPENROUTER API ERROR ===');
      console.error('Error:', apiError);
      console.error('Model Used:', openRouterModel);
      console.error('============================');
      return NextResponse.json(
        { error: apiError instanceof Error ? apiError.message : 'AI analysis failed' },
        { status: 500 }
      );
    }

    console.log(`Total analysis time: ${(Date.now() - startTime) / 1000}s (retry: ${retryAttempted})`);

    // Use legacy sections for backwards compatibility
    const sections = result.sections;

    // BUILD modifiedText by applying anchor-based edits
    // This uses anchor_start and anchor_end to find the exact block to replace
    let modifiedText = normalizedInput;
    let appliedChanges = 0;
    let failedChanges: string[] = [];

    for (const edit of result.edits) {
      if (!edit.anchor_start || !edit.anchor_end || !edit.new_text) {
        console.warn(`Skipping edit for ${edit.section}: missing anchor_start, anchor_end, or new_text`);
        failedChanges.push(edit.section || 'Unknown');
        continue;
      }

      // Normalize anchors and new_text
      const anchorStart = normalizeToASCII(edit.anchor_start);
      const anchorEnd = normalizeToASCII(edit.anchor_end);
      const newText = normalizeToASCII(edit.new_text);

      // Find positions of anchors
      const startPos = modifiedText.indexOf(anchorStart);
      if (startPos === -1) {
        console.warn(`Could not find anchor_start for ${edit.section}: "${anchorStart.substring(0, 50)}..."`);
        failedChanges.push(edit.section || 'Unknown');
        continue;
      }

      // Find anchor_end AFTER anchor_start
      const searchAfterStart = modifiedText.substring(startPos);
      const endPosRelative = searchAfterStart.indexOf(anchorEnd);
      if (endPosRelative === -1) {
        console.warn(`Could not find anchor_end for ${edit.section}: "...${anchorEnd.slice(-50)}"`);
        failedChanges.push(edit.section || 'Unknown');
        continue;
      }

      const endPos = startPos + endPosRelative + anchorEnd.length;

      // Extract the block being replaced (for logging and legacy sections)
      const originalBlock = modifiedText.substring(startPos, endPos);

      // Apply the replacement
      modifiedText = modifiedText.substring(0, startPos) + newText + modifiedText.substring(endPos);
      appliedChanges++;
      console.log(`Applied anchor-based edit to ${edit.section} (replaced ${originalBlock.length} chars with ${newText.length} chars)`);

      // Update legacy section with the original text we found
      const legacySection = sections.find(s => s.sectionTitle === edit.section);
      if (legacySection) {
        legacySection.originalText = originalBlock;
      }
    }

    console.log(`Applied ${appliedChanges}/${result.edits.length} edits. Failed: ${failedChanges.length > 0 ? failedChanges.join(', ') : 'none'}`);

    // Generate diff display using diff-match-patch
    // Both normalizedInput and modifiedText are now in same encoding
    const redlinedText = generateDiffDisplay(normalizedInput, modifiedText);

    // Check if AI actually made changes
    const hasStrikethrough = redlinedText.includes('[strikethrough]');
    const hasUnderline = redlinedText.includes('[underline]');
    const hasVisibleChanges = hasStrikethrough || hasUnderline;

    console.log(`Generated diff display, original: ${normalizedInput.length} chars, modified: ${modifiedText.length} chars`);
    console.log(`Diff has visible changes: ${hasVisibleChanges} (strikethrough: ${hasStrikethrough}, underline: ${hasUnderline})`);
    console.log(`Found ${sections.length} material sections to review`);

    // If we have sections but no visible diff changes, log warning
    if (sections.length > 0 && !hasVisibleChanges) {
      console.warn('WARNING: AI identified sections but modifiedText appears unchanged from original.');
      console.warn('This may indicate AI token limit or failure to apply changes to full document.');
      console.warn(`Original length: ${normalizedInput.length}, Modified length: ${modifiedText.length}`);
      console.warn(`Length difference: ${modifiedText.length - normalizedInput.length} chars`);
    }

    // Calculate risk scores summary
    const riskScores = {
      summary: {
        high: 0,
        medium: 0,
        low: 0,
      },
      sections: sections.map((s: { sectionTitle?: string; sectionNumber?: string; riskLevel?: string; materiality?: string }) => ({
        sectionTitle: s.sectionTitle || s.sectionNumber || 'Unknown',
        riskLevel: (s.riskLevel || s.materiality || 'medium').toLowerCase() as 'high' | 'medium' | 'low',
      })),
    };

    // Count risk levels
    for (const section of sections) {
      const risk = (section.riskLevel || section.materiality || 'medium').toLowerCase();
      if (risk === 'high') riskScores.summary.high++;
      else if (risk === 'medium') riskScores.summary.medium++;
      else riskScores.summary.low++;
    }

    console.log(`Risk scores: ${riskScores.summary.high} high, ${riskScores.summary.medium} medium, ${riskScores.summary.low} low`);

    // Include quality warnings in response if any remain
    const remainingWarnings = qualityIssues.filter(i => i.severity === 'warning');
    const qualityWarnings = remainingWarnings.length > 0
      ? remainingWarnings.map(w => `[${w.section}] ${w.description}`)
      : undefined;

    if (qualityWarnings) {
      console.log(`Returning with ${qualityWarnings.length} quality warnings`);
    }

    return NextResponse.json({
      redlinedText,
      originalText: normalizedInput,  // Normalized for ORIGINAL-PLAIN.docx
      modifiedText,                    // Normalized for REVISED.docx
      summary: result.summary,
      sections, // Structured section-by-section analysis
      hasVisibleChanges, // Flag to indicate if diff found changes
      riskScores, // Risk scoring for each section
      qualityWarnings, // NEW: Any quality issues that couldn't be auto-fixed
      retryAttempted, // NEW: Whether quality gate triggered a retry
      contractId,
      provisionName,
    });
  } catch (error) {
    console.error('=== CONTRACT REVIEW FATAL ERROR ===');
    console.error('Error Type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('Error Message:', error instanceof Error ? error.message : String(error));
    console.error('Error Stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('===================================');

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { error: `Analysis failed: ${errorMessage}` },
      { status: 500 }
    );
  }
}
