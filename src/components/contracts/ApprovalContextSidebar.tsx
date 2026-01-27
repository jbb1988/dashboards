'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  MessageCircle,
  Clock,
  Paperclip,
  Bookmark,
  ChevronRight,
  Download,
  ExternalLink,
  Send,
  AlertTriangle,
  CheckCircle,
  Info,
} from 'lucide-react';
import { ActivityLogEntry } from './ActivityLog';

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

interface DiscussionComment {
  id: string;
  authorEmail: string;
  authorName?: string;
  comment: string;
  createdAt: string;
}

type ContextTab = 'summary' | 'activity' | 'documents' | 'annotations' | 'discussion';

interface ApprovalContextSidebarProps {
  activeTab: ContextTab | null;
  onTabChange: (tab: ContextTab | null) => void;
  isOpen: boolean;
  summary: string[];
  activityLog: ActivityLogEntry[];
  documents: Document[];
  annotations: Comment[];
  discussionComments: DiscussionComment[];
  onViewDocument: (doc: Document) => void;
  onDownloadDocument: (doc: Document) => void;
  onAnnotationClick: (annotationId: string) => void;
  onAddDiscussionComment: (comment: string) => void;
  canAddComments: boolean;
}

const tabs: { id: ContextTab; icon: React.ElementType; label: string }[] = [
  { id: 'summary', icon: FileText, label: 'Summary' },
  { id: 'activity', icon: Clock, label: 'Activity' },
  { id: 'documents', icon: Paperclip, label: 'Documents' },
  { id: 'annotations', icon: Bookmark, label: 'Annotations' },
  { id: 'discussion', icon: MessageCircle, label: 'Discussion' },
];

function formatRelativeTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getActivityIcon(type: string) {
  switch (type) {
    case 'comment':
      return <MessageCircle className="w-3.5 h-3.5" />;
    case 'approval':
    case 'approved':
      return <CheckCircle className="w-3.5 h-3.5 text-[var(--accent-green)]" />;
    case 'rejection':
    case 'rejected':
      return <AlertTriangle className="w-3.5 h-3.5 text-[var(--accent-red)]" />;
    default:
      return <Info className="w-3.5 h-3.5" />;
  }
}

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
  canAddComments,
}: ApprovalContextSidebarProps) {
  const [newComment, setNewComment] = useState('');

  const handleSendComment = () => {
    if (newComment.trim()) {
      onAddDiscussionComment(newComment.trim());
      setNewComment('');
    }
  };

  // Parse summary items for categorization
  const parseSummaryItem = (item: string) => {
    if (item.startsWith('High Risk:') || item.toLowerCase().includes('high risk')) {
      return { type: 'high', text: item };
    }
    if (item.startsWith('Medium Risk:') || item.toLowerCase().includes('medium risk')) {
      return { type: 'medium', text: item };
    }
    if (item.startsWith('Low Risk:') || item.toLowerCase().includes('low risk')) {
      return { type: 'low', text: item };
    }
    if (item.includes('───')) {
      return { type: 'divider', text: item };
    }
    return { type: 'info', text: item };
  };

  return (
    <div className="flex h-full">
      {/* Icon Rail */}
      <div
        className="w-14 flex flex-col py-4 border-l border-[var(--border-subtle)]"
        style={{
          background: 'linear-gradient(180deg, rgba(16, 22, 34, 0.6), rgba(10, 16, 26, 0.8))',
        }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const count = tab.id === 'documents' ? documents.length :
                        tab.id === 'annotations' ? annotations.length :
                        tab.id === 'discussion' ? discussionComments.length : 0;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(isActive ? null : tab.id)}
              className={`
                relative w-full h-12 flex items-center justify-center transition-all duration-[180ms]
                ${isActive
                  ? 'text-[var(--accent-blue)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }
              `}
              title={tab.label}
            >
              {/* Active indicator - left accent bar */}
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-7 bg-[var(--accent-blue)] rounded-r"
                  transition={{ duration: 0.18 }}
                />
              )}
              {/* Backplate on active */}
              {isActive && (
                <div className="absolute inset-x-2 inset-y-1 rounded-lg bg-[var(--surface-active)]" />
              )}
              <Icon className="w-5 h-5 relative z-10" />
              {/* Count badge */}
              {count > 0 && (
                <span className="absolute top-1.5 right-2 w-4 h-4 flex items-center justify-center text-[9px] font-bold bg-[var(--accent-blue)] text-white rounded-full">
                  {count > 9 ? '9+' : count}
                </span>
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
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="context-rail h-full flex flex-col overflow-hidden"
          >
            {/* Panel Header */}
            <div className="flex-shrink-0 h-14 px-5 flex items-center border-b border-[var(--border-subtle)]">
              <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">
                {tabs.find(t => t.id === activeTab)?.label}
              </h2>
            </div>

            {/* Panel Body */}
            <div className="flex-1 overflow-y-auto">
              {/* Summary Tab */}
              {activeTab === 'summary' && (
                <div className="p-4 space-y-2">
                  {summary.length === 0 ? (
                    <p className="text-[13px] text-[var(--text-muted)] text-center py-8">
                      No summary available
                    </p>
                  ) : (
                    summary.map((item, index) => {
                      const parsed = parseSummaryItem(item);
                      if (parsed.type === 'divider') {
                        return <div key={index} className="h-px bg-[var(--border-subtle)] my-3" />;
                      }
                      return (
                        <div
                          key={index}
                          className={`context-item flex items-start gap-3 ${
                            parsed.type === 'high' ? 'border-l-2 border-l-[var(--accent-red)]' :
                            parsed.type === 'medium' ? 'border-l-2 border-l-[var(--accent-amber)]' :
                            parsed.type === 'low' ? 'border-l-2 border-l-[var(--accent-green)]' : ''
                          }`}
                        >
                          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                            parsed.type === 'high' ? 'bg-[var(--accent-red)]' :
                            parsed.type === 'medium' ? 'bg-[var(--accent-amber)]' :
                            parsed.type === 'low' ? 'bg-[var(--accent-green)]' :
                            'bg-[var(--accent-blue)]'
                          }`} />
                          <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed font-medium">
                            {parsed.text}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Activity Tab */}
              {activeTab === 'activity' && (
                <div className="p-4">
                  {activityLog.length === 0 ? (
                    <p className="text-[13px] text-[var(--text-muted)] text-center py-8">
                      No activity recorded
                    </p>
                  ) : (
                    <div className="relative">
                      {/* Timeline line */}
                      <div className="absolute left-[11px] top-3 bottom-3 w-[2px] bg-gradient-to-b from-[var(--accent-blue)]/40 via-[var(--border-subtle)] to-transparent" />
                      <div className="space-y-4">
                        {activityLog.map((entry, index) => (
                          <div key={`${entry.action}-${entry.at}-${index}`} className="flex gap-3 relative">
                            {/* Timeline dot */}
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${
                              entry.action === 'approved' ? 'bg-[var(--accent-green-glow)]' :
                              entry.action === 'rejected' ? 'bg-[var(--accent-red-glow)]' :
                              'bg-[var(--surface-card)]'
                            } border border-[var(--border-subtle)]`}>
                              {getActivityIcon(entry.action)}
                            </div>
                            <div className="flex-1 min-w-0 pt-0.5">
                              <p className="text-[13px] text-[var(--text-primary)] font-medium leading-snug capitalize">
                                {entry.action}
                              </p>
                              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                                {entry.by} · {formatRelativeTime(entry.at)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Documents Tab */}
              {activeTab === 'documents' && (
                <div className="p-2">
                  {documents.length === 0 ? (
                    <p className="text-[13px] text-[var(--text-muted)] text-center py-8">
                      No documents attached
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="context-item flex items-center gap-3 group cursor-pointer"
                          onClick={() => onViewDocument(doc)}
                        >
                          <div className="w-9 h-9 rounded-lg bg-[var(--surface-card)] flex items-center justify-center border border-[var(--border-subtle)]">
                            <Paperclip className="w-4 h-4 text-[var(--text-muted)]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] text-[var(--text-primary)] font-medium truncate group-hover:text-[var(--accent-blue)] transition-colors">
                              {doc.fileName}
                            </p>
                            <p className="text-[11px] text-[var(--text-muted)]">
                              {doc.documentType}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => { e.stopPropagation(); onViewDocument(doc); }}
                              className="tool-btn w-7 h-7"
                              title="Open"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); onDownloadDocument(doc); }}
                              className="tool-btn w-7 h-7"
                              title="Download"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Annotations Tab */}
              {activeTab === 'annotations' && (
                <div className="p-2">
                  {annotations.length === 0 ? (
                    <p className="text-[13px] text-[var(--text-muted)] text-center py-8">
                      No annotations added yet
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {annotations.map((annotation) => (
                        <button
                          key={annotation.id}
                          onClick={() => onAnnotationClick(annotation.id)}
                          className="context-item w-full text-left group"
                        >
                          {annotation.highlightedText && (
                            <p className="text-[12px] text-[var(--accent-amber)] font-medium mb-1 line-clamp-1 border-l-2 border-[var(--accent-amber)] pl-2">
                              "{annotation.highlightedText}"
                            </p>
                          )}
                          <div className="flex items-start gap-2">
                            <MessageCircle className="w-3.5 h-3.5 text-[var(--text-muted)] mt-0.5 flex-shrink-0" />
                            <p className="text-[13px] text-[var(--text-secondary)] line-clamp-2">
                              {annotation.text}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-[var(--text-muted)] absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Discussion Tab */}
              {activeTab === 'discussion' && (
                <div className="flex flex-col h-full">
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {discussionComments.length === 0 ? (
                      <p className="text-[13px] text-[var(--text-muted)] text-center py-8">
                        No discussion yet. Start the conversation!
                      </p>
                    ) : (
                      discussionComments.map((comment) => (
                        <div key={comment.id} className="flex gap-3">
                          <div className="w-8 h-8 rounded-full bg-[var(--surface-card)] flex items-center justify-center flex-shrink-0 border border-[var(--border-subtle)]">
                            <span className="text-[11px] text-[var(--text-secondary)] font-semibold">
                              {(comment.authorName || comment.authorEmail).charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2">
                              <span className="text-[12px] text-[var(--text-primary)] font-semibold">
                                {comment.authorName || comment.authorEmail.split('@')[0]}
                              </span>
                              <span className="text-[10px] text-[var(--text-muted)]">
                                {formatRelativeTime(comment.createdAt)}
                              </span>
                            </div>
                            <p className="text-[13px] text-[var(--text-secondary)] mt-1 leading-relaxed">
                              {comment.comment}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Comment Input */}
                  {canAddComments && (
                    <div className="flex-shrink-0 p-4 border-t border-[var(--border-subtle)]">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSendComment()}
                          placeholder="Add a comment..."
                          className="flex-1 h-10 px-4 text-[13px] input-pill"
                        />
                        <button
                          onClick={handleSendComment}
                          disabled={!newComment.trim()}
                          className="btn-primary w-10 h-10 flex items-center justify-center disabled:opacity-40"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
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
