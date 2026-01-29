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
  category_id?: string;
  risk_level: string;
  primary_text: string;
  fallback_text?: string;
  last_resort_text?: string;
  tags?: string[];
  usage_count?: number;
}

interface ClauseCategory {
  id: string;
  name: string;
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
/**
 * Insert a new section at the current cursor position.
 * User-controlled placement is 100% reliable - no auto-detection needed.
 */
async function insertNewSectionAtCursor(
  context: Word.RequestContext,
  newSectionContent: string,
  trackChangesEnabled: boolean
): Promise<{ success: boolean; error?: string }> {
  console.log('insertNewSectionAtCursor: inserting at cursor position');

  // Get current selection/cursor position
  const selection = context.document.getSelection();

  // Insert the new section at cursor with formatting
  const insertText = '\n\n' + newSectionContent + '\n\n';
  const newRange = selection.insertText(insertText, Word.InsertLocation.after);

  // Style the new content if track changes not enabled
  if (!trackChangesEnabled) {
    newRange.font.underline = Word.UnderlineType.single;
    newRange.font.color = '#16A34A';
  }

  newRange.select();
  await context.sync();

  console.log('insertNewSectionAtCursor: successfully inserted new section');
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

  // Analysis depth toggle - controls what risk levels AI surfaces
  const [riskLevelFilter, setRiskLevelFilter] = useState<'high' | 'medium' | 'all'>('high');

  // Clauses tab filters
  const [clauseCategories, setClauseCategories] = useState<ClauseCategory[]>([]);
  const [selectedClauseCategory, setSelectedClauseCategory] = useState<string>('');
  const [clauseSearch, setClauseSearch] = useState('');
  const [expandedClauseId, setExpandedClauseId] = useState<string | null>(null);
  const [fullViewClause, setFullViewClause] = useState<{ clauseId: string; position: 'primary' | 'fallback' | 'lastresort' } | null>(null);

  // Save to History state
  const [originalDocumentText, setOriginalDocumentText] = useState<string>('');
  const [isSavingToHistory, setIsSavingToHistory] = useState(false);
  const [savedToHistory, setSavedToHistory] = useState(false);
  const [savedReviewId, setSavedReviewId] = useState<string | null>(null);

  // Submit for Approval state
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);
  const [submittedForApproval, setSubmittedForApproval] = useState(false);

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

  // Get the document as base64 for OneDrive upload
  const getDocumentAsBase64 = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      // Use Office.context.document.getFileAsync to get the actual .docx file
      Office.context.document.getFileAsync(
        Office.FileType.Compressed, // Gets .docx format
        { sliceSize: 4194304 }, // 4MB chunks (max allowed)
        async (result) => {
          if (result.status === Office.AsyncResultStatus.Failed) {
            console.error('Failed to get document file:', result.error);
            resolve(''); // Return empty string on failure (non-blocking)
            return;
          }

          try {
            const file = result.value;
            const sliceCount = file.sliceCount;
            const slices: Uint8Array[] = [];

            // Read all slices
            for (let i = 0; i < sliceCount; i++) {
              const slice = await new Promise<Uint8Array>((resolveSlice, rejectSlice) => {
                file.getSliceAsync(i, (sliceResult) => {
                  if (sliceResult.status === Office.AsyncResultStatus.Failed) {
                    rejectSlice(new Error('Failed to get slice'));
                    return;
                  }
                  resolveSlice(new Uint8Array(sliceResult.value.data));
                });
              });
              slices.push(slice);
            }

            // Close the file
            file.closeAsync();

            // Combine all slices into a single array
            const totalLength = slices.reduce((sum, s) => sum + s.length, 0);
            const combined = new Uint8Array(totalLength);
            let offset = 0;
            for (const slice of slices) {
              combined.set(slice, offset);
              offset += slice.length;
            }

            // Convert to base64
            const base64 = btoa(
              combined.reduce((data, byte) => data + String.fromCharCode(byte), '')
            );

            resolve(base64);
          } catch (err) {
            console.error('Error processing document file:', err);
            resolve(''); // Return empty string on failure (non-blocking)
          }
        }
      );
    });
  }, []);

  // Save current document state to history
  // This captures the ACTUAL document with only the changes the user inserted
  const saveToHistory = async () => {
    if (!user) {
      setError('Please log in first');
      return;
    }

    if (!analysisResult) {
      setError('No analysis to save');
      return;
    }

    setIsSavingToHistory(true);
    setError(null);

    try {
      // Read the CURRENT Word document text (with user's applied changes)
      const [currentDocumentText, documentName, documentFile] = await Promise.all([
        getDocumentText(),
        getDocumentName(),
        getDocumentAsBase64(), // Get actual .docx file for OneDrive upload
      ]);

      // Get linked contract info
      const selectedContractData = contracts.find(c => c.id === selectedContract);
      const historyProvisionName = selectedContractData?.name || documentName;

      // Generate a simple diff summary based on what sections were applied
      const appliedSummary = analysisResult.sections
        .filter(s => appliedSections.has(s.sectionTitle))
        .map(s => `[${s.sectionTitle}] ${s.rationale || 'Modified'}`);

      // If no changes were applied, note that
      const summary = appliedSummary.length > 0
        ? appliedSummary
        : ['No changes applied - document reviewed but unchanged'];

      const token = localStorage.getItem('mars_token');
      const response = await fetch(`${API_BASE}/api/contracts/review/history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          contractId: selectedContract || undefined,
          contractName: selectedContractData?.name || undefined,
          provisionName: historyProvisionName,
          originalText: originalDocumentText, // The document BEFORE any changes
          redlinedText: currentDocumentText,  // The document AFTER user's changes (we'll use this as the "modified" view)
          modifiedText: currentDocumentText,  // Current state of the document
          summary: summary,
          status: 'draft',
          documentFile: documentFile || undefined, // Include document file for OneDrive upload
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save to history');
      }

      const responseData = await response.json();
      setSavedToHistory(true);
      setSavedReviewId(responseData.review?.id || null);
      setSuccessMessage(`Saved to history: ${historyProvisionName}`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save to history');
      console.error('Save to history error:', err);
    } finally {
      setIsSavingToHistory(false);
    }
  };

  // Submit for approval - sends to admin for review
  const submitForApproval = async (reviewId?: string) => {
    const idToSubmit = reviewId || savedReviewId;

    if (!user) {
      setError('Please log in first');
      return;
    }

    if (!idToSubmit) {
      setError('No review saved yet. Please save to history first.');
      return;
    }

    if (!analysisResult) {
      setError('No analysis available');
      return;
    }

    setIsSubmittingApproval(true);
    setError(null);

    try {
      // Get contract name for the approval request
      const documentName = await getDocumentName();
      const selectedContractData = contracts.find(c => c.id === selectedContract);
      const contractName = selectedContractData?.name || documentName;

      // Generate summary preview from applied changes
      const summaryPreview = analysisResult.sections
        .filter(s => appliedSections.has(s.sectionTitle))
        .map(s => `[${s.riskLevel?.toUpperCase()}] ${s.sectionTitle}: ${s.rationale || 'Modified'}`)
        .slice(0, 5);

      const token = localStorage.getItem('mars_token');
      const response = await fetch(`${API_BASE}/api/contracts/review/request-approval`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reviewId: idToSubmit,
          contractName: contractName,
          submittedBy: user.email,
          summaryPreview: summaryPreview,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to submit for approval');
      }

      const result = await response.json();
      setSubmittedForApproval(true);
      setSuccessMessage(`Submitted for approval! ${result.emailsSent || 0} admin(s) notified.`);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit for approval');
      console.error('Submit for approval error:', err);
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  // Save to history AND submit for approval in one step
  const saveAndSubmitForApproval = async () => {
    if (!user) {
      setError('Please log in first');
      return;
    }

    if (!analysisResult) {
      setError('No analysis to save');
      return;
    }

    setIsSavingToHistory(true);
    setError(null);

    try {
      // Read the CURRENT Word document text (with user's applied changes)
      const [currentDocumentText, documentName, documentFile] = await Promise.all([
        getDocumentText(),
        getDocumentName(),
        getDocumentAsBase64(),
      ]);

      // Get linked contract info
      const selectedContractData = contracts.find(c => c.id === selectedContract);
      const historyProvisionName = selectedContractData?.name || documentName;

      // Generate a simple diff summary based on what sections were applied
      const appliedSummary = analysisResult.sections
        .filter(s => appliedSections.has(s.sectionTitle))
        .map(s => `[${s.sectionTitle}] ${s.rationale || 'Modified'}`);

      const summary = appliedSummary.length > 0
        ? appliedSummary
        : ['No changes applied - document reviewed but unchanged'];

      const token = localStorage.getItem('mars_token');

      // First, save to history
      const historyResponse = await fetch(`${API_BASE}/api/contracts/review/history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          contractId: selectedContract || undefined,
          contractName: selectedContractData?.name || undefined,
          provisionName: historyProvisionName,
          originalText: originalDocumentText,
          redlinedText: currentDocumentText,
          modifiedText: currentDocumentText,
          summary: summary,
          status: 'draft',
          documentFile: documentFile || undefined,
        }),
      });

      if (!historyResponse.ok) {
        const errorData = await historyResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save to history');
      }

      const historyData = await historyResponse.json();
      const reviewId = historyData.review?.id;

      if (!reviewId) {
        throw new Error('No review ID returned from save');
      }

      setSavedToHistory(true);
      setSavedReviewId(reviewId);

      // Now submit for approval
      setIsSavingToHistory(false);
      setIsSubmittingApproval(true);

      const summaryPreview = analysisResult.sections
        .filter(s => appliedSections.has(s.sectionTitle))
        .map(s => `[${s.riskLevel?.toUpperCase()}] ${s.sectionTitle}: ${s.rationale || 'Modified'}`)
        .slice(0, 5);

      const approvalResponse = await fetch(`${API_BASE}/api/contracts/review/request-approval`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reviewId: reviewId,
          contractName: selectedContractData?.name || documentName,
          submittedBy: user.email,
          summaryPreview: summaryPreview,
        }),
      });

      if (!approvalResponse.ok) {
        const errorData = await approvalResponse.json().catch(() => ({}));
        // Still saved to history, just approval failed
        setSuccessMessage(`Saved to history but approval submission failed: ${errorData.error || 'Unknown error'}`);
        setTimeout(() => setSuccessMessage(null), 5000);
        return;
      }

      const approvalResult = await approvalResponse.json();
      setSubmittedForApproval(true);
      setSuccessMessage(`Saved and submitted for approval! ${approvalResult.emailsSent || 0} admin(s) notified.`);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save and submit');
      console.error('Save and submit error:', err);
    } finally {
      setIsSavingToHistory(false);
      setIsSubmittingApproval(false);
    }
  };

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
    setSavedToHistory(false); // Reset history save state for new analysis
    setSavedReviewId(null);
    setSubmittedForApproval(false);

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
          riskLevel: riskLevelFilter, // Pass risk level filter to control analysis depth
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Analysis failed');
      }

      const result: DashboardAnalysisResult = await response.json();
      setAnalysisResult(result);

      // Store the original document text for later comparison when saving to history
      setOriginalDocumentText(documentText);

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
    if (!analysisResult || !analysisResult.sections || analysisResult.sections.length === 0) {
      setError('No changes to insert');
      return;
    }

    setIsApplyingChange(true);
    setError(null);
    let appliedCount = 0;
    const newApplied = new Set(appliedSections);
    const failedSections: string[] = [];
    // Count new sections that require cursor placement (skipped in bulk apply)
    const newSectionsCount = analysisResult.sections.filter(
      s => s.isNewSection && !appliedSections.has(s.sectionTitle)
    ).length;

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

        // Step 5: Note - New sections are skipped in bulk apply
        // They require cursor placement (user positions cursor, then clicks "Insert at Cursor")
        if (newSectionsCount > 0) {
          console.log(`Skipping ${newSectionsCount} new sections - these require cursor placement`);
        }
      });

      setAppliedSections(newApplied);
      setAllChangesInserted(failedSections.length === 0);

      if (appliedCount > 0) {
        let message = failedSections.length > 0
          ? `Applied ${appliedCount} changes. Failed: ${failedSections.join(', ')}`
          : `Applied ${appliedCount} changes successfully`;
        if (newSectionsCount > 0) {
          message += `. ${newSectionsCount} new section${newSectionsCount > 1 ? 's' : ''} require cursor placement.`;
        }
        setSuccessMessage(message);
        setTimeout(() => setSuccessMessage(null), 5000);
      } else if (newSectionsCount > 0) {
        setSuccessMessage(`No modifications to apply. ${newSectionsCount} new section${newSectionsCount > 1 ? 's' : ''} require cursor placement.`);
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        setError('Could not apply any changes. The document text may have changed.');
      }
    } catch (err) {
      console.error('Insert all changes error:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      // Show detailed error for debugging
      setError(`Failed to insert changes: ${errorMessage || 'Unknown error. Check console for details.'}`);
    } finally {
      setIsApplyingChange(false);
    }
  };

  // Insert a single section change into Word document using Track Changes
  // NEW: Supports both changes array (new format) and originalText/revisedText (legacy)
  const insertSingleSection = async (section: DashboardSection) => {
    // Check if this is a new section to insert
    if (section.isNewSection) {
      if (!section.revisedText) {
        setError('Missing content for new section');
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
          // Insert new section at cursor position (user-controlled placement)
          const result = await insertNewSectionAtCursor(
            context,
            section.revisedText,
            trackChangesEnabled
          );

          if (!result.success) {
            setError(result.error || 'Failed to insert section at cursor');
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
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Failed to apply change: ${errorMessage || 'Unknown error. Check console for details.'}`);
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

  // Load clause library with optional filters
  const loadClauses = async (category?: string, search?: string) => {
    setIsLoadingClauses(true);
    try {
      const token = localStorage.getItem('mars_token');
      const params = new URLSearchParams();
      if (category) params.append('category', category);
      if (search) params.append('search', search);

      const url = `${API_BASE}/api/word-addin/clauses${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setClauses(data.clauses || []);
        // Set categories if available (only on first load)
        if (data.categories && clauseCategories.length === 0) {
          setClauseCategories(data.categories);
        }
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
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Failed to apply change: ${errorMessage || 'Unknown error. Check console for details.'}`);
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
      loadClauses(selectedClauseCategory, clauseSearch);
    }
  };

  // Handle clause category filter change
  const handleClauseCategoryChange = (categoryId: string) => {
    setSelectedClauseCategory(categoryId);
    loadClauses(categoryId, clauseSearch);
  };

  // Handle clause search
  const handleClauseSearch = (searchTerm: string) => {
    setClauseSearch(searchTerm);
    // Debounce the search
    if (searchTerm.length >= 2 || searchTerm.length === 0) {
      loadClauses(selectedClauseCategory, searchTerm);
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
            {/* App icon with glow */}
            <div style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #0A84FF 0%, #0066CC 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(10, 132, 255, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
              marginBottom: 8,
            }}>
              <Shield24Regular style={{ width: 28, height: 28, color: '#fff' }} />
            </div>
            <span style={{
              fontSize: 20,
              fontWeight: 700,
              color: 'rgba(235, 240, 255, 0.95)',
              letterSpacing: '-0.03em',
              textShadow: '0 2px 4px rgba(0,0,0,0.3)',
            }}>
              MARS Contracts
            </span>
            <span style={{
              fontSize: 13,
              color: 'rgba(235, 240, 255, 0.5)',
              textAlign: 'center',
              lineHeight: 1.5,
            }}>
              Sign in to analyze contracts
            </span>

            {!showQuickLogin ? (
              <>
                <button
                  onClick={handleLogin}
                  style={{
                    marginTop: 16,
                    width: '100%',
                    padding: '14px 20px',
                    background: 'linear-gradient(180deg, #0A84FF 0%, #0066CC 100%)',
                    border: 'none',
                    borderRadius: 12,
                    color: '#ffffff',
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    letterSpacing: '-0.01em',
                    boxShadow: '0 4px 20px rgba(10, 132, 255, 0.5), inset 0 1px 0 rgba(255,255,255,0.2)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  Sign in with Microsoft
                </button>
                <button
                  onClick={() => setShowQuickLogin(true)}
                  style={{
                    marginTop: 8,
                    background: 'none',
                    border: 'none',
                    padding: '10px',
                    color: 'rgba(235, 240, 255, 0.5)',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Use email instead
                </button>
              </>
            ) : (
              <div style={{ marginTop: 12, width: '100%' }}>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleQuickLogin()}
                  placeholder="Enter your email"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    border: 'none',
                    borderRadius: 8,
                    color: 'rgba(255,255,255,0.9)',
                    fontSize: 14,
                    marginBottom: 12,
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={handleQuickLogin}
                  disabled={isLoggingIn}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: isLoggingIn ? 'rgba(255,255,255,0.04)' : 'linear-gradient(180deg, rgba(88, 166, 255, 0.15) 0%, rgba(88, 166, 255, 0.08) 100%)',
                    border: 'none',
                    borderRadius: 8,
                    color: isLoggingIn ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.95)',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: isLoggingIn ? 'default' : 'pointer',
                    fontFamily: 'inherit',
                    letterSpacing: '-0.01em',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  {isLoggingIn && <PremiumSpinner size={14} color="rgba(255,255,255,0.6)" />}
                  {isLoggingIn ? 'Signing in...' : 'Sign In'}
                </button>
                <button
                  onClick={() => setShowQuickLogin(false)}
                  style={{
                    marginTop: 4,
                    background: 'none',
                    border: 'none',
                    padding: '8px',
                    color: 'rgba(255,255,255,0.45)',
                    fontSize: 12,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Back
                </button>
              </div>
            )}

            {error && (
              <span style={{ fontSize: 12, color: 'rgba(248, 113, 113, 0.9)', marginTop: 12, textAlign: 'center' }}>
                {error}
              </span>
            )}
          </div>
        </div>
      </FluentProvider>
    );
  }

  return (
    <FluentProvider theme={webDarkTheme}>
      <div style={styles.container}>
        {/* Header - Apple Native glass toolbar */}
        <div style={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              background: 'linear-gradient(135deg, #0A84FF 0%, #0066CC 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(10, 132, 255, 0.4)',
            }}>
              <Shield24Regular style={{ width: 16, height: 16, color: '#fff' }} />
            </div>
            <span style={{
              fontSize: 15,
              fontWeight: 600,
              color: 'rgba(235, 240, 255, 0.95)',
              letterSpacing: '-0.02em',
              textShadow: '0 1px 2px rgba(0,0,0,0.3)'
            }}>
              MARS Contracts
            </span>
          </div>
          <span style={{
            fontSize: 11,
            color: 'rgba(235, 240, 255, 0.5)',
            fontWeight: 500,
          }}>{user.email}</span>
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

        {/* Tabs - Apple Pro L2 toolbar with micro-pills */}
        <div style={{
          display: 'flex',
          padding: '8px 12px',
          background: 'linear-gradient(180deg, rgba(36,46,66,0.92), rgba(22,30,44,0.98))',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
        }}>
          <div style={{
            display: 'flex',
            gap: 4,
          }}>
            <button
              onClick={() => setActiveTab('analyze')}
              style={{
                padding: '8px 20px',
                background: activeTab === 'analyze'
                  ? 'rgba(255,255,255,0.08)'
                  : 'transparent',
                border: 'none',
                borderLeft: activeTab === 'analyze' ? '2px solid rgba(90,130,255,0.95)' : '2px solid transparent',
                borderRadius: 10,
                color: activeTab === 'analyze' ? 'rgba(235,240,255,0.95)' : 'rgba(235,240,255,0.5)',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: 'inherit',
                letterSpacing: '-0.01em',
                transition: 'all 0.15s ease',
              }}
            >
              Analyze
            </button>
            <button
              onClick={() => setActiveTab('clauses')}
              style={{
                padding: '8px 20px',
                background: activeTab === 'clauses'
                  ? 'rgba(255,255,255,0.08)'
                  : 'transparent',
                border: 'none',
                borderLeft: activeTab === 'clauses' ? '2px solid rgba(90,130,255,0.95)' : '2px solid transparent',
                borderRadius: 10,
                color: activeTab === 'clauses' ? 'rgba(235,240,255,0.95)' : 'rgba(235,240,255,0.5)',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: 'inherit',
                letterSpacing: '-0.01em',
                transition: 'all 0.15s ease',
              }}
            >
              Clauses
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={styles.content}>
          {activeTab === 'analyze' && (
            <div style={styles.analyzeTab}>
              {/* Contract Linking - Minimal */}
              <div style={styles.contractSection} ref={contractDropdownRef}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 8, display: 'block' }}>
                  Link to Contract
                </span>
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

              {/* Analyze Controls - Apple Pro style */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Analysis Depth - Minimal inline control */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Depth</span>
                  <select
                    value={riskLevelFilter}
                    onChange={(e) => setRiskLevelFilter(e.target.value as 'high' | 'medium' | 'all')}
                    disabled={isAnalyzing}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      backgroundColor: 'rgba(255,255,255,0.04)',
                      border: 'none',
                      borderRadius: 6,
                      color: 'rgba(255,255,255,0.75)',
                      fontSize: 12,
                      cursor: isAnalyzing ? 'default' : 'pointer',
                      outline: 'none',
                    }}
                  >
                    <option value="high">High Risk Only</option>
                    <option value="medium">Medium + High Risk</option>
                    <option value="all">All Risks</option>
                  </select>
                </div>

                {/* Primary CTA - Analyze Document - Electric Blue */}
                <button
                  onClick={analyzeDocument}
                  disabled={isAnalyzing}
                  style={{
                    width: '100%',
                    padding: '14px 20px',
                    background: isAnalyzing
                      ? 'rgba(255,255,255,0.04)'
                      : 'linear-gradient(180deg, #0A84FF 0%, #0066CC 100%)',
                    border: 'none',
                    borderRadius: 12,
                    color: isAnalyzing ? 'rgba(255,255,255,0.35)' : '#ffffff',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: isAnalyzing ? 'default' : 'pointer',
                    fontFamily: 'inherit',
                    letterSpacing: '-0.01em',
                    boxShadow: isAnalyzing
                      ? 'none'
                      : '0 4px 16px rgba(10, 132, 255, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {isAnalyzing ? 'Analyzing...' : 'Analyze Full Document'}
                </button>

                {/* Secondary action - Analyze Selection - Amber accent */}
                <button
                  onClick={analyzeSelection}
                  disabled={isAnalyzing}
                  title="Select text in Word first"
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    background: 'rgba(255, 159, 10, 0.1)',
                    border: '1px solid rgba(255, 159, 10, 0.25)',
                    borderRadius: 10,
                    color: isAnalyzing ? 'rgba(255,255,255,0.3)' : '#FF9F0A',
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: isAnalyzing ? 'default' : 'pointer',
                    fontFamily: 'inherit',
                    textAlign: 'center',
                    transition: 'all 0.2s ease',
                  }}
                >
                  Analyze Selected Text Only
                </button>
              </div>

              {/* Analysis Results - Dashboard Style */}
              {analysisResult && (
                <div style={styles.results}>
                  {/* Risk Summary - Inline pills, reduced visual weight */}
                  <div style={styles.riskSummaryBar}>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginRight: 4 }}>Found</span>
                    {(analysisResult.riskScores?.summary?.high ?? 0) > 0 && (
                      <span style={{ fontSize: 11, color: 'rgba(248, 81, 73, 0.85)', fontWeight: 500 }}>
                        {analysisResult.riskScores?.summary?.high} high
                      </span>
                    )}
                    {(analysisResult.riskScores?.summary?.medium ?? 0) > 0 && (
                      <span style={{ fontSize: 11, color: 'rgba(210, 153, 34, 0.85)', fontWeight: 500 }}>
                        {analysisResult.riskScores?.summary?.medium} medium
                      </span>
                    )}
                    {(analysisResult.riskScores?.summary?.low ?? 0) > 0 && (
                      <span style={{ fontSize: 11, color: 'rgba(35, 134, 54, 0.85)', fontWeight: 500 }}>
                        {analysisResult.riskScores?.summary?.low} low
                      </span>
                    )}
                  </div>

                  {/* Insert All Changes - Electric Blue accent */}
                  {(analysisResult.sections?.length ?? 0) > 0 && !allChangesInserted && (
                    <button
                      onClick={insertAllChanges}
                      disabled={isApplyingChange}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        background: isApplyingChange
                          ? 'rgba(255,255,255,0.04)'
                          : 'rgba(10, 132, 255, 0.1)',
                        border: '1px solid rgba(10, 132, 255, 0.25)',
                        borderRadius: 10,
                        color: isApplyingChange ? 'rgba(255,255,255,0.4)' : '#0A84FF',
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: isApplyingChange ? 'default' : 'pointer',
                        fontFamily: 'inherit',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <ArrowSync24Regular style={{ width: 16, height: 16 }} />
                      {isApplyingChange ? 'Inserting changes...' : 'Insert All Changes into Document'}
                    </button>
                  )}
                  {allChangesInserted && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '12px 16px',
                      background: 'rgba(52, 199, 89, 0.1)',
                      borderRadius: 10,
                      border: '1px solid rgba(52, 199, 89, 0.2)',
                    }}>
                      <CheckmarkCircle24Filled style={{ width: 18, height: 18, color: '#34C759' }} />
                      <span style={{ fontSize: 13, color: '#34C759', fontWeight: 500 }}>
                        All changes inserted
                      </span>
                    </div>
                  )}

                  {/* Save/Submit Actions - Always visible when analysis exists */}
                  {analysisResult && !savedToHistory && !submittedForApproval && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16, padding: 16, background: 'rgba(52, 199, 89, 0.06)', borderRadius: 14, border: '1px solid rgba(52, 199, 89, 0.12)' }}>
                      {/* Primary: Submit for Approval - Apple Green */}
                      <button
                        onClick={saveAndSubmitForApproval}
                        disabled={isSavingToHistory || isSubmittingApproval}
                        style={{
                          width: '100%',
                          padding: '14px 20px',
                          background: (isSavingToHistory || isSubmittingApproval)
                            ? 'rgba(255,255,255,0.04)'
                            : 'linear-gradient(180deg, #34C759 0%, #28A745 100%)',
                          border: 'none',
                          borderRadius: 12,
                          color: (isSavingToHistory || isSubmittingApproval) ? 'rgba(255,255,255,0.35)' : '#ffffff',
                          fontSize: 14,
                          fontWeight: 600,
                          cursor: (isSavingToHistory || isSubmittingApproval) ? 'default' : 'pointer',
                          fontFamily: 'inherit',
                          letterSpacing: '-0.01em',
                          boxShadow: (isSavingToHistory || isSubmittingApproval)
                            ? 'none'
                            : '0 4px 16px rgba(52, 199, 89, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                        }}
                      >
                        <Send24Regular style={{ width: 16, height: 16 }} />
                        {isSavingToHistory ? 'Saving...' : isSubmittingApproval ? 'Submitting...' : 'Submit for Approval'}
                      </button>
                      {/* Secondary: Save to History */}
                      <button
                        onClick={saveToHistory}
                        disabled={isSavingToHistory || isSubmittingApproval}
                        style={{
                          width: '100%',
                          padding: '10px 16px',
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 10,
                          color: (isSavingToHistory || isSubmittingApproval) ? 'rgba(255,255,255,0.3)' : 'rgba(235, 240, 255, 0.7)',
                          fontSize: 13,
                          fontWeight: 500,
                          cursor: (isSavingToHistory || isSubmittingApproval) ? 'default' : 'pointer',
                          fontFamily: 'inherit',
                          textAlign: 'center',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {isSavingToHistory ? 'Saving...' : 'Save to History Only'}
                      </button>
                    </div>
                  )}

                  {/* After saved to history but not yet submitted */}
                  {savedToHistory && !submittedForApproval && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                      <span style={{ fontSize: 12, color: 'rgba(35, 134, 54, 0.85)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <CheckmarkCircle24Filled style={{ width: 14, height: 14 }} />
                        Saved to history
                      </span>
                      <button
                        onClick={() => submitForApproval()}
                        disabled={isSubmittingApproval}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          background: isSubmittingApproval
                            ? 'rgba(255,255,255,0.04)'
                            : 'linear-gradient(180deg, rgba(35, 134, 54, 0.25) 0%, rgba(35, 134, 54, 0.15) 100%)',
                          border: 'none',
                          borderRadius: 8,
                          color: isSubmittingApproval ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.95)',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: isSubmittingApproval ? 'default' : 'pointer',
                          fontFamily: 'inherit',
                          letterSpacing: '-0.01em',
                        }}
                      >
                        {isSubmittingApproval ? 'Submitting...' : 'Submit for Approval'}
                      </button>
                    </div>
                  )}

                  {/* After submitted for approval */}
                  {submittedForApproval && (
                    <span style={{ fontSize: 12, color: 'rgba(35, 134, 54, 0.85)', padding: '12px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CheckmarkCircle24Filled style={{ width: 14, height: 14 }} />
                      Submitted for approval
                    </span>
                  )}

                  {/* Modifications - Flat editorial blocks */}
                  {(analysisResult.sections?.filter(s => !s.isNewSection).length ?? 0) > 0 && (
                    <div style={styles.sectionList}>
                      <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.5)', marginBottom: 16, display: 'block', marginTop: 20, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Modifications
                      </span>
                      {(analysisResult.sections ?? []).filter(s => !s.isNewSection).map((section, index) => (
                        <div key={`mod-${section.sectionNumber}-${index}`} style={styles.sectionCard}>
                          {/* Header: risk level (weight only) + title */}
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                            <span style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: section.riskLevel === 'high' ? 'rgba(248, 81, 73, 0.85)' : section.riskLevel === 'medium' ? 'rgba(210, 153, 34, 0.85)' : 'rgba(35, 134, 54, 0.85)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.03em',
                            }}>
                              {section.riskLevel}
                            </span>
                            <span style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.9)', letterSpacing: '-0.01em' }}>
                              {section.sectionTitle || `Section ${section.sectionNumber}`}
                            </span>
                            {appliedSections.has(section.sectionTitle) && (
                              <CheckmarkCircle24Filled style={{ color: 'rgba(35, 134, 54, 0.8)', marginLeft: 'auto', width: 14, height: 14 }} />
                            )}
                          </div>

                          {/* Rationale */}
                          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 8, lineHeight: 1.6 }}>
                            {section.rationale}
                          </div>

                          {/* Redlines - Apple diff style: subtle, inline */}
                          {section.changes && section.changes.length > 0 && !appliedSections.has(section.sectionTitle) && (
                            <div style={{ marginTop: 12 }}>
                              {section.changes.slice(0, 2).map((change, idx) => (
                                <div key={idx} style={{ marginBottom: 8, fontSize: 12, lineHeight: 1.7, color: 'rgba(255,255,255,0.65)' }}>
                                  <span style={{ color: 'rgba(248, 81, 73, 0.6)', textDecoration: 'line-through', fontWeight: 400 }}>
                                    {change.find.substring(0, 60)}{change.find.length > 60 ? '...' : ''}
                                  </span>
                                  {' '}
                                  <span style={{ color: 'rgba(35, 134, 54, 0.8)', fontWeight: 400 }}>
                                    {change.replace.substring(0, 60)}{change.replace.length > 60 ? '...' : ''}
                                  </span>
                                </div>
                              ))}
                              {section.changes.length > 2 && (
                                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                                  +{section.changes.length - 2} more
                                </span>
                              )}
                            </div>
                          )}

                          {/* Actions - inline text, minimal */}
                          <div style={{ display: 'flex', gap: 20, marginTop: 14 }}>
                            <button
                              onClick={() => insertSingleSection(section)}
                              disabled={isApplyingChange || appliedSections.has(section.sectionTitle)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: appliedSections.has(section.sectionTitle) ? 'rgba(255,255,255,0.3)' : 'rgba(88, 166, 255, 0.9)',
                                fontSize: 12,
                                fontWeight: 500,
                                cursor: appliedSections.has(section.sectionTitle) ? 'default' : 'pointer',
                                padding: 0,
                              }}
                            >
                              {appliedSections.has(section.sectionTitle) ? 'Applied' : 'Apply'}
                            </button>
                            <button
                              onClick={() => highlightSection(section)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'rgba(255,255,255,0.4)',
                                fontSize: 12,
                                cursor: 'pointer',
                                padding: 0,
                              }}
                            >
                              Find
                            </button>
                            <button
                              onClick={() => reanalyzeClause(section.sectionTitle, section.originalText || '')}
                              disabled={isAnalyzing}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: isAnalyzing ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.4)',
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

                  {/* New Sections - With subtle left accent */}
                  {(analysisResult.sections?.filter(s => s.isNewSection).length ?? 0) > 0 && (
                    <div style={{ marginTop: 24 }}>
                      <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        New Sections
                      </span>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 16 }}>
                        Position cursor, then insert
                      </span>
                      {(analysisResult.sections ?? []).filter(s => s.isNewSection).map((section, index) => (
                        <div key={`new-${index}`} style={{ ...styles.sectionCard, borderLeft: '2px solid rgba(88, 166, 255, 0.4)', paddingLeft: 16 }}>
                          {/* Header - No NEW badge, just title */}
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                            <span style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.9)', letterSpacing: '-0.01em' }}>
                              {section.sectionTitle}
                            </span>
                            {appliedSections.has(section.sectionTitle) && (
                              <CheckmarkCircle24Filled style={{ color: 'rgba(35, 134, 54, 0.8)', marginLeft: 'auto', width: 14, height: 14 }} />
                            )}
                          </div>

                          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 8, lineHeight: 1.6 }}>
                            {section.rationale}
                          </div>

                          {/* Content preview - minimal */}
                          {section.revisedText && !appliedSections.has(section.sectionTitle) && (
                            <div style={{ marginTop: 12 }}>
                              <div style={{
                                padding: 12,
                                backgroundColor: 'rgba(255,255,255,0.02)',
                                borderRadius: 6,
                                maxHeight: 120,
                                overflowY: 'auto',
                              }}>
                                <span style={{ color: 'rgba(35, 134, 54, 0.75)', whiteSpace: 'pre-wrap', fontSize: 11, lineHeight: 1.6 }}>
                                  {section.revisedText.substring(0, 300)}{section.revisedText.length > 300 ? '...' : ''}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Actions - inline text */}
                          <div style={{ display: 'flex', gap: 20, marginTop: 14 }}>
                            <button
                              onClick={() => insertSingleSection(section)}
                              disabled={isApplyingChange || appliedSections.has(section.sectionTitle)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: appliedSections.has(section.sectionTitle) ? 'rgba(255,255,255,0.3)' : 'rgba(88, 166, 255, 0.9)',
                                fontSize: 12,
                                fontWeight: 500,
                                cursor: appliedSections.has(section.sectionTitle) ? 'default' : 'pointer',
                                padding: 0,
                              }}
                            >
                              {appliedSections.has(section.sectionTitle) ? 'Inserted' : 'Insert'}
                            </button>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(section.revisedText);
                                setSuccessMessage('Copied');
                                setTimeout(() => setSuccessMessage(null), 2000);
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'rgba(255,255,255,0.4)',
                                fontSize: 12,
                                cursor: 'pointer',
                                padding: 0,
                              }}
                            >
                              Copy
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Summary List - Minimal */}
                  {(analysisResult.summary?.length ?? 0) > 0 && (
                    <div style={styles.summaryList}>
                      <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.5)', marginBottom: 12, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Summary
                      </span>
                      {analysisResult.summary?.map((item, idx) => (
                        <span key={idx} style={{ display: 'block', marginBottom: 6, color: 'rgba(255,255,255,0.55)', fontSize: 12, lineHeight: 1.6 }}>
                          {item}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* No changes found */}
                  {(analysisResult.sections?.length ?? 0) === 0 && (
                    <div style={{ textAlign: 'center', padding: '24px 0' }}>
                      <CheckmarkCircle24Filled style={{ color: '#238636', width: 24, height: 24 }} />
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.88)', marginTop: 8 }}>
                        No Material Risks Found
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
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
              {/* Filters Row */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                {/* Category Filter */}
                <select
                  value={selectedClauseCategory}
                  onChange={(e) => handleClauseCategoryChange(e.target.value)}
                  style={{
                    flex: 1,
                    minWidth: 120,
                    padding: '6px 8px',
                    backgroundColor: '#242A30',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 4,
                    color: 'rgba(255,255,255,0.88)',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  <option value="">All Categories</option>
                  {clauseCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>

                {/* Search Input */}
                <input
                  type="text"
                  value={clauseSearch}
                  onChange={(e) => handleClauseSearch(e.target.value)}
                  placeholder="Search clauses..."
                  style={{
                    flex: 2,
                    minWidth: 120,
                    padding: '6px 8px',
                    backgroundColor: '#242A30',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 4,
                    color: 'rgba(255,255,255,0.88)',
                    fontSize: 12,
                  }}
                />

                {/* Refresh Button */}
                <Button
                  appearance="subtle"
                  icon={<ArrowSync24Regular />}
                  onClick={() => loadClauses(selectedClauseCategory, clauseSearch)}
                  disabled={isLoadingClauses}
                  style={{ padding: '4px 8px' }}
                >
                  Refresh
                </Button>
              </div>

              {isLoadingClauses ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  padding: 24,
                }}>
                  <PremiumSpinner size={16} color="rgba(255,255,255,0.4)" />
                  <span style={{
                    fontSize: 13,
                    fontWeight: 450,
                    color: 'rgba(255,255,255,0.5)',
                    letterSpacing: '0.01em',
                  }}>
                    Loading clauses
                  </span>
                </div>
              ) : clauses.length === 0 ? (
                <Text style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', padding: 16 }}>
                  {clauseSearch || selectedClauseCategory
                    ? 'No clauses match your filters.'
                    : 'No clauses available. Add clauses in the MARS web app.'}
                </Text>
              ) : (
                <div style={styles.clauseList}>
                  {clauses.map((clause) => (
                    <div key={clause.id} style={styles.clauseCard}>
                      {/* Clause header with expand/collapse */}
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
                        onClick={() => {
                          const newExpandedId = expandedClauseId === clause.id ? null : clause.id;
                          setExpandedClauseId(newExpandedId);
                          // Reset full view when collapsing or switching clauses
                          if (!newExpandedId || newExpandedId !== clause.id) {
                            setFullViewClause(null);
                          }
                        }}
                      >
                        <span style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: clause.risk_level === 'high' ? '#F85149' : clause.risk_level === 'medium' ? '#D29922' : '#238636',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                        }}>
                          {clause.risk_level}
                        </span>
                        <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.88)', flex: 1 }}>
                          {clause.name}
                        </span>
                        {/* Usage count badge */}
                        {clause.usage_count !== undefined && clause.usage_count > 0 && (
                          <span style={{
                            fontSize: 10,
                            backgroundColor: 'rgba(255,255,255,0.08)',
                            color: 'rgba(255,255,255,0.62)',
                            padding: '2px 6px',
                            borderRadius: 10,
                          }}>
                            {clause.usage_count} uses
                          </span>
                        )}
                        {/* Expand indicator */}
                        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>
                          {expandedClauseId === clause.id ? '▼' : '▶'}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                        {clause.category}
                        {clause.tags && clause.tags.length > 0 && (
                          <span style={{ marginLeft: 8 }}>
                            {clause.tags.slice(0, 3).map((tag, i) => (
                              <span key={i} style={{
                                backgroundColor: 'rgba(255,255,255,0.08)',
                                padding: '1px 4px',
                                marginLeft: 4,
                                fontSize: 10,
                                color: 'rgba(255,255,255,0.5)',
                                borderRadius: 2,
                              }}>
                                {tag}
                              </span>
                            ))}
                          </span>
                        )}
                      </div>

                      {/* Collapsed view - show truncated primary text */}
                      {expandedClauseId !== clause.id && (
                        <>
                          <div style={styles.clauseText}>
                            {clause.primary_text.substring(0, 150)}
                            {clause.primary_text.length > 150 ? '...' : ''}
                          </div>
                          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); insertClause(clause.primary_text); }}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#58A6FF',
                                fontSize: 12,
                                cursor: 'pointer',
                                padding: 0,
                              }}
                            >
                              Insert Primary
                            </button>
                            {clause.fallback_text && (
                              <button
                                onClick={(e) => { e.stopPropagation(); insertClause(clause.fallback_text!); }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#58A6FF',
                                  fontSize: 12,
                                  cursor: 'pointer',
                                  padding: 0,
                                }}
                              >
                                Insert Fallback
                              </button>
                            )}
                            {clause.last_resort_text && (
                              <button
                                onClick={(e) => { e.stopPropagation(); insertClause(clause.last_resort_text!); }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'rgba(255,255,255,0.5)',
                                  fontSize: 12,
                                  cursor: 'pointer',
                                  padding: 0,
                                }}
                              >
                                Last Resort
                              </button>
                            )}
                          </div>
                        </>
                      )}

                      {/* Expanded view - show all three positions */}
                      {expandedClauseId === clause.id && (
                        <div style={{ marginTop: 12 }}>
                          {/* Primary Position */}
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <span style={{ fontSize: 11, fontWeight: 600, color: '#238636' }}>PRIMARY</span>
                              <button
                                onClick={(e) => { e.stopPropagation(); insertClause(clause.primary_text); }}
                                style={{
                                  background: 'none',
                                  border: '1px solid rgba(255,255,255,0.1)',
                                  borderRadius: 4,
                                  color: '#58A6FF',
                                  fontSize: 11,
                                  cursor: 'pointer',
                                  padding: '2px 8px',
                                }}
                              >
                                Insert
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFullViewClause(
                                    fullViewClause?.clauseId === clause.id && fullViewClause?.position === 'primary'
                                      ? null
                                      : { clauseId: clause.id, position: 'primary' }
                                  );
                                }}
                                style={{
                                  background: 'none',
                                  border: '1px solid rgba(255,255,255,0.1)',
                                  borderRadius: 4,
                                  color: 'rgba(255,255,255,0.6)',
                                  fontSize: 11,
                                  cursor: 'pointer',
                                  padding: '2px 8px',
                                }}
                              >
                                {fullViewClause?.clauseId === clause.id && fullViewClause?.position === 'primary' ? 'Collapse' : 'View Full'}
                              </button>
                            </div>
                            <div style={{
                              ...styles.clauseText,
                              backgroundColor: '#242A30',
                              padding: 8,
                              borderRadius: 4,
                              ...(fullViewClause?.clauseId === clause.id && fullViewClause?.position === 'primary'
                                ? { maxHeight: 'none' }
                                : { maxHeight: 120, overflowY: 'auto' as const }),
                            }}>
                              {clause.primary_text}
                            </div>
                          </div>

                          {/* Fallback Position */}
                          {clause.fallback_text && (
                            <div style={{ marginBottom: 12 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                <span style={{ fontSize: 11, fontWeight: 600, color: '#D29922' }}>FALLBACK</span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); insertClause(clause.fallback_text!); }}
                                  style={{
                                    background: 'none',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: 4,
                                    color: '#58A6FF',
                                    fontSize: 11,
                                    cursor: 'pointer',
                                    padding: '2px 8px',
                                  }}
                                >
                                  Insert
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFullViewClause(
                                      fullViewClause?.clauseId === clause.id && fullViewClause?.position === 'fallback'
                                        ? null
                                        : { clauseId: clause.id, position: 'fallback' }
                                    );
                                  }}
                                  style={{
                                    background: 'none',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: 4,
                                    color: 'rgba(255,255,255,0.6)',
                                    fontSize: 11,
                                    cursor: 'pointer',
                                    padding: '2px 8px',
                                  }}
                                >
                                  {fullViewClause?.clauseId === clause.id && fullViewClause?.position === 'fallback' ? 'Collapse' : 'View Full'}
                                </button>
                              </div>
                              <div style={{
                                ...styles.clauseText,
                                backgroundColor: '#242A30',
                                padding: 8,
                                borderRadius: 4,
                                ...(fullViewClause?.clauseId === clause.id && fullViewClause?.position === 'fallback'
                                  ? { maxHeight: 'none' }
                                  : { maxHeight: 120, overflowY: 'auto' as const }),
                              }}>
                                {clause.fallback_text}
                              </div>
                            </div>
                          )}

                          {/* Last Resort Position */}
                          {clause.last_resort_text && (
                            <div style={{ marginBottom: 12 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                <span style={{ fontSize: 11, fontWeight: 600, color: '#F85149' }}>LAST RESORT</span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); insertClause(clause.last_resort_text!); }}
                                  style={{
                                    background: 'none',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: 4,
                                    color: '#58A6FF',
                                    fontSize: 11,
                                    cursor: 'pointer',
                                    padding: '2px 8px',
                                  }}
                                >
                                  Insert
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFullViewClause(
                                      fullViewClause?.clauseId === clause.id && fullViewClause?.position === 'lastresort'
                                        ? null
                                        : { clauseId: clause.id, position: 'lastresort' }
                                    );
                                  }}
                                  style={{
                                    background: 'none',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: 4,
                                    color: 'rgba(255,255,255,0.6)',
                                    fontSize: 11,
                                    cursor: 'pointer',
                                    padding: '2px 8px',
                                  }}
                                >
                                  {fullViewClause?.clauseId === clause.id && fullViewClause?.position === 'lastresort' ? 'Collapse' : 'View Full'}
                                </button>
                              </div>
                              <div style={{
                                ...styles.clauseText,
                                backgroundColor: '#242A30',
                                padding: 8,
                                borderRadius: 4,
                                ...(fullViewClause?.clauseId === clause.id && fullViewClause?.position === 'lastresort'
                                  ? { maxHeight: 'none' }
                                  : { maxHeight: 120, overflowY: 'auto' as const }),
                              }}>
                                {clause.last_resort_text}
                              </div>
                            </div>
                          )}

                          {/* No fallback/last resort message */}
                          {!clause.fallback_text && !clause.last_resort_text && (
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>
                              Only primary position defined for this clause.
                            </div>
                          )}
                        </div>
                      )}
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

// ===========================================
// APPLE PRO DARK UI — ELEVATION IMPLEMENTATION
// 3 levels: L0 (canvas), L1 (surface), L2 (focus)
// ===========================================
const styles: Record<string, React.CSSProperties> = {
  // L0 - BASE CANVAS: Luminous radial gradient
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: `
      radial-gradient(1200px 800px at 50% -20%, rgba(90,130,255,0.22), rgba(10,14,20,0.98) 60%)
    `,
    color: 'rgba(235,240,255,0.92)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif',
    fontSize: 13,
    lineHeight: 1.5,
    fontWeight: 400,
  },
  // L2 - HEADER: Active/focus surface (toolbar)
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 16px',
    height: 52,
    background: 'linear-gradient(180deg, rgba(36,46,66,0.92), rgba(22,30,44,0.98))',
    boxShadow: `
      0 30px 90px rgba(0,0,0,0.75),
      inset 0 1px 0 rgba(255,255,255,0.08)
    `,
    borderRadius: 0,
  },
  headerContent: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  // BANNERS - Color accent text only (no fills)
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 16px',
    background: 'rgba(255,95,95,0.08)',
    color: 'rgba(255,95,95,0.95)',
    fontSize: 13,
    fontWeight: 500,
  },
  successBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 16px',
    background: 'rgba(80,210,140,0.08)',
    color: 'rgba(80,210,140,0.95)',
    fontSize: 13,
    fontWeight: 500,
  },
  // L2 - TABS: Active/focus toolbar
  tabs: {
    background: 'linear-gradient(180deg, rgba(36,46,66,0.92), rgba(22,30,44,0.98))',
    padding: '6px 12px',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
  },
  // L0 - CONTENT: Base canvas with subtle ambient glow
  content: {
    flex: 1,
    overflow: 'auto',
    padding: '20px 16px',
    background: 'transparent',
  },
  // L2 - LOGIN CARD: Modal surface
  loginCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 20,
    padding: 32,
    margin: 'auto',
    maxWidth: 300,
    background: 'linear-gradient(180deg, rgba(36,46,66,0.92), rgba(22,30,44,0.98))',
    borderRadius: 18,
    boxShadow: `
      0 30px 90px rgba(0,0,0,0.75),
      inset 0 1px 0 rgba(255,255,255,0.10)
    `,
  },
  // ANALYZE TAB - Content container
  analyzeTab: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  // L1 - RESULTS: Content surface with halo
  results: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginTop: 16,
    padding: 16,
    background: 'linear-gradient(180deg, rgba(28,36,52,0.88), rgba(18,24,36,0.96))',
    borderRadius: 16,
    boxShadow: `
      0 30px 90px rgba(0,0,0,0.75),
      inset 0 1px 0 rgba(255,255,255,0.08)
    `,
    filter: 'drop-shadow(0 0 120px rgba(90,130,255,0.15))',
  },
  scoreCard: {
    padding: '12px 0',
  },
  scoreContent: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  summaryCard: {
    padding: '12px 0',
  },
  riskHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  riskContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    paddingTop: 8,
  },
  suggestion: {
    padding: 12,
    background: 'rgba(52, 199, 89, 0.08)',
    borderRadius: 10,
    border: '1px solid rgba(52, 199, 89, 0.15)',
  },
  // CLAUSES TAB
  clausesTab: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  clauseList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  // L1 - CLAUSE CARD: Flat row with hover
  clauseCard: {
    padding: 16,
    background: 'linear-gradient(180deg, rgba(28,36,52,0.88), rgba(18,24,36,0.96))',
    borderRadius: 12,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
    transition: 'all 0.2s ease',
  },
  clauseText: {
    padding: '8px 0',
    color: 'rgba(235,240,255,0.75)',
    fontSize: 13,
    lineHeight: 1.6,
  },
  clauseActions: {
    display: 'flex',
    gap: 16,
    paddingTop: 12,
  },
  // PREVIEW OVERLAY
  previewOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(10,14,20,0.92)',
    backdropFilter: 'blur(20px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 20,
  },
  // L2 - PREVIEW PANEL: Modal surface
  previewPanel: {
    background: 'linear-gradient(180deg, rgba(36,46,66,0.92), rgba(22,30,44,0.98))',
    padding: 24,
    maxWidth: 420,
    maxHeight: '85vh',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    borderRadius: 18,
    boxShadow: `
      0 30px 90px rgba(0,0,0,0.75),
      inset 0 1px 0 rgba(255,255,255,0.10)
    `,
  },
  diffView: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  diffSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  diffText: {
    padding: 14,
    background: 'rgba(255,255,255,0.04)',
    maxHeight: 120,
    overflowY: 'auto',
    fontSize: 12,
    borderRadius: 10,
    lineHeight: 1.7,
    border: '1px solid rgba(255,255,255,0.06)',
  },
  diffArrow: {
    textAlign: 'center',
    fontSize: 16,
    color: 'rgba(100, 160, 255, 0.7)',
    padding: '4px 0',
  },
  matchInfo: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
  },
  matchSelector: {
    padding: 14,
    background: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.06)',
  },
  matchList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  previewActions: {
    display: 'flex',
    gap: 10,
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  // LOCATION BOX - Amber accent
  locationBox: {
    padding: 14,
    background: 'rgba(255,190,90,0.08)',
    borderLeft: '2px solid rgba(255,190,90,0.95)',
    borderRadius: 12,
  },
  // FIX SECTION - Green accent (text only, no fill)
  fixItSection: {
    padding: 14,
    background: 'rgba(80,210,140,0.06)',
    marginTop: 12,
    borderRadius: 12,
  },
  fixItButtons: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  // L1 - RISK SUMMARY BAR: Flat row
  riskSummaryBar: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 14px',
    gap: 16,
    background: 'linear-gradient(180deg, rgba(28,36,52,0.88), rgba(18,24,36,0.96))',
    borderRadius: 12,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
  },
  riskBadgeLarge: {
    fontSize: 12,
    fontWeight: 600,
    color: 'rgba(200,210,235,0.75)',
  },
  // SECTION LIST
  sectionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  // L1 - SECTION CARD: Flat row
  sectionCard: {
    padding: 16,
    background: 'linear-gradient(180deg, rgba(28,36,52,0.88), rgba(18,24,36,0.96))',
    borderRadius: 16,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  sectionActions: {
    display: 'flex',
    gap: 16,
    marginTop: 14,
    paddingTop: 12,
  },
  summaryList: {
    marginTop: 16,
    padding: 16,
    background: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
  },
  // CONTRACT SECTION
  contractSection: {
    marginBottom: 16,
    position: 'relative',
  },
  contractDropdownContainer: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  // CONTRACT INPUT - Micro-pill style
  contractInput: {
    width: '100%',
    padding: '12px 36px 12px 14px',
    background: 'rgba(255,255,255,0.08)',
    border: 'none',
    borderRadius: 10,
    color: 'rgba(235,240,255,0.92)',
    fontSize: 13,
    fontWeight: 500,
    outline: 'none',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
  },
  clearButton: {
    position: 'absolute',
    right: 10,
    background: 'rgba(255,255,255,0.1)',
    border: 'none',
    color: 'rgba(235,240,255,0.6)',
    cursor: 'pointer',
    fontSize: 12,
    padding: '4px 8px',
    borderRadius: 6,
    lineHeight: 1,
  },
  // L2 - CONTRACT DROPDOWN: Popover surface
  contractDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 6,
    background: 'linear-gradient(180deg, rgba(36,46,66,0.92), rgba(22,30,44,0.98))',
    borderRadius: 16,
    maxHeight: 220,
    overflowY: 'auto',
    zIndex: 100,
    boxShadow: `
      0 30px 90px rgba(0,0,0,0.75),
      inset 0 1px 0 rgba(255,255,255,0.10)
    `,
  },
  // Flat row item with hover
  contractOption: {
    width: '100%',
    textAlign: 'left',
    padding: '12px 14px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    display: 'block',
    color: 'rgba(235,240,255,0.92)',
    fontSize: 13,
    fontWeight: 500,
    transition: 'background 0.15s ease',
    borderRadius: 12,
  },
  selectedContractBadge: {
    marginTop: 10,
  },
  changesList: {
    marginTop: 10,
    padding: '10px 0',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  changeItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    paddingBottom: 10,
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  newSectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  // NEW SECTION PREVIEW - Blue accent
  newSectionPreview: {
    marginTop: 12,
    padding: 14,
    background: 'rgba(10, 132, 255, 0.08)',
    borderLeft: '3px solid rgba(10, 132, 255, 0.6)',
    borderRadius: 8,
  },
  newSectionFullContent: {
    marginTop: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  newSectionContentHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  newSectionTextBox: {
    padding: 14,
    background: 'rgba(255,255,255,0.03)',
    borderRadius: 10,
    maxHeight: 160,
    overflowY: 'auto',
    fontFamily: 'SF Mono, Menlo, Consolas, monospace',
    fontSize: 12,
    lineHeight: 1.7,
    border: '1px solid rgba(255,255,255,0.05)',
  },
  analyzeButtons: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    width: '100%',
  },
};
