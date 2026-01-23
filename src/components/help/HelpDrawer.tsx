'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { searchGuides, getGuidesForPage, getContextForPage, type GuideEntry } from '@/lib/help/guide-content';
import { trackDrawerOpen, trackDrawerClose, trackGuideView } from '@/lib/help/analytics';
import ArticleFeedback from './ArticleFeedback';

interface HelpDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function HelpDrawer({ isOpen, onClose }: HelpDrawerProps) {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [guideResults, setGuideResults] = useState<GuideEntry[]>([]);
  const [relevantGuides, setRelevantGuides] = useState<GuideEntry[]>([]);
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const openTimeRef = useRef<number | null>(null);

  // Track drawer open/close
  useEffect(() => {
    if (isOpen) {
      openTimeRef.current = Date.now();
      trackDrawerOpen(pathname);
      setTimeout(() => inputRef.current?.focus(), 100);
    } else if (openTimeRef.current) {
      trackDrawerClose(Date.now() - openTimeRef.current);
      openTimeRef.current = null;
      // Reset state when closed
      setQuery('');
      setMessages([]);
      setGuideResults([]);
    }
  }, [isOpen, pathname]);

  // Get relevant guides for current page
  useEffect(() => {
    if (pathname) {
      setRelevantGuides(getGuidesForPage(pathname));
    }
  }, [pathname]);

  // Search guides as user types
  useEffect(() => {
    if (query.trim().length >= 2) {
      const results = searchGuides(query);
      setGuideResults(results.slice(0, 4));
    } else {
      setGuideResults([]);
    }
  }, [query]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Close on Escape key
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

  const suggestedQuestions = [
    'How do I create a contract bundle?',
    'What are the pipeline stages?',
    'How does AI redlining work?',
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#0B1220]/80 z-[60]"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-[420px] max-w-full bg-[#111827] border-l border-white/[0.06] shadow-xl z-[60] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <Image
                  src="/drop-white.png"
                  alt="MARS"
                  width={32}
                  height={32}
                  className="drop-shadow-lg"
                />
                <h2 className="text-lg font-semibold text-white">MARS Assistant</h2>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg hover:bg-white/[0.06] flex items-center justify-center text-[#64748B] hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {messages.length === 0 ? (
                // Initial state - show suggestions and relevant guides
                <div className="space-y-6">
                  {/* Quick suggestions */}
                  <div>
                    <p className="text-[#8FA3BF] text-sm mb-3">Ask me anything about MARS:</p>
                    <div className="space-y-2">
                      {suggestedQuestions.map((question, idx) => (
                        <button
                          key={idx}
                          onClick={() => setQuery(question)}
                          className="w-full text-left p-3 rounded-xl bg-[#0B1220] hover:bg-[#1E293B] border border-white/[0.04] hover:border-white/[0.08] transition-all text-sm text-[#8FA3BF] hover:text-white"
                        >
                          {question}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Relevant for this page */}
                  {relevantGuides.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-[#64748B] uppercase tracking-wider mb-3">
                        Guides for this page
                      </p>
                      <div className="space-y-2">
                        {relevantGuides.slice(0, 3).map((guide) => (
                          <button
                            key={guide.id}
                            onClick={() => handleGuideClick(guide)}
                            className="w-full text-left p-3 rounded-xl bg-[#0B1220] hover:bg-[#1E293B] border border-white/[0.04] hover:border-white/[0.08] transition-all group"
                          >
                            <p className="text-white text-sm font-medium truncate group-hover:text-[#38BDF8] transition-colors">
                              {guide.title}
                            </p>
                            <p className="text-[#64748B] text-xs capitalize mt-0.5">
                              {guide.category} Guide
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                // Chat messages
                <div className="space-y-4">
                  {messages.map((message) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                          message.role === 'user'
                            ? 'bg-[#38BDF8] text-white'
                            : 'bg-[#0B1220] border border-white/[0.06] text-[#8FA3BF]'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      </div>
                    </motion.div>
                  ))}

                  {/* Show feedback after assistant response */}
                  {messages.length > 0 && messages[messages.length - 1].role === 'assistant' && !isLoading && (
                    <ArticleFeedback />
                  )}

                  {isLoading && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex justify-start"
                    >
                      <div className="bg-[#0B1220] border border-white/[0.06] rounded-2xl px-4 py-3">
                        <div className="flex items-center gap-2">
                          <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                            className="w-2 h-2 rounded-full bg-[#38BDF8]"
                          />
                          <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
                            className="w-2 h-2 rounded-full bg-[#38BDF8]"
                          />
                          <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
                            className="w-2 h-2 rounded-full bg-[#38BDF8]"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-white/[0.06]">
              {/* Guide results dropdown */}
              <AnimatePresence>
                {guideResults.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="mb-3 p-2 bg-[#0B1220] rounded-xl border border-white/[0.06]"
                  >
                    <p className="text-[10px] text-[#64748B] uppercase tracking-wider px-2 mb-1">Matching guides</p>
                    {guideResults.map((guide) => (
                      <button
                        key={guide.id}
                        onClick={() => handleGuideClick(guide)}
                        className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-white/[0.04] transition-colors"
                      >
                        <p className="text-sm text-white truncate">{guide.title}</p>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSubmit} className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask a question..."
                  className="flex-1 px-4 py-3 bg-[#0B1220] border border-white/[0.06] rounded-xl text-white placeholder-[#64748B] focus:outline-none focus:border-[#38BDF8]/50 focus:ring-1 focus:ring-[#38BDF8]/50 transition-all"
                />
                <button
                  type="submit"
                  disabled={!query.trim() || isLoading}
                  className="w-11 h-11 rounded-xl bg-[#38BDF8] hover:bg-[#0EA5E9] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors flex-shrink-0"
                >
                  {isLoading ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                    />
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                </button>
              </form>
              <p className="text-[#64748B] text-xs text-center mt-2">
                Press Enter to ask · <a href="mailto:support@marswater.com" className="text-[#38BDF8] hover:underline">Contact support</a>
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
