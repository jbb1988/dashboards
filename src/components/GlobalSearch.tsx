'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';

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

const TYPE_ICONS: Record<string, React.ReactNode> = {
  contract: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  document: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  ),
  task: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
};

const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  contract: { bg: 'bg-[#38BDF8]/10', text: 'text-[#38BDF8]', border: 'border-[#38BDF8]/20' },
  document: { bg: 'bg-[#A78BFA]/10', text: 'text-[#A78BFA]', border: 'border-[#A78BFA]/20' },
  task: { bg: 'bg-[#22C55E]/10', text: 'text-[#22C55E]', border: 'border-[#22C55E]/20' },
};

function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

export default function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>({ contracts: [], documents: [], tasks: [] });
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeScope, setActiveScope] = useState<'all' | 'contracts' | 'documents' | 'tasks'>('all');
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Flatten results for keyboard navigation
  const allResults = [
    ...results.contracts,
    ...results.documents,
    ...results.tasks,
  ];

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
      setResults({ contracts: [], documents: [], tasks: [] });
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Search with debounce
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults({ contracts: [], documents: [], tasks: [] });
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/contracts/search?q=${encodeURIComponent(query)}&scope=${activeScope}`);
        if (response.ok) {
          const data = await response.json();
          setResults(data.results);
          setSelectedIndex(0);
        }
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, activeScope]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, allResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && allResults[selectedIndex]) {
      e.preventDefault();
      handleSelect(allResults[selectedIndex]);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const scopes: Array<'all' | 'contracts' | 'documents' | 'tasks'> = ['all', 'contracts', 'documents', 'tasks'];
      const currentIdx = scopes.indexOf(activeScope);
      setActiveScope(scopes[(currentIdx + 1) % scopes.length]);
    }
  }, [allResults, selectedIndex, activeScope]);

  // Handle result selection
  const handleSelect = (result: SearchResult) => {
    setIsOpen(false);
    if (result.url) {
      if (result.url.startsWith('/')) {
        router.push(result.url);
      } else {
        window.open(result.url, '_blank');
      }
    }
  };

  // Scope tabs
  const scopes = [
    { id: 'all', label: 'All', count: allResults.length },
    { id: 'contracts', label: 'Contracts', count: results.contracts.length },
    { id: 'documents', label: 'Documents', count: results.documents.length },
    { id: 'tasks', label: 'Tasks', count: results.tasks.length },
  ] as const;

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        title="Search contracts, documents, and tasks"
        className="flex items-center gap-2.5 px-4 py-2 bg-[#0B1220]/80 border border-white/[0.06] rounded-xl text-[#64748B] hover:text-white hover:border-white/[0.12] hover:bg-[#111827] transition-all group"
      >
        <svg className="w-4 h-4 text-[#64748B] group-hover:text-[#38BDF8] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span className="text-sm">Search...</span>
      </button>

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop - darker, no blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-[#0B1220]/90 z-50"
            />

            {/* Search Panel - centered */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: -10 }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                className="w-full max-w-2xl pointer-events-auto"
              >
                <div className="bg-[#111827] border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
                  {/* Search Input */}
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
                          <svg className="w-6 h-6 text-[#38BDF8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                        placeholder="Search contracts, documents, tasks..."
                        className="flex-1 bg-transparent text-white placeholder-[#64748B] focus:outline-none text-lg font-light"
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
                    <div className="flex items-center gap-2 px-6 py-3 border-b border-white/[0.04]">
                      {scopes.map((scope) => (
                        <button
                          key={scope.id}
                          onClick={() => setActiveScope(scope.id)}
                          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                            activeScope === scope.id
                              ? 'bg-[#38BDF8] text-white shadow-lg shadow-[#38BDF8]/20'
                              : 'text-[#64748B] hover:text-white hover:bg-white/[0.04]'
                          }`}
                        >
                          {scope.label}
                          {scope.count > 0 && activeScope !== scope.id && (
                            <span className="ml-2 px-1.5 py-0.5 bg-white/[0.1] rounded text-xs">
                              {scope.count}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Results */}
                  <div className="max-h-[420px] overflow-y-auto">
                    {query.length < 2 ? (
                      <div className="px-6 py-12 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#38BDF8]/10 flex items-center justify-center">
                          <svg className="w-8 h-8 text-[#38BDF8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                        <p className="text-[#8FA3BF] text-lg font-light mb-2">Search MARS</p>
                        <p className="text-[#64748B] text-sm">Type to search contracts, documents, and tasks</p>
                      </div>
                    ) : allResults.length === 0 && !loading ? (
                      <div className="px-6 py-12 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/[0.04] flex items-center justify-center">
                          <svg className="w-8 h-8 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <p className="text-[#8FA3BF] text-lg font-light mb-2">No results found</p>
                        <p className="text-[#64748B] text-sm">Try different keywords or check spelling</p>
                      </div>
                    ) : (
                      <div className="py-3">
                        {/* Contracts */}
                        {results.contracts.length > 0 && (activeScope === 'all' || activeScope === 'contracts') && (
                          <ResultSection
                            title="Contracts"
                            type="contract"
                            results={results.contracts}
                            selectedIndex={selectedIndex}
                            offset={0}
                            onSelect={handleSelect}
                            onHover={setSelectedIndex}
                          />
                        )}

                        {/* Documents */}
                        {results.documents.length > 0 && (activeScope === 'all' || activeScope === 'documents') && (
                          <ResultSection
                            title="Documents"
                            type="document"
                            results={results.documents}
                            selectedIndex={selectedIndex}
                            offset={results.contracts.length}
                            onSelect={handleSelect}
                            onHover={setSelectedIndex}
                          />
                        )}

                        {/* Tasks */}
                        {results.tasks.length > 0 && (activeScope === 'all' || activeScope === 'tasks') && (
                          <ResultSection
                            title="Tasks"
                            type="task"
                            results={results.tasks}
                            selectedIndex={selectedIndex}
                            offset={results.contracts.length + results.documents.length}
                            onSelect={handleSelect}
                            onHover={setSelectedIndex}
                          />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
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
                          <span className="ml-1">Open</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <kbd className="px-1.5 py-0.5 bg-white/[0.06] rounded font-medium">Tab</kbd>
                          <span className="ml-1">Switch scope</span>
                        </span>
                      </div>
                      <span className="text-[#64748B]">
                        {allResults.length} result{allResults.length !== 1 ? 's' : ''}
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

// Result Section Component
function ResultSection({
  title,
  type,
  results,
  selectedIndex,
  offset,
  onSelect,
  onHover,
}: {
  title: string;
  type: 'contract' | 'document' | 'task';
  results: SearchResult[];
  selectedIndex: number;
  offset: number;
  onSelect: (result: SearchResult) => void;
  onHover: (index: number) => void;
}) {
  const colors = TYPE_COLORS[type];

  return (
    <div className="px-4 mb-3">
      <div className="flex items-center gap-2 px-2 mb-2">
        <span className={`${colors.text}`}>{TYPE_ICONS[type]}</span>
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
              onClick={() => onSelect(result)}
              onMouseEnter={() => onHover(globalIndex)}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl text-left transition-all ${
                isSelected
                  ? `${colors.bg} border ${colors.border}`
                  : 'hover:bg-white/[0.03] border border-transparent'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl ${colors.bg} flex items-center justify-center flex-shrink-0`}>
                <span className={colors.text}>{TYPE_ICONS[type]}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-medium truncate ${isSelected ? 'text-white' : 'text-[#E2E8F0]'}`}>
                  {result.title}
                </p>
                {result.subtitle && (
                  <p className="text-[#64748B] text-sm truncate mt-0.5">{result.subtitle}</p>
                )}
              </div>
              <div className="flex-shrink-0 text-right">
                {result.value && (
                  <p className="text-[#22C55E] text-sm font-semibold">{formatCurrency(result.value)}</p>
                )}
                {result.status && (
                  <p className="text-[#64748B] text-xs capitalize">{result.status.replace(/_/g, ' ')}</p>
                )}
                {result.documentType && (
                  <p className="text-[#A78BFA] text-xs font-medium">{result.documentType}</p>
                )}
              </div>
              {isSelected && (
                <div className={`flex-shrink-0 ${colors.text}`}>
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
