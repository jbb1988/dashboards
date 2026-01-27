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
  RefreshCw,
  Send,
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

// Document type tag - muted pill, no border
function getDocumentTypeStyle(type: string) {
  switch (type) {
    case 'Original Contract':
      return 'text-[#58A6FF]/70 bg-[#58A6FF]/8';
    case 'Client Response':
      return 'text-[#A371F7]/70 bg-[#A371F7]/8';
    case 'MARS Redlines':
      return 'text-[#D29922]/70 bg-[#D29922]/8';
    case 'Final Agreement':
      return 'text-[#3FB950]/70 bg-[#3FB950]/8';
    case 'Amendment':
      return 'text-[#79C0FF]/70 bg-[#79C0FF]/8';
    default:
      return 'text-white/50 bg-white/5';
  }
}

const DOCUMENT_TYPE_ORDER = [
  'Original Contract', 'MARS Redlines', 'Final Agreement', 'Executed Contract',
  'Client Response - MARS STD WTC', 'Client Response - MARS MCC TC',
  'Client Response - MARS EULA', 'Client Response', 'Purchase Order', 'Amendment', 'Other',
];

function sortDocumentsByType(documents: Document[]): Document[] {
  return [...documents].sort((a, b) => {
    const aIndex = DOCUMENT_TYPE_ORDER.findIndex(type => a.documentType === type || a.documentType.startsWith(type));
    const bIndex = DOCUMENT_TYPE_ORDER.findIndex(type => b.documentType === type || b.documentType.startsWith(type));
    return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
  });
}

// Activity icons - outline style
function getActionIcon(action: ActivityLogEntry['action']) {
  const cls = 'w-3.5 h-3.5';
  switch (action) {
    case 'submitted': return <ArrowUpRight className={cls} />;
    case 'viewed': return <Eye className={cls} />;
    case 'edited': return <Edit3 className={cls} />;
    case 'approved': return <Check className={cls} />;
    case 'rejected': return <X className={cls} />;
    case 'resubmitted': return <RefreshCw className={cls} />;
    default: return <FileText className={cls} />;
  }
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
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
      {/* ═══════════════════════════════════════════════════════════════
          LEFT ICON RAIL - Apple Pro style
          Width: 52-56px, same icons, hover backplate
         ═══════════════════════════════════════════════════════════════ */}
      <div className="w-[52px] flex flex-col py-3">
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
                relative w-[52px] h-10 flex items-center justify-center
                transition-all duration-[180ms] ease-out
                ${isActive
                  ? 'text-white'
                  : 'text-white/30 hover:text-white/60'
                }
              `}
            >
              {/* Hover/active backplate */}
              <div className={`
                absolute inset-x-2 inset-y-0.5 rounded-[10px] transition-all duration-[180ms]
                ${isActive ? 'bg-white/[0.06]' : 'group-hover:bg-white/[0.04]'}
              `} />

              {/* Left accent bar - active only */}
              {isActive && (
                <motion.div
                  layoutId="tab-accent"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-[#58A6FF] rounded-r"
                  transition={{ duration: 0.18 }}
                />
              )}

              <span className="relative z-10">{tab.icon}</span>
            </button>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          RIGHT PANEL - Utility sidebar, no cards
         ═══════════════════════════════════════════════════════════════ */}
      <AnimatePresence mode="wait">
        {isOpen && activeTab && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 380, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden flex flex-col border-l border-white/[0.04]"
          >
            {/* Tab header - icon + label, thin accent */}
            <div className="h-11 px-5 flex items-center gap-3 border-b border-white/[0.04] flex-shrink-0">
              <span className="text-white/40">
                {tabs.find((t) => t.id === activeTab)?.icon}
              </span>
              <span className="text-[13px] font-medium text-white/80">
                {tabs.find((t) => t.id === activeTab)?.label}
              </span>
              <button
                onClick={() => onTabChange(null)}
                className="ml-auto p-1 rounded text-white/30 hover:text-white/60 transition-colors duration-[180ms]"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Panel Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4">

              {/* ═══════════════════════════════════════════════════════════
                  SUMMARY - Row blocks, hover shows Surface A
                 ═══════════════════════════════════════════════════════════ */}
              {activeTab === 'summary' && (
                <div className="space-y-0">
                  {summary.length > 0 ? (
                    summary.map((item, idx) => {
                      if (item.includes('───')) {
                        return <div key={idx} className="border-t border-white/[0.05] my-4" />;
                      }

                      const isReviewerNote = item.startsWith('📝');

                      return (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: idx * 0.02 }}
                          className="group flex items-start gap-3 py-3 -mx-2 px-2 rounded-[10px] cursor-pointer transition-all duration-[180ms] hover:bg-white/[0.04]"
                        >
                          {/* Severity dot - muted */}
                          {!isReviewerNote && (
                            <div className="w-1.5 h-1.5 rounded-full bg-white/20 mt-2 flex-shrink-0" />
                          )}

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <p className={`text-[13px] leading-[1.6] ${
                              isReviewerNote ? 'text-[#58A6FF]/80' : 'text-white/70'
                            }`}>
                              {isReviewerNote ? item.replace('📝 ', '') : item}
                            </p>
                          </div>

                          {/* Chevron on hover */}
                          <ChevronRight className="w-3.5 h-3.5 text-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-[180ms] flex-shrink-0 mt-1" />
                        </motion.div>
                      );
                    })
                  ) : (
                    <p className="text-[13px] text-white/30">No summary available</p>
                  )}
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════
                  ACTIVITY - Vertical timeline, text blocks
                 ═══════════════════════════════════════════════════════════ */}
              {activeTab === 'activity' && (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-[7px] top-3 bottom-3 w-[2px] bg-white/[0.06] rounded-full" />

                  <div className="space-y-0">
                    {activityLog.length > 0 ? (
                      activityLog.map((entry, idx) => {
                        const isFirst = idx === 0;

                        return (
                          <motion.div
                            key={`${entry.action}-${entry.at}-${idx}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: idx * 0.02 }}
                            className={`relative pl-6 py-3 ${
                              isFirst ? 'rounded-[10px] -mx-2 px-2 pl-8 bg-white/[0.04]' : ''
                            }`}
                          >
                            {/* Timeline dot */}
                            <div className={`absolute left-0 top-4 w-4 h-4 rounded-full flex items-center justify-center ${
                              isFirst ? 'bg-[#58A6FF]/20 left-2' : 'bg-white/[0.08]'
                            }`}>
                              <span className={isFirst ? 'text-[#58A6FF]' : 'text-white/40'}>
                                {getActionIcon(entry.action)}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className={`text-[13px] font-medium capitalize ${isFirst ? 'text-white/90' : 'text-white/60'}`}>
                                {entry.action}
                              </span>
                              <span className="text-white/20">·</span>
                              <span className="text-[13px] text-white/40 truncate">{entry.by}</span>
                            </div>
                            <div className={`text-[11px] mt-0.5 ${isFirst ? 'text-white/50' : 'text-white/30'}`}>
                              {formatDate(entry.at)}
                            </div>
                            {entry.feedback && (
                              <p className="text-[12px] text-white/50 mt-2 italic">
                                "{entry.feedback}"
                              </p>
                            )}
                          </motion.div>
                        );
                      })
                    ) : (
                      <p className="text-[13px] text-white/30 pl-6">No activity yet</p>
                    )}
                  </div>
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════
                  DOCUMENTS - Compact rows, hover-only icons
                 ═══════════════════════════════════════════════════════════ */}
              {activeTab === 'documents' && (
                <div className="space-y-0">
                  {documents.length > 0 ? (
                    sortDocumentsByType(documents).map((doc, idx) => {
                      const isHovered = hoveredDoc === doc.id;

                      return (
                        <motion.div
                          key={doc.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: idx * 0.02 }}
                          onMouseEnter={() => setHoveredDoc(doc.id)}
                          onMouseLeave={() => setHoveredDoc(null)}
                          onClick={() => onViewDocument(doc)}
                          className="flex items-center gap-3 py-2.5 -mx-2 px-2 rounded-[10px] cursor-pointer transition-all duration-[180ms] hover:bg-white/[0.04]"
                        >
                          {/* File icon */}
                          <div className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center flex-shrink-0">
                            <Paperclip className="w-3.5 h-3.5 text-white/40" />
                          </div>

                          {/* Filename + tag */}
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] text-white/80 truncate">{doc.fileName}</p>
                            <span className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded mt-0.5 ${getDocumentTypeStyle(doc.documentType)}`}>
                              {doc.documentType}
                            </span>
                          </div>

                          {/* Hover-only actions */}
                          <div className={`flex items-center gap-0.5 transition-opacity duration-[180ms] ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
                            <button
                              onClick={(e) => { e.stopPropagation(); onViewDocument(doc); }}
                              className="p-1.5 text-white/40 hover:text-white/70 rounded transition-colors"
                              title="View"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            {isWordDocument(doc.fileName) && (
                              <button
                                onClick={(e) => { e.stopPropagation(); onDownloadDocument(doc); }}
                                className="p-1.5 text-white/40 hover:text-white/70 rounded transition-colors"
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
                    <p className="text-[13px] text-white/30">No documents</p>
                  )}
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════
                  ANNOTATIONS
                 ═══════════════════════════════════════════════════════════ */}
              {activeTab === 'annotations' && (
                <div className="space-y-0">
                  {annotations.length > 0 ? (
                    annotations.map((annotation, idx) => (
                      <motion.div
                        key={annotation.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: idx * 0.02 }}
                        onClick={() => onAnnotationClick?.(annotation.id)}
                        className="group py-3 -mx-2 px-2 rounded-[10px] cursor-pointer transition-all duration-[180ms] hover:bg-white/[0.04]"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Highlighter className="w-3 h-3 text-[#D29922]/60" />
                          <span className="text-[11px] text-[#D29922]/60 font-medium">#{idx + 1}</span>
                        </div>
                        <p className="text-[12px] text-white/40 italic truncate mb-1">
                          "{annotation.highlightedText.slice(0, 50)}{annotation.highlightedText.length > 50 ? '...' : ''}"
                        </p>
                        <p className="text-[13px] text-white/70 leading-relaxed">
                          {annotation.text || <span className="text-white/30 italic">No note</span>}
                        </p>
                      </motion.div>
                    ))
                  ) : (
                    <p className="text-[13px] text-white/30">No annotations</p>
                  )}
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════
                  DISCUSSION - Pill input with send icon
                 ═══════════════════════════════════════════════════════════ */}
              {activeTab === 'discussion' && (
                <div className="flex flex-col h-full">
                  <div className="flex-1 overflow-y-auto space-y-0 mb-4">
                    {discussionComments.length > 0 ? (
                      discussionComments.map((comment, idx) => (
                        <motion.div
                          key={comment.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: idx * 0.02 }}
                          className="py-3"
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className="w-5 h-5 rounded-full bg-white/[0.06] flex items-center justify-center">
                              <span className="text-[9px] text-white/60 font-medium">
                                {(comment.authorName || comment.authorEmail).charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <span className="text-[12px] text-white/60 truncate flex-1">
                              {comment.authorName || comment.authorEmail}
                            </span>
                            <span className="text-[10px] text-white/30">
                              {formatDate(comment.createdAt)}
                            </span>
                          </div>
                          <p className="text-[13px] text-white/70 whitespace-pre-wrap leading-relaxed pl-7">
                            {highlightMentions(comment.comment)}
                          </p>
                        </motion.div>
                      ))
                    ) : (
                      <p className="text-[13px] text-white/30 text-center py-6">No comments yet</p>
                    )}
                  </div>

                  {/* Input - pill + send icon */}
                  {canAddComments && onAddDiscussionComment && (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newComment.trim()) {
                            onAddDiscussionComment(newComment.trim());
                            setNewComment('');
                          }
                        }}
                        placeholder="Add a comment..."
                        className="flex-1 h-9 px-4 text-[13px] input-pill"
                      />
                      <button
                        onClick={() => {
                          if (newComment.trim()) {
                            onAddDiscussionComment(newComment.trim());
                            setNewComment('');
                          }
                        }}
                        disabled={!newComment.trim()}
                        className="w-9 h-9 flex items-center justify-center rounded-full bg-white/[0.04] hover:bg-white/[0.06] text-white/50 hover:text-white/70 transition-all duration-[180ms] disabled:opacity-30"
                      >
                        <Send className="w-4 h-4" />
                      </button>
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
