'use client';

import { useState, useEffect, use, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import Sidebar, { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from '@/components/Sidebar';
import ApprovalHeader from '@/components/contracts/ApprovalHeader';
import ApprovalContextSidebar from '@/components/contracts/ApprovalContextSidebar';
import { ActivityLogEntry } from '@/components/contracts/ActivityLog';

// Dynamically import components to avoid SSR issues
const RedlineEditor = dynamic(
  () => import('@/components/contracts/RedlineEditor'),
  { ssr: false, loading: () => <div className="h-full bg-[#161B22] animate-pulse rounded" /> }
);

const DecisionList = dynamic(
  () => import('@/components/contracts/DecisionList'),
  { ssr: false, loading: () => <div className="h-full bg-[#161B22] animate-pulse rounded" /> }
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
  const [viewMode, setViewMode] = useState<'decisions' | 'redlines'>('decisions');

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
      <div className="min-h-screen bg-[#161B22] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-[#58A6FF] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#8B949E] text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-[#161B22] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#1E2328] border border-white/5 rounded-lg p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-[#F85149]/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-[#F85149]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
            </svg>
          </div>
          <h1 className="text-base font-medium text-[#E6EDF3] mb-2">Unable to Load</h1>
          <p className="text-[#8B949E] text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!review) {
    return null;
  }

  const mainSidebarWidth = sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;

  return (
    <div className="min-h-screen bg-[#161B22]">
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
          {/* Document Viewer Area */}
          <div className="flex-1 overflow-hidden bg-[#161B22]">
            {/* View Mode Toggle - minimal */}
            <div className="px-4 py-2 border-b border-white/5 bg-[#1E2328] flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setViewMode('decisions')}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                    viewMode === 'decisions'
                      ? 'bg-[#58A6FF]/15 text-[#58A6FF]'
                      : 'text-[#8B949E] hover:text-[#E6EDF3]'
                  }`}
                >
                  Decisions
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('redlines')}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                    viewMode === 'redlines'
                      ? 'bg-[#58A6FF]/15 text-[#58A6FF]'
                      : 'text-[#8B949E] hover:text-[#E6EDF3]'
                  }`}
                >
                  Full Document
                </button>
              </div>
            </div>

            {/* Document Container */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              ref={editorRef}
              className="h-[calc(100vh-60px-41px)] overflow-hidden"
            >
              {viewMode === 'decisions' ? (
                <DecisionList
                  redlinedText={review.redlinedText}
                  riskScores={review.riskScores}
                  summaries={review.summary}
                  readOnly={!!decision}
                  contractName={review.contractName}
                  onRefreshFromWord={refreshFromWord}
                  refreshingFromWord={refreshingFromWord}
                />
              ) : (
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
              )}
            </motion.div>
          </div>

          {/* Context Sidebar (Right) - wider */}
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
            canAddComments={!decision}
          />
        </div>
      </motion.div>

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 bg-[#161B22]/80 flex items-center justify-center z-50 p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#1E2328] border border-white/5 rounded-lg p-6 max-w-md w-full"
          >
            <h3 className="text-base font-medium text-[#E6EDF3] mb-4">
              {pendingDecision === 'approve' ? 'Approve Contract' : 'Reject Contract'}
            </h3>

            <div className="mb-4">
              <label className="block text-sm text-[#8B949E] mb-2">
                Feedback {pendingDecision === 'reject' && <span className="text-[#F85149]">*</span>}
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder={
                  pendingDecision === 'approve'
                    ? 'Optional comments...'
                    : 'Reason for rejection...'
                }
                rows={4}
                className="w-full px-3 py-2 bg-[#161B22] border border-white/10 rounded text-[#E6EDF3] text-sm focus:outline-none focus:border-[#58A6FF] resize-none placeholder:text-[#484F58]"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowFeedbackModal(false);
                  setPendingDecision(null);
                }}
                className="flex-1 px-4 py-2 text-sm text-[#8B949E] hover:text-[#E6EDF3] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitDecision}
                disabled={submitting || (pendingDecision === 'reject' && !feedback.trim())}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded transition-colors disabled:opacity-50 ${
                  pendingDecision === 'approve'
                    ? 'bg-[#238636] hover:bg-[#2ea043] text-white'
                    : 'text-[#F85149] hover:bg-[#F85149]/10'
                }`}
              >
                {submitting ? 'Submitting...' : pendingDecision === 'approve' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Success State - minimal toast */}
      {decision && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-6 right-6 z-50"
        >
          <div className="px-4 py-2 rounded bg-[#1E2328] border border-white/5 text-sm">
            {decision === 'approve' ? (
              <span className="text-[#3FB950]">Approved</span>
            ) : (
              <span className="text-[#F85149]">Rejected</span>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
