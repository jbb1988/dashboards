'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Download,
  Send,
  ChevronRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

type TabType = 'summary' | 'downloads' | 'approval';

interface RiskScores {
  summary: {
    high: number;
    medium: number;
    low: number;
  };
  sections: Array<{
    sectionTitle: string;
    riskLevel: 'high' | 'medium' | 'low';
  }>;
}

interface ReviewResultsSidebarProps {
  activeTab: TabType | null;
  onTabChange: (tab: TabType | null) => void;
  isOpen: boolean;
  // Summary tab props
  summary: string[];
  riskScores?: RiskScores;
  onViewDiff: () => void;
  isComparingAnalysis: boolean;
  // Downloads tab props
  onDownloadBoth: () => void;
  onDownloadOriginal: () => void;
  onDownloadRevised: () => void;
  onCopyText: () => void;
  isGeneratingDocx: boolean;
  isGeneratingOriginal: boolean;
  hasModifiedText: boolean;
  // Approval tab props
  reviewerNotes: string;
  onReviewerNotesChange: (notes: string) => void;
  ccEmails: string;
  onCcEmailsChange: (emails: string) => void;
  onSendForApproval: () => void;
  isSendingApproval: boolean;
  canSendApproval: boolean;
}

const tabs: { id: TabType; icon: React.ReactNode; label: string }[] = [
  { id: 'summary', icon: <FileText className="w-5 h-5" />, label: 'Summary' },
  { id: 'downloads', icon: <Download className="w-5 h-5" />, label: 'Downloads' },
  { id: 'approval', icon: <Send className="w-5 h-5" />, label: 'Approval' },
];

export default function ReviewResultsSidebar({
  activeTab,
  onTabChange,
  isOpen,
  summary,
  riskScores,
  onViewDiff,
  isComparingAnalysis,
  onDownloadBoth,
  onDownloadOriginal,
  onDownloadRevised,
  onCopyText,
  isGeneratingDocx,
  isGeneratingOriginal,
  hasModifiedText,
  reviewerNotes,
  onReviewerNotesChange,
  ccEmails,
  onCcEmailsChange,
  onSendForApproval,
  isSendingApproval,
  canSendApproval,
}: ReviewResultsSidebarProps) {
  const [wordInstructionsExpanded, setWordInstructionsExpanded] = useState(false);

  const handleTabClick = (tab: TabType) => {
    if (activeTab === tab && isOpen) {
      onTabChange(null);
    } else {
      onTabChange(tab);
    }
  };

  return (
    <div className="flex h-full">
      {/* Tab Strip */}
      <div className="w-12 bg-[#1F2328] border-l border-white/8 flex flex-col py-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id && isOpen;
          const hasContent =
            (tab.id === 'summary' && summary.length > 0) ||
            (tab.id === 'downloads' && hasModifiedText) ||
            tab.id === 'approval';

          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              title={tab.label}
              className={`
                relative w-12 h-12 flex items-center justify-center transition-colors
                ${isActive
                  ? 'text-[#58A6FF] bg-[#242A30]'
                  : 'text-[rgba(255,255,255,0.5)] hover:text-[rgba(255,255,255,0.7)] hover:bg-[#242A30]/50'
                }
              `}
            >
              {tab.icon}
              {/* Active indicator */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-[#58A6FF] rounded-r" />
              )}
              {/* Badge dot for content */}
              {hasContent && !isActive && (
                <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-[#58A6FF] rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Panel Content */}
      <AnimatePresence mode="wait">
        {isOpen && activeTab && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 380, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-[#161B22] border-l border-white/8 overflow-hidden flex flex-col"
          >
            {/* Panel Header */}
            <div className="h-12 px-4 flex items-center justify-between border-b border-white/8 flex-shrink-0">
              <h3 className="text-sm font-medium text-[rgba(255,255,255,0.88)]">
                {tabs.find((t) => t.id === activeTab)?.label}
              </h3>
              <button
                onClick={() => onTabChange(null)}
                className="p-1 text-[rgba(255,255,255,0.5)] hover:text-[rgba(255,255,255,0.88)] transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Panel Body */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Summary Tab */}
              {activeTab === 'summary' && (
                <div className="space-y-4">
                  {/* Risk Assessment Cards */}
                  {riskScores && (riskScores.summary.high > 0 || riskScores.summary.medium > 0 || riskScores.summary.low > 0) && (
                    <div className="grid grid-cols-3 gap-2">
                      {riskScores.summary.high > 0 && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-center">
                          <div className="text-2xl font-bold text-red-400">{riskScores.summary.high}</div>
                          <div className="text-xs text-red-400/70">High Risk</div>
                        </div>
                      )}
                      {riskScores.summary.medium > 0 && (
                        <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-center">
                          <div className="text-2xl font-bold text-yellow-400">{riskScores.summary.medium}</div>
                          <div className="text-xs text-yellow-400/70">Medium</div>
                        </div>
                      )}
                      {riskScores.summary.low > 0 && (
                        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-center">
                          <div className="text-2xl font-bold text-green-400">{riskScores.summary.low}</div>
                          <div className="text-xs text-green-400/70">Low</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Changes Count */}
                  <div className="flex items-center gap-2 text-sm text-[rgba(255,255,255,0.62)]">
                    <span className="text-white font-semibold">{summary.length}</span>
                    <span>changes identified</span>
                  </div>

                  {/* View Diff Button - Primary Action */}
                  <button
                    onClick={onViewDiff}
                    disabled={isComparingAnalysis}
                    className="w-full py-2.5 bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isComparingAnalysis ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Comparing...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        View Exact Changes
                      </>
                    )}
                  </button>

                  {/* Summary List */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-[rgba(255,255,255,0.5)] uppercase tracking-wider">Changes</h4>
                    {summary.length > 0 ? (
                      summary.map((item, idx) => {
                        const match = item.match(/^\[([^\]]+)\]\s*(.*)/);
                        const provision = match ? match[1] : null;
                        const text = match ? match[2] : item;

                        let riskLevel: 'high' | 'medium' | 'low' | null = null;
                        if (provision && riskScores?.sections) {
                          const section = riskScores.sections.find(
                            s => s.sectionTitle.toLowerCase().includes(provision.toLowerCase()) ||
                                 provision.toLowerCase().includes(s.sectionTitle.toLowerCase())
                          );
                          if (section) {
                            riskLevel = section.riskLevel;
                          }
                        }

                        return (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.02 }}
                            className="flex items-start gap-2 text-sm p-2 bg-white/[0.02] rounded-lg"
                          >
                            {riskLevel ? (
                              <span className={`mt-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded flex-shrink-0 ${
                                riskLevel === 'high' ? 'bg-red-500/20 text-red-400' :
                                riskLevel === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-green-500/20 text-green-400'
                              }`}>
                                {riskLevel === 'high' ? 'HIGH' : riskLevel === 'medium' ? 'MED' : 'LOW'}
                              </span>
                            ) : (
                              <span className="text-[#58A6FF] mt-1 flex-shrink-0">•</span>
                            )}
                            <span className="text-[rgba(255,255,255,0.62)]">
                              {provision && (
                                <span className="text-[#F59E0B] font-medium">[{provision}]</span>
                              )}{provision ? ' ' : ''}{text}
                            </span>
                          </motion.div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-[rgba(255,255,255,0.5)]">No changes detected</p>
                    )}
                  </div>
                </div>
              )}

              {/* Downloads Tab */}
              {activeTab === 'downloads' && (
                <div className="space-y-4">
                  {hasModifiedText ? (
                    <>
                      {/* Primary Download Action */}
                      <button
                        onClick={onDownloadBoth}
                        disabled={isGeneratingDocx || isGeneratingOriginal}
                        className="w-full py-3 bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {(isGeneratingDocx || isGeneratingOriginal) ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Download className="w-5 h-5" />
                            Download Both for Word Compare
                          </>
                        )}
                      </button>

                      {/* Individual Downloads */}
                      <div className="flex gap-2">
                        <button
                          onClick={onDownloadOriginal}
                          disabled={isGeneratingOriginal}
                          className="flex-1 py-2 bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-[#F59E0B] text-sm font-medium rounded-lg hover:bg-[#F59E0B]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                        >
                          <Download className="w-4 h-4" />
                          Original
                        </button>
                        <button
                          onClick={onDownloadRevised}
                          disabled={isGeneratingDocx}
                          className="flex-1 py-2 bg-[#22C55E]/10 border border-[#22C55E]/30 text-[#22C55E] text-sm font-medium rounded-lg hover:bg-[#22C55E]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                        >
                          <Download className="w-4 h-4" />
                          Revised
                        </button>
                      </div>

                      {/* Copy Text */}
                      <button
                        onClick={onCopyText}
                        className="w-full py-2 bg-[#38BDF8]/10 text-[#38BDF8] font-medium rounded-lg hover:bg-[#38BDF8]/20 transition-colors flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy Redlined Text
                      </button>

                      {/* Word Instructions - Collapsible */}
                      <div className="border border-white/10 rounded-lg overflow-hidden">
                        <button
                          onClick={() => setWordInstructionsExpanded(!wordInstructionsExpanded)}
                          className="w-full px-3 py-2.5 flex items-center justify-between text-sm text-[rgba(255,255,255,0.62)] hover:bg-white/5 transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-[#38BDF8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Word Track Changes Instructions
                          </span>
                          {wordInstructionsExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                        <AnimatePresence>
                          {wordInstructionsExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="px-3 pb-3 text-xs text-[#8FA3BF] space-y-2">
                                <p className="font-medium text-white">To get Track Changes in Word:</p>
                                <ol className="list-decimal list-inside space-y-1.5 ml-1">
                                  <li><span className="text-white">Review</span> → <span className="text-white">Compare</span> → <span className="text-white">Compare Documents</span></li>
                                  <li>Original: <span className="text-[#F59E0B]">*-ORIGINAL-PLAIN.docx</span></li>
                                  <li>Revised: <span className="text-[#22C55E]">*-REVISED.docx</span></li>
                                  <li>Click <span className="text-white">More</span> → <span className="text-[#38BDF8]">UNCHECK "Formatting"</span></li>
                                  <li>Click OK</li>
                                </ol>
                                <div className="mt-2 p-2 bg-[#38BDF8]/10 border border-[#38BDF8]/30 rounded text-[#38BDF8]">
                                  Compare the two downloaded files together - do NOT use your original upload.
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8 text-[rgba(255,255,255,0.5)]">
                      <Download className="w-10 h-10 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">No downloads available</p>
                      <p className="text-xs mt-1">Run an analysis first to generate documents</p>
                    </div>
                  )}
                </div>
              )}

              {/* Approval Tab */}
              {activeTab === 'approval' && (
                <div className="space-y-4">
                  {/* Reviewer Notes */}
                  <div>
                    <label className="flex items-center gap-2 text-[#38BDF8] text-sm font-medium mb-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                      </svg>
                      Reviewer Notes
                    </label>
                    <textarea
                      value={reviewerNotes}
                      onChange={(e) => onReviewerNotesChange(e.target.value)}
                      placeholder="Add notes for the approver..."
                      className="w-full h-24 px-3 py-2 bg-[#0B1220] border border-white/10 rounded-lg text-white text-sm placeholder-[#64748B] focus:outline-none focus:border-[#38BDF8]/50 resize-none"
                    />
                    <p className="text-[10px] text-[#64748B] mt-1">
                      Visible to the approver in the Summary section
                    </p>
                  </div>

                  {/* CC Others */}
                  <div>
                    <label className="flex items-center gap-2 text-[#A78BFA] text-sm font-medium mb-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      CC Others (Optional)
                    </label>
                    <input
                      type="text"
                      value={ccEmails}
                      onChange={(e) => onCcEmailsChange(e.target.value)}
                      placeholder="email1@example.com, email2@example.com"
                      className="w-full px-3 py-2 bg-[#0B1220] border border-white/10 rounded-lg text-white text-sm placeholder-[#64748B] focus:outline-none focus:border-[#8B5CF6]/50"
                    />
                    <p className="text-[10px] text-[#64748B] mt-1">
                      CC'd parties receive notification but cannot approve/reject
                    </p>
                  </div>

                  {/* Send for Approval Button */}
                  <button
                    onClick={onSendForApproval}
                    disabled={isSendingApproval || !canSendApproval}
                    className="w-full py-3 bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSendingApproval ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Send for Approval
                      </>
                    )}
                  </button>

                  {!canSendApproval && (
                    <p className="text-xs text-[#F59E0B] text-center">
                      Select a contract and provision name to enable approval workflow
                    </p>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
