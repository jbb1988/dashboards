import React, { useState, useEffect, useCallback } from 'react';
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
  matchType: 'exact' | 'normalized' | 'wildcard' | 'fuzzy' | 'truncated';
}

interface PreviewState {
  isOpen: boolean;
  originalText: string;
  newText: string;
  matches: SearchMatch[];
  selectedMatchIndex: number;
  riskId: string;
  clauseType: 'primary' | 'fallback' | 'last_resort' | 'suggestion';
}

interface AnalysisResult {
  overall_risk_score: number;
  risk_level: string;
  risks: RiskItem[];
  clause_suggestions: ClauseSuggestion[];
  summary: string;
}

interface User {
  email: string;
  name: string;
}

// Office.js types are loaded from @types/office-js
// Office.js library is loaded from CDN in HTML
declare const Office: typeof globalThis.Office;
declare const Word: typeof globalThis.Word;

const API_BASE = process.env.NODE_ENV === 'production'
  ? 'https://mars-contracts.vercel.app'
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
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [clauses, setClauses] = useState<ClauseSuggestion[]>([]);
  const [isLoadingClauses, setIsLoadingClauses] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Preview and match selection state
  const [previewState, setPreviewState] = useState<PreviewState | null>(null);
  const [isApplyingChange, setIsApplyingChange] = useState(false);

  // Track which fixes have been applied (by risk id)
  const [appliedFixes, setAppliedFixes] = useState<Set<string>>(new Set());

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

  // Handle login
  const handleLogin = async () => {
    try {
      // Open dialog for OAuth flow
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
          }
        }
      );
    } catch (err) {
      setError('Failed to open login dialog');
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

  // Analyze document
  const analyzeDocument = async () => {
    if (!user) {
      setError('Please log in first');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAppliedFixes(new Set()); // Clear applied fixes on new analysis

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
      const response = await fetch(`${API_BASE}/api/word-addin/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          document_text: documentText,
          document_name: documentName,
        }),
      });

      if (!response.ok) {
        throw new Error('Analysis failed');
      }

      const result = await response.json();
      setAnalysisResult(result);
    } catch (err) {
      setError('Failed to analyze document. Please try again.');
      console.error('Analysis error:', err);
    } finally {
      setIsAnalyzing(false);
    }
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
   */
  const cascadingSearch = async (
    searchText: string,
    context: Word.RequestContext
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
        const matches = await cascadingSearch(originalText, context);

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

        // Set up preview state
        setPreviewState({
          isOpen: true,
          originalText,
          newText,
          matches,
          selectedMatchIndex: 0,
          riskId: risk.id,
          clauseType,
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
        // Re-search to get fresh range reference
        const matches = await cascadingSearch(previewState.originalText, context);

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

        // Track usage in API (fire and forget)
        const riskItem = analysisResult?.risks.find(r => r.id === previewState.riskId);
        if (riskItem?.matched_clause) {
          trackClauseUsage(riskItem.matched_clause.id, previewState.clauseType);
        }

        // Mark this fix as applied
        setAppliedFixes(prev => new Set(prev).add(previewState.riskId));

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
        const matches = await cascadingSearch(previewState.originalText, context);
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
        const matches = await cascadingSearch(previewState.originalText, context);

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
            <Button
              appearance="primary"
              icon={<Person24Regular />}
              onClick={handleLogin}
              style={{ marginTop: 16 }}
            >
              Sign in with Microsoft
            </Button>
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

              {/* Analysis Results */}
              {analysisResult && (
                <div style={styles.results}>
                  {/* Risk Score */}
                  <Card style={styles.scoreCard}>
                    <div style={styles.scoreContent}>
                      <div style={getScoreCircleStyle(analysisResult.risk_level)}>
                        <Text size={700} weight="bold">
                          {Math.round(analysisResult.overall_risk_score)}
                        </Text>
                      </div>
                      <div>
                        <Text weight="semibold">Risk Score</Text>
                        <Text size={200} style={{ color: '#A0A0A0' }}>
                          {analysisResult.risk_level} risk
                        </Text>
                      </div>
                    </div>
                  </Card>

                  {/* Summary */}
                  <Card style={styles.summaryCard}>
                    <Text size={200} style={{ color: '#A0A0A0' }}>
                      {analysisResult.summary}
                    </Text>
                  </Card>

                  {/* Risks */}
                  {analysisResult.risks.length > 0 && (
                    <div>
                      <Text weight="semibold" style={{ marginBottom: 8, display: 'block' }}>
                        Issues Found ({analysisResult.risks.length})
                      </Text>
                      <Accordion collapsible>
                        {analysisResult.risks.map((risk) => (
                          <AccordionItem key={risk.id} value={risk.id}>
                            <AccordionHeader>
                              <div style={styles.riskHeader}>
                                {appliedFixes.has(risk.id) ? (
                                  <Badge appearance="filled" color="success" icon={<CheckmarkCircle24Filled />}>
                                    Fixed
                                  </Badge>
                                ) : (
                                  getRiskBadge(risk.severity)
                                )}
                                <Text size={200} style={appliedFixes.has(risk.id) ? { textDecoration: 'line-through', opacity: 0.6 } : undefined}>
                                  {risk.title}
                                </Text>
                              </div>
                            </AccordionHeader>
                            <AccordionPanel>
                              <div style={styles.riskContent}>
                                <Text size={200}>{risk.description}</Text>

                                {/* Location Info */}
                                {risk.location && (
                                  <div style={styles.locationBox}>
                                    <Text size={200} weight="semibold" style={{ color: '#FBBF24' }}>
                                      Problematic Text:
                                    </Text>
                                    <Text size={200} style={{ fontStyle: 'italic', color: '#D1D5DB' }}>
                                      "{risk.location.substring(0, 150)}{risk.location.length > 150 ? '...' : ''}"
                                    </Text>
                                  </div>
                                )}

                                {/* Matched Clause Library Options */}
                                {risk.matched_clause && (
                                  <div style={styles.fixItSection}>
                                    <Text size={200} weight="semibold" style={{ marginBottom: 8, display: 'block' }}>
                                      Fix with Clause Library: {risk.matched_clause.name}
                                    </Text>

                                    <div style={styles.fixItButtons}>
                                      <Button
                                        size="small"
                                        appearance="primary"
                                        onClick={() => initiateFixIt(risk, 'primary')}
                                        disabled={isApplyingChange || appliedFixes.has(risk.id)}
                                        style={{ backgroundColor: appliedFixes.has(risk.id) ? '#4B5563' : '#16A34A' }}
                                      >
                                        {appliedFixes.has(risk.id) ? 'Applied' : 'Fix It: Primary'}
                                      </Button>

                                      {risk.matched_clause.fallback_text && !appliedFixes.has(risk.id) && (
                                        <Button
                                          size="small"
                                          appearance="outline"
                                          onClick={() => initiateFixIt(risk, 'fallback')}
                                          disabled={isApplyingChange}
                                        >
                                          Fix It: Fallback
                                        </Button>
                                      )}

                                      {risk.matched_clause.last_resort_text && !appliedFixes.has(risk.id) && (
                                        <Button
                                          size="small"
                                          appearance="subtle"
                                          onClick={() => initiateFixIt(risk, 'last_resort')}
                                          disabled={isApplyingChange}
                                        >
                                          Fix It: Last Resort
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* AI Suggestion (if no matched clause or as alternative) */}
                                {risk.suggestion && (
                                  <div style={styles.suggestion}>
                                    <Text size={200} weight="semibold">
                                      {risk.matched_clause ? 'Alternative - AI Suggestion:' : 'AI Suggestion:'}
                                    </Text>
                                    <Text size={200}>{risk.suggestion.substring(0, 200)}
                                      {risk.suggestion.length > 200 ? '...' : ''}</Text>
                                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                      {risk.location && !appliedFixes.has(risk.id) && (
                                        <Button
                                          size="small"
                                          appearance="outline"
                                          onClick={() => initiateFixIt(risk, 'suggestion')}
                                          disabled={isApplyingChange}
                                        >
                                          Fix with Suggestion
                                        </Button>
                                      )}
                                      <Button
                                        size="small"
                                        appearance="subtle"
                                        onClick={() => insertClause(risk.suggestion)}
                                      >
                                        Insert at Cursor
                                      </Button>
                                    </div>
                                  </div>
                                )}

                                {/* Highlight Button */}
                                {risk.location && (
                                  <Button
                                    size="small"
                                    appearance="outline"
                                    onClick={() => highlightRisk(risk.location!)}
                                    style={{ marginTop: 8 }}
                                  >
                                    Highlight in Document
                                  </Button>
                                )}
                              </div>
                            </AccordionPanel>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </div>
                  )}

                  {/* Clause Suggestions */}
                  {analysisResult.clause_suggestions.length > 0 && (
                    <div>
                      <Text weight="semibold" style={{ marginBottom: 8, display: 'block' }}>
                        Recommended Clauses
                      </Text>
                      {analysisResult.clause_suggestions.map((clause) => (
                        <Card key={clause.id} style={styles.clauseCard}>
                          <CardHeader
                            header={<Text weight="semibold">{clause.name}</Text>}
                            description={<Text size={200}>{clause.category}</Text>}
                            action={
                              <Button
                                size="small"
                                onClick={() => insertClause(clause.primary_text)}
                              >
                                Insert
                              </Button>
                            }
                          />
                        </Card>
                      ))}
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
    backgroundColor: '#1F1F1F',
    color: '#FFFFFF',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid #333',
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
    backgroundColor: '#7F1D1D',
    color: '#FCA5A5',
  },
  tabs: {
    borderBottom: '1px solid #333',
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: 16,
  },
  loginCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    padding: 32,
    margin: 'auto',
  },
  analyzeTab: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  results: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  scoreCard: {
    padding: 16,
    backgroundColor: '#2D2D2D',
  },
  scoreContent: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  summaryCard: {
    padding: 12,
    backgroundColor: '#2D2D2D',
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
    backgroundColor: '#1F2937',
    borderRadius: 4,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  clausesTab: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  clauseList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  clauseCard: {
    backgroundColor: '#2D2D2D',
    padding: 12,
  },
  clauseText: {
    padding: '8px 0',
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
    backgroundColor: '#14532D',
    color: '#86EFAC',
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
};
