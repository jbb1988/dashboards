'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import GuideSearch from './GuideSearch';
import AIChat from './AIChat';
import { getGuidesForPage, type GuideEntry } from '@/lib/help/guide-content';
import { trackDrawerOpen, trackDrawerClose, trackGuideView } from '@/lib/help/analytics';

interface HelpDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HelpDrawer({ isOpen, onClose }: HelpDrawerProps) {
  const [showAIChat, setShowAIChat] = useState(false);
  const [relevantGuides, setRelevantGuides] = useState<GuideEntry[]>([]);
  const pathname = usePathname();
  const openTimeRef = useRef<number | null>(null);

  // Track drawer open/close
  useEffect(() => {
    if (isOpen) {
      openTimeRef.current = Date.now();
      trackDrawerOpen(pathname);
    } else if (openTimeRef.current) {
      trackDrawerClose(Date.now() - openTimeRef.current);
      openTimeRef.current = null;
    }
  }, [isOpen, pathname]);

  // Get relevant guides for current page
  useEffect(() => {
    if (pathname) {
      setRelevantGuides(getGuidesForPage(pathname));
    }
  }, [pathname]);

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

  const handleGuideClick = (guide: GuideEntry) => {
    trackGuideView(guide.id, guide.title, guide.category);
    window.open(guide.path, '_blank');
  };

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
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
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
                <div className="w-8 h-8 rounded-lg bg-[#38BDF8]/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#38BDF8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-white">Help</h2>
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
            <div className="flex-1 overflow-y-auto">
              {showAIChat ? (
                <AIChat onBack={() => setShowAIChat(false)} />
              ) : (
                <div className="p-6 space-y-6">
                  {/* Search Section */}
                  <GuideSearch />

                  {/* Ask AI Section */}
                  <div className="bg-gradient-to-r from-[#38BDF8]/10 to-[#8B5CF6]/10 rounded-xl p-4 border border-white/[0.06]">
                    <p className="text-[#8FA3BF] text-sm mb-3">
                      Can't find what you need?
                    </p>
                    <button
                      onClick={() => setShowAIChat(true)}
                      className="w-full py-2.5 px-4 bg-[#38BDF8] hover:bg-[#0EA5E9] text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                      Ask AI Assistant
                    </button>
                  </div>

                  {/* Relevant for this page */}
                  {relevantGuides.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-[#64748B] uppercase tracking-wider mb-3">
                        Relevant for this page
                      </h3>
                      <div className="space-y-2">
                        {relevantGuides.map((guide) => (
                          <button
                            key={guide.id}
                            onClick={() => handleGuideClick(guide)}
                            className="w-full text-left p-3 rounded-lg bg-[#0B1220] hover:bg-[#1E293B] border border-white/[0.04] hover:border-white/[0.08] transition-all group"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-[#38BDF8]/10 flex items-center justify-center flex-shrink-0">
                                <svg className="w-4 h-4 text-[#38BDF8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-white text-sm font-medium truncate group-hover:text-[#38BDF8] transition-colors">
                                  {guide.title}
                                </p>
                                <p className="text-[#64748B] text-xs capitalize">
                                  {guide.category} Guide
                                </p>
                              </div>
                              <svg className="w-4 h-4 text-[#64748B] group-hover:text-[#38BDF8] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/[0.06]">
              <p className="text-[#64748B] text-sm text-center">
                Contact:{' '}
                <a
                  href="mailto:support@marswater.com"
                  className="text-[#38BDF8] hover:underline"
                >
                  support@marswater.com
                </a>
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
