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
 *
 * @param context Word.RequestContext
 * @param afterHeading Section heading after which to insert
 * @param newSectionContent Complete content of the new section
 * @param trackChangesEnabled Whether Track Changes is enabled
 * @returns True if insertion succeeded
 */
async function insertNewSection(
  context: Word.RequestContext,
  afterHeading: string,
  newSectionContent: string,
  trackChangesEnabled: boolean
): Promise<boolean> {
  console.log(`insertNewSection: inserting after "${afterHeading}"`);

  // Find the section heading
  const headingRange = await findSectionByHeading(context, afterHeading);
  if (!headingRange) {
    console.error(`Could not find section heading: "${afterHeading}"`);
    return false;
  }

  // Get the paragraph containing the heading
  const paragraph = headingRange.paragraphs.getFirst();
  paragraph.load('text');
  await context.sync();

  // Find the end of this section (next section heading or end of document)
  // For simplicity, we'll insert after the current paragraph
  // A more sophisticated approach would find the next numbered heading

  // Get the range after the heading paragraph
  const afterRange = paragraph.getRange('After');

  // Insert a new paragraph with the section content
  // Add blank line before and after for separation
  const insertText = '\n\n' + newSectionContent + '\n';
  const newRange = afterRange.insertText(insertText, Word.InsertLocation.start);

  // Style the new content
  if (!trackChangesEnabled) {
    newRange.font.underline = Word.UnderlineType.single;
    newRange.font.color = '#16A34A';
  }

  newRange.select();
  await context.sync();

  console.log(`insertNewSection: successfully inserted new section`);
  return true;
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

          const inserted = await insertNewSection(
            context,
            section.insertAfter,
            section.revisedText,
            trackChangesEnabled
          );

          if (inserted) {
            newApplied.add(section.sectionTitle);
            appliedCount++;
            console.log(`Inserted new section: ${section.sectionTitle}`);
          } else {
            failedSections.push(section.sectionTitle);
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
          const inserted = await insertNewSection(
            context,
            section.insertAfter!,
            section.revisedText,
            trackChangesEnabled
          );

          if (!inserted) {
            setError(`Could not find location to insert after "${section.insertAfter}"`);
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

  // Risk severity badge
  const getRiskBadge = (severity: string) => {
    const colors: Record<string, 'danger' | 'warning' | 'success'> = {
      high: 'danger',
      medium: 'warning',
      low: 'success',
    };
    return (
      <Badge appearance="filled" color={colors[severity] || 'informative'}>
        {severity.toUpperCase()}
      </Badge>
    );
  };

  // Loading state
  if (!isOfficeReady) {
    return (
      <FluentProvider theme={webDarkTheme}>
        <div style={styles.container}>
          <Spinner label="Loading MARS..." />
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
                  style={{ width: '100%' }}
                >
                  {isLoggingIn ? 'Signing in...' : 'Sign In'}
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
                  icon={isApplyingChange ? <Spinner size="tiny" /> : <CheckmarkCircle24Filled />}
                >
                  {isApplyingChange ? 'Applying...' : 'Apply Change'}
                </Button>
                <Button
                  appearance="outline"
                  onClick={cancelChange}
                  disabled={isApplyingChange}
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

              {/* Analyze Button */}
              <Button
                appearance="primary"
                icon={isAnalyzing ? <Spinner size="tiny" /> : <DocumentSearch24Regular />}
                onClick={analyzeDocument}
                disabled={isAnalyzing}
                style={{ width: '100%' }}
              >
                {isAnalyzing ? 'Analyzing...' : 'Analyze Document'}
              </Button>

              {/* Analysis Results - Dashboard Style */}
              {analysisResult && (
                <div style={styles.results}>
                  {/* Risk Summary Bar */}
                  <div style={styles.riskSummaryBar}>
                    <Badge appearance="filled" color="danger" style={styles.riskBadgeLarge}>
                      {analysisResult.riskScores.summary.high} High
                    </Badge>
                    <Badge appearance="filled" color="warning" style={styles.riskBadgeLarge}>
                      {analysisResult.riskScores.summary.medium} Medium
                    </Badge>
                    <Badge appearance="filled" color="success" style={styles.riskBadgeLarge}>
                      {analysisResult.riskScores.summary.low} Low
                    </Badge>
                  </div>

                  {/* Insert All Changes Button */}
                  {analysisResult.sections.length > 0 && (
                    <Button
                      appearance="primary"
                      onClick={insertAllChanges}
                      disabled={isApplyingChange || allChangesInserted}
                      style={{ width: '100%', marginTop: 8 }}
                      icon={allChangesInserted ? <CheckmarkCircle24Filled /> : undefined}
                    >
                      {isApplyingChange ? 'Inserting...' : allChangesInserted ? 'All Changes Inserted' : 'Insert All Changes into Document'}
                    </Button>
                  )}

                  {/* Modifications Section */}
                  {analysisResult.sections.filter(s => !s.isNewSection).length > 0 && (
                    <div style={styles.sectionList}>
                      <Text weight="semibold" style={{ marginBottom: 12, display: 'block' }}>
                        Modifications ({analysisResult.sections.filter(s => !s.isNewSection).length})
                      </Text>
                      {analysisResult.sections.filter(s => !s.isNewSection).map((section, index) => (
                        <Card key={`mod-${section.sectionNumber}-${index}`} style={styles.sectionCard}>
                          <div style={styles.sectionHeader}>
                            <Badge
                              appearance="filled"
                              color={getRiskColor(section.riskLevel)}
                            >
                              {section.riskLevel.toUpperCase()}
                            </Badge>
                            <Text weight="semibold" size={300}>
                              {section.sectionTitle || `Section ${section.sectionNumber}`}
                            </Text>
                            {section.changes && section.changes.length > 0 && (
                              <Badge appearance="outline" color="informative" style={{ marginLeft: 8 }}>
                                {section.changes.length} change{section.changes.length !== 1 ? 's' : ''}
                              </Badge>
                            )}
                            {appliedSections.has(section.sectionTitle) && (
                              <CheckmarkCircle24Filled style={{ color: '#4ADE80', marginLeft: 'auto' }} />
                            )}
                          </div>
                          <Text size={200} style={{ color: '#A0A0A0', marginTop: 8 }}>
                            {section.rationale}
                          </Text>
                          {/* Show individual changes if available */}
                          {section.changes && section.changes.length > 0 && !appliedSections.has(section.sectionTitle) && (
                            <div style={styles.changesList}>
                              {section.changes.slice(0, 3).map((change, idx) => (
                                <div key={idx} style={styles.changeItem}>
                                  <Text size={100} style={{ color: '#F87171', textDecoration: 'line-through' }}>
                                    {change.find.substring(0, 60)}{change.find.length > 60 ? '...' : ''}
                                  </Text>
                                  <Text size={100} style={{ color: '#4ADE80' }}>
                                    → {change.replace.substring(0, 60)}{change.replace.length > 60 ? '...' : ''}
                                  </Text>
                                </div>
                              ))}
                              {section.changes.length > 3 && (
                                <Text size={100} style={{ color: '#64748B' }}>
                                  +{section.changes.length - 3} more changes...
                                </Text>
                              )}
                            </div>
                          )}
                          <div style={styles.sectionActions}>
                            <Button
                              size="small"
                              appearance={appliedSections.has(section.sectionTitle) ? 'outline' : 'primary'}
                              onClick={() => insertSingleSection(section)}
                              disabled={isApplyingChange || appliedSections.has(section.sectionTitle)}
                            >
                              {appliedSections.has(section.sectionTitle) ? 'Applied' : 'Apply Changes'}
                            </Button>
                            <Button
                              size="small"
                              appearance="subtle"
                              onClick={() => highlightSection(section)}
                            >
                              Find in Doc
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}

                  {/* New Sections to Insert */}
                  {analysisResult.sections.filter(s => s.isNewSection).length > 0 && (
                    <div style={styles.sectionList}>
                      <div style={styles.newSectionHeader}>
                        <Text weight="semibold" style={{ display: 'block' }}>
                          New Sections ({analysisResult.sections.filter(s => s.isNewSection).length})
                        </Text>
                        <Badge appearance="filled" color="brand">NEW</Badge>
                      </div>
                      <Text size={200} style={{ color: '#A0A0A0', marginBottom: 12 }}>
                        These sections will be added to your contract. Review insertion points carefully.
                      </Text>
                      {analysisResult.sections.filter(s => s.isNewSection).map((section, index) => (
                        <Card key={`new-${index}`} style={{ ...styles.sectionCard, borderColor: '#0EA5E9', borderWidth: 2 }}>
                          <div style={styles.sectionHeader}>
                            <Badge appearance="filled" color="brand">
                              NEW
                            </Badge>
                            <Text weight="semibold" size={300}>
                              {section.sectionTitle}
                            </Text>
                            {appliedSections.has(section.sectionTitle) && (
                              <CheckmarkCircle24Filled style={{ color: '#4ADE80', marginLeft: 'auto' }} />
                            )}
                          </div>
                          <Text size={200} style={{ color: '#A0A0A0', marginTop: 8 }}>
                            {section.rationale}
                          </Text>
                          {section.insertAfter && (
                            <Text size={200} style={{ color: '#0EA5E9', marginTop: 4 }}>
                              Insert after: {section.insertAfter}
                            </Text>
                          )}
                          {/* Preview of new section content */}
                          {section.revisedText && !appliedSections.has(section.sectionTitle) && (
                            <div style={styles.newSectionPreview}>
                              <Text size={100} style={{ color: '#86EFAC' }}>
                                {section.revisedText.substring(0, 200)}{section.revisedText.length > 200 ? '...' : ''}
                              </Text>
                            </div>
                          )}
                          <div style={styles.sectionActions}>
                            <Button
                              size="small"
                              appearance={appliedSections.has(section.sectionTitle) ? 'outline' : 'primary'}
                              onClick={() => insertSingleSection(section)}
                              disabled={isApplyingChange || appliedSections.has(section.sectionTitle)}
                            >
                              {appliedSections.has(section.sectionTitle) ? 'Inserted' : 'Insert Section'}
                            </Button>
                          </div>
                        </Card>
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
                    <Card style={styles.summaryCard}>
                      <div style={{ textAlign: 'center', padding: 16 }}>
                        <CheckmarkCircle24Filled style={{ color: '#4ADE80', fontSize: 32 }} />
                        <Text size={300} weight="semibold" style={{ display: 'block', marginTop: 8 }}>
                          No Material Risks Found
                        </Text>
                        <Text size={200} style={{ color: '#A0A0A0' }}>
                          This contract appears to be favorable or already aligned with MARS positions.
                        </Text>
                      </div>
                    </Card>
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
                <Spinner label="Loading clauses..." />
              ) : clauses.length === 0 ? (
                <Text style={{ color: '#A0A0A0', textAlign: 'center' }}>
                  No clauses available. Add clauses in the MARS web app.
                </Text>
              ) : (
                <div style={styles.clauseList}>
                  {clauses.map((clause) => (
                    <Card key={clause.id} style={styles.clauseCard}>
                      <CardHeader
                        header={<Text weight="semibold">{clause.name}</Text>}
                        description={
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <Text size={200}>{clause.category}</Text>
                            {getRiskBadge(clause.risk_level)}
                          </div>
                        }
                      />
                      <div style={styles.clauseText}>
                        <Text size={200}>
                          {clause.primary_text.substring(0, 150)}
                          {clause.primary_text.length > 150 ? '...' : ''}
                        </Text>
                      </div>
                      <div style={styles.clauseActions}>
                        <Button
                          size="small"
                          appearance="primary"
                          onClick={() => insertClause(clause.primary_text)}
                        >
                          Insert Primary
                        </Button>
                        {clause.fallback_text && (
                          <Button
                            size="small"
                            appearance="outline"
                            onClick={() => insertClause(clause.fallback_text!)}
                          >
                            Insert Fallback
                          </Button>
                        )}
                      </div>
                    </Card>
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

// Dynamic style function for score circle
const getScoreCircleStyle = (riskLevel: string): React.CSSProperties => ({
  width: 64,
  height: 64,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: riskLevel === 'high' ? '#7F1D1D' : riskLevel === 'medium' ? '#78350F' : '#14532D',
});

// Styles
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: '#0F172A',
    color: '#F1F5F9',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 16px',
    borderBottom: '1px solid #1E293B',
    backgroundColor: '#0F172A',
  },
  headerContent: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 16px',
    backgroundColor: '#7F1D1D',
    color: '#FCA5A5',
    fontSize: 13,
  },
  tabs: {
    borderBottom: '1px solid #1E293B',
    backgroundColor: '#0F172A',
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: '16px 14px',
    backgroundColor: '#0F172A',
  },
  loginCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    padding: 32,
    margin: 'auto',
    maxWidth: 280,
  },
  analyzeTab: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  results: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    marginTop: 8,
  },
  scoreCard: {
    padding: 16,
    backgroundColor: '#1E293B',
    borderRadius: 10,
  },
  scoreContent: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  summaryCard: {
    padding: 14,
    backgroundColor: '#1E293B',
    borderRadius: 10,
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
    padding: 10,
    backgroundColor: '#1E293B',
    borderRadius: 6,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  clausesTab: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  clauseList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  clauseCard: {
    backgroundColor: '#1E293B',
    padding: 14,
    borderRadius: 10,
  },
  clauseText: {
    padding: '10px 0',
  },
  clauseActions: {
    display: 'flex',
    gap: 8,
    paddingTop: 10,
  },
  successBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 16px',
    backgroundColor: '#14532D',
    color: '#86EFAC',
    fontSize: 13,
  },
  previewOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 16,
  },
  previewPanel: {
    backgroundColor: '#2D2D2D',
    borderRadius: 8,
    padding: 20,
    maxWidth: 500,
    maxHeight: '90vh',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  diffView: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  diffSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  diffText: {
    padding: 12,
    backgroundColor: '#1F1F1F',
    borderRadius: 4,
    maxHeight: 150,
    overflowY: 'auto',
  },
  diffArrow: {
    textAlign: 'center',
    fontSize: 24,
    color: '#6B7280',
  },
  matchInfo: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  matchSelector: {
    padding: 12,
    backgroundColor: '#1F1F1F',
    borderRadius: 4,
  },
  matchList: {
    display: 'flex',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  previewActions: {
    display: 'flex',
    gap: 8,
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  locationBox: {
    padding: 8,
    backgroundColor: '#1F2937',
    borderRadius: 4,
    borderLeft: '3px solid #FBBF24',
  },
  fixItSection: {
    padding: 12,
    backgroundColor: '#14532D',
    borderRadius: 4,
    marginTop: 8,
  },
  fixItButtons: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  riskSummaryBar: {
    display: 'flex',
    justifyContent: 'center',
    padding: '14px 12px',
    backgroundColor: '#1E293B',
    borderRadius: 10,
    gap: 12,
  },
  riskBadgeLarge: {
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 600,
    borderRadius: 6,
  },
  sectionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginTop: 4,
  },
  sectionCard: {
    backgroundColor: '#1E293B',
    padding: 14,
    borderRadius: 10,
    border: '1px solid #334155',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  sectionActions: {
    display: 'flex',
    gap: 8,
    marginTop: 14,
    paddingTop: 12,
    borderTop: '1px solid #334155',
  },
  summaryList: {
    marginTop: 14,
    padding: 14,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    border: '1px solid #334155',
  },
  contractSection: {
    marginBottom: 14,
    position: 'relative',
  },
  contractDropdownContainer: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  contractInput: {
    width: '100%',
    padding: '11px 36px 11px 14px',
    backgroundColor: '#1E293B',
    border: '1px solid #334155',
    borderRadius: 8,
    color: '#F1F5F9',
    fontSize: 13,
    outline: 'none',
  },
  clearButton: {
    position: 'absolute',
    right: 10,
    background: 'none',
    border: 'none',
    color: '#64748B',
    cursor: 'pointer',
    fontSize: 16,
    padding: 4,
    lineHeight: 1,
  },
  contractDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 6,
    backgroundColor: '#1E293B',
    border: '1px solid #334155',
    borderRadius: 8,
    maxHeight: 220,
    overflowY: 'auto',
    zIndex: 100,
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
  },
  contractOption: {
    width: '100%',
    textAlign: 'left',
    padding: '12px 14px',
    border: 'none',
    borderBottom: '1px solid #334155',
    background: 'none',
    cursor: 'pointer',
    display: 'block',
    color: '#F1F5F9',
  },
  selectedContractBadge: {
    marginTop: 10,
  },
  changesList: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#0F172A',
    borderRadius: 6,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  changeItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    paddingBottom: 6,
    borderBottom: '1px solid #334155',
  },
  newSectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  newSectionPreview: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#0F172A',
    borderRadius: 6,
    borderLeft: '3px solid #0EA5E9',
  },
};
