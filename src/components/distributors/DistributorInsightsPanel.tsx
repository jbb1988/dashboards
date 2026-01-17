'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CategoryBadgeList from './CategoryBadgeList';
import ActivityStatusBadge from './ActivityStatusBadge';

interface ProductContext {
  top_categories: Array<{
    name: string;
    revenue: number;
    percentage: number;
  }>;
  category_count: number;
  last_purchase_date: string;
  recent_activity: {
    days_since_purchase: number;
    transaction_count_30d: number;
    status: 'active' | 'warning' | 'inactive';
  };
  missing_categories?: Array<{
    name: string;
    peer_penetration_pct: number;
    estimated_opportunity: number;
  }>;
}

interface AIRecommendation {
  priority: 'high' | 'medium' | 'low';
  title: string;
  problem: string;
  recommendation: string;
  expected_impact: string;
  action_items: string[];
  category: 'attrisk' | 'growth' | 'categorygap' | 'expansion';
  distributor_name?: string;
  customer_id?: string;
  customer_name?: string;
  product_context?: ProductContext;
}

interface DistributorInsightsPanelProps {
  onGenerate: () => Promise<{ recommendations: AIRecommendation[]; executive_summary: string }>;
  onCreateTask?: (recommendation: AIRecommendation, actionItem?: string) => void;
  selectedYears: number[];
  selectedMonths: number[];
  selectedClass: string | null;
}

const PRIORITY_STYLES = {
  high: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    badge: 'bg-red-500/20 text-red-400',
    icon: 'text-red-400',
    glow: 'shadow-[0_0_20px_rgba(239,68,68,0.15)]',
  },
  medium: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    badge: 'bg-amber-500/20 text-amber-400',
    icon: 'text-amber-400',
    glow: 'shadow-[0_0_20px_rgba(245,158,11,0.15)]',
  },
  low: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    badge: 'bg-blue-500/20 text-blue-400',
    icon: 'text-blue-400',
    glow: 'shadow-[0_0_20px_rgba(59,130,246,0.15)]',
  },
};

const CATEGORY_CONFIG = {
  attrisk: {
    label: 'At Risk',
    color: '#EF4444',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
  growth: {
    label: 'Growth',
    color: '#14B8A6',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
  categorygap: {
    label: 'Category Gap',
    color: '#8B5CF6',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>
    ),
  },
  expansion: {
    label: 'Expansion',
    color: '#06B6D4',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
};

export function DistributorInsightsPanel({
  onGenerate,
  onCreateTask,
  selectedYears,
  selectedMonths,
  selectedClass,
}: DistributorInsightsPanelProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [executiveSummary, setExecutiveSummary] = useState<string>('');
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const [tasksCreated, setTasksCreated] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string>('');

  const handleGenerate = async () => {
    setState('loading');
    setError('');
    setRecommendations([]);
    setExecutiveSummary('');

    try {
      const result = await onGenerate();
      setRecommendations(result.recommendations);
      setExecutiveSummary(result.executive_summary);
      setState('loaded');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate insights');
      setState('error');
    }
  };

  const toggleCard = (index: number) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedCards(newExpanded);
  };

  // Group recommendations by category
  const groupedRecs = recommendations.reduce((acc, rec, idx) => {
    if (!acc[rec.category]) acc[rec.category] = [];
    acc[rec.category].push({ rec, idx });
    return acc;
  }, {} as Record<string, { rec: AIRecommendation; idx: number }[]>);

  return (
    <div className="space-y-6">
      {/* Header with Generate Button */}
      {state === 'idle' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-12"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#14B8A6]/10 border border-[#14B8A6]/30 mb-4">
            <svg className="w-8 h-8 text-[#14B8A6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">
            AI-Powered Distributor Insights
          </h3>
          <p className="text-[#94A3B8] text-[14px] mb-6 max-w-md mx-auto">
            Analyze distributor data to identify at-risk locations, growth opportunities, and category gaps
          </p>
          <button
            onClick={handleGenerate}
            className="px-6 py-3 rounded-lg bg-gradient-to-r from-[#14B8A6] to-[#06B6D4] text-white font-medium hover:shadow-[0_0_30px_rgba(20,184,166,0.3)] transition-all"
          >
            Generate Insights
          </button>
        </motion.div>
      )}

      {/* Loading State */}
      {state === 'loading' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#14B8A6]/10 border border-[#14B8A6]/30 mb-4 animate-pulse">
            <svg className="w-8 h-8 text-[#14B8A6] animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">
            Analyzing Distributor Data...
          </h3>
          <p className="text-[#94A3B8] text-[14px]">
            Identifying at-risk locations, growth opportunities, and category gaps
          </p>
        </motion.div>
      )}

      {/* Error State */}
      {state === 'error' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">
            Failed to Generate Insights
          </h3>
          <p className="text-[#94A3B8] text-[14px] mb-6">
            {error}
          </p>
          <button
            onClick={handleGenerate}
            className="px-6 py-3 rounded-lg bg-[#1E293B] text-white font-medium hover:bg-[#334155] transition-colors"
          >
            Try Again
          </button>
        </motion.div>
      )}

      {/* Loaded State - Show Insights */}
      {state === 'loaded' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6"
        >
          {/* Executive Summary */}
          {executiveSummary && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl bg-gradient-to-br from-[#14B8A6]/10 to-[#06B6D4]/10 border border-[#14B8A6]/30 p-6"
            >
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-[#14B8A6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Executive Summary
              </h3>
              <p className="text-[#94A3B8] text-[14px] leading-relaxed whitespace-pre-wrap">
                {executiveSummary}
              </p>
            </motion.div>
          )}

          {/* Action Bar */}
          {recommendations.length > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-[14px] text-[#94A3B8]">
                  {recommendations.length} insight{recommendations.length !== 1 ? 's' : ''} found
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleGenerate}
                  className="px-4 py-2 rounded-lg text-[13px] font-medium text-[#94A3B8] bg-[#1E293B] hover:bg-[#334155] transition-colors"
                >
                  Refresh Insights
                </button>
              </div>
            </div>
          )}

          {/* Insights by Category */}
          {Object.entries(groupedRecs).map(([category, items]) => {
            const config = CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG];

            return (
              <div key={category}>
                <h4 className="text-[15px] font-semibold text-white mb-3 flex items-center gap-2">
                  <span style={{ color: config.color }}>{config.icon}</span>
                  {config.label} Insights ({items.length})
                </h4>

                <div className="space-y-3">
                  {items.map(({ rec, idx }) => {
                    const isExpanded = expandedCards.has(idx);
                    const taskCreated = tasksCreated.has(idx);
                    const styles = PRIORITY_STYLES[rec.priority];

                    return (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className={`rounded-xl border ${styles.border} ${styles.bg} overflow-hidden`}
                      >
                        {/* Card Header */}
                        <div className="p-4">
                          <div className="flex items-start gap-3">
                            <div
                              className="flex-1 min-w-0 cursor-pointer"
                              onClick={() => toggleCard(idx)}
                            >
                              <div className="flex items-start justify-between gap-3 mb-2">
                                <h5 className="text-[14px] font-semibold text-white flex-1">
                                  {rec.title}
                                </h5>
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${styles.badge}`}>
                                    {rec.priority.toUpperCase()}
                                  </span>
                                  <svg
                                    className={`w-4 h-4 text-[#64748B] transition-transform ${
                                      isExpanded ? 'rotate-180' : ''
                                    }`}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </div>
                              </div>

                              {rec.distributor_name && (
                                <div className="text-[12px] text-[#64748B] mb-2">
                                  {rec.distributor_name}{rec.customer_name ? ` > ${rec.customer_name}` : ''}
                                </div>
                              )}

                              <p className="text-[13px] text-[#94A3B8] line-clamp-2">
                                {rec.problem}
                              </p>
                            </div>

                            {/* Add Task Button */}
                            {onCreateTask && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onCreateTask(rec);
                                  setTasksCreated(prev => new Set(prev).add(idx));
                                }}
                                disabled={taskCreated}
                                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                                  taskCreated
                                    ? 'bg-green-500/20 text-green-300 border border-green-500/30 cursor-not-allowed'
                                    : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30'
                                }`}
                              >
                                {taskCreated ? (
                                  <span className="flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    Task Created
                                  </span>
                                ) : (
                                  'Add Task'
                                )}
                              </button>
                            )}
                          </div>

                          {/* Product Context */}
                          {rec.product_context && (
                            <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-2">
                              {/* Category Badges */}
                              {rec.product_context.top_categories.length > 0 && (
                                <CategoryBadgeList categories={rec.product_context.top_categories} />
                              )}

                              {/* Activity Status & Stats */}
                              <div className="flex items-center gap-3 text-[11px]">
                                <ActivityStatusBadge
                                  status={rec.product_context.recent_activity.status}
                                  daysSincePurchase={rec.product_context.recent_activity.days_since_purchase}
                                  transactionCount30d={rec.product_context.recent_activity.transaction_count_30d}
                                />
                                <span className="text-[#64748B]">
                                  {rec.product_context.category_count} categories
                                </span>
                                <span className="text-[#64748B]">•</span>
                                <span className="text-[#64748B]">
                                  Last order: {new Date(rec.product_context.last_purchase_date).toLocaleDateString()}
                                </span>
                              </div>

                              {/* Missing Categories (if applicable) */}
                              {rec.product_context.missing_categories && rec.product_context.missing_categories.length > 0 && (
                                <div className="mt-2 p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
                                  <div className="text-[10px] font-semibold text-amber-300 uppercase tracking-wider mb-1">
                                    Expansion Opportunity
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {rec.product_context.missing_categories.slice(0, 3).map((cat, idx) => (
                                      <span
                                        key={idx}
                                        className="text-[10px] text-[#94A3B8]"
                                        title={`${cat.peer_penetration_pct}% of peers buy this • Est. $${cat.estimated_opportunity.toLocaleString()} opportunity`}
                                      >
                                        {cat.name}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Expanded Content */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="border-t border-white/[0.06]"
                            >
                              <div className="p-4 space-y-4">
                                {/* Recommendation */}
                                <div>
                                  <h6 className="text-[12px] font-semibold text-[#14B8A6] uppercase tracking-wider mb-2">
                                    Recommendation
                                  </h6>
                                  <p className="text-[13px] text-[#94A3B8]">
                                    {rec.recommendation}
                                  </p>
                                </div>

                                {/* Expected Impact */}
                                <div>
                                  <h6 className="text-[12px] font-semibold text-[#14B8A6] uppercase tracking-wider mb-2">
                                    Expected Impact
                                  </h6>
                                  <p className="text-[13px] text-[#94A3B8]">
                                    {rec.expected_impact}
                                  </p>
                                </div>

                                {/* Action Items */}
                                {rec.action_items && rec.action_items.length > 0 && (
                                  <div>
                                    <h6 className="text-[12px] font-semibold text-[#14B8A6] uppercase tracking-wider mb-2">
                                      Action Items
                                    </h6>
                                    <ul className="space-y-1.5">
                                      {rec.action_items.map((item, i) => (
                                        <li key={i} className="flex items-start gap-2 text-[13px] text-[#94A3B8]">
                                          <svg className="w-4 h-4 text-[#14B8A6] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                          </svg>
                                          <span>{item}</span>
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
              </div>
            );
          })}

          {/* Empty State */}
          {recommendations.length === 0 && (
            <div className="text-center py-12 text-[#64748B]">
              <p className="text-[14px]">No insights generated</p>
              <p className="text-[12px] mt-1">Try adjusting your filters or syncing more data</p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
