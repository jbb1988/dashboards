'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AIRecommendation {
  priority: 'high' | 'medium' | 'low';
  title: string;
  problem: string;
  recommendation: string;
  expected_impact: string;
  action_items: string[];
  category: 'attrition' | 'growth' | 'crosssell' | 'concentration' | 'general';
}

interface AIInsightsPanelV2Props {
  onGenerate: () => Promise<{ recommendations: AIRecommendation[]; executive_summary: string }>;
  initialState?: 'idle' | 'loading' | 'loaded';
}

const PRIORITY_STYLES = {
  high: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    badge: 'bg-red-500/20 text-red-400',
    icon: 'text-red-400',
  },
  medium: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    badge: 'bg-amber-500/20 text-amber-400',
    icon: 'text-amber-400',
  },
  low: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    badge: 'bg-blue-500/20 text-blue-400',
    icon: 'text-blue-400',
  },
};

const CATEGORY_ICONS: Record<string, JSX.Element> = {
  attrition: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  growth: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
  crosssell: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  concentration: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
    </svg>
  ),
  general: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
};

export function AIInsightsPanelV2({ onGenerate, initialState = 'idle' }: AIInsightsPanelV2Props) {
  const [state, setState] = useState<'idle' | 'loading' | 'loaded' | 'error'>(initialState);
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [executiveSummary, setExecutiveSummary] = useState<string>('');
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string>('');

  const handleGenerate = async () => {
    setState('loading');
    setError('');

    try {
      const result = await onGenerate();
      setRecommendations(result.recommendations);
      setExecutiveSummary(result.executive_summary);
      setState('loaded');
      // Auto-expand high priority items
      const highPriorityIndices = result.recommendations
        .map((r, i) => r.priority === 'high' ? i : -1)
        .filter(i => i >= 0);
      setExpandedCards(new Set(highPriorityIndices));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate insights');
      setState('error');
    }
  };

  const toggleCard = (index: number) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-[#0F1123]/80 rounded-2xl p-6 border border-white/[0.08] shadow-lg shadow-purple-500/5 backdrop-blur-sm"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold flex items-center gap-2">
            <span className="text-purple-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </span>
            AI-Powered Insights
          </h3>
          <p className="text-[#64748B] text-[12px] mt-0.5">
            Powered by Claude • On-demand analysis
          </p>
        </div>

        {state === 'loaded' && (
          <button
            onClick={handleGenerate}
            className="text-[12px] text-[#64748B] hover:text-white transition-colors flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        )}
      </div>

      {/* Idle State */}
      {state === 'idle' && (
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-500/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <p className="text-[#94A3B8] mb-4 text-sm">
            Get AI-powered recommendations for customer retention,<br />
            growth opportunities, and risk mitigation.
          </p>
          <button
            onClick={handleGenerate}
            className="px-6 py-2.5 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2 mx-auto"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Generate Insights
          </button>
        </div>
      )}

      {/* Loading State */}
      {state === 'loading' && (
        <div className="text-center py-12">
          <div className="w-12 h-12 mx-auto mb-4 relative">
            <div className="absolute inset-0 rounded-full border-2 border-purple-500/20"></div>
            <div className="absolute inset-0 rounded-full border-2 border-purple-500 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-[#94A3B8] text-sm">Analyzing sales data...</p>
          <p className="text-[#64748B] text-[11px] mt-1">This may take 10-20 seconds</p>
        </div>
      )}

      {/* Error State */}
      {state === 'error' && (
        <div className="text-center py-8">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
            <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-red-400 mb-2 text-sm">Failed to generate insights</p>
          <p className="text-[#64748B] text-[12px] mb-4">{error}</p>
          <button
            onClick={handleGenerate}
            className="px-4 py-2 bg-white/[0.05] hover:bg-white/[0.1] text-white rounded-lg text-sm transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Loaded State */}
      {state === 'loaded' && (
        <div className="space-y-4">
          {/* Executive Summary */}
          {executiveSummary && (
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="text-purple-400 mt-0.5">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-white font-medium text-sm mb-1">Executive Summary</h4>
                  <p className="text-[#94A3B8] text-[13px] leading-relaxed">{executiveSummary}</p>
                </div>
              </div>
            </div>
          )}

          {/* Recommendation Cards */}
          <div className="space-y-3">
            {recommendations.map((rec, idx) => {
              const styles = PRIORITY_STYLES[rec.priority];
              const isExpanded = expandedCards.has(idx);

              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.1 }}
                  className="bg-[#151F2E] border border-white/[0.06] rounded-xl overflow-hidden"
                >
                  {/* Card Header - Always visible */}
                  <button
                    onClick={() => toggleCard(idx)}
                    className="w-full px-4 py-3 flex items-start gap-3 text-left hover:bg-white/[0.02] transition-colors"
                  >
                    <div className={`${styles.icon} mt-0.5`}>
                      {CATEGORY_ICONS[rec.category] || CATEGORY_ICONS.general}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-medium uppercase px-1.5 py-0.5 rounded ${styles.badge}`}>
                          {rec.priority}
                        </span>
                        <span className="text-[10px] text-[#64748B] uppercase">
                          {rec.category}
                        </span>
                      </div>
                      <h4 className="text-white font-medium text-sm truncate">{rec.title}</h4>
                    </div>
                    <svg
                      className={`w-4 h-4 text-[#64748B] transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Card Body - Expandable */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="px-4 pb-4"
                      >
                        <div className="pt-2 border-t border-white/[0.05] space-y-3">
                          {/* Problem */}
                          <div>
                            <h5 className="text-[10px] text-[#64748B] uppercase tracking-wide mb-1">Problem</h5>
                            <p className="text-[13px] text-[#94A3B8]">{rec.problem}</p>
                          </div>

                          {/* Recommendation */}
                          <div>
                            <h5 className="text-[10px] text-[#64748B] uppercase tracking-wide mb-1">Recommendation</h5>
                            <p className="text-[13px] text-white">{rec.recommendation}</p>
                          </div>

                          {/* Expected Impact */}
                          <div className="bg-white/[0.03] rounded-lg px-3 py-2">
                            <span className="text-[11px] text-[#64748B]">Expected Impact: </span>
                            <span className="text-[11px] text-green-400 font-medium">{rec.expected_impact}</span>
                          </div>

                          {/* Action Items */}
                          {rec.action_items.length > 0 && (
                            <div>
                              <h5 className="text-[10px] text-[#64748B] uppercase tracking-wide mb-2">Action Items</h5>
                              <ul className="space-y-1.5">
                                {rec.action_items.map((item, i) => (
                                  <li key={i} className="flex items-start gap-2 text-[12px]">
                                    <span className="text-cyan-400 mt-0.5">
                                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                      </svg>
                                    </span>
                                    <span className="text-[#94A3B8]">{item}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>

          {recommendations.length === 0 && (
            <div className="text-center py-6 text-[#64748B]">
              No recommendations generated. Try refreshing or adjusting filters.
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
