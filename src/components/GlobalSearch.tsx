'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';

// =============================================================================
// TYPES
// =============================================================================

type ResultType = 'contract' | 'document' | 'task' | 'work_order' | 'sales_order' | 'asana_task';
type ScopeType = 'all' | 'contracts' | 'documents' | 'tasks' | 'netsuite' | 'asana';

interface SearchResult {
  id: string;
  type: ResultType;
  title: string;
  subtitle?: string;
  value?: number;
  status?: string;
  url?: string;
  matchedField?: string;
  matchedText?: string;
  relevanceScore?: number;
  isArchived?: boolean;
  // Type-specific fields
  documentType?: string;
  uploadedAt?: string;
  dueDate?: string;
  dueOn?: string;
  customerName?: string;
  woDate?: string;
  soDate?: string;
  soNumber?: string;
  totalAmount?: number;
  completed?: boolean;
  projectName?: string;
  assignee?: string;
}

interface SearchResults {
  contracts: SearchResult[];
  documents: SearchResult[];
  tasks: SearchResult[];
  workOrders: SearchResult[];
  salesOrders: SearchResult[];
  asanaTasks: SearchResult[];
}

interface SearchTotals {
  contracts: number;
  documents: number;
  tasks: number;
  workOrders: number;
  salesOrders: number;
  asanaTasks: number;
  total: number;
}

interface Pagination {
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

interface SearchFilters {
  includeArchived: boolean;
  includeHistorical: boolean;
  status?: string;
}

// =============================================================================
// CONSTANTS & DESIGN TOKENS
// =============================================================================

const SEARCH_HISTORY_KEY = 'mars-search-history';
const MAX_HISTORY_ITEMS = 10;

// Apple Pro Design Tokens
const design = {
  // L2 Modal surface
  modalBg: 'linear-gradient(180deg, rgba(36,46,66,0.95), rgba(22,30,44,0.98))',
  modalShadow: '0 30px 90px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.10)',
  // L1 Result surface
  resultBg: 'linear-gradient(180deg, rgba(28,36,52,0.88), rgba(18,24,36,0.96))',
  resultShadow: '0 10px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
};

// Data source colors
const TYPE_CONFIG: Record<ResultType, {
  color: string;
  bgOpacity: string;
  label: string;
  icon: React.ReactNode;
}> = {
  contract: {
    color: '#38BDF8',
    bgOpacity: '10',
    label: 'Contract',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  document: {
    color: '#8B5CF6',
    bgOpacity: '10',
    label: 'Document',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
  task: {
    color: '#50D28C',
    bgOpacity: '10',
    label: 'Task',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  work_order: {
    color: '#F97316',
    bgOpacity: '10',
    label: 'Work Order',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  sales_order: {
    color: '#F97316',
    bgOpacity: '10',
    label: 'Sales Order',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
      </svg>
    ),
  },
  asana_task: {
    color: '#F06A6A',
    bgOpacity: '10',
    label: 'Asana',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.782 12.625c-1.854 0-3.357 1.503-3.357 3.357s1.503 3.357 3.357 3.357 3.357-1.503 3.357-3.357-1.503-3.357-3.357-3.357zM5.218 12.625c-1.854 0-3.357 1.503-3.357 3.357s1.503 3.357 3.357 3.357 3.357-1.503 3.357-3.357-1.503-3.357-3.357-3.357zM12 4.661c-1.854 0-3.357 1.503-3.357 3.357S10.146 11.375 12 11.375s3.357-1.503 3.357-3.357S13.854 4.661 12 4.661z"/>
      </svg>
    ),
  },
};

const SCOPE_CONFIG: Record<ScopeType, { label: string; color: string }> = {
  all: { label: 'All', color: '#5A82FF' },
  contracts: { label: 'Contracts', color: '#38BDF8' },
  documents: { label: 'Docs', color: '#8B5CF6' },
  tasks: { label: 'Tasks', color: '#50D28C' },
  netsuite: { label: 'NetSuite', color: '#F97316' },
  asana: { label: 'Asana', color: '#F06A6A' },
};

// =============================================================================
// HELPERS
// =============================================================================

function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

function getSearchHistory(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveSearchHistory(query: string): void {
  if (typeof window === 'undefined' || !query.trim()) return;
  try {
    const history = getSearchHistory();
    const filtered = history.filter(h => h.toLowerCase() !== query.toLowerCase());
    const updated = [query, ...filtered].slice(0, MAX_HISTORY_ITEMS);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // Ignore localStorage errors
  }
}

function clearSearchHistory(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  } catch {
    // Ignore
  }
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>({
    contracts: [],
    documents: [],
    tasks: [],
    workOrders: [],
    salesOrders: [],
    asanaTasks: [],
  });
  const [totals, setTotals] = useState<SearchTotals>({
    contracts: 0, documents: 0, tasks: 0,
    workOrders: 0, salesOrders: 0, asanaTasks: 0, total: 0,
  });
  const [pagination, setPagination] = useState<Pagination>({
    page: 1, limit: 20, totalPages: 0, hasMore: false,
  });
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeScope, setActiveScope] = useState<ScopeType>('all');
  const [filters, setFilters] = useState<SearchFilters>({
    includeArchived: false,
    includeHistorical: false,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // =============================================================================
  // COMPUTED VALUES
  // =============================================================================

  // Flatten results based on active scope
  const allResults = (() => {
    if (activeScope === 'contracts') return results.contracts;
    if (activeScope === 'documents') return results.documents;
    if (activeScope === 'tasks') return results.tasks;
    if (activeScope === 'netsuite') return [...results.workOrders, ...results.salesOrders];
    if (activeScope === 'asana') return results.asanaTasks;
    return [
      ...results.contracts,
      ...results.documents,
      ...results.tasks,
      ...results.workOrders,
      ...results.salesOrders,
      ...results.asanaTasks,
    ];
  })();

  // Group results by type for display
  const groupedResults = {
    contracts: activeScope === 'all' || activeScope === 'contracts' ? results.contracts : [],
    documents: activeScope === 'all' || activeScope === 'documents' ? results.documents : [],
    tasks: activeScope === 'all' || activeScope === 'tasks' ? results.tasks : [],
    workOrders: activeScope === 'all' || activeScope === 'netsuite' ? results.workOrders : [],
    salesOrders: activeScope === 'all' || activeScope === 'netsuite' ? results.salesOrders : [],
    asanaTasks: activeScope === 'all' || activeScope === 'asana' ? results.asanaTasks : [],
  };

  // Scope tabs with counts
  const scopeTabs = [
    { id: 'all' as ScopeType, label: 'All', count: totals.total },
    { id: 'contracts' as ScopeType, label: 'Contracts', count: totals.contracts },
    { id: 'documents' as ScopeType, label: 'Docs', count: totals.documents },
    { id: 'tasks' as ScopeType, label: 'Tasks', count: totals.tasks },
    { id: 'netsuite' as ScopeType, label: 'NetSuite', count: totals.workOrders + totals.salesOrders },
    { id: 'asana' as ScopeType, label: 'Asana', count: totals.asanaTasks },
  ];

  // =============================================================================
  // EFFECTS
  // =============================================================================

  // Load search history on mount
  useEffect(() => {
    setSearchHistory(getSearchHistory());
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setSearchHistory(getSearchHistory());
    } else {
      setQuery('');
      setResults({
        contracts: [], documents: [], tasks: [],
        workOrders: [], salesOrders: [], asanaTasks: [],
      });
      setTotals({
        contracts: 0, documents: 0, tasks: 0,
        workOrders: 0, salesOrders: 0, asanaTasks: 0, total: 0,
      });
      setSelectedIndex(0);
      setPagination({ page: 1, limit: 20, totalPages: 0, hasMore: false });
    }
  }, [isOpen]);

  // Global keyboard shortcut (Cmd+K or Ctrl+K)
  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen]);

  // Search with debounce
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults({
        contracts: [], documents: [], tasks: [],
        workOrders: [], salesOrders: [], asanaTasks: [],
      });
      setTotals({
        contracts: 0, documents: 0, tasks: 0,
        workOrders: 0, salesOrders: 0, asanaTasks: 0, total: 0,
      });
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          q: query,
          scope: activeScope,
          includeArchived: filters.includeArchived.toString(),
          includeHistorical: filters.includeHistorical.toString(),
          page: '1',
          limit: '20',
        });
        if (filters.status) params.set('status', filters.status);

        const response = await fetch(`/api/contracts/search?${params}`);
        if (response.ok) {
          const data = await response.json();
          setResults(data.results);
          setTotals(data.totals);
          setPagination(data.pagination);
          setSelectedIndex(0);
        }
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, activeScope, filters]);

  // =============================================================================
  // HANDLERS
  // =============================================================================

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, allResults.length - 1));
      // Scroll selected item into view
      setTimeout(() => {
        const selected = resultsRef.current?.querySelector('[data-selected="true"]');
        selected?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }, 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
      setTimeout(() => {
        const selected = resultsRef.current?.querySelector('[data-selected="true"]');
        selected?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }, 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allResults[selectedIndex]) {
        handleSelect(allResults[selectedIndex], e.metaKey || e.ctrlKey);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const scopes: ScopeType[] = ['all', 'contracts', 'documents', 'tasks', 'netsuite', 'asana'];
      const currentIdx = scopes.indexOf(activeScope);
      const nextIdx = e.shiftKey
        ? (currentIdx - 1 + scopes.length) % scopes.length
        : (currentIdx + 1) % scopes.length;
      setActiveScope(scopes[nextIdx]);
      setSelectedIndex(0);
    }
  }, [allResults, selectedIndex, activeScope]);

  const handleSelect = (result: SearchResult, newTab = false) => {
    // Save to history
    if (query.trim()) {
      saveSearchHistory(query);
    }

    setIsOpen(false);

    if (result.url) {
      if (result.url.startsWith('/')) {
        if (newTab) {
          window.open(result.url, '_blank');
        } else {
          router.push(result.url);
        }
      } else {
        // External URL (like Asana) - always open in new tab
        window.open(result.url, '_blank');
      }
    }
  };

  const handleLoadMore = async () => {
    if (!pagination.hasMore || loadingMore) return;

    setLoadingMore(true);
    try {
      const params = new URLSearchParams({
        q: query,
        scope: activeScope,
        includeArchived: filters.includeArchived.toString(),
        includeHistorical: filters.includeHistorical.toString(),
        page: (pagination.page + 1).toString(),
        limit: '20',
      });

      const response = await fetch(`/api/contracts/search?${params}`);
      if (response.ok) {
        const data = await response.json();
        // Append new results
        setResults(prev => ({
          contracts: [...prev.contracts, ...data.results.contracts],
          documents: [...prev.documents, ...data.results.documents],
          tasks: [...prev.tasks, ...data.results.tasks],
          workOrders: [...prev.workOrders, ...data.results.workOrders],
          salesOrders: [...prev.salesOrders, ...data.results.salesOrders],
          asanaTasks: [...prev.asanaTasks, ...data.results.asanaTasks],
        }));
        setPagination(data.pagination);
      }
    } catch (err) {
      console.error('Load more failed:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleHistorySelect = (historyQuery: string) => {
    setQuery(historyQuery);
    inputRef.current?.focus();
  };

  const handleClearHistory = () => {
    clearSearchHistory();
    setSearchHistory([]);
  };

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        title="Search (Cmd+K)"
        className="flex items-center gap-2.5 px-4 py-2 bg-[#0B1220]/80 border border-white/[0.06] rounded-xl text-[#64748B] hover:text-white hover:border-white/[0.12] hover:bg-[#111827] transition-all group"
      >
        <svg className="w-4 h-4 text-[#64748B] group-hover:text-[#5A82FF] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span className="text-sm">Search...</span>
        <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium text-[#64748B] bg-white/[0.04] rounded border border-white/[0.06]">
          <span className="mr-0.5">&#8984;</span>K
        </kbd>
      </button>

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-[#0B1220]/90 z-50"
            />

            {/* Search Panel */}
            <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: -10 }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                className="w-full max-w-2xl pointer-events-auto"
              >
                <div
                  className="rounded-[18px] overflow-hidden border border-white/[0.08]"
                  style={{
                    background: design.modalBg,
                    boxShadow: design.modalShadow,
                  }}
                >
                  {/* Search Input */}
                  <div className="relative">
                    <div className="flex items-center gap-4 px-6 py-5">
                      <div className="relative">
                        {loading ? (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            className="w-6 h-6 border-2 border-[#5A82FF] border-t-transparent rounded-full"
                          />
                        ) : (
                          <svg className="w-6 h-6 text-[#5A82FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        )}
                      </div>
                      <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Search contracts, documents, NetSuite, Asana..."
                        className="flex-1 bg-transparent text-white placeholder-[#64748B] focus:outline-none text-lg font-light"
                        style={{
                          caretColor: '#5A82FF',
                        }}
                      />
                      {query && (
                        <button
                          onClick={() => setQuery('')}
                          className="p-1.5 rounded-lg text-[#64748B] hover:text-white hover:bg-white/[0.06] transition-all"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                      <div className="flex items-center gap-1.5 pl-4 border-l border-white/[0.06]">
                        <kbd className="px-2 py-1 text-xs font-medium text-[#64748B] bg-[#0B1220] rounded-md border border-white/[0.08]">
                          ESC
                        </kbd>
                      </div>
                    </div>
                    <div className="absolute bottom-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
                  </div>

                  {/* Scope Tabs */}
                  {query.length >= 2 && (
                    <div className="flex items-center gap-2 px-6 py-3 border-b border-white/[0.04] overflow-x-auto">
                      {scopeTabs.map((scope) => {
                        const isActive = activeScope === scope.id;
                        const color = SCOPE_CONFIG[scope.id].color;
                        return (
                          <button
                            key={scope.id}
                            onClick={() => {
                              setActiveScope(scope.id);
                              setSelectedIndex(0);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                              isActive
                                ? 'text-white'
                                : 'text-[#64748B] hover:text-white hover:bg-white/[0.04]'
                            }`}
                            style={isActive ? {
                              backgroundColor: color,
                              boxShadow: `0 4px 12px ${color}40`,
                            } : undefined}
                          >
                            {scope.label}
                            {scope.count > 0 && !isActive && (
                              <span className="ml-1.5 px-1.5 py-0.5 bg-white/[0.1] rounded text-xs">
                                {scope.count}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Filters (Collapsible) */}
                  {query.length >= 2 && (
                    <div className="border-b border-white/[0.04]">
                      <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="w-full flex items-center justify-between px-6 py-2 text-xs text-[#64748B] hover:text-white transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                          </svg>
                          Filters
                          {(filters.includeArchived || filters.includeHistorical) && (
                            <span className="px-1.5 py-0.5 bg-[#5A82FF]/20 text-[#5A82FF] rounded text-[10px] font-medium">
                              Active
                            </span>
                          )}
                        </span>
                        <svg
                          className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      <AnimatePresence>
                        {showFilters && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="px-6 pb-3 flex flex-wrap gap-4">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={filters.includeArchived}
                                  onChange={(e) => setFilters(f => ({ ...f, includeArchived: e.target.checked }))}
                                  className="w-4 h-4 rounded border-white/[0.2] bg-transparent text-[#5A82FF] focus:ring-[#5A82FF] focus:ring-offset-0"
                                />
                                <span className="text-sm text-[#8FA3BF]">Include archived</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={filters.includeHistorical}
                                  onChange={(e) => setFilters(f => ({ ...f, includeHistorical: e.target.checked }))}
                                  className="w-4 h-4 rounded border-white/[0.2] bg-transparent text-[#5A82FF] focus:ring-[#5A82FF] focus:ring-offset-0"
                                />
                                <span className="text-sm text-[#8FA3BF]">Include pre-2025</span>
                              </label>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Results */}
                  <div ref={resultsRef} className="max-h-[420px] overflow-y-auto">
                    {query.length < 2 ? (
                      // Show search history or empty state
                      <div className="px-6 py-8">
                        {searchHistory.length > 0 ? (
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                                Recent Searches
                              </span>
                              <button
                                onClick={handleClearHistory}
                                className="text-xs text-[#64748B] hover:text-white transition-colors"
                              >
                                Clear
                              </button>
                            </div>
                            <div className="space-y-1">
                              {searchHistory.map((historyQuery, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => handleHistorySelect(historyQuery)}
                                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-[#8FA3BF] hover:text-white hover:bg-white/[0.04] transition-all"
                                >
                                  <svg className="w-4 h-4 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <span className="truncate">{historyQuery}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-center">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#5A82FF]/10 flex items-center justify-center">
                              <svg className="w-8 h-8 text-[#5A82FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                              </svg>
                            </div>
                            <p className="text-[#8FA3BF] text-lg font-light mb-2">Search MARS</p>
                            <p className="text-[#64748B] text-sm">Contracts, documents, NetSuite orders, Asana tasks</p>
                          </div>
                        )}
                      </div>
                    ) : allResults.length === 0 && !loading ? (
                      <div className="px-6 py-12 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/[0.04] flex items-center justify-center">
                          <svg className="w-8 h-8 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <p className="text-[#8FA3BF] text-lg font-light mb-2">No results found</p>
                        <p className="text-[#64748B] text-sm">Try different keywords or adjust filters</p>
                      </div>
                    ) : (
                      <div className="py-3">
                        {/* Contracts */}
                        {groupedResults.contracts.length > 0 && (
                          <ResultSection
                            title="Contracts"
                            type="contract"
                            results={groupedResults.contracts}
                            selectedIndex={selectedIndex}
                            offset={0}
                            onSelect={handleSelect}
                            onHover={setSelectedIndex}
                            totals={totals}
                          />
                        )}

                        {/* Documents */}
                        {groupedResults.documents.length > 0 && (
                          <ResultSection
                            title="Documents"
                            type="document"
                            results={groupedResults.documents}
                            selectedIndex={selectedIndex}
                            offset={groupedResults.contracts.length}
                            onSelect={handleSelect}
                            onHover={setSelectedIndex}
                            totals={totals}
                          />
                        )}

                        {/* Tasks */}
                        {groupedResults.tasks.length > 0 && (
                          <ResultSection
                            title="Tasks"
                            type="task"
                            results={groupedResults.tasks}
                            selectedIndex={selectedIndex}
                            offset={groupedResults.contracts.length + groupedResults.documents.length}
                            onSelect={handleSelect}
                            onHover={setSelectedIndex}
                            totals={totals}
                          />
                        )}

                        {/* Work Orders */}
                        {groupedResults.workOrders.length > 0 && (
                          <ResultSection
                            title="Work Orders"
                            type="work_order"
                            results={groupedResults.workOrders}
                            selectedIndex={selectedIndex}
                            offset={groupedResults.contracts.length + groupedResults.documents.length + groupedResults.tasks.length}
                            onSelect={handleSelect}
                            onHover={setSelectedIndex}
                            totals={totals}
                          />
                        )}

                        {/* Sales Orders */}
                        {groupedResults.salesOrders.length > 0 && (
                          <ResultSection
                            title="Sales Orders"
                            type="sales_order"
                            results={groupedResults.salesOrders}
                            selectedIndex={selectedIndex}
                            offset={groupedResults.contracts.length + groupedResults.documents.length + groupedResults.tasks.length + groupedResults.workOrders.length}
                            onSelect={handleSelect}
                            onHover={setSelectedIndex}
                            totals={totals}
                          />
                        )}

                        {/* Asana Tasks */}
                        {groupedResults.asanaTasks.length > 0 && (
                          <ResultSection
                            title="Asana Tasks"
                            type="asana_task"
                            results={groupedResults.asanaTasks}
                            selectedIndex={selectedIndex}
                            offset={groupedResults.contracts.length + groupedResults.documents.length + groupedResults.tasks.length + groupedResults.workOrders.length + groupedResults.salesOrders.length}
                            onSelect={handleSelect}
                            onHover={setSelectedIndex}
                            totals={totals}
                          />
                        )}

                        {/* Load More */}
                        {pagination.hasMore && (
                          <div className="px-4 py-3">
                            <button
                              onClick={handleLoadMore}
                              disabled={loadingMore}
                              className="w-full py-2 rounded-lg text-sm text-[#5A82FF] hover:bg-[#5A82FF]/10 transition-all disabled:opacity-50"
                            >
                              {loadingMore ? (
                                <span className="flex items-center justify-center gap-2">
                                  <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                    className="w-4 h-4 border-2 border-[#5A82FF] border-t-transparent rounded-full"
                                  />
                                  Loading...
                                </span>
                              ) : (
                                `Load more results`
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="px-6 py-3 border-t border-white/[0.04] bg-[#0B1220]/30">
                    <div className="flex items-center justify-between text-xs text-[#64748B]">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5">
                          <kbd className="px-1.5 py-0.5 bg-white/[0.06] rounded font-medium">&#8593;</kbd>
                          <kbd className="px-1.5 py-0.5 bg-white/[0.06] rounded font-medium">&#8595;</kbd>
                          <span className="ml-1">Navigate</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <kbd className="px-1.5 py-0.5 bg-white/[0.06] rounded font-medium">&#8629;</kbd>
                          <span className="ml-1">Open</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <kbd className="px-1.5 py-0.5 bg-white/[0.06] rounded font-medium">Tab</kbd>
                          <span className="ml-1">Switch</span>
                        </span>
                        <span className="hidden sm:flex items-center gap-1.5">
                          <kbd className="px-1.5 py-0.5 bg-white/[0.06] rounded font-medium">&#8984;&#8629;</kbd>
                          <span className="ml-1">New tab</span>
                        </span>
                      </div>
                      <span className="text-[#64748B]">
                        {totals.total} result{totals.total !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// =============================================================================
// RESULT SECTION COMPONENT
// =============================================================================

function ResultSection({
  title,
  type,
  results,
  selectedIndex,
  offset,
  onSelect,
  onHover,
  totals,
}: {
  title: string;
  type: ResultType;
  results: SearchResult[];
  selectedIndex: number;
  offset: number;
  onSelect: (result: SearchResult, newTab?: boolean) => void;
  onHover: (index: number) => void;
  totals: SearchTotals;
}) {
  const config = TYPE_CONFIG[type];

  return (
    <div className="px-4 mb-3">
      <div className="flex items-center gap-2 px-2 mb-2">
        <span style={{ color: config.color }}>{config.icon}</span>
        <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
          {title}
        </span>
        <span className="text-xs text-[#64748B]">({results.length})</span>
      </div>
      <div className="space-y-1">
        {results.map((result, idx) => {
          const globalIndex = offset + idx;
          const isSelected = selectedIndex === globalIndex;

          return (
            <button
              key={result.id}
              onClick={(e) => onSelect(result, e.metaKey || e.ctrlKey)}
              onMouseEnter={() => onHover(globalIndex)}
              data-selected={isSelected}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl text-left transition-all relative overflow-hidden ${
                isSelected
                  ? 'bg-white/[0.06]'
                  : 'hover:bg-white/[0.03]'
              }`}
              style={isSelected ? {
                boxShadow: `inset 0 0 0 1px ${config.color}30`,
              } : undefined}
            >
              {/* Left accent bar */}
              {isSelected && (
                <div
                  className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full"
                  style={{
                    backgroundColor: config.color,
                    boxShadow: `0 0 8px ${config.color}`,
                  }}
                />
              )}

              {/* Icon */}
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  backgroundColor: `${config.color}${config.bgOpacity}`,
                  color: config.color,
                }}
              >
                {config.icon}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`font-medium truncate ${isSelected ? 'text-white' : 'text-[#E2E8F0]'}`}>
                    {result.title}
                  </p>
                  {result.isArchived && (
                    <span className="px-1.5 py-0.5 bg-[#64748B]/20 text-[#64748B] rounded text-[10px] font-medium">
                      Archived
                    </span>
                  )}
                  {result.completed && (
                    <span className="px-1.5 py-0.5 bg-[#50D28C]/20 text-[#50D28C] rounded text-[10px] font-medium">
                      Done
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {result.subtitle && (
                    <p className="text-[#64748B] text-sm truncate">{result.subtitle}</p>
                  )}
                  {result.matchedField && result.matchedField !== 'unknown' && (
                    <span className="text-[10px] text-[#64748B] bg-white/[0.04] px-1.5 py-0.5 rounded">
                      Matched: {result.matchedField}
                    </span>
                  )}
                </div>
              </div>

              {/* Right side info */}
              <div className="flex-shrink-0 text-right">
                {result.value !== undefined && result.value > 0 && (
                  <p className="text-[#50D28C] text-sm font-semibold">{formatCurrency(result.value)}</p>
                )}
                {result.totalAmount !== undefined && result.totalAmount > 0 && (
                  <p className="text-[#50D28C] text-sm font-semibold">{formatCurrency(result.totalAmount)}</p>
                )}
                {result.status && (
                  <p className="text-[#64748B] text-xs capitalize">{result.status.replace(/_/g, ' ')}</p>
                )}
                {result.documentType && (
                  <p className="text-[#8B5CF6] text-xs font-medium">{result.documentType}</p>
                )}
                {result.projectName && type === 'asana_task' && (
                  <p className="text-[#F06A6A] text-xs truncate max-w-[120px]">{result.projectName}</p>
                )}
              </div>

              {/* Arrow indicator */}
              {isSelected && (
                <div className="flex-shrink-0" style={{ color: config.color }}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
