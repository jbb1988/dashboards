'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Clause {
  id: string;
  name: string;
  description: string | null;
  primary_text: string;
  fallback_text: string | null;
  last_resort_text: string | null;
  risk_level: 'low' | 'medium' | 'high';
  usage_count: number;
  similarity_score?: number;
  category?: {
    id: string;
    name: string;
  };
}

interface ClauseSuggestionPanelProps {
  contractText: string;
  selectedText?: string;
  onInsertClause: (clauseText: string, clauseName: string) => void;
  onClose?: () => void;
}

export default function ClauseSuggestionPanel({
  contractText,
  selectedText,
  onInsertClause,
  onClose,
}: ClauseSuggestionPanelProps) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Clause[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedClause, setExpandedClause] = useState<string | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<'primary' | 'fallback' | 'last_resort'>('primary');

  // Search for similar clauses when text is selected
  useEffect(() => {
    if (selectedText && selectedText.length > 50) {
      searchSimilarClauses(selectedText);
    }
  }, [selectedText]);

  async function searchSimilarClauses(text: string) {
    setLoading(true);
    try {
      const response = await fetch('/api/clauses/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clause_text: text,
          limit: 5,
        }),
      });
      const data = await response.json();
      setSuggestions(data.clauses || []);
    } catch (error) {
      console.error('Failed to search clauses:', error);
    } finally {
      setLoading(false);
    }
  }

  async function searchByKeyword(query: string) {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/clauses/search?q=${encodeURIComponent(query)}&limit=10`);
      const data = await response.json();
      setSuggestions(data.clauses || []);
    } catch (error) {
      console.error('Failed to search clauses:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleInsert(clause: Clause) {
    const text = selectedPosition === 'primary' ? clause.primary_text
      : selectedPosition === 'fallback' ? clause.fallback_text
      : clause.last_resort_text;

    if (text) {
      onInsertClause(text, clause.name);
      // Track usage
      fetch(`/api/clauses/${clause.id}/use`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          used_position: selectedPosition,
        }),
      }).catch(console.error);
    }
  }

  const riskColors = {
    low: 'bg-green-500/10 text-green-400 border-green-500/20',
    medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    high: 'bg-red-500/10 text-red-400 border-red-500/20',
  };

  return (
    <div className="h-full flex flex-col bg-[#0F1722] border-l border-white/10">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Clause Library</h3>
          <p className="text-xs text-[#8FA3BF]">Insert approved language</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/5 rounded transition-colors"
          >
            <svg className="w-4 h-4 text-[#8FA3BF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Search */}
      <div className="px-4 py-3 border-b border-white/10">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              searchByKeyword(e.target.value);
            }}
            placeholder="Search clauses..."
            className="w-full pl-9 pr-3 py-2 bg-[#151F2E] border border-white/10 rounded-lg text-white text-sm placeholder-[#64748B] focus:outline-none focus:border-teal-500/50"
          />
        </div>
      </div>

      {/* Position Selector */}
      <div className="px-4 py-2 border-b border-white/10">
        <div className="flex gap-1">
          {(['primary', 'fallback', 'last_resort'] as const).map(pos => (
            <button
              key={pos}
              onClick={() => setSelectedPosition(pos)}
              className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
                selectedPosition === pos
                  ? 'bg-teal-500/20 text-teal-400'
                  : 'bg-white/5 text-[#8FA3BF] hover:bg-white/10'
              }`}
            >
              {pos === 'primary' ? 'Favorable' : pos === 'fallback' ? 'Fallback' : 'Last Resort'}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="px-4 py-8 text-center">
            <div className="w-6 h-6 border-2 border-teal-500/30 border-t-teal-500 rounded-full animate-spin mx-auto" />
            <p className="text-xs text-[#8FA3BF] mt-2">Searching...</p>
          </div>
        ) : suggestions.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <svg className="w-10 h-10 text-[#64748B] mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p className="text-xs text-[#8FA3BF]">
              {searchQuery || selectedText ? 'No matching clauses found' : 'Search or select text to find clauses'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            <AnimatePresence>
              {suggestions.map((clause, index) => (
                <motion.div
                  key={clause.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="px-4 py-3 hover:bg-white/5 transition-colors"
                >
                  {/* Clause Header */}
                  <div
                    className="cursor-pointer"
                    onClick={() => setExpandedClause(expandedClause === clause.id ? null : clause.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-white truncate">
                          {clause.name}
                        </h4>
                        {clause.category && (
                          <p className="text-xs text-[#64748B]">{clause.category.name}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded border ${riskColors[clause.risk_level]} capitalize`}>
                          {clause.risk_level}
                        </span>
                        <svg
                          className={`w-4 h-4 text-[#64748B] transition-transform ${expandedClause === clause.id ? 'rotate-180' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {clause.similarity_score !== undefined && (
                      <div className="mt-1 flex items-center gap-1">
                        <div className="h-1 flex-1 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-teal-500"
                            style={{ width: `${clause.similarity_score * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-[#64748B]">
                          {Math.round(clause.similarity_score * 100)}% match
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Expanded Content */}
                  <AnimatePresence>
                    {expandedClause === clause.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3 pt-3 border-t border-white/5">
                          {/* Description */}
                          {clause.description && (
                            <p className="text-xs text-[#8FA3BF] mb-3">
                              {clause.description}
                            </p>
                          )}

                          {/* Preview */}
                          <div className="bg-[#0B1220] rounded-lg p-3 mb-3">
                            <p className="text-xs text-white/80 line-clamp-4 font-mono">
                              {selectedPosition === 'primary' ? clause.primary_text
                                : selectedPosition === 'fallback' ? (clause.fallback_text || 'No fallback position defined')
                                : (clause.last_resort_text || 'No last resort position defined')}
                            </p>
                          </div>

                          {/* Insert Button */}
                          <button
                            onClick={() => handleInsert(clause)}
                            disabled={
                              (selectedPosition === 'fallback' && !clause.fallback_text) ||
                              (selectedPosition === 'last_resort' && !clause.last_resort_text)
                            }
                            className="w-full px-3 py-2 bg-teal-500 text-white text-xs font-medium rounded-lg hover:bg-teal-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Insert {selectedPosition === 'primary' ? 'Favorable' : selectedPosition === 'fallback' ? 'Fallback' : 'Last Resort'} Position
                          </button>

                          {/* Usage Stats */}
                          <p className="text-xs text-[#64748B] text-center mt-2">
                            Used {clause.usage_count} time{clause.usage_count !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-white/10 bg-[#0B1220]">
        <a
          href="/clauses"
          className="text-xs text-teal-400 hover:text-teal-300 transition-colors flex items-center justify-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Open Full Clause Library
        </a>
      </div>
    </div>
  );
}
