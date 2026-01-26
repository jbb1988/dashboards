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
      <div className="w-12 bg-[#1F2328] border-l border-white/8 flex flex-col py-2">
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
            animate={{ width: 750, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-[#242A30] border-l border-white/8 overflow-hidden flex flex-col"
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
                        <span className="text-[#58A6FF] mt-0.5 flex-shrink-0">•</span>
                        <span className="text-[rgba(255,255,255,0.62)]">{item}</span>
                      </motion.div>
                    ))
                  ) : (
                    <p className="text-xs text-[rgba(255,255,255,0.5)]">No summary available</p>
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
                        className={`p-2 rounded border bg-[#1B1F24]/50 ${getActionColor(entry.action)}`}
                      >
                        <div className="flex items-center gap-2 text-xs">
                          <span>{getActionIcon(entry.action)}</span>
                          <span className="text-[rgba(255,255,255,0.88)] font-medium capitalize">{entry.action}</span>
                          <span className="text-[rgba(255,255,255,0.3)]">•</span>
                          <span className="text-[rgba(255,255,255,0.62)] truncate">{entry.by}</span>
                        </div>
                        <div className="text-[10px] text-[rgba(255,255,255,0.5)] mt-1">{formatDate(entry.at)}</div>
                        {entry.feedback && (
                          <p className="text-[10px] text-[rgba(255,255,255,0.62)] mt-1 italic border-l-2 border-white/10 pl-2">
                            &ldquo;{entry.feedback}&rdquo;
                          </p>
                        )}
                      </motion.div>
                    ))
                  ) : (
                    <p className="text-xs text-[rgba(255,255,255,0.5)]">No activity recorded yet</p>
                  )}
                </div>
              )}

              {/* Documents Tab */}
              {activeTab === 'documents' && (
                <div className="space-y-2">
                  {documents.length > 0 ? (
                    sortDocumentsByType(documents).map((doc, idx) => (
                      <motion.div
                        key={doc.id}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className="p-2 rounded bg-[#1B1F24] border border-white/8 hover:border-white/15 transition-colors"
                      >
                        <div className="flex items-start gap-2 mb-2">
                          <svg className="w-4 h-4 text-[rgba(255,255,255,0.62)] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-[rgba(255,255,255,0.88)] truncate">{doc.fileName}</p>
                            <span className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded border mt-1 ${getDocumentTypeColor(doc.documentType)}`}>
                              {doc.documentType}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => onViewDocument(doc)}
                            className="flex-1 text-[10px] px-2 py-1 bg-[#58A6FF]/10 text-[#58A6FF] rounded hover:bg-[#58A6FF]/20 transition-colors"
                          >
                            View
                          </button>
                          {isWordDocument(doc.fileName) && (
                            <button
                              onClick={() => onDownloadDocument(doc)}
                              className="flex-1 text-[10px] px-2 py-1 bg-white/5 text-[rgba(255,255,255,0.62)] rounded hover:bg-white/10 transition-colors"
                            >
                              Download
                            </button>
                          )}
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <p className="text-xs text-[rgba(255,255,255,0.5)]">No supporting documents</p>
                  )}
                </div>
              )}

              {/* Annotations Tab - Document highlights with notes */}
              {activeTab === 'annotations' && (
                <div className="space-y-2">
                  <p className="text-[10px] text-[rgba(255,255,255,0.5)] mb-3 pb-2 border-b border-white/8">
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
                        className="p-2 rounded bg-[#D29922]/10 border border-[#D29922]/20 cursor-pointer hover:bg-[#D29922]/15 transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Highlighter className="w-3 h-3 text-[#D29922]" />
                          <span className="text-[10px] text-[#D29922] font-medium">#{idx + 1}</span>
                        </div>
                        <p className="text-[10px] text-[#D29922]/60 italic truncate border-l-2 border-[#D29922]/30 pl-2 mb-1">
                          &ldquo;{annotation.highlightedText.slice(0, 40)}{annotation.highlightedText.length > 40 ? '...' : ''}&rdquo;
                        </p>
                        <p className="text-xs text-[rgba(255,255,255,0.88)]">
                          {annotation.text || <span className="text-[rgba(255,255,255,0.5)] italic">No note added</span>}
                        </p>
                      </motion.div>
                    ))
                  ) : (
                    <p className="text-xs text-[rgba(255,255,255,0.5)]">No annotations in the document. Select text and click the comment button to add one.</p>
                  )}
                </div>
              )}

              {/* Discussion Tab - General comments */}
              {activeTab === 'discussion' && (
                <div className="flex flex-col h-full">
                  <p className="text-[10px] text-[rgba(255,255,255,0.5)] mb-3 pb-2 border-b border-white/8">
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
                          className="p-3 rounded bg-[#1B1F24] border border-white/8"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-6 h-6 rounded-full bg-[#58A6FF]/20 flex items-center justify-center">
                              <span className="text-[10px] text-[#58A6FF] font-medium">
                                {(comment.authorName || comment.authorEmail).charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-[rgba(255,255,255,0.88)] font-medium truncate">
                                {comment.authorName || comment.authorEmail}
                              </p>
                              <p className="text-[10px] text-[rgba(255,255,255,0.5)]">
                                {formatDate(comment.createdAt)}
                              </p>
                            </div>
                          </div>
                          <p className="text-sm text-[rgba(255,255,255,0.62)] whitespace-pre-wrap">
                            {highlightMentions(comment.comment)}
                          </p>
                        </motion.div>
                      ))
                    ) : (
                      <p className="text-xs text-[rgba(255,255,255,0.5)] text-center py-4">No comments yet. Start the discussion below.</p>
                    )}
                  </div>

                  {/* Add comment input */}
                  {canAddComments && onAddDiscussionComment && (
                    <div className="border-t border-white/8 pt-3">
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
