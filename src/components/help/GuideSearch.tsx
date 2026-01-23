'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { searchGuides, type GuideEntry } from '@/lib/help/guide-content';
import { trackSearch, trackGuideView } from '@/lib/help/analytics';
import ArticleFeedback from './ArticleFeedback';

export default function GuideSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GuideEntry[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedResult, setSelectedResult] = useState<GuideEntry | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounced search
  const handleSearch = useCallback((searchQuery: string) => {
    setQuery(searchQuery);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!searchQuery.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(() => {
      const searchResults = searchGuides(searchQuery);
      setResults(searchResults.slice(0, 8)); // Limit to 8 results
      setIsSearching(false);
      trackSearch(searchQuery, searchResults.length);
    }, 200);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const handleResultClick = (guide: GuideEntry) => {
    trackGuideView(guide.id, guide.title, guide.category);
    setSelectedResult(guide);
  };

  const handleBackToResults = () => {
    setSelectedResult(null);
  };

  const handleOpenInGuides = (guide: GuideEntry) => {
    window.open(guide.path, '_blank');
  };

  // Show selected guide detail
  if (selectedResult) {
    return (
      <div className="space-y-4">
        <button
          onClick={handleBackToResults}
          className="flex items-center gap-2 text-[#64748B] hover:text-white transition-colors text-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to search results
        </button>

        <div className="bg-[#0B1220] rounded-xl border border-white/[0.04] p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 bg-[#38BDF8]/10 text-[#38BDF8] text-xs font-medium rounded capitalize">
              {selectedResult.category}
            </span>
          </div>
          <h3 className="text-lg font-semibold text-white mb-3">{selectedResult.title}</h3>
          <div className="text-[#8FA3BF] text-sm whitespace-pre-line leading-relaxed">
            {selectedResult.content}
          </div>
          <button
            onClick={() => handleOpenInGuides(selectedResult)}
            className="mt-4 text-[#38BDF8] hover:underline text-sm flex items-center gap-1"
          >
            Open in Guides
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </button>
        </div>

        <ArticleFeedback guideId={selectedResult.id} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
          {isSearching ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-5 h-5 border-2 border-[#38BDF8] border-t-transparent rounded-full"
            />
          ) : (
            <svg className="w-5 h-5 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search guides..."
          className="w-full pl-11 pr-4 py-3 bg-[#0B1220] border border-white/[0.06] rounded-xl text-white placeholder-[#64748B] focus:outline-none focus:border-[#38BDF8]/50 focus:ring-1 focus:ring-[#38BDF8]/50 transition-all"
        />
        {query && (
          <button
            onClick={() => handleSearch('')}
            className="absolute inset-y-0 right-3 flex items-center text-[#64748B] hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Search Results */}
      <AnimatePresence mode="wait">
        {results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-2"
          >
            <p className="text-xs text-[#64748B] uppercase tracking-wider">
              {results.length} result{results.length !== 1 ? 's' : ''} found
            </p>
            <div className="space-y-2">
              {results.map((guide, index) => (
                <motion.button
                  key={guide.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleResultClick(guide)}
                  className="w-full text-left p-3 rounded-lg bg-[#0B1220] hover:bg-[#1E293B] border border-white/[0.04] hover:border-white/[0.08] transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#38BDF8]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-4 h-4 text-[#38BDF8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium group-hover:text-[#38BDF8] transition-colors">
                        {guide.title}
                      </p>
                      <p className="text-[#64748B] text-xs mt-0.5 line-clamp-2">
                        {guide.content.substring(0, 100)}...
                      </p>
                      <span className="inline-block mt-1 px-2 py-0.5 bg-white/[0.04] text-[#64748B] text-xs rounded capitalize">
                        {guide.category}
                      </span>
                    </div>
                    <svg className="w-4 h-4 text-[#64748B] group-hover:text-[#38BDF8] transition-colors flex-shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {query && !isSearching && results.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-6"
          >
            <div className="w-12 h-12 rounded-full bg-[#1E293B] flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-[#8FA3BF] text-sm">No results found for "{query}"</p>
            <p className="text-[#64748B] text-xs mt-1">Try different keywords or ask AI for help</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
