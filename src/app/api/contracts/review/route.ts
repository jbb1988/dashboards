import { NextRequest, NextResponse } from 'next/server';
import DiffMatchPatch from 'diff-match-patch';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';

// Default model if none specified
const DEFAULT_MODEL = 'anthropic/claude-sonnet-4';

// Increase timeout for Vercel - this requires vercel.json config as well
export const maxDuration = 300; // 5 minutes max for Pro plan

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

IMPORTANT: Your response must be ONLY a JSON object. No explanations, no markdown, no text before or after. Start your response with { and end with }

CONTRACT:
`;

export async function POST(request: NextRequest) {
  console.log('=== CONTRACT REVIEW API CALLED ===');
  console.log('Timestamp:', new Date().toISOString());

  try {
    const body = await request.json();
    const { text, contractId, provisionName, model = 'sonnet', playbookContent } = body;

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

    // Build the full prompt - optionally include playbook comparison
    let fullPrompt = MARS_CONTRACT_PROMPT + normalizedInput;

    if (playbookContent && typeof playbookContent === 'string' && playbookContent.trim().length > 0) {
      const normalizedPlaybook = normalizeToASCII(playbookContent);
      const playbookComparisonPrompt = `

PLAYBOOK COMPARISON:
The following is MARS's standard agreement template (playbook). Compare the contract above against this playbook and highlight any deviations from MARS's standard terms. Prioritize flagging clauses where the counterparty's version is LESS favorable than MARS's standard position.

MARS PLAYBOOK:
${normalizedPlaybook}

When analyzing, note in the rationale if a change brings the contract CLOSER to MARS standard terms (good) or FURTHER from them (concerning).`;

      fullPrompt = MARS_CONTRACT_PROMPT + normalizedInput + playbookComparisonPrompt;
      console.log('Added playbook comparison to prompt');
    }

    // Call OpenRouter API - use model ID directly from frontend
    const openRouterModel = model || DEFAULT_MODEL;
    console.log(`Starting OpenRouter analysis with model: ${openRouterModel}...`);
    const startTime = Date.now();

    // Use streaming to prevent timeout on large contracts
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://mars-contracts.vercel.app',
        'X-Title': 'MARS Contract Review',
      },
      body: JSON.stringify({
        model: openRouterModel,
        messages: [
          {
            role: 'user',
            content: fullPrompt,
          },
        ],
        max_tokens: 8000,  // Reduced - no longer outputting full document
        temperature: 0.2,
        stream: true, // Enable streaming to prevent timeout
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('=== OPENROUTER API ERROR ===');
      console.error('Status:', response.status);
      console.error('Status Text:', response.statusText);
      console.error('Response Body:', errorText);
      console.error('Model Used:', openRouterModel);
      console.error('Input Length:', normalizedInput.length, 'chars');
      console.error('============================');
      return NextResponse.json(
        { error: `AI analysis failed (${response.status}): ${errorText.substring(0, 200)}` },
        { status: 500 }
      );
    }

    // Collect streamed response chunks
    const reader = response.body?.getReader();
    if (!reader) {
      return NextResponse.json(
        { error: 'Failed to get response stream' },
        { status: 500 }
      );
    }

    const decoder = new TextDecoder();
    let fullContent = '';
    let chunkCount = 0;

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
                chunkCount++;
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

    console.log(`Received ${chunkCount} chunks, total content: ${fullContent.length} chars`);
    const stdout = fullContent;
    if (!stdout) {
      console.error('=== OPENROUTER EMPTY RESPONSE ===');
      console.error('No content in streamed AI response');
      console.error('Chunk count:', chunkCount);
      console.error('=================================');
      return NextResponse.json(
        { error: 'AI returned empty response. Please try again.' },
        { status: 500 }
      );
    }

    console.log(`OpenRouter completed in ${(Date.now() - startTime) / 1000}s`);
    console.log('Raw output length:', stdout.length);

    // Parse the response
    let result;
    try {
      // Try to extract JSON from the response - find the outermost { }
      let jsonStr = stdout.trim();

      // Strip markdown code blocks if present
      jsonStr = jsonStr.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '');

      // Find JSON object boundaries - look for the structure we expect
      const firstBrace = jsonStr.indexOf('{');
      const lastBrace = jsonStr.lastIndexOf('}');

      if (firstBrace !== -1 && lastBrace > firstBrace) {
        jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);

        // Try to parse
        try {
          result = JSON.parse(jsonStr);
        } catch {
          // If direct parse fails, try to fix common issues
          // Sometimes there are unescaped newlines in strings
          jsonStr = jsonStr.replace(/[\r\n]+/g, '\\n');
          result = JSON.parse(jsonStr);
        }

        console.log('Successfully parsed JSON response');
        console.log('Fields in result:', Object.keys(result));
        console.log('sections count:', result.sections?.length || 0);
        console.log('summary count:', result.summary?.length || 0);
      } else {
        // No JSON found - maybe the AI returned text. Try to extract any useful info
        console.log('No JSON braces found. Raw output:', stdout.substring(0, 1000));
        throw new Error('No JSON object found in response');
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.log('Raw output preview:', stdout.substring(0, 500));

      // If JSON parsing fails, return error with more context
      return NextResponse.json(
        { error: 'AI did not return valid JSON. Try selecting "Quick" mode or try again.' },
        { status: 500 }
      );
    }

    // Ensure summary is an array
    if (!Array.isArray(result.summary)) {
      result.summary = [result.summary || 'No summary provided'];
    }

    // Ensure sections is an array
    const sections = Array.isArray(result.sections) ? result.sections : [];

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

    return NextResponse.json({
      redlinedText,
      originalText: normalizedInput,  // Normalized for ORIGINAL-PLAIN.docx
      modifiedText,                    // Normalized for REVISED.docx
      summary: result.summary,
      sections, // NEW: Structured section-by-section analysis
      hasVisibleChanges, // NEW: Flag to indicate if diff found changes
      riskScores, // NEW: Risk scoring for each section
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
