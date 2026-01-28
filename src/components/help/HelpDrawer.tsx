'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { searchGuides, getGuidesForPage, getContextForPage, type GuideEntry } from '@/lib/help/guide-content';
import { trackDrawerOpen, trackDrawerClose, trackGuideView } from '@/lib/help/analytics';
import ArticleFeedback from './ArticleFeedback';

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
    surface1: 'rgba(18,18,24,0.98)',
    surface2: 'rgba(28,28,36,0.95)',
    surface3: 'rgba(38,38,48,0.90)',
    elevated: 'rgba(48,48,58,0.85)',
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
    drawer: '0 0 80px rgba(0,0,0,0.8), -20px 0 60px rgba(0,0,0,0.4), inset 1px 0 0 rgba(255,255,255,0.05)',
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

// Type configurations for search results
const TYPE_CONFIG: Record<string, { color: string; glow: string; bgColor: string; label: string }> = {
  document: {
    color: visionPro.accent.purple,
    glow: visionPro.glow.purple,
    bgColor: 'rgba(167,139,250,0.15)',
    label: 'Document',
  },
  contract: {
    color: visionPro.accent.cyan,
    glow: visionPro.glow.cyan,
    bgColor: 'rgba(56,189,248,0.15)',
    label: 'Contract',
  },
  task: {
    color: visionPro.accent.green,
    glow: visionPro.glow.green,
    bgColor: 'rgba(74,222,128,0.15)',
    label: 'Task',
  },
  work_order: {
    color: visionPro.accent.orange,
    glow: visionPro.glow.orange,
    bgColor: 'rgba(251,146,60,0.15)',
    label: 'Work Order',
  },
  sales_order: {
    color: visionPro.accent.orange,
    glow: visionPro.glow.orange,
    bgColor: 'rgba(251,146,60,0.15)',
    label: 'Sales Order',
  },
  asana_task: {
    color: visionPro.accent.coral,
    glow: visionPro.glow.coral,
    bgColor: 'rgba(240,106,106,0.15)',
    label: 'Asana',
  },
  guide: {
    color: visionPro.accent.pink,
    glow: visionPro.glow.white,
    bgColor: 'rgba(244,114,182,0.15)',
    label: 'Guide',
  },
};

// =============================================================================
// TYPES
// =============================================================================

interface SearchResult {
  id: string;
  type: 'contract' | 'document' | 'task' | 'work_order' | 'sales_order' | 'asana_task';
  title: string;
  subtitle?: string;
  url: string;
}

interface HelpDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

// =============================================================================
// ICONS
// =============================================================================

const icons = {
  search: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  close: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  send: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  ),
  document: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  contract: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  ),
  task: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  guide: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  sparkle: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  ),
  arrow: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  ),
  workOrder: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  salesOrder: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  ),
  asana: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.78 12.653c-2.478 0-4.487 2.009-4.487 4.487s2.009 4.487 4.487 4.487 4.487-2.009 4.487-4.487-2.009-4.487-4.487-4.487zm-13.56 0c-2.478 0-4.487 2.009-4.487 4.487s2.009 4.487 4.487 4.487 4.487-2.009 4.487-4.487-2.009-4.487-4.487-4.487zm6.78-10.28c-2.478 0-4.487 2.009-4.487 4.487s2.009 4.487 4.487 4.487 4.487-2.009 4.487-4.487-2.009-4.487-4.487-4.487z"/>
    </svg>
  ),
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  document: icons.document,
  contract: icons.contract,
  task: icons.task,
  work_order: icons.workOrder,
  sales_order: icons.salesOrder,
  asana_task: icons.asana,
  guide: icons.guide,
};

// =============================================================================
// COMPONENT
// =============================================================================

export default function HelpDrawer({ isOpen, onClose }: HelpDrawerProps) {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [guideResults, setGuideResults] = useState<GuideEntry[]>([]);
  const [dataResults, setDataResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [relevantGuides, setRelevantGuides] = useState<GuideEntry[]>([]);
  const [inputFocused, setInputFocused] = useState(false);
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const openTimeRef = useRef<number | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track drawer open/close
  useEffect(() => {
    if (isOpen) {
      openTimeRef.current = Date.now();
      trackDrawerOpen(pathname);
      setTimeout(() => inputRef.current?.focus(), 100);
    } else if (openTimeRef.current) {
      trackDrawerClose(Date.now() - openTimeRef.current);
      openTimeRef.current = null;
      setQuery('');
      setMessages([]);
      setGuideResults([]);
      setDataResults([]);
    }
  }, [isOpen, pathname]);

  // Get relevant guides for current page
  useEffect(() => {
    if (pathname) {
      setRelevantGuides(getGuidesForPage(pathname));
    }
  }, [pathname]);

  // Search both guides and data as user types
  const searchData = useCallback(async (searchQuery: string) => {
    if (searchQuery.trim().length < 2) {
      setDataResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/contracts/search?q=${encodeURIComponent(searchQuery)}&limit=15`);
      if (response.ok) {
        const data = await response.json();

        // Log what we got back for debugging
        console.log('[HelpDrawer] Search results:', {
          contracts: data.results.contracts?.length || 0,
          documents: data.results.documents?.length || 0,
          tasks: data.results.tasks?.length || 0,
          workOrders: data.results.workOrders?.length || 0,
          salesOrders: data.results.salesOrders?.length || 0,
          asanaTasks: data.results.asanaTasks?.length || 0,
        });

        // Combine all results
        const combined: (SearchResult & { relevanceScore?: number })[] = [
          // Contracts
          ...(data.results.contracts || []).map((c: SearchResult & { relevanceScore?: number }) => ({ ...c, type: 'contract' as const })),
          // Documents
          ...(data.results.documents || []).map((d: SearchResult & { relevanceScore?: number }) => ({ ...d, type: 'document' as const })),
          // Tasks
          ...(data.results.tasks || []).map((t: SearchResult & { relevanceScore?: number }) => ({ ...t, type: 'task' as const })),
          // NetSuite Work Orders
          ...(data.results.workOrders || []).map((wo: SearchResult & { relevanceScore?: number }) => ({ ...wo, type: 'work_order' as const })),
          // NetSuite Sales Orders
          ...(data.results.salesOrders || []).map((so: SearchResult & { relevanceScore?: number }) => ({ ...so, type: 'sales_order' as const })),
          // Asana Tasks
          ...(data.results.asanaTasks || []).map((at: SearchResult & { relevanceScore?: number }) => ({ ...at, type: 'asana_task' as const })),
        ];

        // Sort by relevance score (highest first) and take top 10
        combined.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
        setDataResults(combined.slice(0, 10) as SearchResult[]);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    if (query.trim().length >= 2) {
      const results = searchGuides(query);
      setGuideResults(results.slice(0, 3));
    } else {
      setGuideResults([]);
      setDataResults([]);
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.trim().length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        searchData(query);
      }, 300);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, searchData]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: query.trim(),
    };

    setMessages(prev => [...prev, userMessage]);
    setQuery('');
    setGuideResults([]);
    setDataResults([]);
    setIsLoading(true);

    try {
      const guideContext = getContextForPage(pathname);
      const response = await fetch('/api/help-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          guideContext,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.response,
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        throw new Error('Failed to get response');
      }
    } catch {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Sorry, I couldn't process your request. Please try again or contact support@marswater.com",
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuideClick = (guide: GuideEntry) => {
    trackGuideView(guide.id, guide.title, guide.category);
    window.open(guide.path, '_blank');
  };

  const handleDataClick = (result: SearchResult) => {
    if (result.url.startsWith('http')) {
      window.open(result.url, '_blank');
    } else {
      window.location.href = result.url;
    }
    onClose();
  };

  const suggestedQuestions = [
    'How do I create a contract bundle?',
    'What are the pipeline stages?',
    'How does AI redlining work?',
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Vision Pro Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
            className="fixed inset-0 z-[60]"
            style={{
              background: visionPro.depth.backdrop,
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            }}
          />

          {/* Vision Pro Drawer */}
          <motion.div
            initial={{ x: '100%', opacity: 0.8 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.8 }}
            transition={{
              type: 'spring',
              stiffness: 400,
              damping: 35,
              mass: 0.8,
            }}
            className="fixed right-0 top-0 bottom-0 w-[440px] max-w-full z-[60] flex flex-col"
            style={{
              background: `linear-gradient(180deg, ${visionPro.depth.surface1}, ${visionPro.depth.surface2})`,
              borderLeft: `1px solid ${visionPro.border.light}`,
              boxShadow: visionPro.shadow.drawer,
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: `1px solid ${visionPro.border.subtle}`,
                background: visionPro.glass.ultra,
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1, type: 'spring', stiffness: 300 }}
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '14px',
                      background: `linear-gradient(135deg, ${visionPro.glass.regular}, ${visionPro.glass.thin})`,
                      border: `1px solid ${visionPro.border.light}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: visionPro.glow.blue,
                    }}
                  >
                    <Image
                      src="/drop-white.png"
                      alt="MARS"
                      width={28}
                      height={28}
                      style={{ filter: 'drop-shadow(0 0 10px rgba(88,166,255,0.5))' }}
                    />
                  </motion.div>
                  <div>
                    <h2 style={{ color: visionPro.text.primary, fontSize: '18px', fontWeight: 600, letterSpacing: '-0.02em' }}>
                      MARS Assistant
                    </h2>
                    <p style={{ color: visionPro.text.quaternary, fontSize: '12px', marginTop: '2px' }}>
                      Search & AI Help
                    </p>
                  </div>
                </div>
                <motion.button
                  onClick={onClose}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '12px',
                    background: visionPro.glass.thin,
                    border: `1px solid ${visionPro.border.subtle}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: visionPro.text.tertiary,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {icons.close}
                </motion.button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto" style={{ padding: '20px' }}>
              {messages.length === 0 ? (
                // Initial state - show suggestions and relevant guides
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {/* Quick suggestions */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    <p style={{ color: visionPro.text.secondary, fontSize: '14px', marginBottom: '12px' }}>
                      Ask me anything about MARS:
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {suggestedQuestions.map((question, idx) => (
                        <motion.button
                          key={idx}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.15 + idx * 0.05 }}
                          onClick={() => setQuery(question)}
                          whileHover={{ x: 4 }}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '14px 16px',
                            borderRadius: '16px',
                            background: visionPro.glass.thin,
                            border: `1px solid ${visionPro.border.subtle}`,
                            color: visionPro.text.secondary,
                            fontSize: '14px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <span>{question}</span>
                          <span style={{ color: visionPro.text.quaternary }}>{icons.arrow}</span>
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>

                  {/* Relevant for this page */}
                  {relevantGuides.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      <p style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: TYPE_CONFIG.guide.color,
                        marginBottom: '12px',
                      }}>
                        Guides for this page
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {relevantGuides.slice(0, 3).map((guide, idx) => (
                          <motion.button
                            key={guide.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.35 + idx * 0.05 }}
                            onClick={() => handleGuideClick(guide)}
                            whileHover={{ x: 4 }}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: '14px 16px',
                              borderRadius: '16px',
                              background: TYPE_CONFIG.guide.bgColor,
                              border: `1px solid ${TYPE_CONFIG.guide.color}20`,
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                            }}
                          >
                            <div style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '10px',
                              background: TYPE_CONFIG.guide.bgColor,
                              border: `1px solid ${TYPE_CONFIG.guide.color}30`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: TYPE_CONFIG.guide.color,
                              flexShrink: 0,
                            }}>
                              {icons.guide}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{
                                color: visionPro.text.primary,
                                fontSize: '14px',
                                fontWeight: 500,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}>
                                {guide.title}
                              </p>
                              <p style={{
                                color: visionPro.text.quaternary,
                                fontSize: '12px',
                                textTransform: 'capitalize',
                                marginTop: '2px',
                              }}>
                                {guide.category} Guide
                              </p>
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </div>
              ) : (
                // Chat messages
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {messages.map((message, idx) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                      style={{
                        display: 'flex',
                        justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                      }}
                    >
                      <div
                        style={{
                          maxWidth: '85%',
                          borderRadius: message.role === 'user' ? '20px 20px 6px 20px' : '20px 20px 20px 6px',
                          padding: '14px 18px',
                          background: message.role === 'user'
                            ? `linear-gradient(135deg, ${visionPro.accent.blue}, ${visionPro.accent.cyan})`
                            : visionPro.glass.regular,
                          border: message.role === 'user'
                            ? 'none'
                            : `1px solid ${visionPro.border.light}`,
                          boxShadow: message.role === 'user'
                            ? visionPro.glow.blue
                            : visionPro.shadow.inner,
                        }}
                      >
                        <p style={{
                          fontSize: '14px',
                          lineHeight: 1.5,
                          color: message.role === 'user' ? '#fff' : visionPro.text.secondary,
                          whiteSpace: 'pre-wrap',
                        }}>
                          {message.content}
                        </p>
                      </div>
                    </motion.div>
                  ))}

                  {/* Show feedback after assistant response */}
                  {messages.length > 0 && messages[messages.length - 1].role === 'assistant' && !isLoading && (
                    <ArticleFeedback />
                  )}

                  {isLoading && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      style={{ display: 'flex', justifyContent: 'flex-start' }}
                    >
                      <div
                        style={{
                          borderRadius: '20px 20px 20px 6px',
                          padding: '14px 18px',
                          background: visionPro.glass.regular,
                          border: `1px solid ${visionPro.border.light}`,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {[0, 1, 2].map((i) => (
                            <motion.div
                              key={i}
                              animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                              transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
                              style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: visionPro.accent.blue,
                                boxShadow: visionPro.glow.blue,
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input Area */}
            <div
              style={{
                padding: '16px 20px 20px',
                borderTop: `1px solid ${visionPro.border.subtle}`,
                background: visionPro.glass.ultra,
              }}
            >
              {/* Search results dropdown */}
              <AnimatePresence>
                {(guideResults.length > 0 || dataResults.length > 0 || isSearching) && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: 10, height: 0 }}
                    style={{
                      marginBottom: '12px',
                      padding: '8px',
                      background: visionPro.depth.surface3,
                      borderRadius: '16px',
                      border: `1px solid ${visionPro.border.light}`,
                      maxHeight: '240px',
                      overflowY: 'auto',
                    }}
                  >
                    {/* Data results */}
                    {dataResults.length > 0 && (
                      <div style={{ marginBottom: guideResults.length > 0 ? '8px' : 0 }}>
                        <p style={{
                          fontSize: '10px',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          color: visionPro.text.quaternary,
                          padding: '4px 8px',
                          marginBottom: '4px',
                        }}>
                          Results
                        </p>
                        {dataResults.map((result, idx) => {
                          const config = TYPE_CONFIG[result.type] || TYPE_CONFIG.document;
                          return (
                            <motion.button
                              key={`${result.type}-${result.id}`}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.03 }}
                              onClick={() => handleDataClick(result)}
                              whileHover={{ x: 4 }}
                              style={{
                                width: '100%',
                                textAlign: 'left',
                                padding: '10px 12px',
                                borderRadius: '12px',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                transition: 'all 0.2s ease',
                              }}
                            >
                              <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '8px',
                                background: config.bgColor,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: config.color,
                                flexShrink: 0,
                              }}>
                                {TYPE_ICONS[result.type]}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{
                                  fontSize: '13px',
                                  fontWeight: 500,
                                  color: visionPro.text.primary,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}>
                                  {result.title}
                                </p>
                                {result.subtitle && (
                                  <p style={{
                                    fontSize: '11px',
                                    color: visionPro.text.quaternary,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}>
                                    {result.subtitle}
                                  </p>
                                )}
                              </div>
                              <span style={{
                                fontSize: '9px',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                color: config.color,
                                padding: '3px 6px',
                                borderRadius: '4px',
                                background: config.bgColor,
                              }}>
                                {config.label}
                              </span>
                            </motion.button>
                          );
                        })}
                      </div>
                    )}

                    {/* Guide results */}
                    {guideResults.length > 0 && (
                      <div>
                        <p style={{
                          fontSize: '10px',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          color: visionPro.text.quaternary,
                          padding: '4px 8px',
                          marginBottom: '4px',
                        }}>
                          Guides
                        </p>
                        {guideResults.map((guide, idx) => (
                          <motion.button
                            key={guide.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: dataResults.length * 0.03 + idx * 0.03 }}
                            onClick={() => handleGuideClick(guide)}
                            whileHover={{ x: 4 }}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: '10px 12px',
                              borderRadius: '12px',
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              transition: 'all 0.2s ease',
                            }}
                          >
                            <div style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              background: TYPE_CONFIG.guide.bgColor,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: TYPE_CONFIG.guide.color,
                              flexShrink: 0,
                            }}>
                              {icons.guide}
                            </div>
                            <p style={{
                              flex: 1,
                              fontSize: '13px',
                              fontWeight: 500,
                              color: visionPro.text.primary,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>
                              {guide.title}
                            </p>
                          </motion.button>
                        ))}
                      </div>
                    )}

                    {/* Loading */}
                    {isSearching && dataResults.length === 0 && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '12px',
                        color: visionPro.text.tertiary,
                        fontSize: '13px',
                      }}>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          style={{
                            width: '16px',
                            height: '16px',
                            border: `2px solid ${visionPro.accent.blue}`,
                            borderTopColor: 'transparent',
                            borderRadius: '50%',
                          }}
                        />
                        Searching...
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    flex: 1,
                    position: 'relative',
                    borderRadius: '16px',
                    background: visionPro.glass.thin,
                    border: `1px solid ${inputFocused ? `${visionPro.accent.blue}40` : visionPro.border.subtle}`,
                    boxShadow: inputFocused ? visionPro.glow.blue : 'none',
                    transition: 'all 0.3s ease',
                  }}
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => setInputFocused(false)}
                    placeholder="Search or ask a question..."
                    style={{
                      width: '100%',
                      padding: '14px 18px',
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: visionPro.text.primary,
                      fontSize: '15px',
                      fontWeight: 400,
                    }}
                  />
                </div>
                <motion.button
                  type="submit"
                  disabled={!query.trim() || isLoading}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '14px',
                    background: query.trim() && !isLoading
                      ? `linear-gradient(135deg, ${visionPro.accent.blue}, ${visionPro.accent.cyan})`
                      : visionPro.glass.thin,
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: query.trim() && !isLoading ? '#fff' : visionPro.text.quaternary,
                    cursor: query.trim() && !isLoading ? 'pointer' : 'not-allowed',
                    boxShadow: query.trim() && !isLoading ? visionPro.glow.blue : 'none',
                    transition: 'all 0.3s ease',
                    flexShrink: 0,
                  }}
                >
                  {isLoading ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      style={{
                        width: '20px',
                        height: '20px',
                        border: '2px solid #fff',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                      }}
                    />
                  ) : (
                    icons.send
                  )}
                </motion.button>
              </form>
              <p style={{
                textAlign: 'center',
                marginTop: '10px',
                fontSize: '11px',
                color: visionPro.text.quaternary,
              }}>
                Search everything or press Enter to ask AI
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
