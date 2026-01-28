'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';

// =============================================================================
// TYPES
// =============================================================================

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

// Type configurations
const TYPE_CONFIG: Record<string, { color: string; glow: string; bgColor: string }> = {
  contract: {
    color: visionPro.accent.cyan,
    glow: visionPro.glow.cyan,
    bgColor: 'rgba(56,189,248,0.15)',
  },
  document: {
    color: visionPro.accent.purple,
    glow: visionPro.glow.purple,
    bgColor: 'rgba(167,139,250,0.15)',
  },
  task: {
    color: visionPro.accent.green,
    glow: visionPro.glow.green,
    bgColor: 'rgba(74,222,128,0.15)',
  },
  action: {
    color: visionPro.accent.blue,
    glow: visionPro.glow.blue,
    bgColor: 'rgba(88,166,255,0.15)',
  },
  filter: {
    color: visionPro.accent.orange,
    glow: visionPro.glow.orange,
    bgColor: 'rgba(251,146,60,0.15)',
  },
  navigation: {
    color: visionPro.accent.purple,
    glow: visionPro.glow.purple,
    bgColor: 'rgba(167,139,250,0.15)',
  },
};

// =============================================================================
// ICONS
// =============================================================================

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
  sparkle: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  ),
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  contract: icons.contract,
  document: icons.document,
  task: icons.task,
};

function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function CommandPalette({
  isOpen,
  onClose,
  commands,
  placeholder = 'Type a command or search contracts...',
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchResults, setSearchResults] = useState<SearchResults>({ contracts: [], documents: [], tasks: [] });
  const [loading, setLoading] = useState(false);
  const [activeScope, setActiveScope] = useState<'all' | 'contracts' | 'documents' | 'tasks'>('all');
  const [inputFocused, setInputFocused] = useState(false);
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

    // Add API search results
    const { contracts: apiContracts, documents: apiDocuments, tasks: apiTasks } = searchResults;

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

  // Count results
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
        case 'Tab':
          e.preventDefault();
          // Cycle through scopes
          const scopes: Array<'all' | 'contracts' | 'documents' | 'tasks'> = ['all', 'contracts', 'documents', 'tasks'];
          const currentIdx = scopes.indexOf(activeScope);
          setActiveScope(scopes[(currentIdx + 1) % scopes.length]);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, flatResults, selectedIndex, onClose, activeScope]);

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

  // Get category type for styling
  const getCategoryType = (category: string): string => {
    const lower = category.toLowerCase();
    if (lower === 'contracts') return 'contract';
    if (lower === 'documents') return 'document';
    if (lower === 'tasks') return 'task';
    if (lower === 'filters') return 'filter';
    if (lower === 'navigation') return 'navigation';
    return 'action';
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-hidden">
        {/* Vision Pro Backdrop - deep with blur and saturation */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={onClose}
          className="absolute inset-0"
          style={{
            background: visionPro.depth.backdrop,
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          }}
        />

        {/* Command Palette - centered with Vision Pro styling */}
        <div className="absolute inset-0 flex items-start justify-center pt-[15vh] p-4 pointer-events-none">
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{
              type: 'spring',
              stiffness: 400,
              damping: 32,
              mass: 0.8,
            }}
            className="w-full max-w-2xl pointer-events-auto"
          >
            <div
              style={{
                background: `linear-gradient(135deg, ${visionPro.depth.surface1}, ${visionPro.depth.surface2})`,
                borderRadius: '28px',
                border: `1px solid ${visionPro.border.light}`,
                boxShadow: visionPro.shadow.modal,
                overflow: 'hidden',
              }}
            >
              {/* Top highlight edge */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: '10%',
                  right: '10%',
                  height: '1px',
                  background: `linear-gradient(90deg, transparent, ${visionPro.glass.chrome}, transparent)`,
                }}
              />

              {/* Search Input Area */}
              <div style={{ position: 'relative' }}>
                <div className="flex items-center gap-4 px-7 py-6">
                  {/* Search Icon / Loader */}
                  <div className="relative">
                    {loading ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        style={{
                          width: '24px',
                          height: '24px',
                          border: `2px solid ${visionPro.accent.blue}`,
                          borderTopColor: 'transparent',
                          borderRadius: '50%',
                        }}
                      />
                    ) : (
                      <motion.span
                        animate={{
                          color: inputFocused ? visionPro.accent.blue : visionPro.text.tertiary,
                        }}
                        style={{ display: 'flex' }}
                      >
                        {icons.search}
                      </motion.span>
                    )}
                  </div>

                  {/* Input with glow on focus */}
                  <div className="flex-1 relative">
                    <input
                      ref={inputRef}
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onFocus={() => setInputFocused(true)}
                      onBlur={() => setInputFocused(false)}
                      placeholder={placeholder}
                      className="w-full bg-transparent outline-none"
                      style={{
                        color: visionPro.text.primary,
                        fontSize: '18px',
                        fontWeight: 300,
                        letterSpacing: '-0.01em',
                      }}
                    />
                    <style jsx>{`
                      input::placeholder {
                        color: ${visionPro.text.quaternary};
                      }
                    `}</style>
                  </div>

                  {/* ESC Badge */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      paddingLeft: '16px',
                      borderLeft: `1px solid ${visionPro.border.subtle}`,
                    }}
                  >
                    <kbd
                      style={{
                        padding: '6px 10px',
                        fontSize: '12px',
                        fontWeight: 500,
                        color: visionPro.text.tertiary,
                        background: visionPro.glass.thin,
                        borderRadius: '8px',
                        border: `1px solid ${visionPro.border.subtle}`,
                      }}
                    >
                      ESC
                    </kbd>
                  </div>
                </div>

                {/* Bottom gradient line */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: '24px',
                    right: '24px',
                    height: '1px',
                    background: inputFocused
                      ? `linear-gradient(90deg, transparent, ${visionPro.accent.blue}, transparent)`
                      : `linear-gradient(90deg, transparent, ${visionPro.border.light}, transparent)`,
                    transition: 'background 0.3s ease',
                  }}
                />
              </div>

              {/* Scope Tabs */}
              {showScopeTabs && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 24px',
                    borderBottom: `1px solid ${visionPro.border.subtle}`,
                  }}
                >
                  {(['all', 'contracts', 'documents', 'tasks'] as const).map((scope) => {
                    const isActive = activeScope === scope;
                    const config = scope === 'all' ? TYPE_CONFIG.action : TYPE_CONFIG[scope] || TYPE_CONFIG.action;

                    return (
                      <motion.button
                        key={scope}
                        onClick={() => setActiveScope(scope)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '12px',
                          fontSize: '13px',
                          fontWeight: 500,
                          textTransform: 'capitalize',
                          border: isActive ? `1px solid ${config.color}40` : `1px solid transparent`,
                          background: isActive ? config.bgColor : 'transparent',
                          color: isActive ? config.color : visionPro.text.tertiary,
                          boxShadow: isActive ? config.glow : 'none',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {scope}
                        {resultCounts[scope] > 0 && !isActive && (
                          <span
                            style={{
                              marginLeft: '8px',
                              padding: '2px 6px',
                              background: visionPro.glass.thin,
                              borderRadius: '6px',
                              fontSize: '11px',
                            }}
                          >
                            {resultCounts[scope]}
                          </span>
                        )}
                      </motion.button>
                    );
                  })}
                </motion.div>
              )}

              {/* Results List */}
              <div
                ref={listRef}
                style={{
                  maxHeight: '420px',
                  overflowY: 'auto',
                  padding: '12px',
                }}
              >
                {Object.entries(results).length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{
                      padding: '48px 24px',
                      textAlign: 'center',
                    }}
                  >
                    <div
                      style={{
                        width: '64px',
                        height: '64px',
                        margin: '0 auto 16px',
                        borderRadius: '20px',
                        background: visionPro.glass.thin,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: visionPro.text.quaternary,
                      }}
                    >
                      {icons.sparkle}
                    </div>
                    <p style={{ color: visionPro.text.secondary, fontSize: '16px', fontWeight: 300, marginBottom: '8px' }}>
                      {query.length < 2 ? 'Search or run a command' : 'No results found'}
                    </p>
                    <p style={{ color: visionPro.text.quaternary, fontSize: '13px' }}>
                      {query.length < 2 ? 'Type to search contracts, documents, and tasks' : 'Try different keywords'}
                    </p>
                  </motion.div>
                ) : (
                  Object.entries(results).map(([category, items], categoryIndex) => {
                    const categoryType = getCategoryType(category);
                    const config = TYPE_CONFIG[categoryType] || TYPE_CONFIG.action;

                    return (
                      <motion.div
                        key={category}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: categoryIndex * 0.05 }}
                        style={{ marginBottom: '16px' }}
                      >
                        {/* Category Header */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            marginBottom: '4px',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                              color: config.color,
                            }}
                          >
                            {category}
                          </span>
                          <span
                            style={{
                              fontSize: '10px',
                              color: visionPro.text.quaternary,
                              padding: '2px 6px',
                              background: visionPro.glass.ultra,
                              borderRadius: '4px',
                            }}
                          >
                            {items.length}
                          </span>
                        </div>

                        {/* Items */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {items.map((item: ResultItem, itemIndex) => {
                            currentFlatIndex++;
                            const isSelected = currentFlatIndex === selectedIndex;
                            const isSearchResult = item.type !== undefined;
                            const itemConfig = item.type ? TYPE_CONFIG[item.type] || config : config;

                            return (
                              <motion.button
                                key={item.id}
                                data-selected={isSelected}
                                onClick={() => {
                                  item.action();
                                  onClose();
                                }}
                                onMouseEnter={() => setSelectedIndex(currentFlatIndex)}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: categoryIndex * 0.05 + itemIndex * 0.02 }}
                                whileHover={{ x: 2 }}
                                style={{
                                  width: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '16px',
                                  padding: '14px 16px',
                                  borderRadius: '16px',
                                  textAlign: 'left',
                                  border: isSelected
                                    ? `1px solid ${itemConfig.color}30`
                                    : `1px solid transparent`,
                                  background: isSelected
                                    ? `linear-gradient(135deg, ${itemConfig.bgColor}, transparent)`
                                    : 'transparent',
                                  boxShadow: isSelected ? itemConfig.glow : 'none',
                                  position: 'relative',
                                  overflow: 'hidden',
                                  transition: 'all 0.2s ease',
                                  cursor: 'pointer',
                                }}
                              >
                                {/* Luminous accent bar */}
                                {isSelected && (
                                  <motion.div
                                    initial={{ scaleY: 0 }}
                                    animate={{ scaleY: 1 }}
                                    style={{
                                      position: 'absolute',
                                      left: 0,
                                      top: '20%',
                                      bottom: '20%',
                                      width: '3px',
                                      borderRadius: '0 3px 3px 0',
                                      background: itemConfig.color,
                                      boxShadow: itemConfig.glow,
                                    }}
                                  />
                                )}

                                {/* Icon */}
                                <div
                                  style={{
                                    width: '42px',
                                    height: '42px',
                                    borderRadius: '14px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    background: isSelected ? itemConfig.bgColor : visionPro.glass.thin,
                                    border: `1px solid ${isSelected ? `${itemConfig.color}30` : visionPro.border.subtle}`,
                                    color: isSelected ? itemConfig.color : visionPro.text.tertiary,
                                    transition: 'all 0.2s ease',
                                  }}
                                >
                                  {item.icon || icons.navigate}
                                </div>

                                {/* Content */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div
                                    style={{
                                      fontWeight: 500,
                                      fontSize: '15px',
                                      color: isSelected ? visionPro.text.primary : visionPro.text.secondary,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {item.label}
                                  </div>
                                  {item.description && (
                                    <div
                                      style={{
                                        fontSize: '13px',
                                        color: visionPro.text.quaternary,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        marginTop: '2px',
                                      }}
                                    >
                                      {item.description}
                                    </div>
                                  )}
                                </div>

                                {/* Metadata */}
                                {isSearchResult && (
                                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                                    {item.value && (
                                      <p style={{
                                        color: visionPro.accent.green,
                                        fontSize: '14px',
                                        fontWeight: 600,
                                      }}>
                                        {formatCurrency(item.value)}
                                      </p>
                                    )}
                                    {item.status && (
                                      <p style={{
                                        color: visionPro.text.quaternary,
                                        fontSize: '12px',
                                        textTransform: 'capitalize',
                                      }}>
                                        {item.status.replace(/_/g, ' ')}
                                      </p>
                                    )}
                                    {item.documentType && (
                                      <p style={{
                                        color: visionPro.accent.purple,
                                        fontSize: '12px',
                                        fontWeight: 500,
                                      }}>
                                        {item.documentType}
                                      </p>
                                    )}
                                  </div>
                                )}

                                {/* Shortcut */}
                                {!isSearchResult && item.shortcut && (
                                  <kbd
                                    style={{
                                      padding: '6px 10px',
                                      fontSize: '12px',
                                      fontWeight: 500,
                                      color: visionPro.text.tertiary,
                                      background: visionPro.glass.thin,
                                      borderRadius: '8px',
                                      border: `1px solid ${visionPro.border.subtle}`,
                                    }}
                                  >
                                    {item.shortcut}
                                  </kbd>
                                )}

                                {/* Arrow indicator */}
                                {isSelected && (
                                  <motion.div
                                    initial={{ opacity: 0, x: -5 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    style={{ color: itemConfig.color, flexShrink: 0 }}
                                  >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                    </svg>
                                  </motion.div>
                                )}
                              </motion.button>
                            );
                          })}
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div
                style={{
                  padding: '14px 24px',
                  borderTop: `1px solid ${visionPro.border.subtle}`,
                  background: visionPro.glass.ultra,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    color: visionPro.text.quaternary,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <kbd style={{
                        padding: '4px 8px',
                        background: visionPro.glass.thin,
                        borderRadius: '6px',
                        fontWeight: 500,
                      }}>↑</kbd>
                      <kbd style={{
                        padding: '4px 8px',
                        background: visionPro.glass.thin,
                        borderRadius: '6px',
                        fontWeight: 500,
                      }}>↓</kbd>
                      <span style={{ marginLeft: '4px' }}>Navigate</span>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <kbd style={{
                        padding: '4px 8px',
                        background: visionPro.glass.thin,
                        borderRadius: '6px',
                        fontWeight: 500,
                      }}>↵</kbd>
                      <span style={{ marginLeft: '4px' }}>Select</span>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <kbd style={{
                        padding: '4px 8px',
                        background: visionPro.glass.thin,
                        borderRadius: '6px',
                        fontWeight: 500,
                      }}>Tab</kbd>
                      <span style={{ marginLeft: '4px' }}>Scope</span>
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

// =============================================================================
// DEFAULT COMMANDS
// =============================================================================

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
