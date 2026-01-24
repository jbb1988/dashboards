import { NextRequest, NextResponse } from 'next/server';
import DiffMatchPatch from 'diff-match-patch';
import { getClauseContextForPrompt } from '@/lib/clauseRetrieval';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';

// Default model if none specified
const DEFAULT_MODEL = 'anthropic/claude-sonnet-4';

// Increase timeout for Vercel - this requires vercel.json config as well
export const maxDuration = 300; // 5 minutes max for Pro plan

// ============================================
// QUALITY GATE VALIDATION
// ============================================

interface QualityIssue {
  type: 'orphan_fragment' | 'duplicate_opening' | 'dangling_conjunction' | 'conflicting_modifiers' | 'incomplete_sentence';
  severity: 'error' | 'warning';
  description: string;
  sectionTitle?: string;
  evidence?: string;
}

interface Section {
  sectionNumber?: string;
  sectionTitle?: string;
  originalText?: string;
  revisedText?: string;
  riskLevel?: string;
  materiality?: string;
  rationale?: string;
}

/**
 * Quality Gate: Validate AI-generated sections for common issues
 * Returns list of issues found. Empty list = passed validation.
 */
function validateSections(
  sections: Section[],
  originalContract: string
): QualityIssue[] {
  const issues: QualityIssue[] = [];

  for (const section of sections) {
    if (!section.originalText || !section.revisedText) continue;

    const title = section.sectionTitle || section.sectionNumber || 'Unknown';

    // 1. Check for orphan fragments - originalText should end at a sentence boundary
    const endsWithPunctuation = /[.!?;:]\s*$/.test(section.originalText.trim());
    const endsWithClosingParen = /\)\s*$/.test(section.originalText.trim());
    if (!endsWithPunctuation && !endsWithClosingParen) {
      // Check if there's more text after in the original contract
      const originalPos = originalContract.indexOf(section.originalText);
      if (originalPos !== -1) {
        const afterText = originalContract.substring(originalPos + section.originalText.length, originalPos + section.originalText.length + 100);
        // If there's non-whitespace content immediately after, this might leave orphans
        if (afterText.trim() && !afterText.trim().startsWith('\n\n')) {
          issues.push({
            type: 'incomplete_sentence',
            severity: 'error',
            description: `originalText may not capture complete sentence - could leave orphan text`,
            sectionTitle: title,
            evidence: `Ends with: "${section.originalText.slice(-50)}" | Next in doc: "${afterText.substring(0, 50)}"`
          });
        }
      }
    }

    // 2. Check for duplicate sentence openings in revisedText
    const sentenceStarts = section.revisedText.match(/(?:^|\.\s+)([A-Z][^.]{10,40})/g) || [];
    const uniqueStarts = new Set(sentenceStarts.map(s => s.toLowerCase().trim()));
    if (sentenceStarts.length > uniqueStarts.size) {
      issues.push({
        type: 'duplicate_opening',
        severity: 'warning',
        description: `revisedText may have duplicate sentence openings`,
        sectionTitle: title
      });
    }

    // 3. Check for dangling conjunctions at paragraph start
    const danglingConjunctionPattern = /(?:^|\n\n)\s*(and\s+against|and\s+including|and\s+any|or\s+any)\s/i;
    if (danglingConjunctionPattern.test(section.revisedText)) {
      issues.push({
        type: 'dangling_conjunction',
        severity: 'error',
        description: `revisedText starts paragraph with dangling conjunction (no antecedent)`,
        sectionTitle: title,
        evidence: section.revisedText.match(danglingConjunctionPattern)?.[0]
      });
    }

    // 4. Check for conflicting modifiers (legal scope issue)
    const hasLimitedCausation = /to the extent caused by|to the extent arising from|proportionate to/i.test(section.revisedText);
    const hasUnlimitedCausation = /however caused|regardless of cause|whether or not caused/i.test(section.revisedText);
    if (hasLimitedCausation && hasUnlimitedCausation) {
      issues.push({
        type: 'conflicting_modifiers',
        severity: 'warning',
        description: `revisedText has conflicting causation language ("to the extent caused by" + "however caused")`,
        sectionTitle: title
      });
    }

    // 5. Check if revisedText is grammatically complete (basic check)
    const revisedTrimmed = section.revisedText.trim();
    if (!revisedTrimmed.endsWith('.') && !revisedTrimmed.endsWith('"') && !revisedTrimmed.endsWith(')')) {
      issues.push({
        type: 'incomplete_sentence',
        severity: 'warning',
        description: `revisedText may not be a complete sentence`,
        sectionTitle: title,
        evidence: `Ends with: "${revisedTrimmed.slice(-30)}"`
      });
    }

    // 6. Check for duplicated defined terms - e.g., (collectively "FW"...) appearing twice
    const definedTermPattern = /\(collectively\s+["'][^"']+["'][^)]*\)/gi;
    const definedTerms = section.revisedText.match(definedTermPattern) || [];
    if (definedTerms.length > 1) {
      // Check if they're the same definition
      const normalized = definedTerms.map(t => t.toLowerCase());
      const uniqueTerms = new Set(normalized);
      if (normalized.length > uniqueTerms.size) {
        issues.push({
          type: 'duplicate_opening',
          severity: 'error',
          description: `revisedText has duplicate defined term parenthetical`,
          sectionTitle: title,
          evidence: definedTerms.join(' ... ')
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

  let feedback = '\n\n=== QUALITY VALIDATION FAILED - PLEASE FIX ===\n';
  feedback += 'Your previous output had the following issues:\n\n';

  if (errorIssues.length > 0) {
    feedback += 'ERRORS (must fix):\n';
    for (const issue of errorIssues) {
      feedback += `- [${issue.sectionTitle}] ${issue.description}`;
      if (issue.evidence) feedback += `\n  Evidence: ${issue.evidence}`;
      feedback += '\n';
    }
    feedback += '\n';
  }

  if (warningIssues.length > 0) {
    feedback += 'WARNINGS (should fix):\n';
    for (const issue of warningIssues) {
      feedback += `- [${issue.sectionTitle}] ${issue.description}`;
      if (issue.evidence) feedback += `\n  Evidence: ${issue.evidence}`;
      feedback += '\n';
    }
    feedback += '\n';
  }

  feedback += `
REMINDER - TO AVOID THESE ISSUES:
1. originalText MUST include COMPLETE sentences - never stop mid-sentence
2. If original text contains "employees (collectively 'FW'...)" - include the ENTIRE parenthetical AND the sentence it's part of
3. revisedText must be a grammatically complete, standalone replacement
4. Do not use "to the extent caused by" AND "however caused" in the same clause - pick one
5. Never start a new paragraph with "and against..." without a preceding clause in the same sentence

Please regenerate your response with these issues fixed.
`;

  return feedback;
}

// ============================================
// OPENROUTER API CALL
// ============================================

interface AIResult {
  sections: Section[];
  summary: string[];
  raw: string;
}

/**
 * Call OpenRouter API with the given prompt
 * Extracted for reuse in retry logic
 */
async function callOpenRouterAPI(
  prompt: string,
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
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 8000,
      temperature: 0.2,
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
  let result;
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

  return {
    sections: Array.isArray(result.sections) ? result.sections : [],
    summary: Array.isArray(result.summary) ? result.summary : [result.summary || 'No summary'],
    raw: fullContent,
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

const MARS_CONTRACT_PROMPT = `You are an expert contract attorney reviewing agreements for MARS Company (the Contractor/Vendor). Your goal is to identify material risks and propose specific redlines.

MARS STANDARD NEGOTIATING POSITIONS:
- Liability: Cap at contract value, limit to direct damages only, exclude consequential/indirect damages
- Indemnification: Must be mutual and proportionate to fault; never indemnify for County/Client's own negligence
- IP/Work Product: MARS retains all pre-existing IP, tools, methodologies, templates; only deliverables specifically created become client property
- Termination: Require payment for work performed plus reasonable wind-down costs if terminated without cause
- Warranty: Should not exceed 1 year
- Payment: Net 30 or longer
- Audit Rights: Reasonable notice, limited frequency (annually), scope limited to records related to the agreement
- Disputes: Preserve right to legal remedies, no unilateral final decisions by client

=== MANDATORY FLAGS - ALWAYS IDENTIFY THESE ISSUES ===
You MUST flag and revise ALL of the following, regardless of how the contract is worded:

1. NO LIMITATION OF LIABILITY CLAUSE
   - If the contract lacks any limitation of liability, ADD ONE
   - Suggest: "Contractor's aggregate liability under this Agreement shall not exceed the total fees paid under this Agreement. In no event shall Contractor be liable for indirect, incidental, consequential, punitive, or special damages."

2. UNLIMITED OR UNCAPPED LIABILITY
   - Any clause that makes MARS liable without limit → Suggest cap at contract value
   - Any clause exposing MARS to consequential/indirect damages → Add exclusion

3. BROAD OR ONE-SIDED INDEMNIFICATION
   - If MARS must indemnify but Client does not → Make mutual
   - If indemnification is not proportionate to fault → Add "to the extent caused by" language
   - If contract is with MUNICIPALITY/GOVERNMENT: They legally CANNOT indemnify, so MARS MUST have a liability cap

4. FULL IP/WORK PRODUCT TRANSFER WITHOUT CARVE-OUTS
   - Any clause transferring all IP to Client → Add pre-existing IP carve-out
   - Suggested language: "Notwithstanding the foregoing, Contractor retains all rights to its pre-existing intellectual property, including tools, methodologies, templates, and know-how developed prior to or independently of this Agreement."

5. TERMINATION WITHOUT PAYMENT PROTECTION
   - If Client can terminate without paying for work performed → Add wind-down payment provision

YOUR TASK:
1. Identify ONLY sections with MATERIAL risks to MARS (skip boilerplate that's not negotiable)
2. For each material section, provide the EXACT ORIGINAL text and your REVISED text
3. Briefly explain WHY each change protects MARS

OUTPUT FORMAT:
{
  "sections": [
    {
      "sectionNumber": "6",
      "sectionTitle": "Indemnification",
      "materiality": "high",
      "riskLevel": "high",
      "originalText": "Copy the EXACT text from the contract that needs changing - must match character-for-character so we can find it",
      "revisedText": "The clean revised text WITHOUT any markdown formatting - plain text only",
      "rationale": "One sentence explaining why this change protects MARS"
    }
  ],
  "summary": [
    "[Indemnification] Made indemnity proportionate to Contractor fault",
    "[IP/Work Product] Added pre-existing IP carve-out",
    "[Liability] Capped liability at contract value"
  ]
}

MATERIALITY LEVELS:
- "high" = Must negotiate or walk away (unlimited liability, one-sided indemnity, IP ownership)
- "medium" = Should negotiate (audit scope, termination notice, dispute resolution)
- "low" = Nice to have but not dealbreaker

RISK LEVELS (for riskLevel field):
- "high" (Red) = Changes to liability, indemnification, IP/work product, termination for cause, insurance requirements
- "medium" (Yellow) = Changes to payment terms, warranties, confidentiality periods, audit rights, dispute resolution
- "low" (Green) = Formatting changes, word choices, minor clarifications, notice periods, standard boilerplate

CRITICAL RULES:
- Only flag sections that are MATERIALLY unfavorable - skip standard government boilerplate
- The "originalText" MUST be copied EXACTLY from the contract - character for character - so it can be found and replaced
- The "revisedText" must be PLAIN TEXT with NO markdown (no ** or ~~ or any formatting)
- Keep changes surgical and minimal - only change what's necessary
- PRESERVE ALL SPECIAL CHARACTERS exactly as they appear: § (section symbol), ¶ (paragraph symbol), © ® ™, and all legal citation formats

CRITICAL - COMPLETE TEXT REPLACEMENT (READ CAREFULLY):
These rules prevent broken documents with orphan text fragments:

1. COMPLETE SENTENCES ONLY
   - originalText MUST end at a sentence boundary (period, semicolon, or section break)
   - If a sentence contains "employees (collectively 'FW' for purposes of this section)" - include the ENTIRE sentence through to its period
   - NEVER stop mid-parenthetical or mid-definition

2. NO ORPHAN FRAGMENTS
   - After your replacement, NO leftover words should remain from the original
   - If original text is "The Contractor covenants... from and against any claims" - you must include ALL of it
   - CHECK: What comes AFTER your originalText in the contract? If it's "and against..." or other continuation, expand originalText

3. GRAMMATICALLY COMPLETE REPLACEMENTS
   - revisedText must read as a complete, standalone paragraph
   - No paragraph should start with "and against...", "and including...", "or any..." without an antecedent in the same sentence
   - The first word after a period should make sense as a new sentence

4. NO CONFLICTING MODIFIERS
   - Do NOT use both "to the extent caused by [negligence]" AND "however caused" in the same obligation
   - These are logically contradictory - pick ONE scope of liability

5. SINGLE DEFINITIONS
   - Defined terms like "(collectively 'FW' for purposes of this section)" should appear ONCE per clause
   - If your revision duplicates a definition, you've captured too little of the original

6. SELF-TEST BEFORE OUTPUT
   - Read your revisedText aloud - does it flow grammatically from start to finish?
   - Imagine pasting revisedText into the document in place of originalText - would any words be left over?
   - If YES to leftover words, expand originalText to include them

=== SELF-CHECK BEFORE OUTPUTTING ===
Before returning your response, verify for EACH section:
1. Does the revisedText BENEFIT MARS (the Contractor)? If it benefits the Client more, reconsider.
2. Does the revision LIMIT MARS's liability or exposure? If it increases liability, reconsider.
3. Does the revision PROTECT MARS's IP and pre-existing work? If it gives more away, reconsider.
4. For government/municipality contracts: Is there a liability cap? There MUST be one since they cannot indemnify.

IMPORTANT: Your response must be ONLY a JSON object. No explanations, no markdown, no text before or after. Start your response with { and end with }

CONTRACT:
`;

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
    // This provides the AI with concrete examples of MARS's approved language
    let clauseContext = '';
    try {
      clauseContext = await getClauseContextForPrompt(false); // false = only critical categories
      if (clauseContext) {
        console.log(`RAG: Injecting ${clauseContext.length} chars of approved clause context`);
      } else {
        console.log('RAG: No approved clauses found in database');
      }
    } catch (ragError) {
      console.error('RAG: Error fetching clause context (continuing without):', ragError);
    }

    // Build the full prompt - include clause context (RAG) and optionally playbook comparison
    let fullPrompt = MARS_CONTRACT_PROMPT + clauseContext + normalizedInput;

    if (playbookContent && typeof playbookContent === 'string' && playbookContent.trim().length > 0) {
      const normalizedPlaybook = normalizeToASCII(playbookContent);
      const playbookComparisonPrompt = `

PLAYBOOK COMPARISON:
The following is MARS's standard agreement template (playbook). Compare the contract above against this playbook and highlight any deviations from MARS's standard terms. Prioritize flagging clauses where the counterparty's version is LESS favorable than MARS's standard position.

MARS PLAYBOOK:
${normalizedPlaybook}

When analyzing, note in the rationale if a change brings the contract CLOSER to MARS standard terms (good) or FURTHER from them (concerning).`;

      fullPrompt = MARS_CONTRACT_PROMPT + clauseContext + normalizedInput + playbookComparisonPrompt;
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
      console.log('=== PASS 1: Initial AI Analysis ===');
      result = await callOpenRouterAPI(fullPrompt, openRouterModel);
      console.log(`Pass 1 completed in ${(Date.now() - startTime) / 1000}s`);
      console.log(`Pass 1 sections: ${result.sections.length}, summary items: ${result.summary.length}`);

      // Run quality gates on the result
      qualityIssues = validateSections(result.sections, normalizedInput);

      if (qualityIssues.length > 0) {
        const errorCount = qualityIssues.filter(i => i.severity === 'error').length;
        const warningCount = qualityIssues.filter(i => i.severity === 'warning').length;
        console.log(`Quality gate: ${errorCount} errors, ${warningCount} warnings`);

        // If there are errors (not just warnings), retry
        if (errorCount > 0) {
          console.log('=== PASS 2: Retry with Quality Feedback ===');
          retryAttempted = true;

          // Build retry prompt with feedback about what went wrong
          const qualityFeedback = formatQualityFeedback(qualityIssues);
          const retryPrompt = fullPrompt + qualityFeedback;

          try {
            const retryStartTime = Date.now();
            result = await callOpenRouterAPI(retryPrompt, openRouterModel);
            console.log(`Pass 2 completed in ${(Date.now() - retryStartTime) / 1000}s`);
            console.log(`Pass 2 sections: ${result.sections.length}, summary items: ${result.summary.length}`);

            // Re-validate after retry
            qualityIssues = validateSections(result.sections, normalizedInput);
            const retryErrorCount = qualityIssues.filter(i => i.severity === 'error').length;
            const retryWarningCount = qualityIssues.filter(i => i.severity === 'warning').length;
            console.log(`Quality gate (retry): ${retryErrorCount} errors, ${retryWarningCount} warnings`);

            if (retryErrorCount > 0) {
              console.warn('Quality issues persist after retry - proceeding with warnings');
            }
          } catch (retryError) {
            console.error('Retry failed:', retryError);
            // Continue with original result if retry fails
          }
        }
      } else {
        console.log('Quality gate: PASSED (no issues)');
      }
    } catch (apiError) {
      console.error('=== OPENROUTER API ERROR ===');
      console.error('Error:', apiError);
      console.error('Model Used:', openRouterModel);
      console.error('Input Length:', normalizedInput.length, 'chars');
      console.error('============================');
      return NextResponse.json(
        { error: apiError instanceof Error ? apiError.message : 'AI analysis failed' },
        { status: 500 }
      );
    }

    console.log(`Total analysis time: ${(Date.now() - startTime) / 1000}s (retry: ${retryAttempted})`);

    // Use the result
    const sections = result.sections;

    // BUILD modifiedText ourselves by applying section changes
    // This is much faster than having Claude output the entire 50K+ document
    let modifiedText = normalizedInput;
    let appliedChanges = 0;
    let failedChanges: string[] = [];

    for (const section of sections) {
      if (section.originalText && section.revisedText) {
        // Clean up the revised text (remove any markdown that slipped through)
        let cleanRevised = section.revisedText
          .replace(/\*\*([^*]+)\*\*/g, '$1')  // Remove **bold** markers
          .replace(/~~([^~]+)~~/g, '');        // Remove ~~strikethrough~~ content entirely

        // Normalize both for matching
        const normalizedOriginal = normalizeToASCII(section.originalText);
        cleanRevised = normalizeToASCII(cleanRevised);

        // Try to find and replace
        if (modifiedText.includes(normalizedOriginal)) {
          modifiedText = modifiedText.replace(normalizedOriginal, cleanRevised);
          appliedChanges++;
          console.log(`Applied change to section: ${section.sectionTitle || section.sectionNumber}`);
        } else {
          // Try fuzzy match - sometimes whitespace differs
          const fuzzyOriginal = normalizedOriginal.replace(/\s+/g, ' ').trim();
          const fuzzyModified = modifiedText.replace(/\s+/g, ' ');

          if (fuzzyModified.includes(fuzzyOriginal)) {
            // Found with fuzzy match - apply change
            const regex = new RegExp(escapeRegExp(normalizedOriginal).replace(/\\s+/g, '\\s+'), 'g');
            const before = modifiedText;
            modifiedText = modifiedText.replace(regex, cleanRevised);
            if (modifiedText !== before) {
              appliedChanges++;
              console.log(`Applied change (fuzzy) to section: ${section.sectionTitle || section.sectionNumber}`);
            } else {
              failedChanges.push(section.sectionTitle || section.sectionNumber || 'Unknown');
            }
          } else {
            failedChanges.push(section.sectionTitle || section.sectionNumber || 'Unknown');
            console.warn(`Could not find originalText for section: ${section.sectionTitle || section.sectionNumber}`);
            console.warn(`Looking for (first 100 chars): ${normalizedOriginal.substring(0, 100)}`);
          }
        }
      }
    }

    console.log(`Applied ${appliedChanges}/${sections.length} changes. Failed: ${failedChanges.length > 0 ? failedChanges.join(', ') : 'none'}`);

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
      ? remainingWarnings.map(w => `[${w.sectionTitle}] ${w.description}`)
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
