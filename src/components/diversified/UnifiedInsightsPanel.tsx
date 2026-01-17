'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface AIRecommendation {
  priority: 'high' | 'medium' | 'low';
  title: string;
  problem: string;
  recommendation: string;
  expected_impact: string;
  action_items: string[];
  category: 'attrition' | 'growth' | 'crosssell' | 'concentration' | 'general';
  customer_segment?: string;
}

export interface SavedInsight {
  id: string;
  generated_at: string;
  created_at: string;
  executive_summary: string;
  recommendations?: AIRecommendation[];
}

interface UnifiedInsightsPanelProps {
  onGenerate: () => Promise<{ recommendations: AIRecommendation[]; executive_summary: string }>;
  onCreateTask: (recommendation: AIRecommendation, actionItem?: string) => void;
  onViewFullAnalysis: () => void;
  initialRecommendations?: AIRecommendation[];
  initialExecutiveSummary?: string;
  initialGeneratedAt?: string;
  insightsHistory?: SavedInsight[];
  onLoadHistoricalInsight?: (id: string) => void;
}

const PRIORITY_STYLES = {
  high: {
    badge: 'bg-red-500/20 text-red-400 border-red-500/30',
    dot: 'bg-red-400',
  },
  medium: {
    badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    dot: 'bg-amber-400',
  },
  low: {
    badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    dot: 'bg-blue-400',
  },
};

const CATEGORY_STYLES = {
  attrition: {
    badge: 'bg-red-500/20 text-red-400 border-red-500/30',
    label: 'Attrition Risk',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
  growth: {
    badge: 'bg-green-500/20 text-green-400 border-green-500/30',
    label: 'Growth Opportunity',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
  crosssell: {
    badge: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    label: 'Cross-Sell',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  concentration: {
    badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    label: 'Concentration',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
      </svg>
    ),
  },
  general: {
    badge: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    label: 'General',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
};

const SEGMENT_STYLES: Record<string, { badge: string; label: string }> = {
  steady_repeater: { badge: 'bg-green-500/20 text-green-400 border-green-500/30', label: 'Steady Repeater' },
  diverse_buyer: { badge: 'bg-purple-500/20 text-purple-400 border-purple-500/30', label: 'Diverse Buyer' },
  project_buyer: { badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30', label: 'Project Buyer' },
  seasonal: { badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30', label: 'Seasonal' },
  new_account: { badge: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', label: 'New Account' },
  irregular: { badge: 'bg-gray-500/20 text-gray-400 border-gray-500/30', label: 'Irregular' },
};

type FilterTab = 'quick-wins' | 'all' | 'attrition' | 'growth' | 'crosssell';

export function UnifiedInsightsPanel({
  onGenerate,
  onCreateTask,
  onViewFullAnalysis,
  initialRecommendations = [],
  initialExecutiveSummary = '',
  initialGeneratedAt,
  insightsHistory = [],
  onLoadHistoricalInsight,
}: UnifiedInsightsPanelProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'loaded' | 'error'>(
    initialRecommendations.length > 0 ? 'loaded' : 'idle'
  );
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>(initialRecommendations);
  const [executiveSummary, setExecutiveSummary] = useState<string>(initialExecutiveSummary);
  const [generatedAt, setGeneratedAt] = useState<string | undefined>(initialGeneratedAt);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('quick-wins');
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);
  const [error, setError] = useState<string>('');
  const [tasksCreated, setTasksCreated] = useState<Set<number>>(new Set()); // Track which insights have tasks

  // Update state when props change
  useEffect(() => {
    if (initialRecommendations.length > 0) {
      setRecommendations(initialRecommendations);
      setExecutiveSummary(initialExecutiveSummary);
      setGeneratedAt(initialGeneratedAt);
      setState('loaded');
      setTasksCreated(new Set()); // Reset task tracking when loading new insights
    }
  }, [initialRecommendations, initialExecutiveSummary, initialGeneratedAt]);

  const handleGenerate = async () => {
    setState('loading');
    setError('');

    try {
      const result = await onGenerate();
      setRecommendations(result.recommendations);
      setExecutiveSummary(result.executive_summary);
      setGeneratedAt(new Date().toISOString());
      setState('loaded');
      setTasksCreated(new Set()); // Reset task tracking when generating new insights

      // Auto-select quick-wins if any exist
      const hasQuickWins = result.recommendations.some(r => r.priority === 'high');
      if (hasQuickWins) {
        setActiveFilter('quick-wins');
      } else {
        setActiveFilter('all');
      }
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

  // Filter recommendations based on active tab
  const filteredRecommendations = recommendations.filter(r => {
    if (activeFilter === 'quick-wins') return r.priority === 'high';
    if (activeFilter === 'all') return true;
    return r.category === activeFilter;
  });

  // Calculate stats
  const stats = {
    total: recommendations.length,
    highPriority: recommendations.filter(r => r.priority === 'high').length,
    potentialImpact: recommendations.reduce((sum, r) => {
      const match = r.expected_impact.match(/\$[\d,]+/);
      if (match) {
        const value = parseInt(match[0].replace(/[$,]/g, ''));
        return sum + value;
      }
      return sum;
    }, 0),
  };

  // Empty State
  if (state === 'idle') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-gradient-to-br from-purple-500/10 to-cyan-500/10 rounded-2xl p-12 border border-purple-500/20 text-center"
      >
        <div className="max-w-2xl mx-auto">
          <div className="w-16 h-16 mx-auto mb-6 bg-purple-500/20 rounded-2xl flex items-center justify-center">
            <svg className="w-8 h-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>

          <h3 className="text-2xl font-bold text-white mb-3">AI-Powered Sales Insights</h3>
          <p className="text-[#94A3B8] text-[15px] mb-8 leading-relaxed">
            Get actionable recommendations for customer retention, growth opportunities, and risk mitigation based on advanced analysis of your sales data
          </p>

          <button
            onClick={handleGenerate}
            className="px-8 py-4 bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40"
          >
            Generate AI-Powered Insights
          </button>

          <p className="text-[#64748B] text-[13px] mt-4">
            Analysis typically takes 10-20 seconds
          </p>
        </div>
      </motion.div>
    );
  }

  // Loading State
  if (state === 'loading') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-[#0F1123]/80 rounded-2xl p-12 border border-white/[0.08] text-center"
      >
        <div className="max-w-2xl mx-auto">
          {/* Animated Spinner */}
          <div className="w-16 h-16 mx-auto mb-6 relative">
            <motion.div
              className="absolute inset-0 border-4 border-purple-500/20 rounded-full"
            />
            <motion.div
              className="absolute inset-0 border-4 border-transparent border-t-purple-500 rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
          </div>

          <h3 className="text-xl font-semibold text-white mb-3">Analyzing Sales Data</h3>
          <p className="text-[#94A3B8] text-[14px] mb-2">
            Computing attrition scores, cross-sell opportunities, and concentration metrics
          </p>
          <p className="text-[#64748B] text-[13px]">
            This may take 10-20 seconds
          </p>
        </div>
      </motion.div>
    );
  }

  // Error State
  if (state === 'error') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-red-500/10 rounded-2xl p-12 border border-red-500/20 text-center"
      >
        <div className="max-w-2xl mx-auto">
          <div className="w-16 h-16 mx-auto mb-6 bg-red-500/20 rounded-2xl flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <h3 className="text-xl font-semibold text-white mb-3">Failed to Generate Insights</h3>
          <p className="text-[#94A3B8] text-[14px] mb-8">{error}</p>

          <button
            onClick={handleGenerate}
            className="px-6 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 font-medium rounded-xl transition-all"
          >
            Retry
          </button>
        </div>
      </motion.div>
    );
  }

  // Loaded State
  return (
    <div className="space-y-6">
      {/* Executive Summary Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-gradient-to-br from-purple-500/10 to-cyan-500/10 rounded-2xl p-6 border border-purple-500/20"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-white font-semibold text-[15px]">Executive Summary</h3>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[#64748B] text-[12px]">
                  {stats.total} recommendations
                </span>
                <span className="text-[#64748B]">•</span>
                <span className="text-amber-400 text-[12px]">
                  {stats.highPriority} high-priority
                </span>
                {stats.potentialImpact > 0 && (
                  <>
                    <span className="text-[#64748B]">•</span>
                    <span className="text-green-400 text-[12px]">
                      ${stats.potentialImpact.toLocaleString()} potential impact
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* History Dropdown */}
          {insightsHistory && insightsHistory.length > 1 && onLoadHistoricalInsight && (
            <div className="relative">
              <button
                onClick={() => setShowHistoryDropdown(!showHistoryDropdown)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[12px] text-[#94A3B8] hover:text-white transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                History ({insightsHistory.length})
                <svg className={`w-3 h-3 transition-transform ${showHistoryDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showHistoryDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowHistoryDropdown(false)}
                  />
                  <div className="absolute right-0 mt-2 w-80 bg-[#1E293B] border border-white/10 rounded-xl shadow-2xl z-20 overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/10">
                      <span className="text-[11px] text-[#64748B] uppercase tracking-wider font-semibold">
                        Previous Insights
                      </span>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {insightsHistory.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => {
                            onLoadHistoricalInsight(item.id);
                            setShowHistoryDropdown(false);
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-white/5 transition-colors border-b border-white/[0.04] last:border-b-0"
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[13px] text-white font-medium">
                              {new Date(item.generated_at || item.created_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </span>
                            <span className="text-[11px] text-[#64748B]">
                              {new Date(item.generated_at || item.created_at).toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                          <p className="text-[12px] text-[#94A3B8] line-clamp-2">
                            {item.executive_summary.slice(0, 120)}...
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <p className="text-[#E2E8F0] text-[14px] leading-relaxed">
          {executiveSummary}
        </p>
      </motion.div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setActiveFilter('quick-wins')}
          className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${
            activeFilter === 'quick-wins'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : 'bg-white/5 text-[#94A3B8] border border-white/10 hover:bg-white/10'
          }`}
        >
          Quick Wins
          {recommendations.filter(r => r.priority === 'high').length > 0 && (
            <span className="ml-2 text-[11px] opacity-70">
              ({recommendations.filter(r => r.priority === 'high').length})
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveFilter('all')}
          className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${
            activeFilter === 'all'
              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
              : 'bg-white/5 text-[#94A3B8] border border-white/10 hover:bg-white/10'
          }`}
        >
          All Insights ({recommendations.length})
        </button>
        <button
          onClick={() => setActiveFilter('attrition')}
          className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${
            activeFilter === 'attrition'
              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
              : 'bg-white/5 text-[#94A3B8] border border-white/10 hover:bg-white/10'
          }`}
        >
          Attrition
          {recommendations.filter(r => r.category === 'attrition').length > 0 && (
            <span className="ml-2 text-[11px] opacity-70">
              ({recommendations.filter(r => r.category === 'attrition').length})
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveFilter('growth')}
          className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${
            activeFilter === 'growth'
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-white/5 text-[#94A3B8] border border-white/10 hover:bg-white/10'
          }`}
        >
          Growth
          {recommendations.filter(r => r.category === 'growth').length > 0 && (
            <span className="ml-2 text-[11px] opacity-70">
              ({recommendations.filter(r => r.category === 'growth').length})
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveFilter('crosssell')}
          className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${
            activeFilter === 'crosssell'
              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
              : 'bg-white/5 text-[#94A3B8] border border-white/10 hover:bg-white/10'
          }`}
        >
          Cross-Sell
          {recommendations.filter(r => r.category === 'crosssell').length > 0 && (
            <span className="ml-2 text-[11px] opacity-70">
              ({recommendations.filter(r => r.category === 'crosssell').length})
            </span>
          )}
        </button>
      </div>

      {/* Insight Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AnimatePresence mode="sync">
          {filteredRecommendations.map((rec, index) => {
            const isExpanded = expandedCards.has(index);
            const categoryStyle = CATEGORY_STYLES[rec.category];
            const priorityStyle = PRIORITY_STYLES[rec.priority];

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="bg-[#0F1123]/80 rounded-xl p-5 border border-white/[0.08] hover:border-purple-500/30 transition-all"
              >
                {/* Header with badges */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-1 rounded-md text-[11px] font-medium border ${priorityStyle.badge}`}>
                      {rec.priority.toUpperCase()}
                    </span>
                    <span className={`px-2 py-1 rounded-md text-[11px] font-medium border flex items-center gap-1 ${categoryStyle.badge}`}>
                      {categoryStyle.icon}
                      {categoryStyle.label}
                    </span>
                    {rec.customer_segment && SEGMENT_STYLES[rec.customer_segment] && (
                      <span className={`px-2 py-1 rounded-md text-[11px] font-medium border ${SEGMENT_STYLES[rec.customer_segment].badge}`}>
                        {SEGMENT_STYLES[rec.customer_segment].label}
                      </span>
                    )}
                  </div>
                </div>

                {/* Title */}
                <h4 className="text-white font-semibold text-[14px] mb-2 leading-snug">
                  {rec.title}
                </h4>

                {/* Problem (collapsible) */}
                <div className="mb-3">
                  <button
                    onClick={() => toggleCard(index)}
                    className="text-[#94A3B8] text-[12px] hover:text-white transition-colors flex items-center gap-1"
                  >
                    <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    Problem
                  </button>
                  {isExpanded && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-[#94A3B8] text-[12px] mt-1 leading-relaxed"
                    >
                      {rec.problem}
                    </motion.p>
                  )}
                </div>

                {/* Recommendation */}
                <p className="text-[#E2E8F0] text-[13px] mb-3 leading-relaxed">
                  {rec.recommendation}
                </p>

                {/* Expected Impact */}
                <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <span className="text-[11px] text-green-400/70 uppercase tracking-wider font-semibold block mb-1">
                    Expected Impact
                  </span>
                  <span className="text-green-400 text-[13px] font-medium">
                    {rec.expected_impact}
                  </span>
                </div>

                {/* Action Items (collapsible) */}
                {rec.action_items.length > 0 && (
                  <div className="mb-4">
                    <button
                      onClick={() => toggleCard(index)}
                      className="text-[#94A3B8] text-[12px] hover:text-white transition-colors flex items-center gap-1 mb-2"
                    >
                      <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      Action Items ({rec.action_items.length})
                    </button>
                    {isExpanded && (
                      <motion.ul
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-1.5"
                      >
                        {rec.action_items.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-[#94A3B8] text-[12px]">
                            <svg className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span>{item}</span>
                          </li>
                        ))}
                      </motion.ul>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      onCreateTask(rec);
                      // Mark this insight as having a task created
                      setTasksCreated(prev => {
                        const next = new Set(prev);
                        next.add(index);
                        return next;
                      });
                    }}
                    className={`flex-1 px-4 py-2.5 text-white text-[13px] font-medium rounded-lg transition-all flex items-center justify-center gap-2 ${
                      tasksCreated.has(index)
                        ? 'bg-green-500/20 border border-green-500/30 text-green-400 cursor-default'
                        : 'bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40'
                    }`}
                    disabled={tasksCreated.has(index)}
                  >
                    {tasksCreated.has(index) ? (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Added
                      </>
                    ) : (
                      'Add Task'
                    )}
                  </button>
                  <button
                    onClick={() => toggleCard(index)}
                    className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-[#94A3B8] text-[13px] font-medium rounded-lg transition-all"
                  >
                    {isExpanded ? 'Collapse' : 'Expand'}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Bottom Actions Bar */}
      <div className="flex items-center justify-between pt-4 border-t border-white/[0.08]">
        <button
          onClick={onViewFullAnalysis}
          className="flex items-center gap-2 px-5 py-3 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-xl text-purple-400 font-medium text-[13px] transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          View Full Analysis & Action Plan
        </button>

        <div className="flex items-center gap-4">
          {generatedAt && (
            <div className="flex items-center gap-2 text-[12px] text-[#64748B]">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>
                Generated {new Date(generatedAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit'
                })}
              </span>
            </div>
          )}

          <button
            onClick={handleGenerate}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[#94A3B8] hover:text-white text-[12px] font-medium transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Regenerate
          </button>
        </div>
      </div>
    </div>
  );
}
