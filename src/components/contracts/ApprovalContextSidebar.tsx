'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  History,
  Paperclip,
  MessageSquare,
  MessageCircle,
  ChevronRight,
  Send,
  Highlighter,
} from 'lucide-react';
import { ActivityLogEntry } from './ActivityLog';
import MentionInput, { highlightMentions } from '@/components/ui/MentionInput';

type TabType = 'summary' | 'activity' | 'documents' | 'annotations' | 'discussion';

interface Document {
  id: string;
  fileName: string;
  fileUrl: string;
  documentType: string;
  uploadedAt: string;
  mimeType: string | null;
  convertedPdfUrl: string | null;
}

// Document annotations (yellow highlights on specific text)
interface Annotation {
  id: string;
  text: string;
  highlightedText: string;
}

// Discussion comments (general comments about the document)
interface DiscussionComment {
  id: string;
  authorEmail: string;
  authorName?: string;
  comment: string;
  createdAt: string;
}

interface ApprovalContextSidebarProps {
  activeTab: TabType | null;
  onTabChange: (tab: TabType | null) => void;
  isOpen: boolean;
  summary: string[];
  activityLog: ActivityLogEntry[];
  documents: Document[];
  annotations: Annotation[];
  discussionComments: DiscussionComment[];
  onViewDocument: (doc: Document) => void;
  onDownloadDocument: (doc: Document) => void;
  onAnnotationClick?: (annotationId: string) => void;
  onAddDiscussionComment?: (comment: string) => void;
  canAddComments?: boolean;
}

function isWordDocument(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return lower.endsWith('.docx') || lower.endsWith('.doc');
}

function getDocumentTypeColor(type: string) {
  switch (type) {
    case 'Original Contract':
      return 'text-[#58A6FF] bg-[#58A6FF]/10 border-[#58A6FF]/30';
    case 'Client Response':
      return 'text-[#A371F7] bg-[#A371F7]/10 border-[#A371F7]/30';
    case 'MARS Redlines':
      return 'text-[#D29922] bg-[#D29922]/10 border-[#D29922]/30';
    case 'Final Agreement':
      return 'text-[#3FB950] bg-[#3FB950]/10 border-[#3FB950]/30';
    case 'Amendment':
      return 'text-[#79C0FF] bg-[#79C0FF]/10 border-[#79C0FF]/30';
    default:
      return 'text-[rgba(255,255,255,0.62)] bg-white/5 border-white/10';
  }
}

// Document type display order
const DOCUMENT_TYPE_ORDER = [
  // Required documents
  'Original Contract',
  'MARS Redlines',
  'Final Agreement',
  'Executed Contract',
  // Optional documents
  'Client Response - MARS STD WTC',
  'Client Response - MARS MCC TC',
  'Client Response - MARS EULA',
  'Client Response', // Fallback for generic client response
  'Purchase Order',
  'Amendment',
  'Other',
];

function sortDocumentsByType(documents: Document[]): Document[] {
  return [...documents].sort((a, b) => {
    const aIndex = DOCUMENT_TYPE_ORDER.findIndex(type =>
      a.documentType === type || a.documentType.startsWith(type)
    );
    const bIndex = DOCUMENT_TYPE_ORDER.findIndex(type =>
      b.documentType === type || b.documentType.startsWith(type)
    );

    // If not found in order list, put at end
    const aOrder = aIndex === -1 ? DOCUMENT_TYPE_ORDER.length : aIndex;
    const bOrder = bIndex === -1 ? DOCUMENT_TYPE_ORDER.length : bIndex;

    return aOrder - bOrder;
  });
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
      return 'border-[#58A6FF]/30';
    case 'viewed':
      return 'border-white/10';
    case 'edited':
      return 'border-[#D29922]/30';
    case 'approved':
      return 'border-[#238636]/30';
    case 'rejected':
      return 'border-[#F85149]/30';
    case 'resubmitted':
      return 'border-[#A371F7]/30';
    default:
      return 'border-white/10';
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
  { id: 'annotations', icon: <Highlighter className="w-5 h-5" />, label: 'Annotations' },
  { id: 'discussion', icon: <MessageCircle className="w-5 h-5" />, label: 'Discussion' },
];

export default function ApprovalContextSidebar({
  activeTab,
  onTabChange,
  isOpen,
  summary,
  activityLog,
  documents,
  annotations,
  discussionComments,
  onViewDocument,
  onDownloadDocument,
  onAnnotationClick,
  onAddDiscussionComment,
  canAddComments = true,
}: ApprovalContextSidebarProps) {
  const [newComment, setNewComment] = useState('');
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
      <div className="w-12 bg-[var(--approval-bg-base)] border-l border-white/5 flex flex-col py-3">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id && isOpen;
          const hasContent =
            (tab.id === 'summary' && summary.length > 0) ||
            (tab.id === 'activity' && activityLog.length > 0) ||
            (tab.id === 'documents' && documents.length > 0) ||
            (tab.id === 'annotations' && annotations.length > 0) ||
            (tab.id === 'discussion' && discussionComments.length > 0);

          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              title={tab.label}
              className={`
                relative w-12 h-11 flex items-center justify-center transition-all
                ${isActive
                  ? 'text-[#58A6FF]'
                  : 'text-[rgba(255,255,255,0.30)] hover:text-[rgba(255,255,255,0.55)]'
                }
              `}
            >
              {tab.icon}
              {/* Active indicator bar */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-5 bg-[#58A6FF] rounded-r" />
              )}
              {/* Badge dot for content - subtle */}
              {hasContent && !isActive && (
                <div className="absolute top-2.5 right-2.5 w-1 h-1 bg-[#58A6FF]/60 rounded-full" />
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
            animate={{ width: 420, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="glass-panel overflow-hidden flex flex-col"
          >
            {/* Panel Header */}
            <div className="h-14 px-5 flex items-center justify-between border-b border-white/6 flex-shrink-0">
              <h3 className="text-sm font-semibold text-[rgba(255,255,255,0.92)] tracking-tight">
                {tabs.find((t) => t.id === activeTab)?.label}
              </h3>
              <button
                onClick={() => onTabChange(null)}
                className="p-1.5 rounded-md text-[rgba(255,255,255,0.45)] hover:text-[rgba(255,255,255,0.88)] hover:bg-white/5 transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Panel Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {/* Summary Tab */}
              {activeTab === 'summary' && (
                <div className="space-y-4">
                  {summary.length > 0 ? (
                    summary.map((item, idx) => {
                      // Check if this is a separator line
                      if (item.includes('───')) {
                        return (
                          <div key={idx} className="border-t border-white/6 my-5" />
                        );
                      }

                      const isReviewerNote = item.startsWith('📝');

                      return (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.04, ease: 'easeOut' }}
                          className={`summary-card p-4 rounded-xl border cursor-pointer group ${
                            isReviewerNote
                              ? 'bg-[#58A6FF]/8 border-[#58A6FF]/15'
                              : 'bg-[#161B22] border-white/4'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <p className={`text-[13px] leading-[1.7] ${
                                isReviewerNote
                                  ? 'text-[#58A6FF]'
                                  : 'text-[rgba(255,255,255,0.82)]'
                              }`}>
                                {isReviewerNote ? item.replace('📝 ', '') : item}
                              </p>
                            </div>
                            {/* Subtle hover arrow */}
                            <ChevronRight className="w-4 h-4 text-[rgba(255,255,255,0.2)] opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-0.5 flex-shrink-0 mt-0.5" />
                          </div>
                        </motion.div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-[rgba(255,255,255,0.4)]">No summary available</p>
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
                        className={`p-3 rounded-lg border bg-[#1B1F24]/60 ${getActionColor(entry.action)}`}
                      >
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-base">{getActionIcon(entry.action)}</span>
                          <span className="text-[rgba(255,255,255,0.92)] font-medium capitalize">{entry.action}</span>
                          <span className="text-[rgba(255,255,255,0.25)]">•</span>
                          <span className="text-[rgba(255,255,255,0.62)] truncate">{entry.by}</span>
                        </div>
                        <div className="text-[10px] text-[rgba(255,255,255,0.45)] mt-1.5">{formatDate(entry.at)}</div>
                        {entry.feedback && (
                          <p className="text-[11px] text-[rgba(255,255,255,0.62)] mt-2 italic border-l-2 border-white/10 pl-2">
                            &ldquo;{entry.feedback}&rdquo;
                          </p>
                        )}
                      </motion.div>
                    ))
                  ) : (
                    <p className="text-xs text-[rgba(255,255,255,0.45)]">No activity recorded yet</p>
                  )}
                </div>
              )}

              {/* Documents Tab */}
              {activeTab === 'documents' && (
                <div className="space-y-3">
                  {documents.length > 0 ? (
                    sortDocumentsByType(documents).map((doc, idx) => (
                      <motion.div
                        key={doc.id}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className="p-3 rounded-lg bg-[#1B1F24]/60 border border-white/5 hover:border-white/12 transition-all"
                      >
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-[rgba(255,255,255,0.55)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] text-[rgba(255,255,255,0.92)] truncate font-medium">{doc.fileName}</p>
                            <span className={`inline-block px-2 py-0.5 text-[10px] font-medium rounded-md border mt-1.5 ${getDocumentTypeColor(doc.documentType)}`}>
                              {doc.documentType}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => onViewDocument(doc)}
                            className="flex-1 text-[11px] font-medium px-3 py-1.5 bg-[#58A6FF]/10 text-[#58A6FF] rounded-md hover:bg-[#58A6FF]/20 transition-colors"
                          >
                            View
                          </button>
                          {isWordDocument(doc.fileName) && (
                            <button
                              onClick={() => onDownloadDocument(doc)}
                              className="flex-1 text-[11px] font-medium px-3 py-1.5 bg-white/5 text-[rgba(255,255,255,0.62)] rounded-md hover:bg-white/10 transition-colors"
                            >
                              Download
                            </button>
                          )}
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <p className="text-xs text-[rgba(255,255,255,0.45)]">No supporting documents</p>
                  )}
                </div>
              )}

              {/* Annotations Tab - Document highlights with notes */}
              {activeTab === 'annotations' && (
                <div className="space-y-3">
                  <p className="text-[11px] text-[rgba(255,255,255,0.45)] mb-4 pb-3 border-b border-white/6">
                    Yellow highlights added to specific text in the document
                  </p>
                  {annotations.length > 0 ? (
                    annotations.map((annotation, idx) => (
                      <motion.div
                        key={annotation.id}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        onClick={() => onAnnotationClick?.(annotation.id)}
                        className="p-3 rounded-lg bg-[#D29922]/10 border border-[#D29922]/20 cursor-pointer hover:bg-[#D29922]/15 hover:border-[#D29922]/30 transition-all group"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded-md bg-[#D29922]/20 flex items-center justify-center">
                            <Highlighter className="w-3.5 h-3.5 text-[#D29922]" />
                          </div>
                          <span className="text-[11px] text-[#D29922] font-semibold">Annotation #{idx + 1}</span>
                          <ChevronRight className="w-4 h-4 text-[#D29922]/40 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <p className="text-[11px] text-[#D29922]/70 italic truncate border-l-2 border-[#D29922]/30 pl-2 mb-2">
                          &ldquo;{annotation.highlightedText.slice(0, 50)}{annotation.highlightedText.length > 50 ? '...' : ''}&rdquo;
                        </p>
                        <p className="text-[13px] text-[rgba(255,255,255,0.88)] leading-relaxed">
                          {annotation.text || <span className="text-[rgba(255,255,255,0.45)] italic">No note added</span>}
                        </p>
                      </motion.div>
                    ))
                  ) : (
                    <p className="text-xs text-[rgba(255,255,255,0.45)]">No annotations in the document. Select text and click the comment button to add one.</p>
                  )}
                </div>
              )}

              {/* Discussion Tab - General comments */}
              {activeTab === 'discussion' && (
                <div className="flex flex-col h-full">
                  <p className="text-[11px] text-[rgba(255,255,255,0.45)] mb-4 pb-3 border-b border-white/6">
                    General comments and questions about this review
                  </p>

                  {/* Comments list */}
                  <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                    {discussionComments.length > 0 ? (
                      discussionComments.map((comment, idx) => (
                        <motion.div
                          key={comment.id}
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.03 }}
                          className="p-4 rounded-lg bg-[#1B1F24]/60 border border-white/5"
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#58A6FF]/30 to-[#58A6FF]/10 flex items-center justify-center">
                              <span className="text-[11px] text-[#58A6FF] font-semibold">
                                {(comment.authorName || comment.authorEmail).charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] text-[rgba(255,255,255,0.92)] font-medium truncate">
                                {comment.authorName || comment.authorEmail}
                              </p>
                              <p className="text-[10px] text-[rgba(255,255,255,0.45)]">
                                {formatDate(comment.createdAt)}
                              </p>
                            </div>
                          </div>
                          <p className="text-[13px] text-[rgba(255,255,255,0.70)] whitespace-pre-wrap leading-relaxed">
                            {highlightMentions(comment.comment)}
                          </p>
                        </motion.div>
                      ))
                    ) : (
                      <p className="text-xs text-[rgba(255,255,255,0.45)] text-center py-6">No comments yet. Start the discussion below.</p>
                    )}
                  </div>

                  {/* Add comment input */}
                  {canAddComments && onAddDiscussionComment && (
                    <div className="border-t border-white/6 pt-4">
                      <MentionInput
                        value={newComment}
                        onChange={setNewComment}
                        onSubmit={(text) => {
                          onAddDiscussionComment(text);
                          setNewComment('');
                        }}
                        placeholder="Add a comment... Use @ to mention"
                      />
                    </div>
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
