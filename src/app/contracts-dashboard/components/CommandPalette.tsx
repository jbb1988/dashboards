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
    const grouped: Record<string, Array<CommandItem | SearchResult & { action: () => void }>> = {};

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
      grouped['Contracts'] = apiContracts.map(c => ({
        ...c,
        label: c.title,
        description: c.subtitle,
        icon: TYPE_ICONS.contract,
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
      grouped['Documents'] = apiDocuments.map(d => ({
        ...d,
        label: d.title,
        description: d.subtitle,
        icon: TYPE_ICONS.document,
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
      grouped['Tasks'] = apiTasks.map(t => ({
        ...t,
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
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Palette */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          transition={{ duration: 0.15 }}
          className="absolute top-[15%] left-1/2 -translate-x-1/2 w-full max-w-2xl"
        >
          <div className="mx-4 bg-[#1A2332] border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden">
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
              <span className="text-[#64748B]">{icons.search}</span>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                className="flex-1 bg-transparent text-white placeholder-[#64748B] text-[15px] outline-none"
              />
              {loading && (
                <div className="w-4 h-4 border-2 border-[#38BDF8] border-t-transparent rounded-full animate-spin" />
              )}
              <kbd className="px-2 py-0.5 text-[11px] font-medium text-[#64748B] bg-[#0B1220] rounded border border-white/[0.08]">
                ESC
              </kbd>
            </div>

            {/* Scope Tabs (shown when searching) */}
            {showScopeTabs && (
              <div className="flex items-center gap-1 px-4 py-2 border-b border-white/[0.04]">
                {(['all', 'contracts', 'documents', 'tasks'] as const).map((scope) => (
                  <button
                    key={scope}
                    onClick={() => setActiveScope(scope)}
                    className={`px-3 py-1 rounded-lg text-sm transition-colors capitalize ${
                      activeScope === scope
                        ? 'bg-[#38BDF8]/10 text-[#38BDF8]'
                        : 'text-[#64748B] hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    {scope}
                    {resultCounts[scope] > 0 && (
                      <span className="ml-1.5 px-1.5 py-0.5 bg-white/[0.1] rounded text-xs">
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
              className="max-h-[400px] overflow-y-auto py-2"
            >
              {Object.entries(results).length === 0 ? (
                <div className="px-4 py-8 text-center text-[#64748B]">
                  {query.length < 2 ? 'Type at least 2 characters to search' : 'No results found'}
                </div>
              ) : (
                Object.entries(results).map(([category, items]) => (
                  <div key={category}>
                    {/* Category header */}
                    <div className="px-4 py-1.5 text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                      {category}
                    </div>

                    {/* Items */}
                    {items.map((item) => {
                      currentFlatIndex++;
                      const isSelected = currentFlatIndex === selectedIndex;
                      const isSearchResult = 'type' in item;

                      return (
                        <button
                          key={item.id}
                          data-selected={isSelected}
                          onClick={() => {
                            item.action();
                            onClose();
                          }}
                          onMouseEnter={() => setSelectedIndex(currentFlatIndex)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                            isSelected
                              ? 'bg-[#38BDF8]/10 text-white'
                              : 'text-[#A1B4C9] hover:bg-white/[0.03]'
                          }`}
                        >
                          {/* Icon */}
                          <span className={isSelected && isSearchResult ? TYPE_COLORS[(item as any).type] : isSelected ? 'text-[#38BDF8]' : 'text-[#64748B]'}>
                            {item.icon || icons.navigate}
                          </span>

                          {/* Label & description */}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{item.label}</div>
                            {item.description && (
                              <div className="text-[12px] text-[#64748B] truncate">
                                {item.description}
                              </div>
                            )}
                          </div>

                          {/* Metadata for search results */}
                          {isSearchResult && (
                            <div className="flex-shrink-0 text-right">
                              {(item as SearchResult).value && (
                                <p className="text-[#22C55E] text-sm font-medium">
                                  {formatCurrency((item as SearchResult).value!)}
                                </p>
                              )}
                              {(item as SearchResult).status && (
                                <p className="text-[#64748B] text-xs capitalize">
                                  {(item as SearchResult).status!.replace(/_/g, ' ')}
                                </p>
                              )}
                              {(item as SearchResult).documentType && (
                                <p className="text-[#A78BFA] text-xs">{(item as SearchResult).documentType}</p>
                              )}
                            </div>
                          )}

                          {/* Shortcut for commands */}
                          {!isSearchResult && 'shortcut' in item && item.shortcut && (
                            <kbd className="px-2 py-0.5 text-[11px] font-medium text-[#64748B] bg-[#0B1220] rounded border border-white/[0.08]">
                              {item.shortcut}
                            </kbd>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer hint */}
            <div className="px-4 py-2 border-t border-white/[0.06] flex items-center gap-4 text-[11px] text-[#64748B]">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-[#0B1220] rounded border border-white/[0.08]">↑</kbd>
                <kbd className="px-1.5 py-0.5 bg-[#0B1220] rounded border border-white/[0.08]">↓</kbd>
                Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-[#0B1220] rounded border border-white/[0.08]">↵</kbd>
                Select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-[#0B1220] rounded border border-white/[0.08]">ESC</kbd>
                Close
              </span>
            </div>
          </div>
        </motion.div>
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
      description: 'Sync latest data from Salesforce',
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
