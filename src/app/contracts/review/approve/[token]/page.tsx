'use client';

import { useState, useEffect, use, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import Sidebar, { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from '@/components/Sidebar';
import ApprovalHeader from '@/components/contracts/ApprovalHeader';
import ApprovalContextSidebar from '@/components/contracts/ApprovalContextSidebar';
import { ActivityLogEntry } from '@/components/contracts/ActivityLog';

// Dynamically import RedlineEditor to avoid SSR issues with TipTap
const RedlineEditor = dynamic(
  () => import('@/components/contracts/RedlineEditor'),
  { ssr: false, loading: () => <div className="h-full bg-[var(--approval-bg-surface)] animate-pulse rounded-xl" /> }
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

// Check if file is a Word document
function isWordDocument(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return lower.endsWith('.docx') || lower.endsWith('.doc');
}

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

interface DocumentVersion {
  version: number;
  savedAt: string;
  savedBy?: string;
  fileId?: string;
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
  approverEmail?: string;
  approvalFeedback?: string;
  approverEditedText?: string | null;
  activityLog?: ActivityLogEntry[];
  riskScores?: RiskScores | null;
  documents: Document[];
  // OneDrive integration fields
  onedriveFileId?: string | null;
  onedriveWebUrl?: string | null;
  onedriveEmbedUrl?: string | null;
  documentVersions?: DocumentVersion[];
}

type ContextTab = 'summary' | 'activity' | 'documents' | 'annotations' | 'discussion';

interface DiscussionComment {
  id: string;
  authorEmail: string;
  authorName?: string;
  comment: string;
  createdAt: string;
}

export default function ApprovalPage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = use(params);
  const [review, setReview] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [approverEmail, setApproverEmail] = useState('');
  const [editorContent, setEditorContent] = useState<string | null>(null);
  const [hasEdits, setHasEdits] = useState(false);
  const [initialEditorContent, setInitialEditorContent] = useState<string | null>(null);

  // Layout state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [contextTab, setContextTab] = useState<ContextTab | null>('summary');
  const [contextSidebarOpen, setContextSidebarOpen] = useState(true);
  const [editorAnnotations, setEditorAnnotations] = useState<Comment[]>([]);
  const [discussionComments, setDiscussionComments] = useState<DiscussionComment[]>([]);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [pendingDecision, setPendingDecision] = useState<'approve' | 'reject' | null>(null);
  const [refreshingFromWord, setRefreshingFromWord] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchReviewByToken();
    fetchDiscussionComments();
    // Load sidebar collapsed state from localStorage
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved !== null) {
      setSidebarCollapsed(saved === 'true');
    }
  }, [resolvedParams.token]);

  const fetchDiscussionComments = async () => {
    try {
      const response = await fetch(`/api/contracts/review/comments?token=${resolvedParams.token}`);
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
    if (!approverEmail.trim()) {
      alert('Please enter your email address in the header before adding comments.');
      return;
    }

    try {
      const response = await fetch('/api/contracts/review/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: resolvedParams.token,
          authorEmail: approverEmail.trim(),
          comment,
        }),
      });

      if (response.ok) {
        // Refresh comments
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

  const fetchReviewByToken = async () => {
    try {
      const response = await fetch(`/api/contracts/review/by-token/${resolvedParams.token}`);

      if (!response.ok) {
        if (response.status === 404) {
          setError('Invalid approval link. The token may be incorrect.');
        } else if (response.status === 410) {
          setError('This approval link has expired. Please request a new approval.');
        } else {
          setError('Failed to load approval request.');
        }
        setLoading(false);
        return;
      }

      const data = await response.json();
      setReview(data);

      // Set initial editor content from approver edits or null
      if (data.approverEditedText) {
        setEditorContent(data.approverEditedText);
        setInitialEditorContent(data.approverEditedText);
      }

      // Check if already decided
      if (data.approvalStatus === 'approved' || data.approvalStatus === 'rejected') {
        setDecision(data.approvalStatus);
      }

      setLoading(false);
    } catch (err) {
      console.error('Error fetching review:', err);
      setError('Failed to load approval request.');
      setLoading(false);
    }
  };

  // Handler for editor content changes
  const handleEditorChange = useCallback((html: string) => {
    setEditorContent(html);
    // Mark as having edits if content differs from initial
    if (!hasEdits && html !== initialEditorContent) {
      setHasEdits(true);
    }
    // Extract comments from editor
    extractCommentsFromHTML(html);
  }, [hasEdits, initialEditorContent]);

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

  const handleApprove = useCallback(() => {
    if (!approverEmail.trim()) {
      alert('Please enter your email address in the header.');
      return;
    }
    setPendingDecision('approve');
    setShowFeedbackModal(true);
  }, [approverEmail]);

  const handleReject = useCallback(() => {
    if (!approverEmail.trim()) {
      alert('Please enter your email address in the header.');
      return;
    }
    setPendingDecision('reject');
    setShowFeedbackModal(true);
  }, [approverEmail]);

  const submitDecision = async () => {
    if (pendingDecision === 'reject' && !feedback.trim()) {
      alert('Feedback is required when rejecting a contract.');
      return;
    }

    setSubmitting(true);
    setShowFeedbackModal(false);

    try {
      const response = await fetch('/api/contracts/review/approvals/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: resolvedParams.token,
          decision: pendingDecision === 'approve' ? 'approve' : 'reject',
          feedback: feedback.trim() || null,
          approverEmail: approverEmail.trim(),
          editedText: editorContent,
          hasEdits,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        alert(result.error || 'Failed to submit decision');
        setSubmitting(false);
        return;
      }

      setDecision(pendingDecision);
    } catch (err) {
      console.error('Error submitting decision:', err);
      alert('Failed to submit decision');
    } finally {
      setSubmitting(false);
      setPendingDecision(null);
    }
  };

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

  // Refresh content from OneDrive Word document
  const refreshFromWord = useCallback(async () => {
    if (!review?.id) return;

    setRefreshingFromWord(true);
    try {
      const response = await fetch('/api/contracts/review/refresh-from-onedrive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId: review.id }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to refresh from Word');
      }

      const data = await response.json();

      // Update the review with new redlined text
      setReview(prev => prev ? {
        ...prev,
        redlinedText: data.redlinedText,
      } : null);

    } catch (err) {
      console.error('Error refreshing from Word:', err);
      alert(err instanceof Error ? err.message : 'Failed to refresh from Word');
    } finally {
      setRefreshingFromWord(false);
    }
  }, [review?.id]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--approval-bg-base)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#58A6FF] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[rgba(255,255,255,0.62)]">Loading approval request...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-[var(--approval-bg-base)] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[var(--approval-bg-panel)] border border-[#F85149]/30 rounded-lg p-8 text-center">
          <svg className="w-16 h-16 text-[#F85149] mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h1 className="text-xl font-semibold text-[rgba(255,255,255,0.88)] mb-2">Unable to Load Approval</h1>
          <p className="text-[rgba(255,255,255,0.62)] text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!review) {
    return null;
  }

  const mainSidebarWidth = sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;

  return (
    <div className="approval-canvas">
      {/* Main Navigation Sidebar (Left) */}
      <Sidebar
        isCollapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />

      {/* Main Content Area */}
      <motion.div
        animate={{ marginLeft: mainSidebarWidth }}
        transition={{ duration: 0.2 }}
        className="min-h-screen flex flex-col relative z-10"
      >
        {/* Header Bar */}
        <ApprovalHeader
          contractName={review.contractName}
          provisionName={review.provisionName}
          submittedBy={review.submittedBy}
          submittedAt={review.submittedAt}
          status={
            decision === 'approve' ? 'approved' :
            decision === 'reject' ? 'rejected' :
            (review.approvalStatus as 'pending' | 'approved' | 'rejected')
          }
          approverEmail={approverEmail}
          onApproverEmailChange={setApproverEmail}
          onApprove={handleApprove}
          onReject={handleReject}
          submitting={submitting}
          hasEdits={hasEdits}
          readOnly={!!decision}
          riskScores={review.riskScores}
        />

        {/* Main Content: Document + Context Sidebar */}
        <div className="flex-1 flex overflow-hidden">
          {/* Document Viewer Area - luminous canvas background */}
          <div className="flex-1 overflow-auto">
            {/* Document Container - floating luminous card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
              ref={editorRef}
              className="max-w-5xl mx-auto mt-10 mb-10 doc-surface min-h-[calc(100vh-160px)]"
            >
              {/* Redline Editor - text-based view */}
              <RedlineEditor
                initialContent={review.redlinedText}
                approverEditedContent={review.approverEditedText}
                onChange={handleEditorChange}
                readOnly={!!decision}
                contractName={review.contractName}
                onedriveEmbedUrl={review.onedriveEmbedUrl}
                onedriveWebUrl={review.onedriveWebUrl}
                onRefreshFromWord={refreshFromWord}
                refreshingFromWord={refreshingFromWord}
              />
            </motion.div>
          </div>

          {/* Context Sidebar (Right) - tonal contrast rail */}
          <ApprovalContextSidebar
            activeTab={contextTab}
            onTabChange={handleContextTabChange}
            isOpen={contextSidebarOpen}
            summary={[
              ...(review.reviewerNotes ? [`📝 Reviewer Notes: ${review.reviewerNotes}`] : []),
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
            canAddComments={!decision}
          />
        </div>
      </motion.div>

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="glass-panel rounded-xl p-6 max-w-md w-full shadow-2xl"
          >
            <h3 className="text-lg font-semibold text-[rgba(255,255,255,0.92)] mb-5">
              {pendingDecision === 'approve' ? 'Approve Contract' : 'Reject Contract'}
            </h3>

            <div className="mb-5">
              <label className="block text-sm font-medium text-[rgba(255,255,255,0.62)] mb-2">
                Feedback {pendingDecision === 'reject' && <span className="text-[#F85149]">*</span>}
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder={
                  pendingDecision === 'approve'
                    ? 'Optional comments or notes...'
                    : 'Please explain why you are rejecting this contract...'
                }
                rows={4}
                className="w-full px-4 py-3 bg-[var(--approval-bg-base)] border border-white/10 rounded-lg text-[rgba(255,255,255,0.88)] text-sm focus:outline-none focus:border-[#58A6FF] focus:ring-1 focus:ring-[#58A6FF]/30 resize-none placeholder:text-[rgba(255,255,255,0.35)] transition-all"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowFeedbackModal(false);
                  setPendingDecision(null);
                }}
                className="flex-1 px-4 py-2.5 text-sm font-medium bg-white/5 text-[rgba(255,255,255,0.62)] rounded-lg hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitDecision}
                disabled={submitting || (pendingDecision === 'reject' && !feedback.trim())}
                className={`flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all disabled:opacity-50 ${
                  pendingDecision === 'approve'
                    ? 'bg-[#238636] hover:bg-[#2ea043] text-white shadow-md shadow-[#238636]/25'
                    : 'bg-[#F85149]/15 border border-[#F85149]/40 text-[#F85149] hover:bg-[#F85149]/25'
                }`}
              >
                {submitting ? 'Submitting...' : pendingDecision === 'approve' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Success State Overlay */}
      {decision && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-6 right-6 z-50"
        >
          <div className={`px-5 py-3.5 rounded-xl shadow-2xl glass-panel ${
            decision === 'approve'
              ? 'border-[#238636]/40'
              : 'border-[#F85149]/40'
          }`}>
            <div className="flex items-center gap-3">
              {decision === 'approve' ? (
                <>
                  <div className="w-7 h-7 rounded-full bg-[#3FB950]/20 flex items-center justify-center">
                    <svg className="w-4 h-4 text-[#3FB950]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-[rgba(255,255,255,0.92)] font-semibold text-sm">Contract Approved</span>
                </>
              ) : (
                <>
                  <div className="w-7 h-7 rounded-full bg-[#F85149]/20 flex items-center justify-center">
                    <svg className="w-4 h-4 text-[#F85149]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <span className="text-[rgba(255,255,255,0.92)] font-semibold text-sm">Contract Rejected</span>
                </>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
