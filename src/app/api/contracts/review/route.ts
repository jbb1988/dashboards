import { NextRequest, NextResponse } from 'next/server';
import DiffMatchPatch from 'diff-match-patch';
import { getClauseContextForPrompt } from '@/lib/clauseRetrieval';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';

// Default model if none specified
const DEFAULT_MODEL = 'anthropic/claude-sonnet-4';

// Increase timeout for Vercel - this requires vercel.json config as well
export const maxDuration = 300; // 5 minutes max for Pro plan

// ============================================
// TYPES FOR HEADING-BASED SCHEMA
// ============================================

// Small find/replace pair - each must be < 255 chars for Word API
interface Change {
  find: string;      // Text to find (< 255 chars)
  replace: string;   // Replacement text (< 255 chars)
  rationale?: string;
}

// Edit to an existing section
interface SectionEdit {
  section_heading: string;  // Short section heading (e.g., "INDEMNIFICATION")
  operation: 'modify';
  changes: Change[];        // Array of small find/replace pairs
  rationale: string;
}

// New section to insert
interface NewSection {
  operation: 'insert_new';
  title: string;            // Title for the new section
  insert_after: string;     // Section heading after which to insert
  content: string;          // Complete new section text
  rationale: string;
}

interface SelfCheck {
  no_duplicate_sentence_starts: boolean;
  no_orphaned_fragments: boolean;
  no_duplicate_definitions: boolean;
  no_contradictory_modifiers: boolean;
  no_paragraph_starts_with_and: boolean;
}

interface AIResponse {
  edits: SectionEdit[];
  new_sections?: NewSection[];
  self_check?: SelfCheck;
  error?: string;
}

// Legacy anchor-based Edit interface for backwards compatibility
interface LegacyEdit {
  section: string;
  operation: 'replace_block';
  anchor_start: string;
  anchor_end: string;
  new_text: string;
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
  // New fields for heading-based approach
  changes?: Change[];       // Array of find/replace pairs for this section
  isNewSection?: boolean;   // True if this is a new section to insert
  insertAfter?: string;     // Section heading after which to insert (for new sections)
}

// ============================================
// QUALITY GATE VALIDATION (QA CHECKLIST)
// ============================================

/**
 * Quality Gate: Validate AI-generated edits against the QA checklist
 * Returns list of issues found. Empty list = passed validation.
 *
 * Checklist:
 * A) Structure / Find-replace integrity
 * B) Defined terms & parentheticals
 * C) Grammar mechanics
 * D) Scope consistency (contradiction killer)
 * E) Character limit compliance (255 char Word API limit)
 */
function validateEdits(
  edits: SectionEdit[],
  newSections: NewSection[],
  originalContract: string,
  selfCheck?: SelfCheck
): QualityIssue[] {
  const issues: QualityIssue[] = [];

  // Validate section edits
  for (const edit of edits) {
    const section = edit.section_heading || 'Unknown';

    // A) STRUCTURE / FIND-REPLACE INTEGRITY

    // A1. Check section heading exists in contract
    if (edit.section_heading) {
      const headingCount = (originalContract.match(new RegExp(escapeRegExp(edit.section_heading), 'gi')) || []).length;
      if (headingCount === 0) {
        issues.push({
          type: 'anchor_not_found',
          severity: 'error',
          description: `Section heading "${edit.section_heading}" not found in contract`,
          section
        });
      }
    }

    // A2. Validate each change's find/replace pairs
    for (const change of edit.changes || []) {
      // Check find text exists
      if (change.find) {
        const findCount = (originalContract.match(new RegExp(escapeRegExp(change.find), 'g')) || []).length;
        if (findCount === 0) {
          issues.push({
            type: 'anchor_not_found',
            severity: 'error',
            description: `Find text not found in contract`,
            section,
            evidence: `"${change.find.substring(0, 80)}..."`
          });
        }
      }

      // E) CHARACTER LIMIT COMPLIANCE
      if (change.find && change.find.length > 255) {
        issues.push({
          type: 'anchor_not_found',
          severity: 'error',
          description: `Find text exceeds 255 char Word API limit (${change.find.length} chars)`,
          section
        });
      }
      if (change.replace && change.replace.length > 255) {
        // Replace can be longer, but log a warning
        issues.push({
          type: 'incomplete_sentence',
          severity: 'warning',
          description: `Replace text is ${change.replace.length} chars - long replacements are fine but may need chunking`,
          section
        });
      }

      // D) SCOPE CONSISTENCY for replacements
      const replaceText = change.replace || '';
      const hasLimitedCausation = /to the extent caused by|to the extent arising from|but only to the extent/i.test(replaceText);
      const broadCausationPhrases = [
        'however caused',
        'arising out of',
        'in any way connected with',
        'resulting from',
        'regardless of cause'
      ];

      if (hasLimitedCausation) {
        for (const phrase of broadCausationPhrases) {
          if (replaceText.toLowerCase().includes(phrase)) {
            issues.push({
              type: 'contradictory_modifiers',
              severity: 'error',
              description: `Contradictory scope: has "to the extent caused by" but also "${phrase}"`,
              section
            });
          }
        }
      }
    }
  }

  // Validate new sections
  for (const newSection of newSections || []) {
    const section = newSection.title || 'New Section';

    // Check insert_after heading exists
    if (newSection.insert_after) {
      const afterCount = (originalContract.match(new RegExp(escapeRegExp(newSection.insert_after), 'gi')) || []).length;
      if (afterCount === 0) {
        issues.push({
          type: 'anchor_not_found',
          severity: 'error',
          description: `Insert-after heading "${newSection.insert_after}" not found in contract`,
          section
        });
      }
    }

    // Validate content
    const content = newSection.content || '';

    // B) DEFINED TERMS check
    const definedTermPattern = /\(collectively[,]?\s*["'][^"']+["'][^)]*\)/gi;
    const definedTerms = content.match(definedTermPattern) || [];
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
    const danglingPattern = /(?:^|\n\n)\s*(and\s|or\s|but\s)/i;
    if (danglingPattern.test(content)) {
      const matchedConj = content.match(danglingPattern);
      issues.push({
        type: 'dangling_conjunction',
        severity: 'error',
        description: `Paragraph starts with conjunction without antecedent`,
        section,
        evidence: matchedConj ? matchedConj[0].trim() : undefined
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
  edits: SectionEdit[];
  newSections: NewSection[];
  selfCheck?: SelfCheck;
  error?: string;
  raw: string;
  // Legacy fields for backwards compatibility with frontend
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

  console.log('=== AI Response Debug ===');
  console.log('Full content length:', fullContent.length);
  console.log('Full content preview:', fullContent.substring(0, 500));

  // Parse JSON from response - more robust extraction
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
    console.error('No JSON braces found. Response:', jsonStr.substring(0, 1000));
    throw new Error('No JSON object found in response');
  }

  jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
  console.log('Extracted JSON length:', jsonStr.length);

  // Try parsing strategies
  let result: AIResponse;
  try {
    result = JSON.parse(jsonStr);
  } catch (firstError) {
    console.log('First parse attempt failed:', firstError);
    // Try with escaped control characters
    try {
      const fixedJson = jsonStr
        .replace(/\t/g, '\\t')
        .replace(/\r/g, '\\r')
        .replace(/\n/g, '\\n');
      result = JSON.parse(fixedJson);
    } catch (secondError) {
      console.log('Second parse attempt failed:', secondError);
      // Try fixing common JSON issues
      try {
        // Fix unescaped quotes in strings, trailing commas, etc.
        const sanitized = jsonStr
          .replace(/,\s*}/g, '}')  // Remove trailing commas before }
          .replace(/,\s*]/g, ']')  // Remove trailing commas before ]
          .replace(/[\x00-\x1F\x7F]/g, ' '); // Replace control chars with space
        result = JSON.parse(sanitized);
        console.log('Third parse attempt succeeded after sanitization');
      } catch (thirdError) {
        console.error('All JSON parse attempts failed');
        console.error('JSON preview:', jsonStr.substring(0, 500));
        // Return empty result with error message instead of throwing
        return {
          edits: [],
          newSections: [],
          legacySections: [],
          summary: ['AI returned invalid JSON response. Please try again.'],
          error: 'Could not parse AI response',
        };
      }
    }
  }

  // Check for error response
  if (result.error) {
    console.warn('AI returned error:', result.error);
  }

  const edits: SectionEdit[] = Array.isArray(result.edits) ? result.edits : [];
  const newSections: NewSection[] = Array.isArray(result.new_sections) ? result.new_sections : [];

  // Convert edits to legacy sections format for backwards compatibility with frontend
  // Each SectionEdit becomes a LegacySection
  const legacySections: LegacySection[] = [];

  for (const edit of edits) {
    // For the new format, we store the changes array in a way the frontend can use
    // The frontend will handle the individual find/replace pairs
    legacySections.push({
      sectionTitle: edit.section_heading,
      originalText: '', // Will be populated by finding section in document
      revisedText: '', // Will be computed from changes
      riskLevel: 'high',
      materiality: 'high',
      rationale: edit.rationale,
      // Store changes in a custom property for the frontend
      changes: edit.changes,
    } as LegacySection & { changes: Change[] });
  }

  // Add new sections as separate entries
  for (const newSection of newSections) {
    legacySections.push({
      sectionTitle: newSection.title,
      originalText: '', // New section has no original
      revisedText: newSection.content,
      riskLevel: 'high',
      materiality: 'high',
      rationale: newSection.rationale,
      isNewSection: true,
      insertAfter: newSection.insert_after,
    } as LegacySection & { isNewSection: boolean; insertAfter: string });
  }

  // Generate summary from edits
  const summary: string[] = [];
  for (const edit of edits) {
    const changeCount = edit.changes?.length || 0;
    summary.push(`[${edit.section_heading}] ${changeCount} targeted change${changeCount !== 1 ? 's' : ''}`);
  }
  for (const newSection of newSections) {
    summary.push(`[NEW] ${newSection.title} - ${newSection.rationale}`);
  }

  return {
    edits,
    newSections,
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

const REDLINE_SYSTEM_PROMPT = `You are a contract redline engine. Your job is NOT to write legal advice. Your job is to output mechanically correct edits that can be applied to a Word document.

OUTPUT FORMAT (STRICT):
Return ONLY valid JSON. No markdown. No commentary.

CRITICAL: Word has a 255 character search limit. Each "find" string MUST be under 200 characters.

JSON SCHEMA:
{
  "edits": [
    {
      "section_heading": "EXACT section heading from contract (e.g., INDEMNIFICATION)",
      "operation": "modify",
      "changes": [
        {
          "find": "exact text to find (MUST be < 200 chars, unique in section)",
          "replace": "replacement text",
          "rationale": "why this change"
        }
      ],
      "rationale": "overall reason for modifying this section"
    }
  ],
  "new_sections": [
    {
      "operation": "insert_new",
      "title": "NEW SECTION TITLE",
      "insert_after": "EXISTING SECTION HEADING (where to insert after)",
      "content": "Complete new section text including heading",
      "rationale": "why this section is needed"
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

HARD RULES FOR FIND/REPLACE:
1) Each "find" must be < 200 characters (Word API limit is 255, we use 200 for safety)
2) Each "find" must be a UNIQUE phrase within its section - if it appears twice, make it longer/more specific
3) "find" must be EXACT text copied from the contract - no modifications
4) If you need to change a long passage, break it into multiple find/replace pairs
5) Include enough context in "find" to be unique but stay under 200 chars
6) The "replace" text should flow naturally with surrounding unchanged text

WHEN TO USE insert_new:
- Use ONLY for adding entirely new sections that don't exist (e.g., adding LIMITATION OF LIABILITY)
- Do NOT use for modifying existing sections - use "modify" with changes array instead

MARS NEGOTIATING POSITIONS (apply these to edits):
- Liability: Cap at contract value, exclude consequential/indirect damages
- Indemnification: Proportionate to fault ("to the extent caused by"), add liability cap
- Termination: Payment for work performed if terminated without cause

IP/WORK PRODUCT - ONE SIMPLE RULE:
Custom work for Client = theirs. Everything else = ours. No middle ground.

WHAT CLIENT GETS:
- Custom deliverables created specifically for them under this contract

WHAT STAYS WITH CONTRACTOR (non-negotiable):
- Pre-existing IP, tools, software, methodologies, templates
- Reusable components, frameworks, libraries
- General knowledge and know-how

REMOVE these phrases - they are rights grabs:
- "irrevocably transfers" → just "assigns"
- "any and all works created pursuant to this Contract" → "custom deliverables created specifically for Client"
- "works capable of patent, copyright, trade secret protection" → DELETE
- Multiple assignment clauses → consolidate into ONE clear statement

EXAMPLE - Keep it SHORT:
{
  "find": "irrevocably transfers, assigns, sets over and conveys to FW all right, title and interest",
  "replace": "assigns to Client all right, title and interest",
  "rationale": "Remove irrevocable language"
},
{
  "find": "in any and all works created pursuant to this Contract",
  "replace": "in custom deliverables created specifically for Client. Contractor retains all rights to its pre-existing IP, tools, methodologies, templates, and reusable components",
  "rationale": "Custom work = theirs, everything else = ours"
}

EXAMPLE for a long section:
Instead of one massive replacement, use multiple targeted changes:
{
  "section_heading": "INDEMNIFICATION",
  "operation": "modify",
  "changes": [
    {
      "find": "shall indemnify and hold harmless however caused",
      "replace": "shall indemnify and hold harmless to the extent caused by Contractor's negligence",
      "rationale": "Limit to negligence"
    },
    {
      "find": "all claims, damages, losses and expenses",
      "replace": "third-party claims, damages, losses and expenses",
      "rationale": "Limit to third-party claims"
    }
  ],
  "rationale": "Multiple changes to limit indemnification scope"
}

If you cannot comply with any rule, output:
{ "edits": [], "new_sections": [], "error": "reason" }`;

// User prompt template for contract analysis
const MARS_USER_PROMPT_TEMPLATE = `Analyze this contract for MARS Company (the Contractor/Vendor). Identify material risks and output redline edits.

MANDATORY SECTIONS TO REVIEW (flag if problematic):
1. INDEMNIFICATION - Limit to negligence ("to the extent caused by"), add liability cap, remove "however caused"
2. INTELLECTUAL PROPERTY / WORK PRODUCT - Simple rule: custom work = theirs, everything else = ours
   - Remove "irrevocably" and "any and all works"
   - Change to: Client gets custom deliverables only, Contractor keeps tools/templates/pre-existing IP
3. LIMITATION OF LIABILITY - If MISSING entirely, add via "new_sections"; if unlimited, modify to add cap
4. TERMINATION - Ensure payment for work performed if terminated without cause
5. SCOPE OF WORK / SERVICES - Flag if scope is too broad or open-ended
6. CONTRACT TERM / DURATION - Flag unreasonable auto-renewal or excessive terms

CRITICAL INSTRUCTIONS:
1. Use "edits" array with "modify" operation for EXISTING sections - provide targeted find/replace pairs
2. Use "new_sections" array ONLY for adding entirely NEW sections that don't exist in the contract
3. Each "find" text MUST be < 200 characters (Word API limit)
4. Copy "find" text EXACTLY from the contract - do not modify it
5. Make "find" text unique within its section (include enough context)
6. Break long changes into multiple small find/replace pairs

SECTION HEADINGS:
- Use the EXACT section heading text from the contract (e.g., "23. INTELLECTUAL PROPERTY DEVELOPED PURSUANT TO CONTRACT")
- Include section numbers if present (e.g., "23." or "ARTICLE 5")

OUTPUT RULES:
- Return valid JSON only
- Include rationale for each change
- Do NOT make changes just for style - only for substantive risk mitigation
- If a section is acceptable, do not include it in edits

CONTRACT TEXT:
`;

// Legacy prompt for backwards compatibility (if new format fails)
const MARS_CONTRACT_PROMPT = REDLINE_SYSTEM_PROMPT;

// Focused clause analysis prompt - for re-analyzing a specific section
const FOCUSED_CLAUSE_PROMPT = `You are analyzing a SPECIFIC clause that the user wants reviewed more thoroughly.

This clause may have been previously analyzed but the user wants a DEEPER, MORE AGGRESSIVE review.
Be thorough. Find EVERY issue. Suggest STRONG protections for MARS (the Contractor).

OUTPUT FORMAT: Same JSON schema as full contract analysis.
Each "find" text MUST be < 200 characters.

MARS POSITION: Protect Contractor's interests aggressively.
- Indemnification: Limit to negligence, cap liability, third-party claims only
- IP: Custom work = Client's, everything else = Contractor's (tools, templates, pre-existing IP)
- Liability: Cap at contract value, exclude consequential damages
- Termination: Payment for work performed

Analyze this clause and output ALL recommended changes:
`;

export async function POST(request: NextRequest) {
  console.log('=== CONTRACT REVIEW API CALLED ===');
  console.log('Timestamp:', new Date().toISOString());

  try {
    const body = await request.json();
    const { text, contractId, provisionName, model, playbookContent, focusedClause, riskLevel } = body;

    // Check if this is a focused clause analysis
    const isFocusedAnalysis = focusedClause && focusedClause.text && focusedClause.name;

    // Risk level filter: 'high' (default), 'medium', or 'all'
    const analysisRiskLevel = riskLevel || 'high';

    console.log('Request received:');
    console.log('- Text length:', text?.length || 0);
    console.log('- Contract ID:', contractId || 'none');
    console.log('- Provision:', provisionName || 'none');
    console.log('- Model:', model);
    console.log('- Risk Level Filter:', analysisRiskLevel);
    console.log('- Playbook comparison:', playbookContent ? `${playbookContent.length} chars` : 'none');
    console.log('- Focused clause:', isFocusedAnalysis ? focusedClause.name : 'none');

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
    let userPrompt: string;

    if (isFocusedAnalysis) {
      // Focused clause analysis - use specialized prompt
      const normalizedClauseText = normalizeToASCII(focusedClause.text);
      userPrompt = FOCUSED_CLAUSE_PROMPT + `\n\nCLAUSE NAME: ${focusedClause.name}\n\nCLAUSE TEXT:\n${normalizedClauseText}`;
      console.log(`Focused analysis on: ${focusedClause.name} (${normalizedClauseText.length} chars)`);
    } else {
      // Full contract analysis
      userPrompt = MARS_USER_PROMPT_TEMPLATE + normalizedInput;

      // Add RAG clause context if available
      if (clauseContext) {
        userPrompt = clauseContext + '\n\n' + userPrompt;
      }

      // Add risk level filtering instructions based on analysisRiskLevel
      let riskLevelInstructions = '';
      if (analysisRiskLevel === 'all') {
        riskLevelInstructions = `
ANALYSIS DEPTH: COMPREHENSIVE (All Risks)
Include ALL deviations from MARS standard positions:
- HIGH RISK: Material issues that significantly affect MARS's interests or liability
- MEDIUM RISK: Unfavorable but not critical terms - suboptimal clauses that could be improved
- LOW RISK: Minor deviations from MARS standards - style, preference, or non-material differences

Be thorough. Find EVERY issue, even minor ones. Users want a complete review.
`;
      } else if (analysisRiskLevel === 'medium') {
        riskLevelInstructions = `
ANALYSIS DEPTH: MODERATE (High + Medium Risk)
Include HIGH and MEDIUM risk issues:
- HIGH RISK: Material issues that significantly affect MARS's interests or liability
- MEDIUM RISK: Unfavorable but not critical terms - suboptimal clauses that could be improved

Skip low-risk items that are merely preferences or style differences.
`;
      } else {
        // Default: high only
        riskLevelInstructions = `
ANALYSIS DEPTH: FOCUSED (High Risk Only)
Focus ONLY on HIGH RISK issues:
- Material issues that significantly affect MARS's interests or liability
- Terms that could cause substantial financial or legal exposure
- Provisions that fundamentally conflict with MARS's standard positions

Skip medium and low-risk items. Only flag material, high-impact issues.
`;
      }
      userPrompt = riskLevelInstructions + '\n' + userPrompt;

      // Add playbook comparison if provided
      if (playbookContent && typeof playbookContent === 'string' && playbookContent.trim().length > 0) {
        const normalizedPlaybook = normalizeToASCII(playbookContent);
        userPrompt += `\n\nPLAYBOOK COMPARISON:\nCompare against MARS's standard terms and flag deviations:\n${normalizedPlaybook}`;
        console.log('Added playbook comparison to prompt');
      }
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
      qualityIssues = validateEdits(result.edits, result.newSections, normalizedInput, result.selfCheck);

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
            qualityIssues = validateEdits(result.edits, result.newSections, normalizedInput, result.selfCheck);
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

    // BUILD modifiedText by applying heading-based edits with find/replace pairs
    // For diff generation, we apply changes to normalized text
    // For Word add-in, we store original text references in sections
    let modifiedText = normalizedInput;
    let appliedChanges = 0;
    let failedChanges: string[] = [];

    // Keep original (non-normalized) text for Word add-in
    const originalText = text; // This is the original input before normalization

    // Process section edits (modifications to existing sections)
    for (const edit of result.edits) {
      if (!edit.section_heading || !edit.changes || edit.changes.length === 0) {
        console.warn(`Skipping edit for ${edit.section_heading}: missing section_heading or changes`);
        failedChanges.push(edit.section_heading || 'Unknown');
        continue;
      }

      const sectionHeading = normalizeToASCII(edit.section_heading);
      console.log(`Processing section: ${sectionHeading} with ${edit.changes.length} changes`);

      // Find section heading in document to establish section boundaries
      const headingPos = modifiedText.toLowerCase().indexOf(sectionHeading.toLowerCase());
      if (headingPos === -1) {
        console.warn(`Could not find section heading: "${sectionHeading}"`);
        failedChanges.push(edit.section_heading);
        continue;
      }

      // Apply each find/replace pair within this section
      let sectionChangesApplied = 0;
      let originalSectionText = '';
      let revisedSectionText = '';

      for (const change of edit.changes) {
        if (!change.find || change.replace === undefined) {
          console.warn(`Skipping change in ${edit.section_heading}: missing find or replace`);
          continue;
        }

        const findText = normalizeToASCII(change.find);
        const replaceText = normalizeToASCII(change.replace);

        // Find the text in the document
        const findPos = modifiedText.indexOf(findText);
        if (findPos === -1) {
          // Try case-insensitive search
          const findPosCI = modifiedText.toLowerCase().indexOf(findText.toLowerCase());
          if (findPosCI === -1) {
            console.warn(`Could not find text in ${edit.section_heading}: "${findText.substring(0, 60)}..."`);
            continue;
          }
          // Use the case-insensitive position but keep original case
          const actualFindText = modifiedText.substring(findPosCI, findPosCI + findText.length);
          modifiedText = modifiedText.substring(0, findPosCI) + replaceText + modifiedText.substring(findPosCI + actualFindText.length);
          originalSectionText += (originalSectionText ? ' ... ' : '') + actualFindText;
          revisedSectionText += (revisedSectionText ? ' ... ' : '') + replaceText;
        } else {
          modifiedText = modifiedText.substring(0, findPos) + replaceText + modifiedText.substring(findPos + findText.length);
          originalSectionText += (originalSectionText ? ' ... ' : '') + findText;
          revisedSectionText += (revisedSectionText ? ' ... ' : '') + replaceText;
        }

        sectionChangesApplied++;
        console.log(`Applied change in ${edit.section_heading}: "${findText.substring(0, 40)}..." → "${replaceText.substring(0, 40)}..."`);
      }

      if (sectionChangesApplied > 0) {
        appliedChanges += sectionChangesApplied;

        // Update legacy section with the text for Word add-in
        const legacySection = sections.find(s => s.sectionTitle === edit.section_heading);
        if (legacySection) {
          // For the Word add-in, we need to provide the find/replace pairs
          // The frontend will handle these individually
          legacySection.originalText = originalSectionText;
          legacySection.revisedText = revisedSectionText;
        }
      } else {
        failedChanges.push(edit.section_heading);
      }
    }

    // Process new sections (insertions)
    for (const newSection of result.newSections) {
      console.log(`New section to insert: ${newSection.title} after ${newSection.insert_after}`);
      // New sections are passed through to frontend - no modification to modifiedText needed here
      // The Word add-in will handle the insertion
    }

    console.log(`Applied ${appliedChanges} changes across ${result.edits.length} sections. Failed sections: ${failedChanges.length > 0 ? failedChanges.join(', ') : 'none'}`);

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
      sections, // Structured section-by-section analysis with changes arrays
      newSections: result.newSections, // New sections to insert (separate from edits)
      hasVisibleChanges, // Flag to indicate if diff found changes
      riskScores, // Risk scoring for each section
      qualityWarnings, // Any quality issues that couldn't be auto-fixed
      retryAttempted, // Whether quality gate triggered a retry
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
