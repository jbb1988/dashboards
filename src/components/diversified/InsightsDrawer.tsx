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

interface InsightsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  recommendations: AIRecommendation[];
  executiveSummary: string;
  onAddToTasks?: (item: string, recommendation: AIRecommendation) => void;
}

const PRIORITY_STYLES = {
  high: {
    badge: 'bg-red-500/20 text-red-400 border-red-500/30',
    dot: 'bg-red-400',
    icon: 'text-red-400',
  },
  medium: {
    badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    dot: 'bg-amber-400',
    icon: 'text-amber-400',
  },
  low: {
    badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    dot: 'bg-blue-400',
    icon: 'text-blue-400',
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  attrition: 'Attrition Risk',
  growth: 'Growth Opportunity',
  crosssell: 'Cross-Sell',
  concentration: 'Concentration',
  general: 'General',
};

type TabType = 'all' | 'executive' | 'action-plan';

export default function InsightsDrawer({
  isOpen,
  onClose,
  recommendations,
  executiveSummary,
  onAddToTasks,
}: InsightsDrawerProps) {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [expandedInsights, setExpandedInsights] = useState<Set<number>>(new Set([0]));

  const toggleInsight = (index: number) => {
    setExpandedInsights(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const [downloadingPDF, setDownloadingPDF] = useState(false);

  const handleDownloadPDF = async () => {
    setDownloadingPDF(true);
    try {
      const response = await fetch('/api/diversified/insights/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: activeTab === 'executive' ? 'executive' : activeTab === 'action-plan' ? 'action-plan' : 'executive',
          recommendations,
          executive_summary: executiveSummary,
          generated_at: new Date().toLocaleDateString(),
        }),
      });

      if (!response.ok) throw new Error('Failed to generate PDF');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeTab === 'action-plan' ? '30-Day-Action-Plan' : 'Executive-Summary'}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      console.error('Error downloading PDF:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setDownloadingPDF(false);
    }
  };

  // Group by priority for stats
  const highPriority = recommendations.filter(r => r.priority === 'high');
  const mediumPriority = recommendations.filter(r => r.priority === 'medium');
  const lowPriority = recommendations.filter(r => r.priority === 'low');

  // Calculate total revenue at risk (from expected impact strings)
  const totalRevenueAtRisk = recommendations.reduce((sum, rec) => {
    const match = rec.expected_impact.match(/\$([0-9,.]+)([KMB])?/i);
    if (match) {
      let value = parseFloat(match[1].replace(/,/g, ''));
      const multiplier = match[2]?.toUpperCase();
      if (multiplier === 'K') value *= 1000;
      if (multiplier === 'M') value *= 1000000;
      if (multiplier === 'B') value *= 1000000000;
      return sum + value;
    }
    return sum;
  }, 0);

  // Generate 30-day action plan
  const generateActionPlan = () => {
    const week1: { action: string; priority: string; rec: AIRecommendation }[] = [];
    const week2_3: { action: string; priority: string; rec: AIRecommendation }[] = [];
    const week4: { action: string; priority: string; rec: AIRecommendation }[] = [];

    recommendations.forEach(rec => {
      rec.action_items.forEach((action, idx) => {
        const item = { action, priority: rec.priority, rec };
        if (rec.priority === 'high' || idx === 0) {
          week1.push(item);
        } else if (rec.priority === 'medium') {
          week2_3.push(item);
        } else {
          week4.push(item);
        }
      });
    });

    return { week1, week2_3, week4 };
  };

  const actionPlan = generateActionPlan();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-40"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-[560px] bg-[#151F2E] border-l border-white/[0.06] shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex-shrink-0 sticky top-0 bg-[#151F2E] border-b border-white/[0.06] z-10">
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-[18px] font-semibold text-white flex items-center gap-2">
                      <span className="text-purple-400">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      </span>
                      AI-Powered Insights
                    </h2>
                    <p className="text-[12px] text-[#64748B] mt-1">
                      {recommendations.length} recommendations • Powered by Claude
                    </p>
                  </div>

                  <button
                    onClick={onClose}
                    className="p-2 rounded-lg hover:bg-white/5 text-[#64748B] hover:text-white transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Tab Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab('all')}
                    className={`px-3 py-1.5 text-[12px] font-medium rounded-lg transition-colors ${
                      activeTab === 'all'
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        : 'text-[#64748B] hover:text-white hover:bg-white/5'
                    }`}
                  >
                    All Insights
                  </button>
                  <button
                    onClick={() => setActiveTab('executive')}
                    className={`px-3 py-1.5 text-[12px] font-medium rounded-lg transition-colors ${
                      activeTab === 'executive'
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        : 'text-[#64748B] hover:text-white hover:bg-white/5'
                    }`}
                  >
                    Executive Summary
                  </button>
                  <button
                    onClick={() => setActiveTab('action-plan')}
                    className={`px-3 py-1.5 text-[12px] font-medium rounded-lg transition-colors ${
                      activeTab === 'action-plan'
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        : 'text-[#64748B] hover:text-white hover:bg-white/5'
                    }`}
                  >
                    30-Day Action Plan
                  </button>
                </div>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-5 space-y-4">
                {/* All Insights Tab */}
                {activeTab === 'all' && (
                  <>
                    {/* Priority Summary */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-red-400">{highPriority.length}</div>
                        <div className="text-[10px] text-red-400/70 uppercase tracking-wider">High Priority</div>
                      </div>
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-amber-400">{mediumPriority.length}</div>
                        <div className="text-[10px] text-amber-400/70 uppercase tracking-wider">Medium</div>
                      </div>
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-blue-400">{lowPriority.length}</div>
                        <div className="text-[10px] text-blue-400/70 uppercase tracking-wider">Low</div>
                      </div>
                    </div>

                    {/* Insights List */}
                    <div className="space-y-2">
                      {recommendations.map((rec, idx) => {
                        const styles = PRIORITY_STYLES[rec.priority];
                        const isExpanded = expandedInsights.has(idx);

                        return (
                          <div
                            key={idx}
                            className="bg-[#0F1722] border border-white/[0.04] rounded-xl overflow-hidden"
                          >
                            {/* Header - Always visible */}
                            <button
                              onClick={() => toggleInsight(idx)}
                              className="w-full px-4 py-3 flex items-start gap-3 text-left hover:bg-white/[0.02] transition-colors"
                            >
                              <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${styles.dot}`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border ${styles.badge}`}>
                                    {rec.priority}
                                  </span>
                                  <span className="text-[10px] text-[#64748B] uppercase">
                                    {CATEGORY_LABELS[rec.category]}
                                  </span>
                                </div>
                                <h4 className="text-white font-medium text-[13px] leading-snug">{rec.title}</h4>
                              </div>
                              <svg
                                className={`w-4 h-4 text-[#64748B] transform transition-transform flex-shrink-0 mt-1 ${isExpanded ? 'rotate-180' : ''}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>

                            {/* Body - Expandable */}
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="px-4 pb-4"
                                >
                                  <div className="pt-2 border-t border-white/[0.05] space-y-3 pl-5">
                                    {/* Problem */}
                                    <div>
                                      <h5 className="text-[10px] text-[#64748B] uppercase tracking-wide mb-1">Problem</h5>
                                      <p className="text-[12px] text-[#94A3B8] leading-relaxed">{rec.problem}</p>
                                    </div>

                                    {/* Recommendation */}
                                    <div>
                                      <h5 className="text-[10px] text-[#64748B] uppercase tracking-wide mb-1">Recommendation</h5>
                                      <p className="text-[12px] text-white leading-relaxed">{rec.recommendation}</p>
                                    </div>

                                    {/* Expected Impact */}
                                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                                      <span className="text-[11px] text-[#64748B]">Expected Impact: </span>
                                      <span className="text-[11px] text-green-400 font-medium">{rec.expected_impact}</span>
                                    </div>

                                    {/* Action Items */}
                                    {rec.action_items.length > 0 && (
                                      <div>
                                        <h5 className="text-[10px] text-[#64748B] uppercase tracking-wide mb-2">Action Items</h5>
                                        <ul className="space-y-1.5">
                                          {rec.action_items.map((item, i) => (
                                            <li key={i} className="flex items-start gap-2 text-[11px] group">
                                              <span className="text-cyan-400 mt-0.5 flex-shrink-0">
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                </svg>
                                              </span>
                                              <span className="text-[#94A3B8] flex-1">{item}</span>
                                              {onAddToTasks && (
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    onAddToTasks(item, rec);
                                                  }}
                                                  className="text-[10px] text-cyan-400 hover:text-cyan-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                                >
                                                  + Add Task
                                                </button>
                                              )}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* Executive Summary Tab */}
                {activeTab === 'executive' && (
                  <div className="space-y-4">
                    {/* Key Metrics */}
                    <div className="bg-[#0F1722] border border-white/[0.04] rounded-xl p-4">
                      <h3 className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-3">Situation Overview</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-[10px] text-[#64748B] uppercase">Total Recommendations</div>
                          <div className="text-2xl font-bold text-white">{recommendations.length}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-[#64748B] uppercase">Critical Issues</div>
                          <div className="text-2xl font-bold text-red-400">{highPriority.length}</div>
                        </div>
                        {totalRevenueAtRisk > 0 && (
                          <div className="col-span-2">
                            <div className="text-[10px] text-[#64748B] uppercase">Potential Revenue Impact</div>
                            <div className="text-2xl font-bold text-green-400">
                              ${totalRevenueAtRisk >= 1000000
                                ? `${(totalRevenueAtRisk / 1000000).toFixed(1)}M`
                                : totalRevenueAtRisk >= 1000
                                  ? `${(totalRevenueAtRisk / 1000).toFixed(0)}K`
                                  : totalRevenueAtRisk.toLocaleString()
                              }
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Executive Summary Text */}
                    {executiveSummary && (
                      <div className="bg-[#0F1722] border border-white/[0.04] rounded-xl p-4">
                        <h3 className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-3">Summary</h3>
                        <p className="text-[13px] text-[#94A3B8] leading-relaxed">{executiveSummary}</p>
                      </div>
                    )}

                    {/* Critical Issues */}
                    {highPriority.length > 0 && (
                      <div className="bg-[#0F1722] border border-white/[0.04] rounded-xl p-4">
                        <h3 className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-3">Critical Issues</h3>
                        <ul className="space-y-2">
                          {highPriority.map((rec, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 flex-shrink-0" />
                              <span className="text-[12px] text-white">{rec.title}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Key Recommendations */}
                    <div className="bg-[#0F1722] border border-white/[0.04] rounded-xl p-4">
                      <h3 className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-3">Key Recommendations</h3>
                      <ul className="space-y-2">
                        {recommendations.slice(0, 5).map((rec, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${PRIORITY_STYLES[rec.priority].dot}`} />
                            <span className="text-[12px] text-[#94A3B8]">{rec.recommendation}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* 30-Day Action Plan Tab */}
                {activeTab === 'action-plan' && (
                  <div className="space-y-4">
                    {/* Week 1: Immediate Actions */}
                    <div className="bg-[#0F1722] border border-white/[0.04] rounded-xl overflow-hidden">
                      <div className="px-4 py-3 border-b border-white/[0.04] bg-red-500/5">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-red-400" />
                          <h3 className="text-[12px] font-semibold text-white">Week 1: Immediate Actions</h3>
                          <span className="text-[10px] text-red-400 bg-red-500/20 px-2 py-0.5 rounded-full">
                            {actionPlan.week1.length} items
                          </span>
                        </div>
                      </div>
                      <div className="p-4 space-y-2">
                        {actionPlan.week1.length > 0 ? (
                          actionPlan.week1.map((item, idx) => (
                            <div key={idx} className="flex items-start gap-3 group">
                              <div className="w-5 h-5 rounded border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <div className="w-2 h-2 rounded-full bg-white/20" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[12px] text-white leading-relaxed">{item.action}</p>
                                <p className="text-[10px] text-[#64748B] mt-0.5">From: {item.rec.title.slice(0, 40)}...</p>
                              </div>
                              {onAddToTasks && (
                                <button
                                  onClick={() => onAddToTasks(item.action, item.rec)}
                                  className="text-[10px] text-cyan-400 hover:text-cyan-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                >
                                  + Add
                                </button>
                              )}
                            </div>
                          ))
                        ) : (
                          <p className="text-[12px] text-[#64748B]">No immediate actions</p>
                        )}
                      </div>
                    </div>

                    {/* Week 2-3: Follow-up Actions */}
                    <div className="bg-[#0F1722] border border-white/[0.04] rounded-xl overflow-hidden">
                      <div className="px-4 py-3 border-b border-white/[0.04] bg-amber-500/5">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-amber-400" />
                          <h3 className="text-[12px] font-semibold text-white">Week 2-3: Follow-up Actions</h3>
                          <span className="text-[10px] text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-full">
                            {actionPlan.week2_3.length} items
                          </span>
                        </div>
                      </div>
                      <div className="p-4 space-y-2">
                        {actionPlan.week2_3.length > 0 ? (
                          actionPlan.week2_3.map((item, idx) => (
                            <div key={idx} className="flex items-start gap-3 group">
                              <div className="w-5 h-5 rounded border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <div className="w-2 h-2 rounded-full bg-white/20" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[12px] text-white leading-relaxed">{item.action}</p>
                                <p className="text-[10px] text-[#64748B] mt-0.5">From: {item.rec.title.slice(0, 40)}...</p>
                              </div>
                              {onAddToTasks && (
                                <button
                                  onClick={() => onAddToTasks(item.action, item.rec)}
                                  className="text-[10px] text-cyan-400 hover:text-cyan-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                >
                                  + Add
                                </button>
                              )}
                            </div>
                          ))
                        ) : (
                          <p className="text-[12px] text-[#64748B]">No follow-up actions</p>
                        )}
                      </div>
                    </div>

                    {/* Week 4: Review & Adjust */}
                    <div className="bg-[#0F1722] border border-white/[0.04] rounded-xl overflow-hidden">
                      <div className="px-4 py-3 border-b border-white/[0.04] bg-blue-500/5">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-blue-400" />
                          <h3 className="text-[12px] font-semibold text-white">Week 4: Review & Adjust</h3>
                          <span className="text-[10px] text-blue-400 bg-blue-500/20 px-2 py-0.5 rounded-full">
                            {actionPlan.week4.length} items
                          </span>
                        </div>
                      </div>
                      <div className="p-4 space-y-2">
                        {actionPlan.week4.length > 0 ? (
                          actionPlan.week4.map((item, idx) => (
                            <div key={idx} className="flex items-start gap-3 group">
                              <div className="w-5 h-5 rounded border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <div className="w-2 h-2 rounded-full bg-white/20" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[12px] text-white leading-relaxed">{item.action}</p>
                                <p className="text-[10px] text-[#64748B] mt-0.5">From: {item.rec.title.slice(0, 40)}...</p>
                              </div>
                              {onAddToTasks && (
                                <button
                                  onClick={() => onAddToTasks(item.action, item.rec)}
                                  className="text-[10px] text-cyan-400 hover:text-cyan-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                >
                                  + Add
                                </button>
                              )}
                            </div>
                          ))
                        ) : (
                          <p className="text-[12px] text-[#64748B]">No review actions</p>
                        )}
                      </div>
                    </div>

                    {/* Add All to Tasks Button */}
                    {onAddToTasks && (
                      <button
                        onClick={() => {
                          [...actionPlan.week1, ...actionPlan.week2_3, ...actionPlan.week4].forEach(item => {
                            onAddToTasks(item.action, item.rec);
                          });
                        }}
                        className="w-full py-3 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-xl text-[13px] font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add All Actions to Tasks
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex-shrink-0 border-t border-white/[0.06] bg-[#0F1722] px-5 py-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDownloadPDF}
                  disabled={downloadingPDF}
                  className="flex-1 px-4 py-2.5 bg-purple-500 text-white font-medium text-sm rounded-lg hover:bg-purple-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {downloadingPDF ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Generating...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download {activeTab === 'executive' ? 'Executive Summary' : activeTab === 'action-plan' ? 'Action Plan' : 'Report'} PDF
                    </>
                  )}
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2.5 bg-white/10 text-white font-medium text-sm rounded-lg hover:bg-white/20 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
