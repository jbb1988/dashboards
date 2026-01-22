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

// Check if file is a Word document
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
  originalText: string;
  redlinedText: string;
  modifiedText?: string;
  approvalStatus: string;
  approverEmail?: string;
  approvalFeedback?: string;
  approverEditedText?: string | null;
  activityLog?: ActivityLogEntry[];
  documents: Document[];
}

type ContextTab = 'summary' | 'activity' | 'documents' | 'comments';

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
  const [editorComments, setEditorComments] = useState<Comment[]>([]);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [pendingDecision, setPendingDecision] = useState<'approve' | 'reject' | null>(null);

  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchReviewByToken();
    // Load sidebar collapsed state from localStorage
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved !== null) {
      setSidebarCollapsed(saved === 'true');
    }
  }, [resolvedParams.token]);

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

    setEditorComments(newComments);
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

  const scrollToComment = useCallback((commentId: string) => {
    if (!editorRef.current) return;
    const commentElement = editorRef.current.querySelector(
      `span[data-comment-id="${commentId}"]`
    );
    if (commentElement) {
      commentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      commentElement.classList.add('ring-2', 'ring-yellow-400');
      setTimeout(() => {
        commentElement.classList.remove('ring-2', 'ring-yellow-400');
      }, 2000);
    }
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B1220] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#38BDF8] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#8FA3BF]">Loading approval request...</p>
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
          <h1 className="text-xl font-bold text-white mb-2">Unable to Load Approval</h1>
          <p className="text-[#8FA3BF] text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!review) {
    return null;
  }

  const mainSidebarWidth = sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;

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
        />

        {/* Main Content: Document + Context Sidebar */}
        <div className="flex-1 flex overflow-hidden">
          {/* Document Viewer Area - aligned left */}
          <div className="flex-1 overflow-auto bg-[#0B1220]">
            {/* Document Container */}
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
                readOnly={!!decision}
                contractName={review.contractName}
              />
            </motion.div>
          </div>

          {/* Context Sidebar (Right) - wider */}
          <ApprovalContextSidebar
            activeTab={contextTab}
            onTabChange={handleContextTabChange}
            isOpen={contextSidebarOpen}
            summary={review.summary}
            activityLog={review.activityLog || []}
            documents={review.documents}
            comments={editorComments}
            onViewDocument={openDocumentOnline}
            onDownloadDocument={downloadDocument}
            onCommentClick={scrollToComment}
          />
        </div>
      </motion.div>

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#151F2E] border border-white/10 rounded-lg p-6 max-w-md w-full"
          >
            <h3 className="text-lg font-bold text-white mb-4">
              {pendingDecision === 'approve' ? 'Approve Contract' : 'Reject Contract'}
            </h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-[#8FA3BF] mb-2">
                Feedback {pendingDecision === 'reject' && <span className="text-red-400">*</span>}
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
                className="w-full px-3 py-2 bg-[#0B1220] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#38BDF8] resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowFeedbackModal(false);
                  setPendingDecision(null);
                }}
                className="flex-1 px-4 py-2 text-sm bg-white/5 text-[#8FA3BF] rounded-lg hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitDecision}
                disabled={submitting || (pendingDecision === 'reject' && !feedback.trim())}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
                  pendingDecision === 'approve'
                    ? 'bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white hover:opacity-90'
                    : 'bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30'
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
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed bottom-6 right-6 z-50"
        >
          <div className={`px-4 py-3 rounded-lg shadow-lg ${
            decision === 'approve'
              ? 'bg-green-500/20 border border-green-500/30'
              : 'bg-red-500/20 border border-red-500/30'
          }`}>
            <div className="flex items-center gap-2">
              {decision === 'approve' ? (
                <>
                  <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-green-400 font-medium text-sm">Contract Approved</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span className="text-red-400 font-medium text-sm">Contract Rejected</span>
                </>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
