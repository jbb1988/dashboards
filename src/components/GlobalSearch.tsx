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
// APPLE VISION PRO DESIGN SYSTEM
// =============================================================================

const visionPro = {
  // Glass materials - layered translucency
  glass: {
    ultra: 'rgba(255,255,255,0.02)',
    thin: 'rgba(255,255,255,0.04)',
    regular: 'rgba(255,255,255,0.06)',
    thick: 'rgba(255,255,255,0.08)',
    chrome: 'rgba(255,255,255,0.12)',
  },

  // Depths - for layered surfaces
  depth: {
    backdrop: 'rgba(0,0,0,0.85)',
    surface1: 'rgba(18,18,24,0.95)',
    surface2: 'rgba(28,28,36,0.90)',
    surface3: 'rgba(38,38,48,0.85)',
    elevated: 'rgba(48,48,58,0.80)',
  },

  // Luminance - glowing elements
  glow: {
    white: '0 0 30px rgba(255,255,255,0.15), 0 0 60px rgba(255,255,255,0.05)',
    blue: '0 0 20px rgba(88,166,255,0.4), 0 0 40px rgba(88,166,255,0.2), 0 0 80px rgba(88,166,255,0.1)',
    purple: '0 0 20px rgba(167,139,250,0.4), 0 0 40px rgba(167,139,250,0.2)',
    cyan: '0 0 20px rgba(56,189,248,0.4), 0 0 40px rgba(56,189,248,0.2)',
    green: '0 0 20px rgba(74,222,128,0.4), 0 0 40px rgba(74,222,128,0.2)',
    orange: '0 0 20px rgba(251,146,60,0.4), 0 0 40px rgba(251,146,60,0.2)',
    coral: '0 0 20px rgba(240,106,106,0.4), 0 0 40px rgba(240,106,106,0.2)',
  },

  // Premium shadows
  shadow: {
    modal: '0 50px 100px -20px rgba(0,0,0,0.8), 0 30px 60px -30px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.2)',
    card: '0 20px 40px -15px rgba(0,0,0,0.5), 0 10px 20px -10px rgba(0,0,0,0.3)',
    float: '0 25px 50px -12px rgba(0,0,0,0.6)',
    inner: 'inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(0,0,0,0.1)',
  },

  // Accent colors - vibrant and luminous
  accent: {
    blue: '#58A6FF',
    purple: '#A78BFA',
    cyan: '#38BDF8',
    green: '#4ADE80',
    orange: '#FB923C',
    coral: '#F06A6A',
    pink: '#F472B6',
  },

  // Text colors - refined hierarchy
  text: {
    primary: 'rgba(255,255,255,0.95)',
    secondary: 'rgba(255,255,255,0.70)',
    tertiary: 'rgba(255,255,255,0.50)',
    quaternary: 'rgba(255,255,255,0.30)',
  },

  // Borders - subtle definition
  border: {
    subtle: 'rgba(255,255,255,0.04)',
    light: 'rgba(255,255,255,0.08)',
    medium: 'rgba(255,255,255,0.12)',
    strong: 'rgba(255,255,255,0.20)',
  },
};

// Data source configurations with Vision Pro styling
const TYPE_CONFIG: Record<ResultType, {
  color: string;
  glow: string;
  label: string;
  icon: React.ReactNode;
}> = {
  contract: {
    color: visionPro.accent.cyan,
    glow: visionPro.glow.cyan,
    label: 'Contract',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
  document: {
    color: visionPro.accent.purple,
    glow: visionPro.glow.purple,
    label: 'Document',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
  task: {
    color: visionPro.accent.green,
    glow: visionPro.glow.green,
    label: 'Task',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  work_order: {
    color: visionPro.accent.orange,
    glow: visionPro.glow.orange,
    label: 'Work Order',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
      </svg>
    ),
  },
  sales_order: {
    color: visionPro.accent.orange,
    glow: visionPro.glow.orange,
    label: 'Sales Order',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
      </svg>
    ),
  },
  asana_task: {
    color: visionPro.accent.coral,
    glow: visionPro.glow.coral,
    label: 'Asana',
    icon: (
      <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.782 12.625c-1.854 0-3.357 1.503-3.357 3.357s1.503 3.357 3.357 3.357 3.357-1.503 3.357-3.357-1.503-3.357-3.357-3.357zM5.218 12.625c-1.854 0-3.357 1.503-3.357 3.357s1.503 3.357 3.357 3.357 3.357-1.503 3.357-3.357-1.503-3.357-3.357-3.357zM12 4.661c-1.854 0-3.357 1.503-3.357 3.357S10.146 11.375 12 11.375s3.357-1.503 3.357-3.357S13.854 4.661 12 4.661z"/>
      </svg>
    ),
  },
};

const SCOPE_CONFIG: Record<ScopeType, { label: string; color: string; glow: string }> = {
  all: { label: 'All', color: visionPro.accent.blue, glow: visionPro.glow.blue },
  contracts: { label: 'Contracts', color: visionPro.accent.cyan, glow: visionPro.glow.cyan },
  documents: { label: 'Docs', color: visionPro.accent.purple, glow: visionPro.glow.purple },
  tasks: { label: 'Tasks', color: visionPro.accent.green, glow: visionPro.glow.green },
  netsuite: { label: 'NetSuite', color: visionPro.accent.orange, glow: visionPro.glow.orange },
  asana: { label: 'Asana', color: visionPro.accent.coral, glow: visionPro.glow.coral },
};

// =============================================================================
// CONSTANTS
// =============================================================================

const SEARCH_HISTORY_KEY = 'mars-search-history';
const MAX_HISTORY_ITEMS = 10;

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
    // Ignore
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
    contracts: [], documents: [], tasks: [],
    workOrders: [], salesOrders: [], asanaTasks: [],
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

  // Flatten results based on active scope
  const allResults = (() => {
    if (activeScope === 'contracts') return results.contracts;
    if (activeScope === 'documents') return results.documents;
    if (activeScope === 'tasks') return results.tasks;
    if (activeScope === 'netsuite') return [...results.workOrders, ...results.salesOrders];
    if (activeScope === 'asana') return results.asanaTasks;
    return [
      ...results.contracts, ...results.documents, ...results.tasks,
      ...results.workOrders, ...results.salesOrders, ...results.asanaTasks,
    ];
  })();

  const groupedResults = {
    contracts: activeScope === 'all' || activeScope === 'contracts' ? results.contracts : [],
    documents: activeScope === 'all' || activeScope === 'documents' ? results.documents : [],
    tasks: activeScope === 'all' || activeScope === 'tasks' ? results.tasks : [],
    workOrders: activeScope === 'all' || activeScope === 'netsuite' ? results.workOrders : [],
    salesOrders: activeScope === 'all' || activeScope === 'netsuite' ? results.salesOrders : [],
    asanaTasks: activeScope === 'all' || activeScope === 'asana' ? results.asanaTasks : [],
  };

  const scopeTabs = [
    { id: 'all' as ScopeType, label: 'All', count: totals.total },
    { id: 'contracts' as ScopeType, label: 'Contracts', count: totals.contracts },
    { id: 'documents' as ScopeType, label: 'Docs', count: totals.documents },
    { id: 'tasks' as ScopeType, label: 'Tasks', count: totals.tasks },
    { id: 'netsuite' as ScopeType, label: 'NetSuite', count: totals.workOrders + totals.salesOrders },
    { id: 'asana' as ScopeType, label: 'Asana', count: totals.asanaTasks },
  ];

  // Effects
  useEffect(() => {
    setSearchHistory(getSearchHistory());
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setSearchHistory(getSearchHistory());
    } else {
      setQuery('');
      setResults({ contracts: [], documents: [], tasks: [], workOrders: [], salesOrders: [], asanaTasks: [] });
      setTotals({ contracts: 0, documents: 0, tasks: 0, workOrders: 0, salesOrders: 0, asanaTasks: 0, total: 0 });
      setSelectedIndex(0);
      setPagination({ page: 1, limit: 20, totalPages: 0, hasMore: false });
    }
  }, [isOpen]);

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

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults({ contracts: [], documents: [], tasks: [], workOrders: [], salesOrders: [], asanaTasks: [] });
      setTotals({ contracts: 0, documents: 0, tasks: 0, workOrders: 0, salesOrders: 0, asanaTasks: 0, total: 0 });
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          q: query, scope: activeScope,
          includeArchived: filters.includeArchived.toString(),
          includeHistorical: filters.includeHistorical.toString(),
          page: '1', limit: '20',
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

  // Handlers
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, allResults.length - 1));
      setTimeout(() => {
        resultsRef.current?.querySelector('[data-selected="true"]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }, 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
      setTimeout(() => {
        resultsRef.current?.querySelector('[data-selected="true"]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }, 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allResults[selectedIndex]) handleSelect(allResults[selectedIndex], e.metaKey || e.ctrlKey);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const scopes: ScopeType[] = ['all', 'contracts', 'documents', 'tasks', 'netsuite', 'asana'];
      const currentIdx = scopes.indexOf(activeScope);
      const nextIdx = e.shiftKey ? (currentIdx - 1 + scopes.length) % scopes.length : (currentIdx + 1) % scopes.length;
      setActiveScope(scopes[nextIdx]);
      setSelectedIndex(0);
    }
  }, [allResults, selectedIndex, activeScope]);

  const handleSelect = (result: SearchResult, newTab = false) => {
    if (query.trim()) saveSearchHistory(query);
    setIsOpen(false);
    if (result.url) {
      if (result.url.startsWith('/')) {
        newTab ? window.open(result.url, '_blank') : router.push(result.url);
      } else {
        window.open(result.url, '_blank');
      }
    }
  };

  const handleLoadMore = async () => {
    if (!pagination.hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({
        q: query, scope: activeScope,
        includeArchived: filters.includeArchived.toString(),
        includeHistorical: filters.includeHistorical.toString(),
        page: (pagination.page + 1).toString(), limit: '20',
      });
      const response = await fetch(`/api/contracts/search?${params}`);
      if (response.ok) {
        const data = await response.json();
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

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <>
      {/* Trigger Button - Vision Pro Glass Style */}
      <motion.button
        onClick={() => setIsOpen(true)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="relative flex items-center gap-3 px-4 py-2.5 rounded-2xl overflow-hidden group"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
          boxShadow: `${visionPro.shadow.inner}, 0 4px 20px rgba(0,0,0,0.3)`,
          border: `1px solid ${visionPro.border.light}`,
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <svg className="w-4 h-4 text-white/60 group-hover:text-white/90 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span className="text-sm text-white/60 group-hover:text-white/90 transition-colors font-medium">Search</span>
        <div className="flex items-center gap-1 ml-2">
          <kbd className="px-1.5 py-0.5 text-[10px] font-semibold text-white/40 bg-white/[0.06] rounded-md border border-white/[0.08]">
            &#8984;
          </kbd>
          <kbd className="px-1.5 py-0.5 text-[10px] font-semibold text-white/40 bg-white/[0.06] rounded-md border border-white/[0.08]">
            K
          </kbd>
        </div>
      </motion.button>

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop with blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-50"
              style={{
                background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.85) 100%)',
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              }}
            />

            {/* Search Panel */}
            <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                transition={{ type: 'spring', damping: 30, stiffness: 400 }}
                className="w-full max-w-[680px] pointer-events-auto"
              >
                {/* Main Container - Layered Glass */}
                <div
                  className="relative rounded-[28px] overflow-hidden"
                  style={{
                    background: `linear-gradient(180deg, ${visionPro.depth.surface2} 0%, ${visionPro.depth.surface1} 100%)`,
                    boxShadow: visionPro.shadow.modal,
                    border: `1px solid ${visionPro.border.light}`,
                  }}
                >
                  {/* Top highlight line */}
                  <div
                    className="absolute top-0 left-8 right-8 h-[1px]"
                    style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)' }}
                  />

                  {/* Search Input Section */}
                  <div className="relative px-6 py-5">
                    <div className="flex items-center gap-4">
                      {/* Search Icon / Loader */}
                      <div className="relative w-7 h-7 flex items-center justify-center">
                        {loading ? (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            className="w-5 h-5 rounded-full"
                            style={{
                              border: '2px solid transparent',
                              borderTopColor: visionPro.accent.blue,
                              borderRightColor: visionPro.accent.blue,
                            }}
                          />
                        ) : (
                          <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            style={{ color: visionPro.accent.blue }}
                          >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                          </motion.div>
                        )}
                      </div>

                      {/* Input */}
                      <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Search everything..."
                        className="flex-1 bg-transparent text-xl font-light tracking-tight focus:outline-none"
                        style={{
                          color: visionPro.text.primary,
                          caretColor: visionPro.accent.blue,
                        }}
                      />

                      {/* Clear Button */}
                      <AnimatePresence>
                        {query && (
                          <motion.button
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            onClick={() => setQuery('')}
                            className="p-2 rounded-xl transition-colors"
                            style={{ background: visionPro.glass.regular }}
                          >
                            <svg className="w-4 h-4" style={{ color: visionPro.text.tertiary }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </motion.button>
                        )}
                      </AnimatePresence>

                      {/* ESC Key */}
                      <div className="pl-3 border-l" style={{ borderColor: visionPro.border.subtle }}>
                        <kbd
                          className="px-2.5 py-1.5 text-xs font-semibold rounded-lg"
                          style={{
                            color: visionPro.text.quaternary,
                            background: visionPro.glass.thin,
                            border: `1px solid ${visionPro.border.subtle}`,
                          }}
                        >
                          ESC
                        </kbd>
                      </div>
                    </div>

                    {/* Subtle divider */}
                    <div
                      className="absolute bottom-0 left-6 right-6 h-[1px]"
                      style={{ background: `linear-gradient(90deg, transparent, ${visionPro.border.light}, transparent)` }}
                    />
                  </div>

                  {/* Scope Tabs */}
                  {query.length >= 2 && (
                    <div className="px-6 py-3 flex items-center gap-2 overflow-x-auto scrollbar-hide">
                      {scopeTabs.map((scope, i) => {
                        const isActive = activeScope === scope.id;
                        const config = SCOPE_CONFIG[scope.id];
                        return (
                          <motion.button
                            key={scope.id}
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.03 }}
                            onClick={() => { setActiveScope(scope.id); setSelectedIndex(0); }}
                            className="relative px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200"
                            style={{
                              color: isActive ? '#fff' : visionPro.text.tertiary,
                              background: isActive ? config.color : visionPro.glass.thin,
                              boxShadow: isActive ? config.glow : 'none',
                              border: `1px solid ${isActive ? 'transparent' : visionPro.border.subtle}`,
                            }}
                          >
                            {scope.label}
                            {scope.count > 0 && !isActive && (
                              <span
                                className="ml-2 px-1.5 py-0.5 text-[10px] rounded-md font-semibold"
                                style={{ background: visionPro.glass.regular, color: visionPro.text.quaternary }}
                              >
                                {scope.count > 999 ? '999+' : scope.count}
                              </span>
                            )}
                          </motion.button>
                        );
                      })}
                    </div>
                  )}

                  {/* Filters Toggle */}
                  {query.length >= 2 && (
                    <div style={{ borderTop: `1px solid ${visionPro.border.subtle}` }}>
                      <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="w-full flex items-center justify-between px-6 py-2.5 transition-colors"
                        style={{ color: visionPro.text.tertiary }}
                      >
                        <span className="flex items-center gap-2 text-xs font-medium">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                          </svg>
                          Filters
                          {(filters.includeArchived || filters.includeHistorical) && (
                            <span
                              className="px-1.5 py-0.5 text-[10px] font-semibold rounded-md"
                              style={{ background: `${visionPro.accent.blue}30`, color: visionPro.accent.blue }}
                            >
                              Active
                            </span>
                          )}
                        </span>
                        <motion.svg
                          animate={{ rotate: showFilters ? 180 : 0 }}
                          className="w-4 h-4"
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </motion.svg>
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
                            <div className="px-6 pb-4 flex flex-wrap gap-4">
                              {[
                                { key: 'includeArchived', label: 'Include archived' },
                                { key: 'includeHistorical', label: 'Include pre-2025' },
                              ].map((filter) => (
                                <label key={filter.key} className="flex items-center gap-2.5 cursor-pointer group">
                                  <div
                                    className="relative w-5 h-5 rounded-md flex items-center justify-center transition-all"
                                    style={{
                                      background: filters[filter.key as keyof SearchFilters] ? visionPro.accent.blue : visionPro.glass.regular,
                                      border: `1.5px solid ${filters[filter.key as keyof SearchFilters] ? visionPro.accent.blue : visionPro.border.medium}`,
                                      boxShadow: filters[filter.key as keyof SearchFilters] ? visionPro.glow.blue : 'none',
                                    }}
                                  >
                                    {filters[filter.key as keyof SearchFilters] && (
                                      <motion.svg
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className="w-3 h-3 text-white"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={3}
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                      </motion.svg>
                                    )}
                                  </div>
                                  <input
                                    type="checkbox"
                                    className="sr-only"
                                    checked={filters[filter.key as keyof SearchFilters] as boolean}
                                    onChange={(e) => setFilters(f => ({ ...f, [filter.key]: e.target.checked }))}
                                  />
                                  <span
                                    className="text-sm font-medium transition-colors"
                                    style={{ color: visionPro.text.secondary }}
                                  >
                                    {filter.label}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Results Area */}
                  <div
                    ref={resultsRef}
                    className="max-h-[400px] overflow-y-auto scrollbar-thin"
                    style={{
                      scrollbarColor: `${visionPro.glass.chrome} transparent`,
                    }}
                  >
                    {query.length < 2 ? (
                      // Empty state / History
                      <div className="px-6 py-10">
                        {searchHistory.length > 0 ? (
                          <div>
                            <div className="flex items-center justify-between mb-4">
                              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: visionPro.text.quaternary }}>
                                Recent
                              </span>
                              <button
                                onClick={() => { clearSearchHistory(); setSearchHistory([]); }}
                                className="text-xs font-medium transition-colors hover:opacity-80"
                                style={{ color: visionPro.text.tertiary }}
                              >
                                Clear all
                              </button>
                            </div>
                            <div className="space-y-1">
                              {searchHistory.map((h, i) => (
                                <motion.button
                                  key={i}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: i * 0.03 }}
                                  onClick={() => { setQuery(h); inputRef.current?.focus(); }}
                                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all group"
                                  style={{ background: 'transparent' }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = visionPro.glass.thin}
                                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                  <svg className="w-4 h-4" style={{ color: visionPro.text.quaternary }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <span className="truncate" style={{ color: visionPro.text.secondary }}>{h}</span>
                                </motion.button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <motion.div
                              initial={{ scale: 0.8, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className="w-20 h-20 mx-auto mb-5 rounded-3xl flex items-center justify-center"
                              style={{
                                background: `linear-gradient(135deg, ${visionPro.accent.blue}20, ${visionPro.accent.purple}20)`,
                                boxShadow: `0 0 60px ${visionPro.accent.blue}20`,
                              }}
                            >
                              <svg className="w-10 h-10" style={{ color: visionPro.accent.blue }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                              </svg>
                            </motion.div>
                            <p className="text-lg font-medium mb-2" style={{ color: visionPro.text.primary }}>
                              Search MARS
                            </p>
                            <p className="text-sm" style={{ color: visionPro.text.tertiary }}>
                              Contracts, documents, NetSuite, Asana
                            </p>
                          </div>
                        )}
                      </div>
                    ) : allResults.length === 0 && !loading ? (
                      // No results
                      <div className="px-6 py-16 text-center">
                        <div
                          className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                          style={{ background: visionPro.glass.regular }}
                        >
                          <svg className="w-8 h-8" style={{ color: visionPro.text.quaternary }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 16.318A4.486 4.486 0 0012.016 15a4.486 4.486 0 00-3.198 1.318M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
                          </svg>
                        </div>
                        <p className="text-lg font-medium mb-1" style={{ color: visionPro.text.secondary }}>No results</p>
                        <p className="text-sm" style={{ color: visionPro.text.quaternary }}>Try different keywords</p>
                      </div>
                    ) : (
                      // Results
                      <div className="py-2">
                        {Object.entries(groupedResults).map(([key, items]) => {
                          if (items.length === 0) return null;
                          const type = key === 'workOrders' ? 'work_order' :
                                       key === 'salesOrders' ? 'sales_order' :
                                       key === 'asanaTasks' ? 'asana_task' :
                                       key.slice(0, -1) as ResultType;
                          const config = TYPE_CONFIG[type];
                          const title = key === 'workOrders' ? 'Work Orders' :
                                       key === 'salesOrders' ? 'Sales Orders' :
                                       key === 'asanaTasks' ? 'Asana Tasks' :
                                       key.charAt(0).toUpperCase() + key.slice(1);

                          // Calculate offset for selection
                          let offset = 0;
                          const order = ['contracts', 'documents', 'tasks', 'workOrders', 'salesOrders', 'asanaTasks'];
                          for (const k of order) {
                            if (k === key) break;
                            offset += groupedResults[k as keyof typeof groupedResults].length;
                          }

                          return (
                            <div key={key} className="mb-4">
                              {/* Section Header */}
                              <div className="px-6 py-2 flex items-center gap-2">
                                <span style={{ color: config.color }}>{config.icon}</span>
                                <span
                                  className="text-xs font-semibold uppercase tracking-wider"
                                  style={{ color: visionPro.text.quaternary }}
                                >
                                  {title}
                                </span>
                                <span
                                  className="text-xs"
                                  style={{ color: visionPro.text.quaternary }}
                                >
                                  ({items.length})
                                </span>
                              </div>

                              {/* Results */}
                              <div className="px-3">
                                {items.map((result, idx) => {
                                  const globalIndex = offset + idx;
                                  const isSelected = selectedIndex === globalIndex;

                                  return (
                                    <motion.button
                                      key={result.id}
                                      initial={{ opacity: 0, y: 5 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      transition={{ delay: idx * 0.02 }}
                                      onClick={(e) => handleSelect(result, e.metaKey || e.ctrlKey)}
                                      onMouseEnter={() => setSelectedIndex(globalIndex)}
                                      data-selected={isSelected}
                                      className="w-full flex items-center gap-4 px-4 py-3.5 mx-0 rounded-2xl text-left transition-all duration-150 relative group"
                                      style={{
                                        background: isSelected ? visionPro.glass.regular : 'transparent',
                                        boxShadow: isSelected ? `inset 0 0 0 1px ${config.color}40, ${config.glow}` : 'none',
                                      }}
                                    >
                                      {/* Glow bar */}
                                      <motion.div
                                        initial={false}
                                        animate={{
                                          opacity: isSelected ? 1 : 0,
                                          scaleY: isSelected ? 1 : 0.5,
                                        }}
                                        className="absolute left-1 top-3 bottom-3 w-[3px] rounded-full"
                                        style={{
                                          background: config.color,
                                          boxShadow: config.glow,
                                        }}
                                      />

                                      {/* Icon */}
                                      <div
                                        className="w-11 h-11 rounded-[14px] flex items-center justify-center flex-shrink-0 transition-all duration-200"
                                        style={{
                                          background: `linear-gradient(135deg, ${config.color}20, ${config.color}10)`,
                                          color: config.color,
                                          boxShadow: isSelected ? `0 0 20px ${config.color}30` : 'none',
                                        }}
                                      >
                                        {config.icon}
                                      </div>

                                      {/* Content */}
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <p
                                            className="font-medium truncate"
                                            style={{ color: isSelected ? visionPro.text.primary : visionPro.text.secondary }}
                                          >
                                            {result.title}
                                          </p>
                                          {result.isArchived && (
                                            <span
                                              className="px-1.5 py-0.5 text-[10px] font-semibold rounded-md"
                                              style={{ background: visionPro.glass.regular, color: visionPro.text.quaternary }}
                                            >
                                              Archived
                                            </span>
                                          )}
                                          {result.completed && (
                                            <span
                                              className="px-1.5 py-0.5 text-[10px] font-semibold rounded-md"
                                              style={{ background: `${visionPro.accent.green}20`, color: visionPro.accent.green }}
                                            >
                                              Done
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                          {result.subtitle && (
                                            <p
                                              className="text-sm truncate"
                                              style={{ color: visionPro.text.tertiary }}
                                            >
                                              {result.subtitle}
                                            </p>
                                          )}
                                        </div>
                                      </div>

                                      {/* Right side */}
                                      <div className="flex-shrink-0 text-right">
                                        {(result.value !== undefined && result.value > 0) && (
                                          <p className="text-sm font-semibold" style={{ color: visionPro.accent.green }}>
                                            {formatCurrency(result.value)}
                                          </p>
                                        )}
                                        {(result.totalAmount !== undefined && result.totalAmount > 0) && (
                                          <p className="text-sm font-semibold" style={{ color: visionPro.accent.green }}>
                                            {formatCurrency(result.totalAmount)}
                                          </p>
                                        )}
                                        {result.status && (
                                          <p className="text-xs capitalize" style={{ color: visionPro.text.quaternary }}>
                                            {result.status.replace(/_/g, ' ')}
                                          </p>
                                        )}
                                        {result.documentType && (
                                          <p className="text-xs font-medium" style={{ color: visionPro.accent.purple }}>
                                            {result.documentType}
                                          </p>
                                        )}
                                      </div>

                                      {/* Arrow */}
                                      <motion.div
                                        initial={false}
                                        animate={{ opacity: isSelected ? 1 : 0, x: isSelected ? 0 : -5 }}
                                        style={{ color: config.color }}
                                      >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                                        </svg>
                                      </motion.div>
                                    </motion.button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}

                        {/* Load More */}
                        {pagination.hasMore && (
                          <div className="px-6 py-4">
                            <motion.button
                              whileHover={{ scale: 1.01 }}
                              whileTap={{ scale: 0.99 }}
                              onClick={handleLoadMore}
                              disabled={loadingMore}
                              className="w-full py-3 rounded-2xl text-sm font-medium transition-all disabled:opacity-50"
                              style={{
                                background: visionPro.glass.regular,
                                color: visionPro.accent.blue,
                                border: `1px solid ${visionPro.border.subtle}`,
                              }}
                            >
                              {loadingMore ? (
                                <span className="flex items-center justify-center gap-2">
                                  <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                    className="w-4 h-4 rounded-full"
                                    style={{ border: '2px solid transparent', borderTopColor: visionPro.accent.blue }}
                                  />
                                  Loading...
                                </span>
                              ) : (
                                'Load more results'
                              )}
                            </motion.button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div
                    className="px-6 py-3.5 flex items-center justify-between"
                    style={{
                      borderTop: `1px solid ${visionPro.border.subtle}`,
                      background: visionPro.glass.ultra,
                    }}
                  >
                    <div className="flex items-center gap-5 text-xs" style={{ color: visionPro.text.quaternary }}>
                      {[
                        { keys: ['↑', '↓'], label: 'Navigate' },
                        { keys: ['↵'], label: 'Open' },
                        { keys: ['Tab'], label: 'Switch' },
                        { keys: ['⌘', '↵'], label: 'New tab' },
                      ].map((shortcut, i) => (
                        <span key={i} className="hidden sm:flex items-center gap-1.5">
                          {shortcut.keys.map((key, j) => (
                            <kbd
                              key={j}
                              className="px-1.5 py-0.5 text-[10px] font-semibold rounded-md"
                              style={{ background: visionPro.glass.regular, border: `1px solid ${visionPro.border.subtle}` }}
                            >
                              {key}
                            </kbd>
                          ))}
                          <span className="ml-1">{shortcut.label}</span>
                        </span>
                      ))}
                    </div>
                    <span style={{ color: visionPro.text.quaternary }} className="text-xs font-medium">
                      {totals.total.toLocaleString()} result{totals.total !== 1 ? 's' : ''}
                    </span>
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
