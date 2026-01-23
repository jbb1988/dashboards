'use client';

import { useState, useEffect, use, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import Sidebar, { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from '@/components/Sidebar';
import ApprovalContextSidebar from '@/components/contracts/ApprovalContextSidebar';
import { ActivityLogEntry } from '@/components/contracts/ActivityLog';

// Dynamically import RedlineEditor to avoid SSR issues with TipTap
const RedlineEditor = dynamic(
  () => import('@/components/contracts/RedlineEditor'),
  { ssr: false, loading: () => <div className="h-full bg-[#0B1220] animate-pulse rounded" /> }
);

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

function isWordDocument(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return lower.endsWith('.docx') || lower.endsWith('.doc');
}

interface ReviewData {
  id: string;
  contractId?: string;
  contractName: string;
  provisionName: string;
  submittedBy: string;
  submittedAt: string;
  summary: string[];
  reviewerNotes?: string | null;
  originalText: string;
  redlinedText: string;
  modifiedText?: string;
  approvalStatus: string;
  approverEditedText?: string | null;
  activityLog?: ActivityLogEntry[];
  riskScores?: {
    summary: { high: number; medium: number; low: number };
    sections: Array<{ sectionTitle: string; riskLevel: 'high' | 'medium' | 'low' }>;
  } | null;
  documents: Document[];
  isCCView: boolean;
}

type ContextTab = 'summary' | 'activity' | 'documents' | 'annotations' | 'discussion';

interface DiscussionComment {
  id: string;
  authorEmail: string;
  authorName?: string;
  comment: string;
  createdAt: string;
}

export default function CCViewerPage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = use(params);
  const [review, setReview] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewerEmail, setViewerEmail] = useState('');
  const [emailSubmitted, setEmailSubmitted] = useState(false);

  // Layout state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [contextTab, setContextTab] = useState<ContextTab | null>('summary');
  const [contextSidebarOpen, setContextSidebarOpen] = useState(true);
  const [editorAnnotations, setEditorAnnotations] = useState<Comment[]>([]);
  const [discussionComments, setDiscussionComments] = useState<DiscussionComment[]>([]);

  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load sidebar collapsed state from localStorage
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved !== null) {
      setSidebarCollapsed(saved === 'true');
    }
  }, []);

  useEffect(() => {
    if (emailSubmitted) {
      fetchReviewByCCToken();
      fetchDiscussionComments();
    }
  }, [resolvedParams.token, emailSubmitted, viewerEmail]);

  const fetchDiscussionComments = async () => {
    try {
      const response = await fetch(`/api/contracts/review/comments?cc_token=${resolvedParams.token}`);
      if (response.ok) {
        const data = await response.json();
        setDiscussionComments(data.comments.map((c: { id: string; author_email: string; author_name?: string; comment: string; created_at: string }) => ({
          id: c.id,
          authorEmail: c.author_email,
          authorName: c.author_name,
          comment: c.comment,
          createdAt: c.created_at,
        })));
      }
    } catch (err) {
      console.error('Failed to fetch discussion comments:', err);
    }
  };

  const handleAddDiscussionComment = async (comment: string) => {
    if (!viewerEmail.trim()) {
      alert('Email is required to add comments.');
      return;
    }

    try {
      const response = await fetch('/api/contracts/review/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cc_token: resolvedParams.token,
          authorEmail: viewerEmail.trim(),
          comment,
        }),
      });

      if (response.ok) {
        fetchDiscussionComments();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to add comment');
      }
    } catch (err) {
      console.error('Failed to add comment:', err);
      alert('Failed to add comment');
    }
  };

  const fetchReviewByCCToken = async () => {
    try {
      const emailParam = viewerEmail ? `?viewer=${encodeURIComponent(viewerEmail)}` : '';
      const response = await fetch(`/api/contracts/review/by-cc-token/${resolvedParams.token}${emailParam}`);

      if (!response.ok) {
        if (response.status === 404) {
          setError('Invalid link. The token may be incorrect.');
        } else if (response.status === 410) {
          setError('This link has expired.');
        } else {
          setError('Failed to load contract review.');
        }
        setLoading(false);
        return;
      }

      const data = await response.json();
      setReview(data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching review:', err);
      setError('Failed to load contract review.');
      setLoading(false);
    }
  };

  const handleEditorChange = useCallback((html: string) => {
    extractCommentsFromHTML(html);
  }, []);

  const extractCommentsFromHTML = useCallback((html: string) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const commentElements = doc.querySelectorAll('span[data-approver-comment]');
    const newComments: Comment[] = [];

    commentElements.forEach((el, index) => {
      const id = el.getAttribute('data-comment-id') || `comment-${index}`;
      const text = el.getAttribute('data-comment') || '';
      const highlightedText = el.textContent || '';
      if (text || highlightedText) {
        newComments.push({ id, text, highlightedText });
      }
    });

    setEditorAnnotations(newComments);
  }, []);

  const handleContextTabChange = useCallback((tab: ContextTab | null) => {
    if (tab === null) {
      setContextSidebarOpen(false);
      setContextTab(null);
    } else {
      setContextTab(tab);
      setContextSidebarOpen(true);
    }
  }, []);

  const openDocumentOnline = useCallback((doc: Document) => {
    if (isWordDocument(doc.fileName)) {
      const viewerUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(doc.fileUrl)}`;
      window.open(viewerUrl, '_blank');
      return;
    }
    window.open(doc.fileUrl, '_blank');
  }, []);

  const downloadDocument = useCallback(async (doc: Document) => {
    try {
      const response = await fetch(doc.fileUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading file:', err);
      window.open(doc.fileUrl, '_blank');
    }
  }, []);

  const scrollToAnnotation = useCallback((annotationId: string) => {
    if (!editorRef.current) return;
    const annotationElement = editorRef.current.querySelector(
      `span[data-comment-id="${annotationId}"]`
    );
    if (annotationElement) {
      annotationElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      annotationElement.classList.add('ring-2', 'ring-yellow-400');
      setTimeout(() => {
        annotationElement.classList.remove('ring-2', 'ring-yellow-400');
      }, 2000);
    }
  }, []);

  // Email entry screen
  if (!emailSubmitted) {
    return (
      <div className="min-h-screen bg-[#0B1220] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#151F2E] border border-[#8B5CF6]/30 rounded-lg p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-[#8B5CF6]/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[#A78BFA]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white mb-2">Contract Review</h1>
            <p className="text-[#8FA3BF] text-sm">
              You've been CC'd on this contract review. Enter your email to view.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#8FA3BF] mb-2">
                Your Email Address
              </label>
              <input
                type="email"
                value={viewerEmail}
                onChange={(e) => setViewerEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full px-4 py-3 bg-[#0B1220] border border-white/10 rounded-lg text-white placeholder-[#64748B] focus:outline-none focus:border-[#8B5CF6]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && viewerEmail.trim()) {
                    setEmailSubmitted(true);
                  }
                }}
              />
            </div>

            <button
              onClick={() => setEmailSubmitted(true)}
              disabled={!viewerEmail.trim()}
              className="w-full py-3 bg-gradient-to-r from-[#8B5CF6] to-[#6366F1] text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              View Contract Review
            </button>

            <p className="text-[10px] text-[#64748B] text-center">
              Your view will be logged in the activity history
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B1220] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#8B5CF6] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#8FA3BF]">Loading contract review...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-[#0B1220] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#151F2E] border border-red-500/30 rounded-lg p-8 text-center">
          <svg className="w-16 h-16 text-red-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h1 className="text-xl font-bold text-white mb-2">Unable to Load</h1>
          <p className="text-[#8FA3BF] text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!review) {
    return null;
  }

  const mainSidebarWidth = sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;

  // Get status display
  const statusDisplay = review.approvalStatus === 'approved' ? 'Approved' :
    review.approvalStatus === 'rejected' ? 'Rejected' : 'Pending Approval';
  const statusColor = review.approvalStatus === 'approved' ? 'text-green-400' :
    review.approvalStatus === 'rejected' ? 'text-red-400' : 'text-yellow-400';

  return (
    <div className="min-h-screen bg-[#0B1220]">
      {/* Main Navigation Sidebar (Left) */}
      <Sidebar
        isCollapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />

      {/* Main Content Area */}
      <motion.div
        animate={{ marginLeft: mainSidebarWidth }}
        transition={{ duration: 0.2 }}
        className="min-h-screen flex flex-col"
      >
        {/* CC Viewer Header */}
        <div className="bg-[#151F2E] border-b border-white/10 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* CC Badge */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#8B5CF6]/20 border border-[#8B5CF6]/30 rounded-full">
                <svg className="w-4 h-4 text-[#A78BFA]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <span className="text-[#A78BFA] text-xs font-medium">CC View (Read Only)</span>
              </div>

              {/* Contract Info */}
              <div>
                <h1 className="text-lg font-bold text-white">{review.contractName}</h1>
                <p className="text-sm text-[#8FA3BF]">
                  {review.provisionName} &middot; Submitted by {review.submittedBy}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Risk Summary (if available) */}
              {review.riskScores && (
                <div className="flex items-center gap-2">
                  {review.riskScores.summary.high > 0 && (
                    <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs font-medium rounded">
                      {review.riskScores.summary.high} High
                    </span>
                  )}
                  {review.riskScores.summary.medium > 0 && (
                    <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs font-medium rounded">
                      {review.riskScores.summary.medium} Medium
                    </span>
                  )}
                  {review.riskScores.summary.low > 0 && (
                    <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs font-medium rounded">
                      {review.riskScores.summary.low} Low
                    </span>
                  )}
                </div>
              )}

              {/* Status Badge */}
              <span className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                review.approvalStatus === 'approved' ? 'bg-green-500/20 text-green-400' :
                review.approvalStatus === 'rejected' ? 'bg-red-500/20 text-red-400' :
                'bg-yellow-500/20 text-yellow-400'
              }`}>
                {statusDisplay}
              </span>

              {/* Viewing As */}
              <div className="text-right">
                <p className="text-[10px] text-[#64748B]">Viewing as</p>
                <p className="text-sm text-white">{viewerEmail}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content: Document + Context Sidebar */}
        <div className="flex-1 flex overflow-hidden">
          {/* Document Viewer Area */}
          <div className="flex-1 overflow-auto bg-[#0B1220]">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              ref={editorRef}
              className="min-h-[calc(100vh-60px)]"
            >
              <RedlineEditor
                initialContent={review.redlinedText}
                approverEditedContent={review.approverEditedText}
                onChange={handleEditorChange}
                readOnly={true}
                contractName={review.contractName}
              />
            </motion.div>
          </div>

          {/* Context Sidebar (Right) */}
          <ApprovalContextSidebar
            activeTab={contextTab}
            onTabChange={handleContextTabChange}
            isOpen={contextSidebarOpen}
            summary={[
              ...(review.reviewerNotes ? [`📝 REVIEWER NOTES: ${review.reviewerNotes}`] : []),
              ...(review.reviewerNotes && review.summary.length > 0 ? ['───────────────────'] : []),
              ...review.summary
            ]}
            activityLog={review.activityLog || []}
            documents={review.documents}
            annotations={editorAnnotations}
            discussionComments={discussionComments}
            onViewDocument={openDocumentOnline}
            onDownloadDocument={downloadDocument}
            onAnnotationClick={scrollToAnnotation}
            onAddDiscussionComment={handleAddDiscussionComment}
            canAddComments={true}
          />
        </div>
      </motion.div>
    </div>
  );
}
