'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  shortcut?: string;
  icon?: React.ReactNode;
  action: () => void;
  category?: string;
  keywords?: string[];
}

interface SearchResult {
  id: string;
  type: 'contract' | 'document' | 'task';
  title: string;
  subtitle?: string;
  value?: number;
  status?: string;
  url?: string;
  matchedField?: string;
  documentType?: string;
  uploadedAt?: string;
  dueDate?: string;
}

// Unified type for both commands and search results
interface ResultItem {
  id: string;
  label: string;
  description?: string;
  shortcut?: string;
  icon?: React.ReactNode;
  action: () => void;
  category?: string;
  keywords?: string[];
  type?: 'contract' | 'document' | 'task';
  value?: number;
  status?: string;
  documentType?: string;
}

interface SearchResults {
  contracts: SearchResult[];
  documents: SearchResult[];
  tasks: SearchResult[];
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: CommandItem[];
  contracts?: Array<{
    id: string;
    salesforceId?: string;
    name: string;
    status: string;
    value: number;
  }>;
  onContractSelect?: (contractId: string) => void;
  placeholder?: string;
}

// Icons
const icons = {
  search: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  task: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  filter: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
    </svg>
  ),
  navigate: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  ),
  contract: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  document: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  ),
  external: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  ),
  refresh: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  contract: icons.contract,
  document: icons.document,
  task: icons.task,
};

const TYPE_COLORS: Record<string, string> = {
  contract: 'text-[#38BDF8]',
  document: 'text-[#A78BFA]',
  task: 'text-[#22C55E]',
};

function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

/**
 * Unified Command Palette + Global Search
 *
 * Features:
 * - Command palette for quick actions
 * - Global search across contracts, documents, and tasks
 * - Fuzzy search with keyboard navigation
 * - Scope filtering (all/contracts/documents/tasks)
 * - Categories with visual grouping
 */
export default function CommandPalette({
  isOpen,
  onClose,
  commands,
  contracts = [],
  onContractSelect,
  placeholder = 'Search or type a command...',
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchResults, setSearchResults] = useState<SearchResults>({ contracts: [], documents: [], tasks: [] });
  const [loading, setLoading] = useState(false);
  const [activeScope, setActiveScope] = useState<'all' | 'contracts' | 'documents' | 'tasks'>('all');
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setSearchResults({ contracts: [], documents: [], tasks: [] });
      setActiveScope('all');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Global search API call with debounce
  useEffect(() => {
    if (!query || query.length < 2) {
      setSearchResults({ contracts: [], documents: [], tasks: [] });
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/contracts/search?q=${encodeURIComponent(query)}&scope=${activeScope}`);
        if (response.ok) {
          const data = await response.json();
          setSearchResults(data.results);
        }
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, activeScope]);

  // Filter and combine results
  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    const grouped: Record<string, ResultItem[]> = {};

    // If query is less than 2 chars, show commands only
    if (q.length < 2) {
      const filteredCommands = q
        ? commands.filter(cmd =>
            cmd.label.toLowerCase().includes(q) ||
            cmd.description?.toLowerCase().includes(q) ||
            cmd.keywords?.some(k => k.toLowerCase().includes(q)) ||
            cmd.category?.toLowerCase().includes(q)
          )
        : commands;

      // Group commands
      filteredCommands.forEach(cmd => {
        const cat = cmd.category || 'Actions';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(cmd);
      });

      return grouped;
    }

    // For longer queries, show both filtered commands and API search results
    const filteredCommands = commands.filter(cmd =>
      cmd.label.toLowerCase().includes(q) ||
      cmd.description?.toLowerCase().includes(q) ||
      cmd.keywords?.some(k => k.toLowerCase().includes(q)) ||
      cmd.category?.toLowerCase().includes(q)
    );

    // Add API search results first (higher priority)
    const { contracts: apiContracts, documents: apiDocuments, tasks: apiTasks } = searchResults;

    // Add contracts from API
    if (apiContracts.length > 0 && (activeScope === 'all' || activeScope === 'contracts')) {
      grouped['Contracts'] = apiContracts.map((c): ResultItem => ({
        id: c.id,
        type: c.type,
        label: c.title,
        description: c.subtitle,
        icon: TYPE_ICONS.contract,
        value: c.value,
        status: c.status,
        action: () => {
          if (c.url) {
            if (c.url.startsWith('/')) {
              router.push(c.url);
            } else {
              window.open(c.url, '_blank');
            }
          }
        },
      }));
    }

    // Add documents from API
    if (apiDocuments.length > 0 && (activeScope === 'all' || activeScope === 'documents')) {
      grouped['Documents'] = apiDocuments.map((d): ResultItem => ({
        id: d.id,
        type: d.type,
        label: d.title,
        description: d.subtitle,
        icon: TYPE_ICONS.document,
        documentType: d.documentType,
        action: () => {
          if (d.url) {
            if (d.url.startsWith('/')) {
              router.push(d.url);
            } else {
              window.open(d.url, '_blank');
            }
          }
        },
      }));
    }

    // Add tasks from API
    if (apiTasks.length > 0 && (activeScope === 'all' || activeScope === 'tasks')) {
      grouped['Tasks'] = apiTasks.map((t): ResultItem => ({
        id: t.id,
        type: t.type,
        label: t.title,
        description: t.subtitle,
        icon: TYPE_ICONS.task,
        action: () => {
          if (t.url) {
            if (t.url.startsWith('/')) {
              router.push(t.url);
            } else {
              window.open(t.url, '_blank');
            }
          }
        },
      }));
    }

    // Add filtered commands if any match
    if (filteredCommands.length > 0) {
      filteredCommands.forEach(cmd => {
        const cat = cmd.category || 'Actions';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(cmd);
      });
    }

    return grouped;
  }, [query, commands, searchResults, activeScope, router]);

  // Flat list for keyboard navigation
  const flatResults = useMemo(() => {
    return Object.values(results).flat();
  }, [results]);

  // Count results for scope tabs
  const resultCounts = useMemo(() => {
    const { contracts, documents, tasks } = searchResults;
    return {
      all: contracts.length + documents.length + tasks.length,
      contracts: contracts.length,
      documents: documents.length,
      tasks: tasks.length,
    };
  }, [searchResults]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(i => Math.min(i + 1, flatResults.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(i => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (flatResults[selectedIndex]) {
            flatResults[selectedIndex].action();
            onClose();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, flatResults, selectedIndex, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selected = listRef.current.querySelector('[data-selected="true"]');
      selected?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) return null;

  let currentFlatIndex = -1;
  const showScopeTabs = query.length >= 2;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-hidden">
        {/* Backdrop - dark, no blur */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="absolute inset-0 bg-[#0B1220]/90"
        />

        {/* Palette - centered */}
        <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="w-full max-w-2xl pointer-events-auto"
          >
          <div className="bg-[#111827] border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
            {/* Search input */}
            <div className="relative">
              <div className="flex items-center gap-4 px-6 py-5">
                <div className="relative">
                  {loading ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-6 h-6 border-2 border-[#38BDF8] border-t-transparent rounded-full"
                    />
                  ) : (
                    <span className="text-[#38BDF8]">{icons.search}</span>
                  )}
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={placeholder}
                  className="flex-1 bg-transparent text-white placeholder-[#64748B] text-lg font-light outline-none"
                />
                <div className="flex items-center gap-1.5 pl-4 border-l border-white/[0.06]">
                  <kbd className="px-2 py-1 text-xs font-medium text-[#64748B] bg-[#0B1220] rounded-md border border-white/[0.08]">
                    ESC
                  </kbd>
                </div>
              </div>
              <div className="absolute bottom-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
            </div>

            {/* Scope Tabs (shown when searching) */}
            {showScopeTabs && (
              <div className="flex items-center gap-2 px-6 py-3 border-b border-white/[0.04]">
                {(['all', 'contracts', 'documents', 'tasks'] as const).map((scope) => (
                  <button
                    key={scope}
                    onClick={() => setActiveScope(scope)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize ${
                      activeScope === scope
                        ? 'bg-[#38BDF8] text-white shadow-lg shadow-[#38BDF8]/20'
                        : 'text-[#64748B] hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    {scope}
                    {resultCounts[scope] > 0 && activeScope !== scope && (
                      <span className="ml-2 px-1.5 py-0.5 bg-white/[0.1] rounded text-xs">
                        {resultCounts[scope]}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Results */}
            <div
              ref={listRef}
              className="max-h-[420px] overflow-y-auto py-3"
            >
              {Object.entries(results).length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#38BDF8]/10 flex items-center justify-center">
                    {icons.search}
                  </div>
                  <p className="text-[#8FA3BF] text-lg font-light mb-2">
                    {query.length < 2 ? 'Search or run a command' : 'No results found'}
                  </p>
                  <p className="text-[#64748B] text-sm">
                    {query.length < 2 ? 'Type to search contracts, documents, and tasks' : 'Try different keywords'}
                  </p>
                </div>
              ) : (
                Object.entries(results).map(([category, items]) => (
                  <div key={category} className="px-4 mb-3">
                    {/* Category header */}
                    <div className="flex items-center gap-2 px-2 mb-2">
                      <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                        {category}
                      </span>
                    </div>

                    {/* Items */}
                    <div className="space-y-1">
                      {items.map((item: ResultItem) => {
                        currentFlatIndex++;
                        const isSelected = currentFlatIndex === selectedIndex;
                        const isSearchResult = item.type !== undefined;

                        return (
                          <button
                            key={item.id}
                            data-selected={isSelected}
                            onClick={() => {
                              item.action();
                              onClose();
                            }}
                            onMouseEnter={() => setSelectedIndex(currentFlatIndex)}
                            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl text-left transition-all ${
                              isSelected
                                ? 'bg-[#38BDF8]/10 border border-[#38BDF8]/20 text-white'
                                : 'hover:bg-white/[0.03] border border-transparent text-[#E2E8F0]'
                            }`}
                          >
                            {/* Icon */}
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                              isSelected ? 'bg-[#38BDF8]/20' : 'bg-white/[0.04]'
                            }`}>
                              <span className={isSelected ? 'text-[#38BDF8]' : 'text-[#64748B]'}>
                                {item.icon || icons.navigate}
                              </span>
                            </div>

                            {/* Label & description */}
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{item.label}</div>
                              {item.description && (
                                <div className="text-sm text-[#64748B] truncate mt-0.5">
                                  {item.description}
                                </div>
                              )}
                            </div>

                            {/* Metadata for search results */}
                            {isSearchResult && (
                              <div className="flex-shrink-0 text-right">
                                {item.value && (
                                  <p className="text-[#22C55E] text-sm font-semibold">
                                    {formatCurrency(item.value)}
                                  </p>
                                )}
                                {item.status && (
                                  <p className="text-[#64748B] text-xs capitalize">
                                    {item.status.replace(/_/g, ' ')}
                                  </p>
                                )}
                                {item.documentType && (
                                  <p className="text-[#A78BFA] text-xs font-medium">{item.documentType}</p>
                                )}
                              </div>
                            )}

                            {/* Shortcut for commands */}
                            {!isSearchResult && item.shortcut && (
                              <kbd className="px-2.5 py-1 text-xs font-medium text-[#64748B] bg-[#0B1220] rounded-lg border border-white/[0.08]">
                                {item.shortcut}
                              </kbd>
                            )}

                            {/* Arrow for selected */}
                            {isSelected && (
                              <div className="flex-shrink-0 text-[#38BDF8]">
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
                ))
              )}
            </div>

            {/* Footer hint */}
            <div className="px-6 py-3 border-t border-white/[0.04] bg-[#0B1220]/30">
              <div className="flex items-center justify-between text-xs text-[#64748B]">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5">
                    <kbd className="px-1.5 py-0.5 bg-white/[0.06] rounded font-medium">↑</kbd>
                    <kbd className="px-1.5 py-0.5 bg-white/[0.06] rounded font-medium">↓</kbd>
                    <span className="ml-1">Navigate</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <kbd className="px-1.5 py-0.5 bg-white/[0.06] rounded font-medium">↵</kbd>
                    <span className="ml-1">Select</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <kbd className="px-1.5 py-0.5 bg-white/[0.06] rounded font-medium">ESC</kbd>
                    <span className="ml-1">Close</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
}

/**
 * Default commands for contracts dashboard
 */
export function getDefaultCommands(handlers: {
  createTask: () => void;
  filterOverdue: () => void;
  filterDue30: () => void;
  filterHighValue: () => void;
  clearFilters: () => void;
  goToPipeline: () => void;
  goToTasks: () => void;
  goToDocuments: () => void;
  refresh: () => void;
  exportData: () => void;
}): CommandItem[] {
  return [
    // Actions
    {
      id: 'create-task',
      label: 'Create Task',
      description: 'Add a new task to a contract',
      shortcut: 'T',
      icon: icons.task,
      category: 'Actions',
      keywords: ['add', 'new', 'task', 'todo'],
      action: handlers.createTask,
    },
    {
      id: 'refresh',
      label: 'Refresh Data',
      description: 'Sync from Salesforce and refresh',
      shortcut: 'R',
      icon: icons.refresh,
      category: 'Actions',
      keywords: ['sync', 'reload', 'update'],
      action: handlers.refresh,
    },
    {
      id: 'export',
      label: 'Export Data',
      description: 'Download contracts as CSV',
      icon: icons.external,
      category: 'Actions',
      keywords: ['download', 'csv', 'excel'],
      action: handlers.exportData,
    },

    // Filters
    {
      id: 'filter-overdue',
      label: 'Show Overdue',
      description: 'Filter to contracts past due date',
      icon: icons.filter,
      category: 'Filters',
      keywords: ['late', 'past due', 'urgent'],
      action: handlers.filterOverdue,
    },
    {
      id: 'filter-due30',
      label: 'Show Due in 30 Days',
      description: 'Filter to contracts due soon',
      icon: icons.filter,
      category: 'Filters',
      keywords: ['upcoming', 'soon', 'deadline'],
      action: handlers.filterDue30,
    },
    {
      id: 'filter-high-value',
      label: 'Show High Value',
      description: 'Filter to contracts over $250K',
      icon: icons.filter,
      category: 'Filters',
      keywords: ['big', 'large', 'important'],
      action: handlers.filterHighValue,
    },
    {
      id: 'clear-filters',
      label: 'Clear Filters',
      description: 'Reset all filters',
      icon: icons.filter,
      category: 'Filters',
      keywords: ['reset', 'all', 'remove'],
      action: handlers.clearFilters,
    },

    // Navigation
    {
      id: 'go-pipeline',
      label: 'Go to Pipeline',
      description: 'View contract pipeline',
      shortcut: 'G P',
      icon: icons.navigate,
      category: 'Navigation',
      keywords: ['contracts', 'list', 'table'],
      action: handlers.goToPipeline,
    },
    {
      id: 'go-tasks',
      label: 'Go to Tasks',
      description: 'View all tasks',
      shortcut: 'G T',
      icon: icons.navigate,
      category: 'Navigation',
      keywords: ['todo', 'checklist'],
      action: handlers.goToTasks,
    },
    {
      id: 'go-documents',
      label: 'Go to Documents',
      description: 'View contract documents',
      shortcut: 'G D',
      icon: icons.navigate,
      category: 'Navigation',
      keywords: ['files', 'uploads'],
      action: handlers.goToDocuments,
    },
  ];
}
