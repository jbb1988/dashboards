'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Clock,
  Paperclip,
  MessageCircle,
  ChevronRight,
  Eye,
  Download,
  Highlighter,
  ArrowUpRight,
  Check,
  X,
  Edit3,
  Send,
  RefreshCw,
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

interface Annotation {
  id: string;
  text: string;
  highlightedText: string;
}

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

// Document type tag colors - subtle, no borders
function getDocumentTypeStyle(type: string) {
  switch (type) {
    case 'Original Contract':
      return 'text-[#58A6FF]/90 bg-[#58A6FF]/8';
    case 'Client Response':
      return 'text-[#A371F7]/90 bg-[#A371F7]/8';
    case 'MARS Redlines':
      return 'text-[#D29922]/90 bg-[#D29922]/8';
    case 'Final Agreement':
      return 'text-[#3FB950]/90 bg-[#3FB950]/8';
    case 'Amendment':
      return 'text-[#79C0FF]/90 bg-[#79C0FF]/8';
    default:
      return 'text-[rgba(255,255,255,0.55)] bg-white/5';
  }
}

const DOCUMENT_TYPE_ORDER = [
  'Original Contract',
  'MARS Redlines',
  'Final Agreement',
  'Executed Contract',
  'Client Response - MARS STD WTC',
  'Client Response - MARS MCC TC',
  'Client Response - MARS EULA',
  'Client Response',
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
    const aOrder = aIndex === -1 ? DOCUMENT_TYPE_ORDER.length : aIndex;
    const bOrder = bIndex === -1 ? DOCUMENT_TYPE_ORDER.length : bIndex;
    return aOrder - bOrder;
  });
}

// Outline icons for activity - no emojis
function getActionIcon(action: ActivityLogEntry['action']) {
  const iconClass = 'w-3.5 h-3.5';
  switch (action) {
    case 'submitted':
      return <ArrowUpRight className={iconClass} />;
    case 'viewed':
      return <Eye className={iconClass} />;
    case 'edited':
      return <Edit3 className={iconClass} />;
    case 'approved':
      return <Check className={iconClass} />;
    case 'rejected':
      return <X className={iconClass} />;
    case 'resubmitted':
      return <RefreshCw className={iconClass} />;
    default:
      return <FileText className={iconClass} />;
  }
}

function getActionAccent(action: ActivityLogEntry['action']) {
  switch (action) {
    case 'approved':
      return 'bg-[#3FB950]';
    case 'rejected':
      return 'bg-[#F85149]';
    case 'edited':
      return 'bg-[#D29922]';
    case 'submitted':
    case 'resubmitted':
      return 'bg-[#58A6FF]';
    default:
      return 'bg-white/20';
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
  { id: 'summary', icon: <FileText className="w-[18px] h-[18px]" />, label: 'Summary' },
  { id: 'activity', icon: <Clock className="w-[18px] h-[18px]" />, label: 'Activity' },
  { id: 'documents', icon: <Paperclip className="w-[18px] h-[18px]" />, label: 'Documents' },
  { id: 'annotations', icon: <Highlighter className="w-[18px] h-[18px]" />, label: 'Annotations' },
  { id: 'discussion', icon: <MessageCircle className="w-[18px] h-[18px]" />, label: 'Discussion' },
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
  const [hoveredDoc, setHoveredDoc] = useState<string | null>(null);

  const handleTabClick = (tab: TabType) => {
    if (activeTab === tab && isOpen) {
      onTabChange(null);
    } else {
      onTabChange(tab);
    }
  };

  return (
    <div className="flex h-full">
      {/* Tab Strip - minimal */}
      <div className="w-11 bg-[var(--approval-bg-base)] border-l border-white/[0.04] flex flex-col py-4">
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
                relative w-11 h-10 flex items-center justify-center transition-colors
                ${isActive
                  ? 'text-white'
                  : 'text-white/25 hover:text-white/50'
                }
              `}
            >
              {tab.icon}
              {/* Active indicator - thin accent bar */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-[#58A6FF] rounded-r" />
              )}
              {/* Badge dot - very subtle */}
              {hasContent && !isActive && (
                <div className="absolute top-2 right-2 w-1 h-1 bg-white/30 rounded-full" />
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
            animate={{ width: 360, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-[var(--approval-bg-base)] border-l border-white/[0.04] overflow-hidden flex flex-col"
          >
            {/* Panel Header - minimal */}
            <div className="h-12 px-5 flex items-center justify-between border-b border-white/[0.04] flex-shrink-0">
              <h3 className="text-[13px] font-medium text-white/80 tracking-tight">
                {tabs.find((t) => t.id === activeTab)?.label}
              </h3>
              <button
                onClick={() => onTabChange(null)}
                className="p-1 rounded text-white/30 hover:text-white/60 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Panel Body */}
            <div className="flex-1 overflow-y-auto px-5 py-5">

              {/* ═══════════════════════════════════════════════════════════════
                  SUMMARY TAB - No cards, stacked items with faint dividers
                 ═══════════════════════════════════════════════════════════════ */}
              {activeTab === 'summary' && (
                <div className="space-y-0">
                  {summary.length > 0 ? (
                    summary.map((item, idx) => {
                      if (item.includes('───')) {
                        return <div key={idx} className="border-t border-white/[0.06] my-4" />;
                      }

                      const isReviewerNote = item.startsWith('📝');
                      const isLast = idx === summary.length - 1;

                      return (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: idx * 0.03 }}
                          className={`py-3.5 cursor-pointer group transition-colors hover:bg-white/[0.02] -mx-2 px-2 rounded-lg ${
                            !isLast ? 'border-b border-white/[0.04]' : ''
                          }`}
                        >
                          <p className={`text-[13px] leading-[1.65] ${
                            isReviewerNote
                              ? 'text-[#58A6FF]/90'
                              : 'text-white/70'
                          }`}>
                            {isReviewerNote ? item.replace('📝 ', '') : item}
                          </p>
                        </motion.div>
                      );
                    })
                  ) : (
                    <p className="text-[13px] text-white/30">No summary available</p>
                  )}
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════════
                  ACTIVITY TAB - Timeline, outline icons, accent on most recent
                 ═══════════════════════════════════════════════════════════════ */}
              {activeTab === 'activity' && (
                <div className="space-y-0">
                  {activityLog.length > 0 ? (
                    activityLog.map((entry, idx) => {
                      const isFirst = idx === 0;
                      const isLast = idx === activityLog.length - 1;

                      return (
                        <motion.div
                          key={`${entry.action}-${entry.at}-${idx}`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: idx * 0.03 }}
                          className={`relative py-3 ${!isLast ? 'border-b border-white/[0.04]' : ''}`}
                        >
                          {/* Left accent line on most recent only */}
                          {isFirst && (
                            <div className={`absolute left-0 top-3 bottom-3 w-[2px] rounded-full ${getActionAccent(entry.action)}`} />
                          )}

                          <div className={`${isFirst ? 'pl-3' : ''}`}>
                            <div className="flex items-center gap-2">
                              <span className={`${isFirst ? 'text-white/70' : 'text-white/40'}`}>
                                {getActionIcon(entry.action)}
                              </span>
                              <span className={`text-[13px] font-medium capitalize ${isFirst ? 'text-white/90' : 'text-white/60'}`}>
                                {entry.action}
                              </span>
                              <span className="text-white/20 text-[13px]">·</span>
                              <span className="text-[13px] text-white/40 truncate">{entry.by}</span>
                            </div>
                            <div className={`text-[11px] mt-1 ${isFirst ? 'text-white/50' : 'text-white/30'}`}>
                              {formatDate(entry.at)}
                            </div>
                            {entry.feedback && (
                              <p className="text-[12px] text-white/50 mt-2 italic pl-3 border-l border-white/10">
                                "{entry.feedback}"
                              </p>
                            )}
                          </div>
                        </motion.div>
                      );
                    })
                  ) : (
                    <p className="text-[13px] text-white/30">No activity recorded yet</p>
                  )}
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════════
                  DOCUMENTS TAB - Single clickable rows, hover-only actions
                 ═══════════════════════════════════════════════════════════════ */}
              {activeTab === 'documents' && (
                <div className="space-y-0">
                  {documents.length > 0 ? (
                    sortDocumentsByType(documents).map((doc, idx) => {
                      const isHovered = hoveredDoc === doc.id;
                      const isLast = idx === documents.length - 1;

                      return (
                        <motion.div
                          key={doc.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: idx * 0.03 }}
                          onMouseEnter={() => setHoveredDoc(doc.id)}
                          onMouseLeave={() => setHoveredDoc(null)}
                          onClick={() => onViewDocument(doc)}
                          className={`flex items-center gap-3 py-3 cursor-pointer group transition-colors hover:bg-white/[0.02] -mx-2 px-2 rounded-lg ${
                            !isLast ? 'border-b border-white/[0.04]' : ''
                          }`}
                        >
                          {/* File icon */}
                          <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>

                          {/* Filename + tag */}
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] text-white/80 truncate">{doc.fileName}</p>
                            <span className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded mt-1 ${getDocumentTypeStyle(doc.documentType)}`}>
                              {doc.documentType}
                            </span>
                          </div>

                          {/* Hover-only actions */}
                          <div className={`flex items-center gap-1 transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
                            <button
                              onClick={(e) => { e.stopPropagation(); onViewDocument(doc); }}
                              className="p-1.5 text-white/40 hover:text-white/70 transition-colors"
                              title="View"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            {isWordDocument(doc.fileName) && (
                              <button
                                onClick={(e) => { e.stopPropagation(); onDownloadDocument(doc); }}
                                className="p-1.5 text-white/40 hover:text-white/70 transition-colors"
                                title="Download"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </motion.div>
                      );
                    })
                  ) : (
                    <p className="text-[13px] text-white/30">No supporting documents</p>
                  )}
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════════
                  ANNOTATIONS TAB
                 ═══════════════════════════════════════════════════════════════ */}
              {activeTab === 'annotations' && (
                <div className="space-y-0">
                  <p className="text-[11px] text-white/40 mb-4 pb-3 border-b border-white/[0.04]">
                    Highlighted text with notes
                  </p>
                  {annotations.length > 0 ? (
                    annotations.map((annotation, idx) => {
                      const isLast = idx === annotations.length - 1;

                      return (
                        <motion.div
                          key={annotation.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: idx * 0.03 }}
                          onClick={() => onAnnotationClick?.(annotation.id)}
                          className={`py-3 cursor-pointer group transition-colors hover:bg-white/[0.02] -mx-2 px-2 rounded-lg ${
                            !isLast ? 'border-b border-white/[0.04]' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <Highlighter className="w-3 h-3 text-[#D29922]/70" />
                            <span className="text-[11px] text-[#D29922]/70 font-medium">#{idx + 1}</span>
                          </div>
                          <p className="text-[12px] text-white/50 italic truncate mb-1">
                            "{annotation.highlightedText.slice(0, 60)}{annotation.highlightedText.length > 60 ? '...' : ''}"
                          </p>
                          <p className="text-[13px] text-white/70 leading-relaxed">
                            {annotation.text || <span className="text-white/30 italic">No note</span>}
                          </p>
                        </motion.div>
                      );
                    })
                  ) : (
                    <p className="text-[13px] text-white/30">No annotations yet. Select text in the document to add one.</p>
                  )}
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════════
                  DISCUSSION TAB
                 ═══════════════════════════════════════════════════════════════ */}
              {activeTab === 'discussion' && (
                <div className="flex flex-col h-full">
                  <div className="flex-1 overflow-y-auto space-y-0 mb-4">
                    {discussionComments.length > 0 ? (
                      discussionComments.map((comment, idx) => {
                        const isLast = idx === discussionComments.length - 1;

                        return (
                          <motion.div
                            key={comment.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: idx * 0.03 }}
                            className={`py-3.5 ${!isLast ? 'border-b border-white/[0.04]' : ''}`}
                          >
                            <div className="flex items-center gap-2.5 mb-2">
                              <div className="w-6 h-6 rounded-full bg-white/[0.06] flex items-center justify-center">
                                <span className="text-[10px] text-white/60 font-medium">
                                  {(comment.authorName || comment.authorEmail).charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[12px] text-white/70 truncate">
                                  {comment.authorName || comment.authorEmail}
                                </p>
                              </div>
                              <span className="text-[10px] text-white/30">
                                {formatDate(comment.createdAt)}
                              </span>
                            </div>
                            <p className="text-[13px] text-white/60 whitespace-pre-wrap leading-relaxed pl-8">
                              {highlightMentions(comment.comment)}
                            </p>
                          </motion.div>
                        );
                      })
                    ) : (
                      <p className="text-[13px] text-white/30 text-center py-8">No comments yet</p>
                    )}
                  </div>

                  {canAddComments && onAddDiscussionComment && (
                    <div className="border-t border-white/[0.04] pt-4">
                      <MentionInput
                        value={newComment}
                        onChange={setNewComment}
                        onSubmit={(text) => {
                          onAddDiscussionComment(text);
                          setNewComment('');
                        }}
                        placeholder="Add a comment..."
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
