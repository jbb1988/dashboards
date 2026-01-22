'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  History,
  Paperclip,
  MessageSquare,
  ChevronRight,
} from 'lucide-react';
import { ActivityLogEntry } from './ActivityLog';

type TabType = 'summary' | 'activity' | 'documents' | 'comments';

interface Document {
  id: string;
  fileName: string;
  fileUrl: string;
  documentType: string;
  uploadedAt: string;
  mimeType: string | null;
  convertedPdfUrl: string | null;
}

interface Comment {
  id: string;
  text: string;
  highlightedText: string;
}

interface ApprovalContextSidebarProps {
  activeTab: TabType | null;
  onTabChange: (tab: TabType | null) => void;
  isOpen: boolean;
  summary: string[];
  activityLog: ActivityLogEntry[];
  documents: Document[];
  comments: Comment[];
  onViewDocument: (doc: Document) => void;
  onDownloadDocument: (doc: Document) => void;
  onCommentClick?: (commentId: string) => void;
}

function isWordDocument(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return lower.endsWith('.docx') || lower.endsWith('.doc');
}

function getDocumentTypeColor(type: string) {
  switch (type) {
    case 'Original Contract':
      return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
    case 'Client Response':
      return 'text-purple-400 bg-purple-500/10 border-purple-500/30';
    case 'MARS Redlines':
      return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    case 'Final Agreement':
      return 'text-green-400 bg-green-500/10 border-green-500/30';
    case 'Amendment':
      return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';
    default:
      return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
  }
}

function getActionIcon(action: ActivityLogEntry['action']) {
  switch (action) {
    case 'submitted':
      return '📤';
    case 'viewed':
      return '👁️';
    case 'edited':
      return '✏️';
    case 'approved':
      return '✅';
    case 'rejected':
      return '❌';
    case 'resubmitted':
      return '🔄';
    default:
      return '📋';
  }
}

function getActionColor(action: ActivityLogEntry['action']) {
  switch (action) {
    case 'submitted':
      return 'border-blue-500/30';
    case 'viewed':
      return 'border-gray-500/30';
    case 'edited':
      return 'border-amber-500/30';
    case 'approved':
      return 'border-green-500/30';
    case 'rejected':
      return 'border-red-500/30';
    case 'resubmitted':
      return 'border-purple-500/30';
    default:
      return 'border-gray-500/30';
  }
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

const tabs: { id: TabType; icon: React.ReactNode; label: string }[] = [
  { id: 'summary', icon: <FileText className="w-5 h-5" />, label: 'Summary' },
  { id: 'activity', icon: <History className="w-5 h-5" />, label: 'Activity' },
  { id: 'documents', icon: <Paperclip className="w-5 h-5" />, label: 'Documents' },
  { id: 'comments', icon: <MessageSquare className="w-5 h-5" />, label: 'Comments' },
];

export default function ApprovalContextSidebar({
  activeTab,
  onTabChange,
  isOpen,
  summary,
  activityLog,
  documents,
  comments,
  onViewDocument,
  onDownloadDocument,
  onCommentClick,
}: ApprovalContextSidebarProps) {
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
      <div className="w-12 bg-[#0D1520] border-l border-white/10 flex flex-col py-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id && isOpen;
          const hasContent =
            (tab.id === 'summary' && summary.length > 0) ||
            (tab.id === 'activity' && activityLog.length > 0) ||
            (tab.id === 'documents' && documents.length > 0) ||
            (tab.id === 'comments' && comments.length > 0);

          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              title={tab.label}
              className={`
                relative w-12 h-12 flex items-center justify-center transition-colors
                ${isActive
                  ? 'text-[#38BDF8] bg-[#151F2E]'
                  : 'text-[#64748B] hover:text-[#8FA3BF] hover:bg-[#151F2E]/50'
                }
              `}
            >
              {tab.icon}
              {/* Active indicator */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-[#38BDF8] rounded-r" />
              )}
              {/* Badge dot for content */}
              {hasContent && !isActive && (
                <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-[#38BDF8] rounded-full" />
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
            animate={{ width: 500, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-[#151F2E] border-l border-white/10 overflow-hidden flex flex-col"
          >
            {/* Panel Header */}
            <div className="h-12 px-4 flex items-center justify-between border-b border-white/10 flex-shrink-0">
              <h3 className="text-sm font-medium text-white">
                {tabs.find((t) => t.id === activeTab)?.label}
              </h3>
              <button
                onClick={() => onTabChange(null)}
                className="p-1 text-[#64748B] hover:text-white transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Panel Body */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Summary Tab */}
              {activeTab === 'summary' && (
                <div className="space-y-2">
                  {summary.length > 0 ? (
                    summary.map((item, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className="flex items-start gap-2 text-sm"
                      >
                        <span className="text-[#38BDF8] mt-0.5 flex-shrink-0">•</span>
                        <span className="text-[#8FA3BF]">{item}</span>
                      </motion.div>
                    ))
                  ) : (
                    <p className="text-xs text-[#64748B]">No summary available</p>
                  )}
                </div>
              )}

              {/* Activity Tab */}
              {activeTab === 'activity' && (
                <div className="space-y-3">
                  {activityLog.length > 0 ? (
                    activityLog.map((entry, idx) => (
                      <motion.div
                        key={`${entry.action}-${entry.at}-${idx}`}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className={`p-2 rounded border bg-[#0B1220]/50 ${getActionColor(entry.action)}`}
                      >
                        <div className="flex items-center gap-2 text-xs">
                          <span>{getActionIcon(entry.action)}</span>
                          <span className="text-white font-medium capitalize">{entry.action}</span>
                          <span className="text-[#64748B]">•</span>
                          <span className="text-[#8FA3BF] truncate">{entry.by}</span>
                        </div>
                        <div className="text-[10px] text-[#64748B] mt-1">{formatDate(entry.at)}</div>
                        {entry.feedback && (
                          <p className="text-[10px] text-[#8FA3BF] mt-1 italic border-l-2 border-white/10 pl-2">
                            &ldquo;{entry.feedback}&rdquo;
                          </p>
                        )}
                      </motion.div>
                    ))
                  ) : (
                    <p className="text-xs text-[#64748B]">No activity recorded yet</p>
                  )}
                </div>
              )}

              {/* Documents Tab */}
              {activeTab === 'documents' && (
                <div className="space-y-2">
                  {documents.length > 0 ? (
                    documents.map((doc, idx) => (
                      <motion.div
                        key={doc.id}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className="p-2 rounded bg-[#0B1220] border border-white/10 hover:border-white/20 transition-colors"
                      >
                        <div className="flex items-start gap-2 mb-2">
                          <svg className="w-4 h-4 text-[#8FA3BF] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-white truncate">{doc.fileName}</p>
                            <span className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded border mt-1 ${getDocumentTypeColor(doc.documentType)}`}>
                              {doc.documentType}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => onViewDocument(doc)}
                            className="flex-1 text-[10px] px-2 py-1 bg-[#38BDF8]/10 text-[#38BDF8] rounded hover:bg-[#38BDF8]/20 transition-colors"
                          >
                            View
                          </button>
                          {isWordDocument(doc.fileName) && (
                            <button
                              onClick={() => onDownloadDocument(doc)}
                              className="flex-1 text-[10px] px-2 py-1 bg-blue-600/10 text-blue-400 rounded hover:bg-blue-600/20 transition-colors"
                            >
                              Download
                            </button>
                          )}
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <p className="text-xs text-[#64748B]">No supporting documents</p>
                  )}
                </div>
              )}

              {/* Comments Tab */}
              {activeTab === 'comments' && (
                <div className="space-y-2">
                  {comments.length > 0 ? (
                    comments.map((comment, idx) => (
                      <motion.div
                        key={comment.id}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        onClick={() => onCommentClick?.(comment.id)}
                        className="p-2 rounded bg-yellow-500/10 border border-yellow-500/20 cursor-pointer hover:bg-yellow-500/20 transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <MessageSquare className="w-3 h-3 text-yellow-400" />
                          <span className="text-[10px] text-yellow-400 font-medium">#{idx + 1}</span>
                        </div>
                        <p className="text-[10px] text-yellow-200/60 italic truncate border-l-2 border-yellow-500/30 pl-2 mb-1">
                          {comment.highlightedText.slice(0, 40)}{comment.highlightedText.length > 40 ? '...' : ''}
                        </p>
                        <p className="text-xs text-white">
                          {comment.text || <span className="text-gray-500 italic">No comment text</span>}
                        </p>
                      </motion.div>
                    ))
                  ) : (
                    <p className="text-xs text-[#64748B]">No comments in the document</p>
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
