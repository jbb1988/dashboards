import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FluentProvider,
  webDarkTheme,
  Button,
  Spinner,
  Badge,
  Tab,
  TabList,
  Card,
  CardHeader,
  Text,
  Textarea,
  Accordion,
  AccordionItem,
  AccordionHeader,
  AccordionPanel,
  tokens,
} from '@fluentui/react-components';
import {
  DocumentSearch24Regular,
  Shield24Regular,
  Library24Regular,
  Send24Regular,
  CheckmarkCircle24Filled,
  Warning24Filled,
  DismissCircle24Filled,
  ArrowSync24Regular,
  Person24Regular,
} from '@fluentui/react-icons';

// ============================================
// PREMIUM LOADING COMPONENTS
// Enterprise-grade, minimal, intentional
// ============================================

// CSS Keyframes injected into document
const injectKeyframes = () => {
  if (typeof document !== 'undefined' && !document.getElementById('premium-loader-keyframes')) {
    const style = document.createElement('style');
    style.id = 'premium-loader-keyframes';
    style.textContent = `
      @keyframes premium-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      @keyframes premium-shimmer {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(200%); }
      }
      @keyframes premium-fade-in {
        0% { opacity: 0; }
        100% { opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }
};

// Premium Thin Stroke Spinner - Option A (Preferred)
const PremiumSpinner: React.FC<{ size?: number; color?: string }> = ({
  size = 16,
  color = 'rgba(148, 163, 184, 0.6)'
}) => {
  React.useEffect(() => { injectKeyframes(); }, []);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: `1.5px solid ${color}`,
        borderTopColor: 'transparent',
        animation: 'premium-spin 1.2s linear infinite',
        flexShrink: 0,
      }}
    />
  );
};

// Premium Progress Bar - Option B (Alternative)
const PremiumProgressBar: React.FC<{ show: boolean }> = ({ show }) => {
  React.useEffect(() => { injectKeyframes(); }, []);

  if (!show) return null;

  return (
    <div
      style={{
        width: '100%',
        height: 2,
        backgroundColor: 'rgba(148, 163, 184, 0.1)',
        borderRadius: 1,
        overflow: 'hidden',
        opacity: 0.4,
        animation: 'premium-fade-in 150ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <div
        style={{
          width: '40%',
          height: '100%',
          background: 'linear-gradient(90deg, transparent, rgba(96, 165, 250, 0.6), transparent)',
          animation: 'premium-shimmer 2.5s ease-in-out infinite',
        }}
      />
    </div>
  );
};

// Types
interface MatchedClause {
  id: string;
  name: string;
  category: string;
  category_id: string;
  risk_level: string;
  primary_text: string;
  fallback_text: string | null;
  last_resort_text: string | null;
}

interface RiskItem {
  id: string;
  type: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  suggestion: string;
  location?: string;
  context_before?: string;
  context_after?: string;
  matched_clause?: MatchedClause | null;
}

interface ClauseSuggestion {
  id: string;
  name: string;
  category: string;
  risk_level: string;
  primary_text: string;
  fallback_text?: string;
}

interface SearchMatch {
  range: Word.Range;
  text: string;
  context: string;
  confidence: number;
  matchType: 'exact' | 'normalized' | 'wildcard' | 'fuzzy' | 'truncated' | 'section_heading';
}

interface PreviewState {
  isOpen: boolean;
  originalText: string;
  newText: string;
  matches: SearchMatch[];
  selectedMatchIndex: number;
  riskId: string;
  clauseType: 'primary' | 'fallback' | 'last_resort' | 'suggestion';
  sectionTitle?: string;
}

// Legacy interface - kept for compatibility with clause library
interface AnalysisResult {
  overall_risk_score: number;
  risk_level: string;
  risks: RiskItem[];
  clause_suggestions: ClauseSuggestion[];
  summary: string;
}

// Change interface for targeted find/replace pairs
interface SectionChange {
  find: string;      // Text to find (< 255 chars for Word API)
  replace: string;   // Replacement text
  rationale?: string;
}

// New section to insert
interface NewSection {
  operation: 'insert_new';
  title: string;
  insert_after: string;
  content: string;
  rationale: string;
}

// New interface matching dashboard API response
interface DashboardSection {
  sectionNumber: string;
  sectionTitle: string;
  riskLevel: 'high' | 'medium' | 'low';
  originalText: string;
  revisedText: string;
  rationale: string;
  // New fields for heading-based approach
  changes?: SectionChange[];  // Array of find/replace pairs
  isNewSection?: boolean;     // True if this is a new section to insert
  insertAfter?: string;       // Section heading after which to insert
  // Fields for "Analyze Selection" feature
  fromSelection?: boolean;          // True if this came from analyzeSelection
  originalSelectedText?: string;    // The exact text that was selected (for direct search)
}

interface DashboardAnalysisResult {
  redlinedText: string;
  originalText: string;
  modifiedText: string;
  summary: string[];
  sections: DashboardSection[];
  newSections?: NewSection[];  // New sections to insert (separate from edits)
  hasVisibleChanges: boolean;
  riskScores: {
    summary: { high: number; medium: number; low: number };
    sections: { sectionTitle: string; riskLevel: string }[];
  };
}

interface User {
  email: string;
  name: string;
}

// Contract from Salesforce for linking
interface Contract {
  id: string;
  name: string;
  salesforceId?: string;
  contractType?: string[];
  value?: number;
  status?: string;
}

// Office.js types are loaded from @types/office-js
// Office.js library is loaded from CDN in HTML
declare const Office: typeof globalThis.Office;
declare const Word: typeof globalThis.Word;

const API_BASE = process.env.NODE_ENV === 'production'
  ? 'https://mars-dashboards.vercel.app'
  : 'http://localhost:3000';

// ============================================
// TEXT NORMALIZATION ENGINE
// ============================================

/**
 * Normalizes text to handle common mismatches between AI-extracted text and document text
 */
function normalizeText(text: string): string {
  return text
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')  // Smart double quotes → straight
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")  // Smart single quotes → straight
    .replace(/[\u2013\u2014\u2015]/g, '-')        // En-dash, em-dash, horizontal bar → hyphen
    .replace(/[\u00A0\u2007\u202F]/g, ' ')        // Non-breaking spaces → regular space
    .replace(/[\u2026]/g, '...')                   // Ellipsis → three dots
    .replace(/[\r\n]+/g, ' ')                      // Newlines → space
    .replace(/\s+/g, ' ')                          // Collapse multiple spaces
    .trim();
}

/**
 * Extracts a unique phrase from text for precise searching
 * Takes the first 2-3 sentences or up to 200 chars at a word boundary
 */
function getSearchablePhrase(text: string, maxLen: number = 200): string {
  // Normalize and get first portion
  const normalized = normalizeText(text);
  if (normalized.length <= maxLen) return normalized;

  // Find a good break point (end of sentence or word boundary)
  const truncated = normalized.substring(0, maxLen);
  const lastSentence = truncated.lastIndexOf('. ');
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSentence > maxLen * 0.5) {
    return truncated.substring(0, lastSentence + 1);
  }
  if (lastSpace > maxLen * 0.7) {
    return truncated.substring(0, lastSpace);
  }
  return truncated;
}

/**
 * Finds the full range of originalText in the document using a robust search strategy.
 * Works even for text longer than Word's 255-char search limit.
 *
 * STRATEGY:
 * 1. Try to find by SECTION HEADING first (most reliable for long sections)
 * 2. For short text (<200 chars): Direct search
 * 3. For long text: Find start, then search for end phrase AFTER start position
 * 4. CRITICAL: Validate that found range matches expected text before returning
 */
async function findFullRange(
  context: Word.RequestContext,
  originalText: string,
  sectionTitle?: string
): Promise<Word.Range | null> {
  const normalized = normalizeText(originalText);
  const expectedLength = normalized.length;

  console.log(`findFullRange: searching for text of length ${expectedLength}, section: ${sectionTitle || 'unknown'}`);

  // STRATEGY 1: Try to find by section heading first (most reliable)
  // Section headings are typically unique and in ALL CAPS
  if (sectionTitle && sectionTitle.length > 3) {
    console.log(`findFullRange: trying section heading search for "${sectionTitle}"`);

    const headingResults = context.document.body.search(sectionTitle, {
      matchCase: false,
      matchWholeWord: false,
    });
    headingResults.load('items');
    await context.sync();

    if (headingResults.items.length > 0) {
      console.log(`findFullRange: found ${headingResults.items.length} heading matches`);

      // For each heading match, try to expand to capture the full section
      for (const headingRange of headingResults.items) {
        // Get paragraphs starting from this heading
        // We need to expand forward to capture the section content
        const headingPara = headingRange.paragraphs.getFirst();
        headingPara.load('text');
        await context.sync();

        // Get the range from heading to end of document, then search for our end phrase
        const endPhrase = normalized.slice(-80);
        const afterHeading = headingRange.getRange('After');
        const searchInSection = afterHeading.search(endPhrase, {
          matchCase: false,
          matchWholeWord: false,
        });
        searchInSection.load('items');
        await context.sync();

        if (searchInSection.items.length > 0) {
          // Expand from heading to the end phrase
          const fullRange = headingRange.expandToOrNullObject(searchInSection.items[0]);
          await context.sync();

          if (!fullRange.isNullObject) {
            fullRange.load('text');
            await context.sync();

            const foundLength = normalizeText(fullRange.text).length;
            const lengthDiff = Math.abs(foundLength - expectedLength) / expectedLength;

            console.log(`findFullRange: heading-based range has ${foundLength} chars, expected ${expectedLength}, diff ${(lengthDiff * 100).toFixed(1)}%`);

            // Accept if within 25% of expected length
            if (lengthDiff < 0.25) {
              console.log('findFullRange: SUCCESS via section heading search');
              return fullRange;
            }
          }
        }
      }
      console.log('findFullRange: heading search found matches but could not expand to full section');
    } else {
      console.log('findFullRange: section heading not found in document');
    }
  }

  // For short text, search directly
  if (normalized.length <= 200) {
    const results = context.document.body.search(normalized, {
      matchCase: false,
      matchWholeWord: false,
    });
    results.load('items');
    await context.sync();
    if (results.items.length > 0) {
      console.log('findFullRange: found via direct search');
      return results.items[0];
    }
    console.log('findFullRange: direct search failed');
    return null;
  }

  // For long text, use improved bookend search
  // Use first 150 chars to find start position
  const startPhrase = normalized.substring(0, 150);
  // Use last 100 chars for end (smaller to be more precise)
  const endPhrase = normalized.slice(-100);
  // Also grab a unique phrase from the middle for validation
  const middleStart = Math.floor(normalized.length / 2) - 50;
  const middlePhrase = normalized.substring(middleStart, middleStart + 80);

  console.log('findFullRange: start phrase:', startPhrase.substring(0, 40) + '...');
  console.log('findFullRange: end phrase:', '...' + endPhrase.slice(-40));

  // Step 1: Find start position
  const startResults = context.document.body.search(startPhrase, {
    matchCase: false,
    matchWholeWord: false,
  });
  startResults.load('items');
  await context.sync();

  if (startResults.items.length === 0) {
    console.log('findFullRange: start phrase not found, trying shorter phrase');
    // Try with shorter start phrase
    const shorterStart = normalized.substring(0, 80);
    const shortResults = context.document.body.search(shorterStart, {
      matchCase: false,
      matchWholeWord: false,
    });
    shortResults.load('items');
    await context.sync();
    if (shortResults.items.length === 0) {
      console.log('findFullRange: could not find start position');
      return null;
    }
  }

  const startRange = startResults.items[0];

  // Step 2: Find end position - search from start range forward
  const endResults = context.document.body.search(endPhrase, {
    matchCase: false,
    matchWholeWord: false,
  });
  endResults.load('items');
  await context.sync();

  if (endResults.items.length === 0) {
    console.log('findFullRange: end phrase not found');
    return null;
  }

  // Find the end range that comes AFTER our start range
  let bestEndRange: Word.Range | null = null;
  let bestDistance = Infinity;

  for (const candidate of endResults.items) {
    const comparison = startRange.compareLocationWith(candidate);
    await context.sync();

    // End must be after or overlapping with start
    if (comparison.value === 'Before' || comparison.value === 'AdjacentBefore' || comparison.value === 'Contains') {
      // Calculate approximate distance based on expected text length
      // We want the end range that would give us closest to expected length
      const testRange = startRange.expandToOrNullObject(candidate);
      await context.sync();

      if (!testRange.isNullObject) {
        testRange.load('text');
        await context.sync();

        const testLength = testRange.text.length;
        const distance = Math.abs(testLength - expectedLength);

        console.log(`findFullRange: candidate end gives length ${testLength}, distance from expected: ${distance}`);

        if (distance < bestDistance) {
          bestDistance = distance;
          bestEndRange = candidate;
        }

        // If we found an exact or very close match, use it
        if (distance < expectedLength * 0.05) {
          console.log('findFullRange: found close match, using this end range');
          break;
        }
      }
    }
  }

  if (!bestEndRange) {
    console.log('findFullRange: no valid end range found after start');
    return null;
  }

  // Step 3: Create the full range
  const fullRange = startRange.expandToOrNullObject(bestEndRange);
  await context.sync();

  if (fullRange.isNullObject) {
    console.log('findFullRange: expandTo failed');
    return null;
  }

  // Step 4: CRITICAL VALIDATION - check that found text matches expected
  fullRange.load('text');
  await context.sync();

  const foundText = fullRange.text;
  const foundNormalized = normalizeText(foundText);
  const foundLength = foundNormalized.length;
  const lengthDiff = Math.abs(foundLength - expectedLength) / expectedLength;

  console.log(`findFullRange: found length ${foundLength}, expected ${expectedLength}, diff ${(lengthDiff * 100).toFixed(1)}%`);

  // Check if found text ends correctly (this catches the orphan text problem)
  const expectedEnding = normalized.slice(-50);
  const foundEnding = foundNormalized.slice(-50);
  const endingsMatch = foundEnding === expectedEnding || foundNormalized.endsWith(expectedEnding);

  console.log(`findFullRange: expected ending: "${expectedEnding.slice(-30)}"`);
  console.log(`findFullRange: found ending: "${foundEnding.slice(-30)}"`);
  console.log(`findFullRange: endings match: ${endingsMatch}`);

  // Also check if found text contains the middle phrase (validates we have the right section)
  const hasMiddle = foundNormalized.includes(middlePhrase) || foundNormalized.includes(normalizeText(middlePhrase));

  if (endingsMatch && hasMiddle && lengthDiff < 0.20) {
    console.log('findFullRange: validation passed');
    return fullRange;
  }

  // Validation failed - try to fix by extending to paragraph boundaries
  console.log('findFullRange: validation failed, attempting paragraph extension');

  // Get all paragraphs that our range touches
  const paragraphs = fullRange.paragraphs;
  paragraphs.load('items');
  await context.sync();

  if (paragraphs.items.length > 0) {
    // Try extending to include full paragraphs
    const firstPara = paragraphs.items[0];
    const lastPara = paragraphs.items[paragraphs.items.length - 1];

    // Get the range spanning from first to last paragraph
    const extendedRange = firstPara.getRange('Whole').expandToOrNullObject(lastPara.getRange('Whole'));
    await context.sync();

    if (!extendedRange.isNullObject) {
      extendedRange.load('text');
      await context.sync();

      const extendedNormalized = normalizeText(extendedRange.text);

      // Check if extended range contains our expected text
      if (extendedNormalized.includes(normalized)) {
        console.log('findFullRange: extended range contains expected text');
        // We need to return just the portion that matches, not the whole paragraph
        // Since we can't easily trim, return the original range with a warning
        console.warn('findFullRange: using original range despite mismatch - manual review recommended');
        return fullRange;
      }
    }
  }

  // Last resort: return what we have but log strong warning
  console.error('findFullRange: CRITICAL - range may not match expected text, replacement may leave orphan text');
  console.error(`findFullRange: Expected ending: "${expectedEnding}"`);
  console.error(`findFullRange: Found ending: "${foundEnding}"`);

  // Return null to prevent incorrect replacement
  // This is safer than replacing with wrong range and leaving orphan text
  if (!endingsMatch) {
    console.error('findFullRange: refusing to return mismatched range');
    return null;
  }

  return fullRange;
}

/**
 * Finds a section in the document by its heading and returns the range.
 * This is the primary search method - headings are short and unique.
 *
 * @param context Word.RequestContext
 * @param heading Section heading to find (e.g., "INDEMNIFICATION")
 * @returns The Range containing the heading, or null if not found
 */
async function findSectionByHeading(
  context: Word.RequestContext,
  heading: string
): Promise<Word.Range | null> {
  const normalizedHeading = normalizeText(heading);
  console.log(`findSectionByHeading: searching for "${normalizedHeading}"`);

  // Strategy 1: Exact match (most reliable)
  const exactResults = context.document.body.search(heading, {
    matchCase: false,
    matchWholeWord: false,
  });
  exactResults.load('items');
  await context.sync();

  if (exactResults.items.length > 0) {
    console.log(`findSectionByHeading: found ${exactResults.items.length} exact matches`);
    // Return the first match - headings should be unique
    return exactResults.items[0];
  }

  // Strategy 2: Try normalized version
  const normalizedResults = context.document.body.search(normalizedHeading, {
    matchCase: false,
    matchWholeWord: false,
  });
  normalizedResults.load('items');
  await context.sync();

  if (normalizedResults.items.length > 0) {
    console.log(`findSectionByHeading: found ${normalizedResults.items.length} normalized matches`);
    return normalizedResults.items[0];
  }

  // Strategy 3: Try partial match (first significant words)
  const words = normalizedHeading.split(/\s+/).filter(w => w.length > 2);
  if (words.length >= 2) {
    const partialSearch = words.slice(0, 3).join(' ');
    const partialResults = context.document.body.search(partialSearch, {
      matchCase: false,
      matchWholeWord: false,
    });
    partialResults.load('items');
    await context.sync();

    if (partialResults.items.length > 0) {
      console.log(`findSectionByHeading: found ${partialResults.items.length} partial matches for "${partialSearch}"`);
      return partialResults.items[0];
    }
  }

  console.log(`findSectionByHeading: could not find heading "${heading}"`);
  return null;
}

/**
 * Applies an array of find/replace changes within a section.
 * Each change's find text must be < 255 chars for Word API.
 *
 * @param context Word.RequestContext
 * @param sectionHeading The section heading (used to scope the search)
 * @param changes Array of find/replace pairs
 * @returns Number of changes successfully applied
 */
async function applyChangesToSection(
  context: Word.RequestContext,
  sectionHeading: string,
  changes: SectionChange[],
  trackChangesEnabled: boolean
): Promise<number> {
  let appliedCount = 0;

  for (const change of changes) {
    if (!change.find || change.replace === undefined) {
      console.warn(`Skipping change: missing find or replace`);
      continue;
    }

    // Word API has 255 char limit - truncate if needed but warn
    let searchText = change.find;
    if (searchText.length > 250) {
      console.warn(`Find text is ${searchText.length} chars, truncating to 250`);
      searchText = searchText.substring(0, 250);
    }

    // Search for the text in the document
    const results = context.document.body.search(searchText, {
      matchCase: false,
      matchWholeWord: false,
    });
    results.load('items');
    await context.sync();

    if (results.items.length === 0) {
      // Try normalized version
      const normalizedSearch = normalizeText(searchText);
      if (normalizedSearch !== searchText && normalizedSearch.length <= 250) {
        const normalizedResults = context.document.body.search(normalizedSearch, {
          matchCase: false,
          matchWholeWord: false,
        });
        normalizedResults.load('items');
        await context.sync();

        if (normalizedResults.items.length > 0) {
          const range = normalizedResults.items[0];
          const newRange = range.insertText(change.replace, Word.InsertLocation.replace);
          if (!trackChangesEnabled) {
            newRange.font.underline = Word.UnderlineType.single;
            newRange.font.color = '#16A34A';
          }
          await context.sync();
          appliedCount++;
          console.log(`Applied change (normalized): "${searchText.substring(0, 40)}..." → "${change.replace.substring(0, 40)}..."`);
          continue;
        }
      }
      console.warn(`Could not find text: "${searchText.substring(0, 60)}..."`);
      continue;
    }

    // Apply the replacement to the first match
    const range = results.items[0];
    const newRange = range.insertText(change.replace, Word.InsertLocation.replace);

    // If Track Changes is not available, apply visual highlighting
    if (!trackChangesEnabled) {
      newRange.font.underline = Word.UnderlineType.single;
      newRange.font.color = '#16A34A';
    }

    await context.sync();
    appliedCount++;
    console.log(`Applied change: "${searchText.substring(0, 40)}..." → "${change.replace.substring(0, 40)}..."`);
  }

  return appliedCount;
}

/**
 * Inserts a new section after a specified section heading.
 * Uses multiple search strategies to find the insertion point.
 *
 * @param context Word.RequestContext
 * @param afterHeading Section heading after which to insert
 * @param newSectionContent Complete content of the new section
 * @param trackChangesEnabled Whether Track Changes is enabled
 * @returns Object with success status and error message if failed
 */
async function insertNewSection(
  context: Word.RequestContext,
  afterHeading: string,
  newSectionContent: string,
  trackChangesEnabled: boolean
): Promise<{ success: boolean; error?: string }> {
  console.log(`insertNewSection: inserting after "${afterHeading}"`);

  // Strategy 1: Try exact match first
  let headingRange = await findSectionByHeading(context, afterHeading);

  // Strategy 2: Try with just the key word (e.g., "INDEMNIFICATION" from "23. INDEMNIFICATION")
  if (!headingRange) {
    const keyWord = afterHeading.replace(/^\d+\.\s*/, '').replace(/^ARTICLE\s+\d+\s*[-:.]?\s*/i, '').trim();
    if (keyWord && keyWord !== afterHeading) {
      console.log(`insertNewSection: trying keyword search: "${keyWord}"`);
      headingRange = await findSectionByHeading(context, keyWord);
    }
  }

  // Strategy 3: Try searching for the section number pattern
  if (!headingRange) {
    const numberMatch = afterHeading.match(/^(\d+)\./);
    if (numberMatch) {
      const sectionNum = numberMatch[1];
      console.log(`insertNewSection: trying section number search: "${sectionNum}."`);
      const numResults = context.document.body.search(`${sectionNum}.`, {
        matchCase: false,
        matchWholeWord: false,
      });
      numResults.load('items');
      await context.sync();
      if (numResults.items.length > 0) {
        headingRange = numResults.items[0];
      }
    }
  }

  if (!headingRange) {
    console.error(`Could not find section heading: "${afterHeading}"`);
    return {
      success: false,
      error: `Could not find section "${afterHeading}" in document. Try manually copying the text and inserting it after the ${afterHeading} section.`
    };
  }

  // Get the paragraph containing the heading
  const paragraph = headingRange.paragraphs.getFirst();
  paragraph.load('text');
  await context.sync();

  console.log(`insertNewSection: found heading in paragraph: "${paragraph.text.substring(0, 50)}..."`);

  // Find the end of this section by looking for the next numbered section or end of document
  // Get all paragraphs after this one
  const afterRange = paragraph.getRange('After');
  const allParagraphs = afterRange.paragraphs;
  allParagraphs.load('items');
  await context.sync();

  // Look for the next section heading (numbered paragraph or all caps heading)
  let insertionPoint: Word.Range | null = null;
  const sectionPattern = /^\s*(\d+\.|\([a-z]\)|\([0-9]+\)|ARTICLE\s+\d+)/i;

  for (let i = 0; i < Math.min(allParagraphs.items.length, 50); i++) {
    const para = allParagraphs.items[i];
    para.load('text');
    await context.sync();

    // Check if this looks like a new section heading
    if (sectionPattern.test(para.text) && para.text.trim().length > 5) {
      // This is the next section - insert before it
      insertionPoint = para.getRange('Start');
      console.log(`insertNewSection: found next section at: "${para.text.substring(0, 40)}..."`);
      break;
    }
  }

  // If no next section found, insert at the end of the content we found
  if (!insertionPoint) {
    insertionPoint = afterRange.getRange('End');
    console.log(`insertNewSection: no next section found, inserting at end of content`);
  }

  // Insert the new section with proper formatting
  const insertText = '\n\n' + newSectionContent + '\n\n';
  const newRange = insertionPoint.insertText(insertText, Word.InsertLocation.before);

  // Style the new content
  if (!trackChangesEnabled) {
    newRange.font.underline = Word.UnderlineType.single;
    newRange.font.color = '#16A34A';
  }

  newRange.select();
  await context.sync();

  console.log(`insertNewSection: successfully inserted new section`);
  return { success: true };
}

/**
 * Calculates similarity between two strings (0-100)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = normalizeText(str1).toLowerCase();
  const s2 = normalizeText(str2).toLowerCase();

  if (s1 === s2) return 100;
  if (s1.length === 0 || s2.length === 0) return 0;

  // Simple Levenshtein-based similarity
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  // If one string contains the other, high similarity
  if (longer.includes(shorter)) {
    return Math.floor((shorter.length / longer.length) * 100);
  }

  // Word-based overlap
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);
  const commonWords = words1.filter(w => words2.includes(w));

  return Math.floor((commonWords.length / Math.max(words1.length, words2.length)) * 100);
}

/**
 * Creates a wildcard search pattern from text
 */
function createWildcardPattern(text: string): string {
  const words = normalizeText(text).split(/\s+/).filter(w => w.length > 2);
  // Take first 5 significant words and join with wildcard
  return words.slice(0, 5).join('*');
}

/**
 * Extract surrounding context from a paragraph
 */
function extractContext(fullText: string, matchStart: number, matchEnd: number, contextChars: number = 50): string {
  const start = Math.max(0, matchStart - contextChars);
  const end = Math.min(fullText.length, matchEnd + contextChars);

  let context = '';
  if (start > 0) context += '...';
  context += fullText.substring(start, end);
  if (end < fullText.length) context += '...';

  return context;
}

export default function App() {
  const [isOfficeReady, setIsOfficeReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<string>('analyze');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<DashboardAnalysisResult | null>(null);
  const [clauses, setClauses] = useState<ClauseSuggestion[]>([]);
  const [isLoadingClauses, setIsLoadingClauses] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Preview and match selection state
  const [previewState, setPreviewState] = useState<PreviewState | null>(null);
  const [isApplyingChange, setIsApplyingChange] = useState(false);

  // Track which sections have been applied (by section title)
  const [appliedSections, setAppliedSections] = useState<Set<string>>(new Set());

  // Track if all changes have been inserted
  const [allChangesInserted, setAllChangesInserted] = useState(false);

  // Track the selected text range for "Analyze Selection" feature
  // This stores the original selected text so we can find it directly when inserting
  const [selectionContext, setSelectionContext] = useState<{
    originalText: string;
    sectionTitle: string;
  } | null>(null);

  // Contract linking state
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selectedContract, setSelectedContract] = useState<string>('');
  const [contractSearch, setContractSearch] = useState('');
  const [showContractDropdown, setShowContractDropdown] = useState(false);
  const [isLoadingContracts, setIsLoadingContracts] = useState(false);
  const contractDropdownRef = useRef<HTMLDivElement>(null);

  // Initialize Office.js
  useEffect(() => {
    Office.onReady(() => {
      setIsOfficeReady(true);
      checkAuthStatus();
    });
  }, []);

  // Check authentication status
  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('mars_token');
      if (token) {
        const response = await fetch(`${API_BASE}/api/word-addin/auth/verify`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        } else {
          localStorage.removeItem('mars_token');
        }
      }
    } catch (err) {
      console.error('Auth check failed:', err);
    }
  };

  // Fetch contracts for linking
  const fetchContracts = async () => {
    setIsLoadingContracts(true);
    try {
      const token = localStorage.getItem('mars_token');
      const response = await fetch(`${API_BASE}/api/contracts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setContracts(data.contracts || []);
      }
    } catch (err) {
      console.error('Failed to fetch contracts:', err);
    } finally {
      setIsLoadingContracts(false);
    }
  };

  // Load contracts when user logs in
  useEffect(() => {
    if (user) {
      fetchContracts();
    }
  }, [user]);

  // Close contract dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (contractDropdownRef.current && !contractDropdownRef.current.contains(event.target as Node)) {
        setShowContractDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Quick login state for fallback
  const [showQuickLogin, setShowQuickLogin] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Handle login - try Office dialog first, fallback to inline login
  const handleLogin = async () => {
    try {
      // Try to open Office dialog
      const dialogUrl = `${API_BASE}/word-addin/auth.html`;
      Office.context.ui.displayDialogAsync(
        dialogUrl,
        { height: 60, width: 30 },
        (result: Office.AsyncResult<Office.Dialog>) => {
          if (result.status === Office.AsyncResultStatus.Succeeded) {
            const dialog = result.value;
            dialog.addEventHandler(
              Office.EventType.DialogMessageReceived,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (args: any) => {
                const message = JSON.parse(args.message);
                if (message.type === 'auth_success') {
                  localStorage.setItem('mars_token', message.token);
                  setUser(message.user);
                  dialog.close();
                } else if (message.type === 'auth_error') {
                  setError(message.error);
                  dialog.close();
                }
              }
            );
          } else {
            // Dialog failed to open, show inline login
            console.error('Dialog failed:', result.error);
            setShowQuickLogin(true);
          }
        }
      );
    } catch (err) {
      console.error('Login error:', err);
      // Fallback to inline login
      setShowQuickLogin(true);
    }
  };

  // Handle quick email login (fallback)
  const handleQuickLogin = async () => {
    if (!loginEmail || !loginEmail.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoggingIn(true);
    setError(null);

    try {
      console.log('Attempting login to:', `${API_BASE}/api/word-addin/auth/dev`);
      const response = await fetch(`${API_BASE}/api/word-addin/auth/dev`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Login response error:', response.status, errorText);
        throw new Error(`Server error (${response.status})`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      localStorage.setItem('mars_token', data.token);
      setUser(data.user);
      setShowQuickLogin(false);
      setLoginEmail('');
    } catch (err) {
      console.error('Login error:', err);
      const message = err instanceof Error ? err.message : 'Login failed';
      // Check for network errors
      if (message.includes('fetch') || message.includes('network') || message.includes('Failed to fetch')) {
        setError('Cannot connect to server. Please check your internet connection.');
      } else {
        setError(message);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Get document text from Word
  const getDocumentText = useCallback(async (): Promise<string> => {
    return new Promise((resolve, reject) => {
      Word.run(async (context) => {
        const body = context.document.body;
        body.load('text');
        await context.sync();
        resolve(body.text);
      }).catch(reject);
    });
  }, []);

  // Get document name from Word
  const getDocumentName = useCallback(async (): Promise<string> => {
    return new Promise((resolve) => {
      Word.run(async (context) => {
        const properties = context.document.properties;
        properties.load('title');
        await context.sync();
        // Use title if available, otherwise default
        resolve(properties.title || 'Untitled Document');
      }).catch(() => {
        resolve('Word Document');
      });
    });
  }, []);

  // Analyze document using dashboard API
  const analyzeDocument = async () => {
    if (!user) {
      setError('Please log in first');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAppliedSections(new Set()); // Clear applied sections on new analysis
    setAllChangesInserted(false);

    try {
      const [documentText, documentName] = await Promise.all([
        getDocumentText(),
        getDocumentName(),
      ]);

      if (!documentText || documentText.trim().length < 100) {
        setError('Document appears to be empty or too short to analyze');
        setIsAnalyzing(false);
        return;
      }

      const token = localStorage.getItem('mars_token');
      // Use same API as dashboard for consistent results
      const response = await fetch(`${API_BASE}/api/contracts/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          text: documentText,
          provisionName: documentName,
          contractId: selectedContract || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Analysis failed');
      }

      const result: DashboardAnalysisResult = await response.json();
      setAnalysisResult(result);

      if (result.sections.length === 0) {
        setSuccessMessage('No material risks found in this contract.');
        setTimeout(() => setSuccessMessage(null), 5000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze document. Please try again.');
      console.error('Analysis error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Re-analyze a specific section/clause for deeper review
  // fromSelection: if true, marks sections as coming from selection analysis
  const reanalyzeClause = async (clauseName: string, clauseText: string, fromSelection = false) => {
    if (!user) {
      setError('Please log in first');
      return;
    }

    if (!clauseText || clauseText.trim().length < 20) {
      setError('Clause text is too short to analyze');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const token = localStorage.getItem('mars_token');
      const response = await fetch(`${API_BASE}/api/contracts/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          text: clauseText, // Still need full text for context
          focusedClause: {
            name: clauseName,
            text: clauseText,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Re-analysis failed');
      }

      const result: DashboardAnalysisResult = await response.json();

      // If from selection, mark sections with the original selected text
      // This allows insertSingleSection to find the exact selected text
      if (fromSelection && result.sections.length > 0) {
        result.sections = result.sections.map(s => ({
          ...s,
          fromSelection: true,
          originalSelectedText: clauseText, // Store the exact text that was selected
        }));
        console.log('reanalyzeClause: marked sections as fromSelection with originalSelectedText');
      }

      // Merge new sections with existing results
      if (result.sections.length > 0) {
        setAnalysisResult(prev => {
          if (!prev) return result;

          // Add new sections, avoiding duplicates by section title
          const existingTitles = new Set(prev.sections.map(s => s.sectionTitle));
          const newSections = result.sections.filter(s => !existingTitles.has(s.sectionTitle));

          // If analyzing same section again, replace it
          const updatedSections = prev.sections.map(s => {
            const replacement = result.sections.find(r => r.sectionTitle === s.sectionTitle);
            return replacement || s;
          });

          return {
            ...prev,
            sections: [...updatedSections, ...newSections],
            summary: [...prev.summary, ...result.summary.filter(s => !prev.summary.includes(s))],
          };
        });

        setSuccessMessage(`Found ${result.sections.length} additional suggestions for ${clauseName}`);
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setSuccessMessage(`No additional issues found in ${clauseName}`);
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Re-analysis failed');
      console.error('Re-analysis error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Analyze selected text in Word document
  const analyzeSelection = async () => {
    if (!user) {
      setError('Please log in first');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      // Get selected text from Word
      let selectedText = '';
      await Word.run(async (context) => {
        const selection = context.document.getSelection();
        selection.load('text');
        await context.sync();
        selectedText = selection.text;
      });

      if (!selectedText || selectedText.trim().length < 50) {
        setError('Please select more text in the document (at least a full clause or paragraph)');
        setIsAnalyzing(false);
        return;
      }

      // Try to identify the clause name from the first line
      const firstLine = selectedText.trim().split('\n')[0];
      const clauseName = firstLine.length < 100 ? firstLine : 'Selected Text';

      // IMPORTANT: Save the selection context so we can find the exact text when inserting
      // This ensures changes are applied to the selected text, not some other location
      setSelectionContext({
        originalText: selectedText,
        sectionTitle: clauseName,
      });
      console.log('analyzeSelection: saved selection context for:', clauseName);

      await reanalyzeClause(clauseName, selectedText, true); // true = fromSelection
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze selection');
      console.error('Selection analysis error:', err);
      setIsAnalyzing(false);
    }
  };

  // Insert all section changes into Word document using Track Changes
  // NEW: Uses heading-based finding and targeted find/replace pairs
  const insertAllChanges = async () => {
    if (!analysisResult || analysisResult.sections.length === 0) {
      setError('No changes to insert');
      return;
    }

    setIsApplyingChange(true);
    setError(null);
    let appliedCount = 0;
    const newApplied = new Set(appliedSections);
    const failedSections: string[] = [];

    try {
      await Word.run(async (context) => {
        // Step 1: Enable Track Changes
        let trackChangesEnabled = false;
        try {
          if (Office.context.requirements.isSetSupported('WordApi', '1.4')) {
            (context.document as unknown as { changeTrackingMode: string }).changeTrackingMode = 'TrackAll';
            await context.sync();
            trackChangesEnabled = true;
            console.log('Track Changes enabled');
          }
        } catch (e) {
          console.log('Track changes not available:', e);
        }

        // Step 2: Process sections with changes arrays (new format)
        // Apply in reverse document order to prevent position shifts
        const sectionsWithChanges = analysisResult.sections.filter(
          s => s.changes && s.changes.length > 0 && !s.isNewSection && !appliedSections.has(s.sectionTitle)
        );

        // Sort sections by finding their position in document
        const sectionPositions: Array<{ section: DashboardSection; position: number }> = [];
        for (const section of sectionsWithChanges) {
          const headingRange = await findSectionByHeading(context, section.sectionTitle);
          if (headingRange) {
            // Use a simple position indicator - we'll compare ranges
            sectionPositions.push({ section, position: 0 });
          } else {
            console.log(`Could not find heading for: ${section.sectionTitle}`);
            failedSections.push(section.sectionTitle);
          }
        }

        // For simplicity, apply in reverse order of how they appear in the analysis
        // (assumes AI returns sections in document order)
        sectionPositions.reverse();

        console.log(`Applying changes to ${sectionPositions.length} sections`);

        // Step 3: Apply changes to each section
        for (const { section } of sectionPositions) {
          if (!section.changes || section.changes.length === 0) continue;

          console.log(`Processing section: ${section.sectionTitle} with ${section.changes.length} changes`);

          const changesApplied = await applyChangesToSection(
            context,
            section.sectionTitle,
            section.changes,
            trackChangesEnabled
          );

          if (changesApplied > 0) {
            newApplied.add(section.sectionTitle);
            appliedCount += changesApplied;
            console.log(`Applied ${changesApplied} changes to: ${section.sectionTitle}`);
          } else {
            failedSections.push(section.sectionTitle);
          }
        }

        // Step 4: Handle legacy format (originalText/revisedText without changes array)
        const legacySections = analysisResult.sections.filter(
          s => (!s.changes || s.changes.length === 0) && s.originalText && s.revisedText && !s.isNewSection && !appliedSections.has(s.sectionTitle)
        );

        for (const section of legacySections) {
          // Use the old findFullRange approach for legacy format
          const fullRange = await findFullRange(context, section.originalText, section.sectionTitle);
          if (fullRange) {
            const newRange = fullRange.insertText(section.revisedText, Word.InsertLocation.replace);
            if (!trackChangesEnabled) {
              newRange.font.underline = Word.UnderlineType.single;
              newRange.font.color = '#16A34A';
            }
            newApplied.add(section.sectionTitle);
            appliedCount++;
            console.log(`Applied legacy change to: ${section.sectionTitle}`);
            await context.sync();
          } else {
            failedSections.push(section.sectionTitle);
          }
        }

        // Step 5: Handle new sections (insertions) - apply last
        const newSectionsToInsert = analysisResult.sections.filter(
          s => s.isNewSection && !appliedSections.has(s.sectionTitle)
        );

        for (const section of newSectionsToInsert) {
          if (!section.insertAfter || !section.revisedText) {
            console.warn(`New section ${section.sectionTitle} missing insertAfter or content`);
            continue;
          }

          const result = await insertNewSection(
            context,
            section.insertAfter,
            section.revisedText,
            trackChangesEnabled
          );

          if (result.success) {
            newApplied.add(section.sectionTitle);
            appliedCount++;
            console.log(`Inserted new section: ${section.sectionTitle}`);
          } else {
            failedSections.push(section.sectionTitle);
            console.error(`Failed to insert ${section.sectionTitle}: ${result.error}`);
          }
        }
      });

      setAppliedSections(newApplied);
      setAllChangesInserted(failedSections.length === 0);

      if (appliedCount > 0) {
        const message = failedSections.length > 0
          ? `Applied ${appliedCount} changes. Failed: ${failedSections.join(', ')}`
          : `Applied ${appliedCount} changes successfully`;
        setSuccessMessage(message);
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        setError('Could not apply any changes. The document text may have changed.');
      }
    } catch (err) {
      console.error('Insert all changes error:', err);
      setError('Failed to insert changes. Please try again.');
    } finally {
      setIsApplyingChange(false);
    }
  };

  // Insert a single section change into Word document using Track Changes
  // NEW: Supports both changes array (new format) and originalText/revisedText (legacy)
  const insertSingleSection = async (section: DashboardSection) => {
    // Check if this is a new section to insert
    if (section.isNewSection) {
      if (!section.insertAfter || !section.revisedText) {
        setError('Missing insert location or content for new section');
        return;
      }
    } else if (!section.changes && (!section.originalText || !section.revisedText)) {
      setError('No changes available for this section');
      return;
    }

    if (appliedSections.has(section.sectionTitle)) {
      setError('This change has already been applied');
      return;
    }

    setIsApplyingChange(true);
    setError(null);

    try {
      await Word.run(async (context) => {
        // Step 1: Enable Track Changes
        let trackChangesEnabled = false;
        try {
          if (Office.context.requirements.isSetSupported('WordApi', '1.4')) {
            (context.document as unknown as { changeTrackingMode: string }).changeTrackingMode = 'TrackAll';
            await context.sync();
            trackChangesEnabled = true;
            console.log('Track Changes enabled');
          }
        } catch (e) {
          console.log('Track changes not available:', e);
        }

        // Step 2: Handle based on section type
        if (section.isNewSection) {
          // Insert new section
          const result = await insertNewSection(
            context,
            section.insertAfter!,
            section.revisedText,
            trackChangesEnabled
          );

          if (!result.success) {
            setError(result.error || `Could not find location to insert after "${section.insertAfter}"`);
            return;
          }
        } else if (section.fromSelection && section.originalSelectedText && section.changes && section.changes.length > 0) {
          // Selection-based analysis: Search for the exact selected text first
          console.log('insertSingleSection: fromSelection mode, searching for originalSelectedText');

          // Search for the original selected text directly (truncate if needed for Word API limit)
          const searchText = section.originalSelectedText.length > 200
            ? section.originalSelectedText.substring(0, 200)
            : section.originalSelectedText;

          const selectionResults = context.document.body.search(searchText, {
            matchCase: false,
            matchWholeWord: false,
          });
          selectionResults.load('items');
          await context.sync();

          if (selectionResults.items.length === 0) {
            // Try normalized version
            const normalizedSearch = normalizeText(searchText);
            const normalizedResults = context.document.body.search(normalizedSearch, {
              matchCase: false,
              matchWholeWord: false,
            });
            normalizedResults.load('items');
            await context.sync();

            if (normalizedResults.items.length === 0) {
              setError(`Could not find the selected text "${section.sectionTitle}" in document. It may have been modified.`);
              return;
            }

            console.log(`Found ${normalizedResults.items.length} matches for normalized selected text`);
          } else {
            console.log(`Found ${selectionResults.items.length} matches for selected text`);
          }

          // Now apply the changes within the document (search globally since we verified context)
          let changesApplied = 0;
          for (const change of section.changes) {
            if (!change.find || change.replace === undefined) continue;

            const findText = change.find.length > 200 ? change.find.substring(0, 200) : change.find;
            const results = context.document.body.search(findText, {
              matchCase: false,
              matchWholeWord: false,
            });
            results.load('items');
            await context.sync();

            if (results.items.length > 0) {
              const range = results.items[0];
              const newRange = range.insertText(change.replace, Word.InsertLocation.replace);
              if (!trackChangesEnabled) {
                newRange.font.underline = Word.UnderlineType.single;
                newRange.font.color = '#16A34A';
              }
              await context.sync();
              changesApplied++;
              console.log(`Applied selection change: "${change.find.substring(0, 50)}..." → "${change.replace.substring(0, 50)}..."`);
            }
          }

          if (changesApplied === 0) {
            setError(`Could not apply any changes to "${section.sectionTitle}"`);
            return;
          }
        } else if (section.changes && section.changes.length > 0) {
          // New format: Apply targeted find/replace pairs
          const changesApplied = await applyChangesToSection(
            context,
            section.sectionTitle,
            section.changes,
            trackChangesEnabled
          );

          if (changesApplied === 0) {
            setError(`Could not apply any changes to "${section.sectionTitle}"`);
            return;
          }
        } else {
          // Legacy format: Find full range and replace
          const fullRange = await findFullRange(context, section.originalText, section.sectionTitle);

          if (!fullRange) {
            setError(`Could not find "${section.sectionTitle}" in document`);
            return;
          }

          const newRange = fullRange.insertText(section.revisedText, Word.InsertLocation.replace);

          if (!trackChangesEnabled) {
            newRange.font.underline = Word.UnderlineType.single;
            newRange.font.color = '#16A34A';
          }

          newRange.select();
        }

        await context.sync();

        setAppliedSections(prev => new Set(prev).add(section.sectionTitle));
        setSuccessMessage(`Applied changes to: ${section.sectionTitle}`);
        setTimeout(() => setSuccessMessage(null), 3000);
      });
    } catch (err) {
      console.error('Insert section error:', err);
      setError('Failed to apply change');
    } finally {
      setIsApplyingChange(false);
    }
  };

  // Highlight a section in the document
  const highlightSection = async (section: DashboardSection) => {
    if (!section.originalText) {
      setError('No text location for this section');
      return;
    }

    try {
      await Word.run(async (context) => {
        const matches = await cascadingSearch(section.originalText, context, section.sectionTitle);

        if (matches.length > 0) {
          const range = matches[0].range;
          range.font.highlightColor = '#FFE066';
          range.select();
          await context.sync();
        } else {
          setError('Could not find the text in the document');
        }
      });
    } catch (err) {
      console.error('Highlight error:', err);
      setError('Failed to highlight text');
    }
  };

  // Get risk color for badges
  const getRiskColor = (riskLevel: string): 'danger' | 'warning' | 'success' => {
    const level = riskLevel.toLowerCase();
    if (level === 'high') return 'danger';
    if (level === 'medium') return 'warning';
    return 'success';
  };

  // Load clause library
  const loadClauses = async () => {
    setIsLoadingClauses(true);
    try {
      const token = localStorage.getItem('mars_token');
      const response = await fetch(`${API_BASE}/api/word-addin/clauses`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setClauses(data.clauses || []);
      }
    } catch (err) {
      console.error('Failed to load clauses:', err);
    } finally {
      setIsLoadingClauses(false);
    }
  };

  // Insert clause at cursor
  const insertClause = async (text: string) => {
    try {
      await Word.run(async (context) => {
        const selection = context.document.getSelection();
        selection.insertText(text, Word.InsertLocation.replace);
        await context.sync();
      });
    } catch (err) {
      setError('Failed to insert clause');
      console.error('Insert error:', err);
    }
  };

  // Highlight text in document (uses cascading search for reliability)
  const highlightRisk = async (location: string) => {
    try {
      await Word.run(async (context) => {
        // Use cascading search to find the text reliably
        const matches = await cascadingSearch(location, context);

        if (matches.length > 0) {
          const range = matches[0].range;
          range.font.highlightColor = '#FFE066';
          range.select();
          await context.sync();
        } else {
          setError('Could not find the text in the document. It may have been modified.');
        }
      });
    } catch (err) {
      console.error('Highlight error:', err);
      setError('Failed to highlight text in document.');
    }
  };

  // ============================================
  // CASCADING SEARCH STRATEGY
  // ============================================

  // Word API has a 255 character limit for search strings
  const MAX_SEARCH_LENGTH = 200;

  /**
   * Truncates search text to Word API limit, trying to break at word boundary
   */
  const truncateSearchText = (text: string, maxLen: number = MAX_SEARCH_LENGTH): string => {
    if (text.length <= maxLen) return text;

    // Try to break at a word boundary
    const truncated = text.substring(0, maxLen);
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > maxLen * 0.7) {
      return truncated.substring(0, lastSpace);
    }
    return truncated;
  };

  /**
   * Performs a cascading search with multiple fallback strategies
   * Handles long search strings by truncating and then validating matches
   *
   * NOTE: Section heading search is NOT used here because risk.location is
   * a specific text excerpt, not the full section. Use findFullRange() for
   * full section matching (used by Insert All).
   */
  const cascadingSearch = async (
    searchText: string,
    context: Word.RequestContext,
    _sectionTitle?: string  // Kept for API compatibility but not used
  ): Promise<SearchMatch[]> => {
    const matches: SearchMatch[] = [];
    const body = context.document.body;
    const fullSearchText = searchText;
    const isLongSearch = searchText.length > MAX_SEARCH_LENGTH;

    // Truncate for Word API if needed
    const truncatedSearch = truncateSearchText(normalizeText(searchText));
    console.log(`Search text length: ${searchText.length}, truncated to: ${truncatedSearch.length}`);

    // Tier 1: Search with truncated text (or full if short enough)
    try {
      const searchQuery = isLongSearch ? truncatedSearch : searchText;
      const exactResults = body.search(searchQuery, {
        matchCase: false,
        matchWholeWord: false,
      });
      exactResults.load('items');
      await context.sync();

      for (const range of exactResults.items) {
        range.load('text');
        // Get surrounding paragraph for context
        const paragraph = range.paragraphs.getFirst();
        paragraph.load('text');
        await context.sync();

        // For long searches, calculate similarity to validate match
        let confidence = 100;
        if (isLongSearch) {
          confidence = calculateSimilarity(paragraph.text, fullSearchText);
          // Skip low-confidence matches for long searches
          if (confidence < 40) continue;
        }

        matches.push({
          range,
          text: range.text,
          context: paragraph.text.substring(0, 200),
          confidence,
          matchType: isLongSearch ? 'truncated' : 'exact',
        });
      }

      if (matches.length > 0) {
        matches.sort((a, b) => b.confidence - a.confidence);
        return matches;
      }
    } catch (err) {
      console.log('Exact/truncated search failed, trying normalized...', err);
    }

    // Tier 2: Normalized text search
    const normalizedSearch = truncateSearchText(normalizeText(searchText));
    try {
      const normResults = body.search(normalizedSearch, {
        matchCase: false,
        matchWholeWord: false,
      });
      normResults.load('items');
      await context.sync();

      for (const range of normResults.items) {
        range.load('text');
        const paragraph = range.paragraphs.getFirst();
        paragraph.load('text');
        await context.sync();

        let confidence = 95;
        if (isLongSearch) {
          confidence = calculateSimilarity(paragraph.text, fullSearchText);
          if (confidence < 40) continue;
        }

        matches.push({
          range,
          text: range.text,
          context: paragraph.text.substring(0, 200),
          confidence,
          matchType: 'normalized',
        });
      }

      if (matches.length > 0) {
        matches.sort((a, b) => b.confidence - a.confidence);
        return matches;
      }
    } catch (err) {
      console.log('Normalized search failed, trying wildcard...', err);
    }

    // Tier 3: Wildcard pattern search (first few significant words)
    const wildcardPattern = createWildcardPattern(searchText);
    if (wildcardPattern && wildcardPattern.includes('*') && wildcardPattern.length <= MAX_SEARCH_LENGTH) {
      try {
        const wildcardResults = body.search(wildcardPattern, {
          matchCase: false,
          matchWildcards: true,
        });
        wildcardResults.load('items');
        await context.sync();

        for (const range of wildcardResults.items) {
          range.load('text');
          const paragraph = range.paragraphs.getFirst();
          paragraph.load('text');
          await context.sync();

          const similarity = calculateSimilarity(paragraph.text, fullSearchText);
          if (similarity >= 30) {
            matches.push({
              range,
              text: range.text,
              context: paragraph.text.substring(0, 200),
              confidence: similarity,
              matchType: 'wildcard',
            });
          }
        }

        if (matches.length > 0) {
          matches.sort((a, b) => b.confidence - a.confidence);
          return matches;
        }
      } catch (err) {
        console.log('Wildcard search failed, trying fuzzy...', err);
      }
    }

    // Tier 4: Fuzzy/partial match (search for first significant phrase)
    const words = normalizeText(searchText).split(/\s+/);
    // Take more words for better matching, but keep under limit
    const phraseWords = words.slice(0, Math.min(8, words.length));
    const firstPhrase = truncateSearchText(phraseWords.join(' '), 100);
    if (firstPhrase.length >= 10) {
      try {
        const fuzzyResults = body.search(firstPhrase, {
          matchCase: false,
          matchWholeWord: false,
        });
        fuzzyResults.load('items');
        await context.sync();

        for (const range of fuzzyResults.items) {
          // Expand range to get more context
          range.load('text');
          const paragraph = range.paragraphs.getFirst();
          paragraph.load('text');
          await context.sync();

          // Calculate actual similarity for fuzzy matches
          const similarity = calculateSimilarity(paragraph.text, fullSearchText);
          if (similarity < 25) continue; // Skip very low matches

          matches.push({
            range,
            text: range.text,
            context: paragraph.text.substring(0, 200),
            confidence: Math.max(similarity, 50), // At least 50% for fuzzy matches that pass threshold
            matchType: 'fuzzy',
          });
        }
      } catch (err) {
        console.log('Fuzzy search also failed', err);
      }
    }

    return matches;
  };

  // ============================================
  // TRACK CHANGES IMPLEMENTATION
  // ============================================

  /**
   * Applies a text replacement with track changes
   * Uses actual text replacement so subsequent searches work correctly
   */
  const applyWithTrackChanges = async (
    range: Word.Range,
    newText: string,
    context: Word.RequestContext
  ): Promise<void> => {
    // Try to enable track changes if supported (WordApi 1.4+)
    let trackChangesEnabled = false;
    try {
      if (Office.context.requirements.isSetSupported('WordApi', '1.4')) {
        (context.document as unknown as { changeTrackingMode: string }).changeTrackingMode = 'TrackAll';
        await context.sync();
        trackChangesEnabled = true;
        console.log('Native Track Changes enabled');
      }
    } catch (err) {
      console.log('Track changes mode not available:', err);
    }

    // Actually REPLACE the text (not just insert after)
    // This ensures subsequent searches don't find the old text
    const newRange = range.insertText(newText, Word.InsertLocation.replace);

    // If track changes is not natively supported, apply visual highlighting
    // to indicate this is new/changed text (green with underline)
    if (!trackChangesEnabled) {
      newRange.font.underline = Word.UnderlineType.single;
      newRange.font.color = '#16A34A'; // Green to indicate new text
    }

    // Select the new text so user can see where the change was made
    newRange.select();
    await context.sync();
  };

  // ============================================
  // FIX IT FUNCTIONALITY
  // ============================================

  /**
   * Initiates the Fix It flow - searches for text and shows preview
   */
  const initiateFixIt = async (
    risk: RiskItem,
    clauseType: 'primary' | 'fallback' | 'last_resort' | 'suggestion'
  ) => {
    const originalText = risk.location;
    if (!originalText) {
      setError('No text location found to replace');
      return;
    }

    let newText = '';
    if (clauseType === 'suggestion') {
      newText = risk.suggestion;
    } else if (risk.matched_clause) {
      switch (clauseType) {
        case 'primary':
          newText = risk.matched_clause.primary_text;
          break;
        case 'fallback':
          newText = risk.matched_clause.fallback_text || '';
          break;
        case 'last_resort':
          newText = risk.matched_clause.last_resort_text || '';
          break;
      }
    }

    if (!newText) {
      setError('No replacement text available');
      return;
    }

    setIsApplyingChange(true);
    setError(null);

    try {
      await Word.run(async (context) => {
        // Pass risk.type as section title to enable section heading search
        const matches = await cascadingSearch(originalText, context, risk.type);

        if (matches.length === 0) {
          setError(
            'Could not find the text in the document. The text may have been modified. ' +
            'Try selecting the text manually and using "Insert at Cursor".'
          );
          setIsApplyingChange(false);
          return;
        }

        // Highlight all matches temporarily
        for (let i = 0; i < matches.length; i++) {
          const match = matches[i];
          match.range.font.highlightColor = i === 0 ? '#22C55E' : '#FBBF24'; // Green for first, yellow for others
        }
        await context.sync();

        // Set up preview state - include sectionTitle for confirmChange
        setPreviewState({
          isOpen: true,
          originalText,
          newText,
          matches,
          selectedMatchIndex: 0,
          riskId: risk.id,
          clauseType,
          sectionTitle: risk.type,
        });

        setIsApplyingChange(false);
      });
    } catch (err) {
      console.error('Fix It error:', err);
      setError('Failed to search document. Please try again.');
      setIsApplyingChange(false);
    }
  };

  /**
   * Confirms and applies the selected change
   */
  const confirmChange = async () => {
    if (!previewState) return;

    setIsApplyingChange(true);

    try {
      await Word.run(async (context) => {
        // Re-search to get fresh range reference (pass sectionTitle for better search)
        const matches = await cascadingSearch(previewState.originalText, context, previewState.sectionTitle);

        if (matches.length === 0 || matches.length <= previewState.selectedMatchIndex) {
          setError('Could not find the text. Document may have changed.');
          setIsApplyingChange(false);
          return;
        }

        const selectedMatch = matches[previewState.selectedMatchIndex];

        // Clear all highlights first
        for (const match of matches) {
          match.range.font.highlightColor = 'None';
        }
        await context.sync();

        // Apply the change with track changes
        await applyWithTrackChanges(selectedMatch.range, previewState.newText, context);

        // Mark this section/risk as applied
        setAppliedSections(prev => new Set(prev).add(previewState.riskId));

        setPreviewState(null);
        setSuccessMessage('Change applied successfully with track changes!');
        setTimeout(() => setSuccessMessage(null), 3000);
      });
    } catch (err) {
      console.error('Apply change error:', err);
      setError('Failed to apply change. Please try again.');
    } finally {
      setIsApplyingChange(false);
    }
  };

  /**
   * Cancels the preview and clears highlights
   */
  const cancelChange = async () => {
    if (!previewState) return;

    try {
      await Word.run(async (context) => {
        // Re-search to clear highlights
        const matches = await cascadingSearch(previewState.originalText, context, previewState.sectionTitle);
        for (const match of matches) {
          match.range.font.highlightColor = 'None';
        }
        await context.sync();
      });
    } catch (err) {
      console.log('Error clearing highlights:', err);
    }

    setPreviewState(null);
  };

  /**
   * Selects a different match from multiple found
   */
  const selectMatch = async (index: number) => {
    if (!previewState) return;

    try {
      await Word.run(async (context) => {
        const matches = await cascadingSearch(previewState.originalText, context, previewState.sectionTitle);

        // Update highlights
        for (let i = 0; i < matches.length; i++) {
          matches[i].range.font.highlightColor = i === index ? '#22C55E' : '#FBBF24';
        }

        // Select the new match
        if (matches[index]) {
          matches[index].range.select();
        }
        await context.sync();

        setPreviewState({
          ...previewState,
          selectedMatchIndex: index,
          matches,
        });
      });
    } catch (err) {
      console.error('Select match error:', err);
    }
  };

  /**
   * Track clause usage in the API
   */
  const trackClauseUsage = async (clauseId: string, position: string) => {
    try {
      const token = localStorage.getItem('mars_token');
      await fetch(`${API_BASE}/api/word-addin/clauses/usage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ clause_id: clauseId, position }),
      });
    } catch (err) {
      console.log('Usage tracking failed (non-critical):', err);
    }
  };

  // Handle tab change
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleTabChange = (_: any, data: { value: unknown }) => {
    const value = data.value as string;
    setActiveTab(value);
    if (value === 'clauses' && clauses.length === 0) {
      loadClauses();
    }
  };

  // Risk severity badge - elegant pill style
  const getRiskBadge = (severity: string, isApplied?: boolean) => {
    if (isApplied) {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: '0.02em',
          borderRadius: 20,
          backgroundColor: 'rgba(16, 185, 129, 0.12)',
          color: '#10b981',
          border: '1px solid rgba(16, 185, 129, 0.2)',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#10b981' }} />
          Applied
        </span>
      );
    }

    const config: Record<string, { color: string; bg: string; border: string }> = {
      high: { color: '#f87171', bg: 'rgba(248, 113, 113, 0.12)', border: 'rgba(248, 113, 113, 0.25)' },
      medium: { color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.12)', border: 'rgba(251, 191, 36, 0.25)' },
      low: { color: '#4ade80', bg: 'rgba(74, 222, 128, 0.12)', border: 'rgba(74, 222, 128, 0.25)' },
    };
    const { color, bg, border } = config[severity.toLowerCase()] || config.low;

    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: '0.02em',
        borderRadius: 20,
        backgroundColor: bg,
        color: color,
        border: `1px solid ${border}`,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: color, boxShadow: `0 0 6px ${color}` }} />
        {severity.charAt(0).toUpperCase() + severity.slice(1).toLowerCase()}
      </span>
    );
  };

  // Loading state
  if (!isOfficeReady) {
    return (
      <FluentProvider theme={webDarkTheme}>
        <div style={{
          ...styles.container,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
          }}>
            <PremiumSpinner size={24} color="rgba(148, 163, 184, 0.5)" />
            <span style={{
              fontSize: 13,
              fontWeight: 450,
              color: 'rgba(148, 163, 184, 0.6)',
              letterSpacing: '0.01em',
            }}>
              Loading MARS
            </span>
          </div>
        </div>
      </FluentProvider>
    );
  }

  // Login required
  if (!user) {
    return (
      <FluentProvider theme={webDarkTheme}>
        <div style={styles.container}>
          <div style={styles.loginCard}>
            <Shield24Regular style={{ fontSize: 48, color: '#0078D4' }} />
            <Text size={500} weight="semibold">MARS Contract Review</Text>
            <Text size={300} style={{ color: '#A0A0A0', textAlign: 'center' }}>
              Sign in to analyze contracts and access the clause library
            </Text>

            {!showQuickLogin ? (
              <>
                <Button
                  appearance="primary"
                  icon={<Person24Regular />}
                  onClick={handleLogin}
                  style={{ marginTop: 16, width: '100%' }}
                >
                  Sign in with Microsoft
                </Button>
                <Button
                  appearance="subtle"
                  onClick={() => setShowQuickLogin(true)}
                  style={{ marginTop: 8 }}
                >
                  Use email instead
                </Button>
              </>
            ) : (
              <div style={{ marginTop: 16, width: '100%' }}>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleQuickLogin()}
                  placeholder="Enter your email"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: '#374151',
                    border: '1px solid #4B5563',
                    borderRadius: 6,
                    color: 'white',
                    fontSize: 14,
                    marginBottom: 12,
                    boxSizing: 'border-box',
                  }}
                />
                <Button
                  appearance="primary"
                  onClick={handleQuickLogin}
                  disabled={isLoggingIn}
                  style={{
                    width: '100%',
                    opacity: isLoggingIn ? 0.7 : 1,
                    transition: 'opacity 150ms cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                  icon={isLoggingIn ? <PremiumSpinner size={14} color="rgba(255,255,255,0.6)" /> : undefined}
                >
                  {isLoggingIn ? 'Signing in' : 'Sign In'}
                </Button>
                <Button
                  appearance="subtle"
                  onClick={() => setShowQuickLogin(false)}
                  style={{ marginTop: 8 }}
                >
                  Back
                </Button>
              </div>
            )}

            {error && (
              <Text size={200} style={{ color: '#F87171', marginTop: 12 }}>
                {error}
              </Text>
            )}
          </div>
        </div>
      </FluentProvider>
    );
  }

  return (
    <FluentProvider theme={webDarkTheme}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerContent}>
            <Shield24Regular />
            <Text weight="semibold">MARS</Text>
          </div>
          <Text size={200} style={{ color: '#A0A0A0' }}>{user.email}</Text>
        </div>

        {/* Error Display */}
        {error && (
          <div style={styles.errorBanner}>
            <DismissCircle24Filled style={{ color: '#F87171' }} />
            <Text size={200}>{error}</Text>
            <Button
              appearance="subtle"
              size="small"
              onClick={() => setError(null)}
            >
              Dismiss
            </Button>
          </div>
        )}

        {/* Success Display */}
        {successMessage && (
          <div style={styles.successBanner}>
            <CheckmarkCircle24Filled style={{ color: '#4ADE80' }} />
            <Text size={200}>{successMessage}</Text>
          </div>
        )}

        {/* Preview Panel Overlay */}
        {previewState?.isOpen && (
          <div style={styles.previewOverlay}>
            <div style={styles.previewPanel}>
              <Text weight="semibold" size={400}>Preview Change</Text>

              {/* Diff View */}
              <div style={styles.diffView}>
                <div style={styles.diffSection}>
                  <Text size={200} weight="semibold" style={{ color: '#F87171' }}>
                    Original (will be struck through):
                  </Text>
                  <div style={styles.diffText as React.CSSProperties}>
                    <Text size={200} style={{ textDecoration: 'line-through', color: '#FCA5A5' }}>
                      {previewState.originalText.substring(0, 300)}
                      {previewState.originalText.length > 300 ? '...' : ''}
                    </Text>
                  </div>
                </div>

                <div style={styles.diffArrow}>→</div>

                <div style={styles.diffSection}>
                  <Text size={200} weight="semibold" style={{ color: '#4ADE80' }}>
                    Replacement (will be underlined):
                  </Text>
                  <div style={styles.diffText as React.CSSProperties}>
                    <Text size={200} style={{ textDecoration: 'underline', color: '#86EFAC' }}>
                      {previewState.newText.substring(0, 300)}
                      {previewState.newText.length > 300 ? '...' : ''}
                    </Text>
                  </div>
                </div>
              </div>

              {/* Match Info */}
              <div style={styles.matchInfo}>
                <Badge appearance="outline">
                  Match confidence: {previewState.matches[previewState.selectedMatchIndex]?.confidence || 0}%
                </Badge>
                <Badge appearance="outline">
                  Type: {previewState.matches[previewState.selectedMatchIndex]?.matchType || 'unknown'}
                </Badge>
              </div>

              {/* Multiple Match Selector */}
              {previewState.matches.length > 1 && (
                <div style={styles.matchSelector}>
                  <Text size={200} weight="semibold">
                    Found {previewState.matches.length} matches - select which to replace:
                  </Text>
                  <div style={styles.matchList}>
                    {previewState.matches.map((match, idx) => (
                      <Button
                        key={idx}
                        appearance={idx === previewState.selectedMatchIndex ? 'primary' : 'outline'}
                        size="small"
                        onClick={() => selectMatch(idx)}
                        style={{ marginRight: 8, marginBottom: 8 }}
                      >
                        Match {idx + 1} ({match.confidence}%)
                      </Button>
                    ))}
                  </div>
                  <Text size={200} style={{ color: '#A0A0A0', marginTop: 8 }}>
                    Context: {previewState.matches[previewState.selectedMatchIndex]?.context.substring(0, 150)}...
                  </Text>
                </div>
              )}

              {/* Actions */}
              <div style={styles.previewActions}>
                <Button
                  appearance="primary"
                  onClick={confirmChange}
                  disabled={isApplyingChange}
                  icon={isApplyingChange ? <PremiumSpinner size={14} color="rgba(255,255,255,0.6)" /> : <CheckmarkCircle24Filled />}
                  style={{
                    opacity: isApplyingChange ? 0.7 : 1,
                    transition: 'opacity 150ms cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                >
                  {isApplyingChange ? 'Applying change' : 'Apply Change'}
                </Button>
                <Button
                  appearance="outline"
                  onClick={cancelChange}
                  disabled={isApplyingChange}
                  style={{
                    opacity: isApplyingChange ? 0.4 : 1,
                    cursor: isApplyingChange ? 'default' : 'pointer',
                    transition: 'opacity 150ms cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <TabList
          selectedValue={activeTab}
          onTabSelect={handleTabChange}
          style={styles.tabs}
        >
          <Tab value="analyze" icon={<DocumentSearch24Regular />}>
            Analyze
          </Tab>
          <Tab value="clauses" icon={<Library24Regular />}>
            Clauses
          </Tab>
        </TabList>

        {/* Content */}
        <div style={styles.content}>
          {activeTab === 'analyze' && (
            <div style={styles.analyzeTab}>
              {/* Contract Linking Section */}
              <div style={styles.contractSection} ref={contractDropdownRef}>
                <Text size={200} weight="semibold" style={{ marginBottom: 8, display: 'block' }}>
                  Link to Contract (Optional)
                </Text>
                <div style={styles.contractDropdownContainer}>
                  <input
                    type="text"
                    value={contractSearch}
                    onChange={(e) => {
                      setContractSearch(e.target.value);
                      setShowContractDropdown(true);
                    }}
                    onFocus={() => setShowContractDropdown(true)}
                    placeholder={isLoadingContracts ? 'Loading contracts...' : 'Search contracts...'}
                    disabled={isLoadingContracts}
                    style={styles.contractInput}
                  />
                  {selectedContract && (
                    <button
                      onClick={() => {
                        setSelectedContract('');
                        setContractSearch('');
                      }}
                      style={styles.clearButton}
                    >
                      ✕
                    </button>
                  )}
                </div>
                {/* Contract Dropdown */}
                {showContractDropdown && contracts.length > 0 && (
                  <div style={styles.contractDropdown}>
                    {contracts
                      .filter(c =>
                        c.name.toLowerCase().includes(contractSearch.toLowerCase()) ||
                        c.contractType?.some(t => t.toLowerCase().includes(contractSearch.toLowerCase()))
                      )
                      .slice(0, 10)
                      .map((contract) => (
                        <button
                          key={contract.id}
                          onClick={() => {
                            setSelectedContract(contract.id);
                            setContractSearch(contract.name);
                            setShowContractDropdown(false);
                          }}
                          style={{
                            ...styles.contractOption,
                            backgroundColor: selectedContract === contract.id ? '#38BDF8' + '20' : 'transparent',
                          }}
                        >
                          <Text size={200} weight="semibold" style={{ display: 'block' }}>
                            {contract.name}
                          </Text>
                          <Text size={100} style={{ color: '#A0A0A0' }}>
                            {contract.contractType?.join(', ') || 'No Type'}
                            {contract.value ? ` • $${contract.value.toLocaleString()}` : ''}
                          </Text>
                        </button>
                      ))}
                    {contracts.filter(c =>
                      c.name.toLowerCase().includes(contractSearch.toLowerCase())
                    ).length === 0 && (
                      <Text size={200} style={{ padding: 12, color: '#A0A0A0', textAlign: 'center', display: 'block' }}>
                        No contracts found
                      </Text>
                    )}
                  </div>
                )}
                {selectedContract && (
                  <div style={styles.selectedContractBadge}>
                    <Badge appearance="outline" color="brand">
                      Linked: {contracts.find(c => c.id === selectedContract)?.name || 'Contract'}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Analyze Controls - Flat, Microsoft-native */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Button Row - Primary action emphasized */}
                <div style={styles.analyzeButtons}>
                  {/* Primary action - subtle emphasis */}
                  <button
                    onClick={analyzeDocument}
                    disabled={isAnalyzing}
                    style={{
                      flex: 1,
                      padding: '8px 16px',
                      backgroundColor: isAnalyzing ? 'transparent' : 'rgba(86, 156, 214, 0.08)',
                      border: '1px solid rgba(86, 156, 214, 0.25)',
                      color: isAnalyzing ? '#666666' : '#6cb6ff',
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: isAnalyzing ? 'default' : 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Analyze Document
                  </button>
                  {/* Secondary action - quieter */}
                  <button
                    onClick={analyzeSelection}
                    disabled={isAnalyzing}
                    title="Select text in Word and click to analyze just that section"
                    style={{
                      padding: '8px 12px',
                      backgroundColor: 'transparent',
                      border: '1px solid #404040',
                      color: isAnalyzing ? '#505050' : '#808080',
                      fontSize: 12,
                      cursor: isAnalyzing ? 'default' : 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Analyze Selection
                  </button>
                </div>

                {/* Loading State - Full width progress bar + muted text */}
                {isAnalyzing && (
                  <div style={{ marginTop: 4 }}>
                    {/* Thin indeterminate progress bar */}
                    <div style={{
                      width: '100%',
                      height: 2,
                      backgroundColor: '#333333',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        width: '30%',
                        height: '100%',
                        backgroundColor: '#569cd6',
                        animation: 'premium-shimmer 2s ease-in-out infinite',
                      }} />
                    </div>
                    <span style={{
                      display: 'block',
                      marginTop: 8,
                      fontSize: 12,
                      color: '#808080',
                    }}>
                      Analyzing clauses...
                    </span>
                  </div>
                )}
              </div>

              {/* Analysis Results - Dashboard Style */}
              {analysisResult && (
                <div style={styles.results}>
                  {/* Risk Summary Bar */}
                  {/* Results line - muted, informational */}
                  <div style={styles.riskSummaryBar}>
                    <span style={{ fontSize: 11, color: '#606060', opacity: 0.8 }}>Results:</span>
                    <span style={{ fontSize: 11, color: '#b05050', opacity: 0.75 }}>{analysisResult.riskScores.summary.high} High</span>
                    <span style={{ fontSize: 9, color: '#505050', opacity: 0.5 }}>•</span>
                    <span style={{ fontSize: 11, color: '#a08000', opacity: 0.75 }}>{analysisResult.riskScores.summary.medium} Medium</span>
                    <span style={{ fontSize: 9, color: '#505050', opacity: 0.5 }}>•</span>
                    <span style={{ fontSize: 11, color: '#508050', opacity: 0.75 }}>{analysisResult.riskScores.summary.low} Low</span>
                  </div>

                  {/* Insert All Changes - simple link style */}
                  {analysisResult.sections.length > 0 && !allChangesInserted && (
                    <button
                      onClick={insertAllChanges}
                      disabled={isApplyingChange}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: isApplyingChange ? '#666666' : '#569cd6',
                        fontSize: 12,
                        cursor: isApplyingChange ? 'default' : 'pointer',
                        padding: '8px 0',
                        textAlign: 'left',
                      }}
                    >
                      {isApplyingChange ? 'Inserting changes...' : 'Insert All Changes into Document'}
                    </button>
                  )}
                  {allChangesInserted && (
                    <span style={{ fontSize: 12, color: '#6a9955', padding: '8px 0', display: 'block' }}>
                      ✓ All changes inserted
                    </span>
                  )}

                  {/* Modifications Section */}
                  {analysisResult.sections.filter(s => !s.isNewSection).length > 0 && (
                    <div style={styles.sectionList}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: '#cccccc', marginBottom: 8, display: 'block', marginTop: 12 }}>
                        Modifications ({analysisResult.sections.filter(s => !s.isNewSection).length})
                      </span>
                      {analysisResult.sections.filter(s => !s.isNewSection).map((section, index) => (
                        <div key={`mod-${section.sectionNumber}-${index}`} style={styles.sectionCard}>
                          {/* Flat header: HIGH · INDEMNIFICATION    2 changes */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: section.riskLevel === 'high' ? '#d16969' : section.riskLevel === 'medium' ? '#cca700' : '#6a9955',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                            }}>
                              {section.riskLevel}
                            </span>
                            <span style={{ color: '#404040' }}>·</span>
                            <span style={{ fontSize: 13, fontWeight: 400, color: '#b0b0b0' }}>
                              {section.sectionTitle || `Section ${section.sectionNumber}`}
                            </span>
                            {section.changes && section.changes.length > 0 && (
                              <span style={{ fontSize: 10, color: '#606060', marginLeft: 'auto' }}>
                                {section.changes.length} change{section.changes.length !== 1 ? 's' : ''}
                              </span>
                            )}
                            {appliedSections.has(section.sectionTitle) && (
                              <CheckmarkCircle24Filled style={{ color: '#6a9955', marginLeft: 'auto', width: 16, height: 16 }} />
                            )}
                          </div>

                          {/* Rationale */}
                          <div style={{ fontSize: 12, color: '#9d9d9d', marginTop: 6, lineHeight: 1.5 }}>
                            {section.rationale}
                          </div>

                          {/* Redlines - clinical, not aggressive */}
                          {section.changes && section.changes.length > 0 && !appliedSections.has(section.sectionTitle) && (
                            <div style={{ marginTop: 10, paddingLeft: 0 }}>
                              {section.changes.slice(0, 3).map((change, idx) => (
                                <div key={idx} style={{ marginBottom: 6, fontSize: 12, lineHeight: 1.6 }}>
                                  <span style={{ color: '#b55a5a', textDecoration: 'line-through', fontWeight: 400 }}>
                                    {change.find.substring(0, 80)}{change.find.length > 80 ? '...' : ''}
                                  </span>
                                  <br />
                                  <span style={{ color: '#5a9e5a', fontWeight: 400 }}>
                                    → {change.replace.substring(0, 80)}{change.replace.length > 80 ? '...' : ''}
                                  </span>
                                </div>
                              ))}
                              {section.changes.length > 3 && (
                                <span style={{ fontSize: 11, color: '#666666' }}>
                                  +{section.changes.length - 3} more changes
                                </span>
                              )}
                            </div>
                          )}

                          {/* Actions - primary/secondary hierarchy */}
                          <div style={{ display: 'flex', gap: 16, marginTop: 12, paddingTop: 10 }}>
                            {/* Primary action - brighter */}
                            <button
                              onClick={() => insertSingleSection(section)}
                              disabled={isApplyingChange || appliedSections.has(section.sectionTitle)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: appliedSections.has(section.sectionTitle) ? '#505050' : '#6cb6ff',
                                fontSize: 12,
                                fontWeight: appliedSections.has(section.sectionTitle) ? 400 : 500,
                                cursor: appliedSections.has(section.sectionTitle) ? 'default' : 'pointer',
                                padding: 0,
                              }}
                            >
                              {appliedSections.has(section.sectionTitle) ? 'Applied' : 'Apply Changes'}
                            </button>
                            {/* Secondary actions - muted */}
                            <button
                              onClick={() => highlightSection(section)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#707070',
                                fontSize: 12,
                                cursor: 'pointer',
                                padding: 0,
                              }}
                            >
                              Find in Doc
                            </button>
                            <button
                              onClick={() => reanalyzeClause(section.sectionTitle, section.originalText || '')}
                              disabled={isAnalyzing}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: isAnalyzing ? '#505050' : '#707070',
                                fontSize: 12,
                                cursor: isAnalyzing ? 'default' : 'pointer',
                                padding: 0,
                              }}
                            >
                              Re-analyze
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* New Sections to Insert - Flat design */}
                  {analysisResult.sections.filter(s => s.isNewSection).length > 0 && (
                    <div style={{ marginTop: 16, borderTop: '1px solid #333333', paddingTop: 12 }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: '#cccccc', display: 'block', marginBottom: 4 }}>
                        New Sections ({analysisResult.sections.filter(s => s.isNewSection).length})
                      </span>
                      <span style={{ fontSize: 11, color: '#666666', display: 'block', marginBottom: 12 }}>
                        These will be added to your contract
                      </span>
                      {analysisResult.sections.filter(s => s.isNewSection).map((section, index) => (
                        <div key={`new-${index}`} style={styles.sectionCard}>
                          {/* Flat header: NEW · LIMITATION OF LIABILITY */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: '#569cd6',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                            }}>
                              NEW
                            </span>
                            <span style={{ color: '#404040' }}>·</span>
                            <span style={{ fontSize: 13, fontWeight: 400, color: '#b0b0b0' }}>
                              {section.sectionTitle}
                            </span>
                            {appliedSections.has(section.sectionTitle) && (
                              <CheckmarkCircle24Filled style={{ color: '#6a9955', marginLeft: 'auto', width: 16, height: 16 }} />
                            )}
                          </div>

                          <div style={{ fontSize: 12, color: '#9d9d9d', marginTop: 6, lineHeight: 1.5 }}>
                            {section.rationale}
                          </div>

                          {section.insertAfter && (
                            <div style={{ fontSize: 11, color: '#808080', marginTop: 4 }}>
                              Insert after: <span style={{ color: '#569cd6' }}>{section.insertAfter}</span>
                            </div>
                          )}

                          {/* Full content preview - scrollable */}
                          {section.revisedText && !appliedSections.has(section.sectionTitle) && (
                            <div style={{ marginTop: 10 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                <span style={{ fontSize: 11, color: '#666666' }}>Section content:</span>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(section.revisedText);
                                    setSuccessMessage('Copied to clipboard');
                                    setTimeout(() => setSuccessMessage(null), 2000);
                                  }}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#569cd6',
                                    fontSize: 11,
                                    cursor: 'pointer',
                                    padding: 0,
                                  }}
                                >
                                  Copy
                                </button>
                              </div>
                              <div style={styles.newSectionTextBox}>
                                <span style={{ color: '#5a9e5a', whiteSpace: 'pre-wrap', fontSize: 11 }}>
                                  {section.revisedText}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Actions - flat text buttons */}
                          {/* Actions - primary/secondary hierarchy */}
                          <div style={{ display: 'flex', gap: 16, marginTop: 12, paddingTop: 10 }}>
                            {/* Primary action */}
                            <button
                              onClick={() => insertSingleSection(section)}
                              disabled={isApplyingChange || appliedSections.has(section.sectionTitle)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: appliedSections.has(section.sectionTitle) ? '#505050' : '#6cb6ff',
                                fontSize: 12,
                                fontWeight: appliedSections.has(section.sectionTitle) ? 400 : 500,
                                cursor: appliedSections.has(section.sectionTitle) ? 'default' : 'pointer',
                                padding: 0,
                              }}
                            >
                              {appliedSections.has(section.sectionTitle) ? 'Inserted' : 'Insert Section'}
                            </button>
                            {/* Secondary action */}
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(section.revisedText);
                                setSuccessMessage('Copied to clipboard');
                                setTimeout(() => setSuccessMessage(null), 2000);
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#707070',
                                fontSize: 12,
                                cursor: 'pointer',
                                padding: 0,
                              }}
                            >
                              Copy Text
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Summary List */}
                  {analysisResult.summary.length > 0 && (
                    <div style={styles.summaryList}>
                      <Text weight="semibold" style={{ marginBottom: 8, display: 'block' }}>
                        Summary of Changes:
                      </Text>
                      {analysisResult.summary.map((item, idx) => (
                        <Text key={idx} size={200} style={{ display: 'block', marginBottom: 4, color: '#D1D5DB' }}>
                          • {item}
                        </Text>
                      ))}
                    </div>
                  )}

                  {/* No changes found */}
                  {analysisResult.sections.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '24px 0' }}>
                      <CheckmarkCircle24Filled style={{ color: '#6a9955', width: 24, height: 24 }} />
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#cccccc', marginTop: 8 }}>
                        No Material Risks Found
                      </div>
                      <div style={{ fontSize: 12, color: '#666666', marginTop: 4 }}>
                        This contract appears to be favorable or already aligned with MARS positions.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'clauses' && (
            <div style={styles.clausesTab}>
              <Button
                appearance="subtle"
                icon={<ArrowSync24Regular />}
                onClick={loadClauses}
                disabled={isLoadingClauses}
              >
                Refresh
              </Button>

              {isLoadingClauses ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  padding: 24,
                }}>
                  <PremiumSpinner size={16} color="rgba(148, 163, 184, 0.5)" />
                  <span style={{
                    fontSize: 13,
                    fontWeight: 450,
                    color: 'rgba(148, 163, 184, 0.6)',
                    letterSpacing: '0.01em',
                  }}>
                    Loading clauses
                  </span>
                </div>
              ) : clauses.length === 0 ? (
                <Text style={{ color: '#A0A0A0', textAlign: 'center' }}>
                  No clauses available. Add clauses in the MARS web app.
                </Text>
              ) : (
                <div style={styles.clauseList}>
                  {clauses.map((clause) => (
                    <div key={clause.id} style={styles.clauseCard}>
                      {/* Flat clause header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: clause.risk_level === 'high' ? '#d16969' : clause.risk_level === 'medium' ? '#cca700' : '#6a9955',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                        }}>
                          {clause.risk_level}
                        </span>
                        <span style={{ color: '#4d4d4d' }}>·</span>
                        <span style={{ fontSize: 13, fontWeight: 500, color: '#cccccc' }}>
                          {clause.name}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: '#666666', marginTop: 2 }}>
                        {clause.category}
                      </div>
                      <div style={styles.clauseText}>
                        {clause.primary_text.substring(0, 150)}
                        {clause.primary_text.length > 150 ? '...' : ''}
                      </div>
                      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                        <button
                          onClick={() => insertClause(clause.primary_text)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#569cd6',
                            fontSize: 12,
                            cursor: 'pointer',
                            padding: 0,
                          }}
                        >
                          Insert Primary
                        </button>
                        {clause.fallback_text && (
                          <button
                            onClick={() => insertClause(clause.fallback_text!)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#569cd6',
                              fontSize: 12,
                              cursor: 'pointer',
                              padding: 0,
                            }}
                          >
                            Insert Fallback
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </FluentProvider>
  );
}

// ============================================
// MICROSOFT-NATIVE FLAT DESIGN SYSTEM
// Quiet, flat, serious legal tooling aesthetic
// ============================================

// NO score circles - removed for flat design

// Styles - Microsoft-native flat design (Word panel aesthetic)
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: '#1e1e1e',
    color: '#cccccc',
    fontFamily: '"Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif',
    fontSize: 13,
    lineHeight: 1.4,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 16px',
    borderBottom: '1px solid #333333',
    backgroundColor: '#252526',
  },
  headerContent: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 16px',
    backgroundColor: '#5a1d1d',
    borderBottom: '1px solid #6e2020',
    color: '#f48771',
    fontSize: 12,
  },
  tabs: {
    borderBottom: '1px solid #333333',
    backgroundColor: '#252526',
    padding: '0 8px',
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: '12px 16px',
    backgroundColor: '#1e1e1e',
  },
  loginCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    padding: 24,
    margin: 'auto',
    maxWidth: 280,
  },
  analyzeTab: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  results: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    marginTop: 12,
  },
  scoreCard: {
    padding: 12,
  },
  scoreContent: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  summaryCard: {
    padding: 12,
  },
  riskHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  riskContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    paddingTop: 8,
  },
  suggestion: {
    padding: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  clausesTab: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },
  clauseList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },
  clauseCard: {
    padding: '14px 0',
    borderBottom: '1px solid #3a3a3a',
    marginBottom: 2,
  },
  clauseText: {
    padding: '6px 0',
    color: '#9d9d9d',
    fontSize: 12,
    lineHeight: 1.5,
  },
  clauseActions: {
    display: 'flex',
    gap: 8,
    paddingTop: 8,
  },
  successBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 16px',
    backgroundColor: '#1d3d1d',
    borderBottom: '1px solid #2d5d2d',
    color: '#89d185',
    fontSize: 12,
  },
  previewOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 16,
  },
  previewPanel: {
    backgroundColor: '#252526',
    padding: 16,
    maxWidth: 400,
    maxHeight: '85vh',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    border: '1px solid #454545',
  },
  diffView: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  diffSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  diffText: {
    padding: 10,
    backgroundColor: '#1e1e1e',
    maxHeight: 120,
    overflowY: 'auto',
    border: '1px solid #333333',
    fontSize: 12,
  },
  diffArrow: {
    textAlign: 'center',
    fontSize: 14,
    color: '#666666',
    padding: '2px 0',
  },
  matchInfo: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  matchSelector: {
    padding: 10,
    backgroundColor: '#1e1e1e',
    border: '1px solid #333333',
  },
  matchList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  previewActions: {
    display: 'flex',
    gap: 8,
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  locationBox: {
    padding: 8,
    backgroundColor: '#1e1e1e',
    borderLeft: '2px solid #cca700',
  },
  fixItSection: {
    padding: 10,
    backgroundColor: '#1d3d1d',
    marginTop: 8,
    border: '1px solid #2d5d2d',
  },
  fixItButtons: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
  },
  riskSummaryBar: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 0 10px 0',
    gap: 12,
    borderBottom: '1px solid #3a3a3a',
    marginBottom: 12,
  },
  riskBadgeLarge: {
    fontSize: 12,
    fontWeight: 400,
    color: '#9d9d9d',
  },
  sectionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },
  sectionCard: {
    padding: '16px 0',
    borderBottom: '1px solid #3a3a3a',
    marginBottom: 2,
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  sectionActions: {
    display: 'flex',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
  },
  summaryList: {
    marginTop: 12,
    padding: '12px 0',
    borderTop: '1px solid #333333',
  },
  contractSection: {
    marginBottom: 12,
    position: 'relative',
  },
  contractDropdownContainer: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  contractInput: {
    width: '100%',
    padding: '8px 32px 8px 10px',
    backgroundColor: '#3c3c3c',
    border: '1px solid #454545',
    color: '#cccccc',
    fontSize: 13,
    outline: 'none',
  },
  clearButton: {
    position: 'absolute',
    right: 8,
    background: 'none',
    border: 'none',
    color: '#666666',
    cursor: 'pointer',
    fontSize: 12,
    padding: 4,
    lineHeight: 1,
  },
  contractDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 2,
    backgroundColor: '#3c3c3c',
    border: '1px solid #454545',
    maxHeight: 200,
    overflowY: 'auto',
    zIndex: 100,
  },
  contractOption: {
    width: '100%',
    textAlign: 'left',
    padding: '8px 10px',
    border: 'none',
    borderBottom: '1px solid #454545',
    background: 'none',
    cursor: 'pointer',
    display: 'block',
    color: '#cccccc',
    fontSize: 12,
  },
  selectedContractBadge: {
    marginTop: 8,
  },
  changesList: {
    marginTop: 8,
    padding: '8px 0',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  changeItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    paddingBottom: 6,
    borderBottom: '1px solid #333333',
  },
  newSectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  newSectionPreview: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#1e1e1e',
    borderLeft: '2px solid #569cd6',
  },
  newSectionFullContent: {
    marginTop: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  newSectionContentHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  newSectionTextBox: {
    padding: 10,
    backgroundColor: '#1e1e1e',
    borderLeft: '2px solid #569cd6',
    maxHeight: 200,
    overflowY: 'auto',
    fontFamily: '"Consolas", "Courier New", monospace',
    fontSize: 11,
    lineHeight: 1.5,
  },
  analyzeButtons: {
    display: 'flex',
    gap: 8,
    width: '100%',
  },
};
