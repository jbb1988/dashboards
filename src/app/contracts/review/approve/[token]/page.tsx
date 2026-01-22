'use client';

import { useState, useEffect, use, useCallback } from 'react';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import ActivityLog, { ActivityLogEntry } from '@/components/contracts/ActivityLog';

// Dynamically import RedlineEditor to avoid SSR issues with TipTap
const RedlineEditor = dynamic(
  () => import('@/components/contracts/RedlineEditor'),
  { ssr: false, loading: () => <div className="h-[300px] bg-[#0B1220] rounded-lg animate-pulse" /> }
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

export default function ApprovalPage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = use(params);
  const [review, setReview] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [approverEmail, setApproverEmail] = useState('');
  const [convertingDocs, setConvertingDocs] = useState<Set<string>>(new Set());
  const [editorContent, setEditorContent] = useState<string | null>(null);
  const [hasEdits, setHasEdits] = useState(false);
  const [initialEditorContent, setInitialEditorContent] = useState<string | null>(null);

  useEffect(() => {
    fetchReviewByToken();
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
  }, [hasEdits, initialEditorContent]);

  const handleDecision = async (approve: boolean) => {
    if (!approve && !feedback.trim()) {
      alert('Feedback is required when rejecting a contract.');
      return;
    }

    if (!approverEmail.trim()) {
      alert('Please enter your email address.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/contracts/review/approvals/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: resolvedParams.token,
          decision: approve ? 'approve' : 'reject',
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

      setDecision(approve ? 'approve' : 'reject');
    } catch (err) {
      console.error('Error submitting decision:', err);
      alert('Failed to submit decision');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDocumentTypeColor = (type: string) => {
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
  };

  const openDocument = async (doc: Document) => {
    // For PDFs, open directly
    if (!isWordDocument(doc.fileName)) {
      window.open(doc.fileUrl, '_blank');
      return;
    }

    // For Word docs, check if we have a converted PDF
    if (doc.convertedPdfUrl) {
      window.open(doc.convertedPdfUrl, '_blank');
      return;
    }

    // Need to convert the Word doc to PDF first
    setConvertingDocs(prev => new Set(prev).add(doc.id));

    try {
      const response = await fetch('/api/contracts/documents/convert-to-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: doc.id,
          fileUrl: doc.fileUrl,
          fileName: doc.fileName,
        }),
      });

      const result = await response.json();

      if (result.pdfUrl) {
        // Update the document in state with the new PDF URL
        if (review) {
          setReview({
            ...review,
            documents: review.documents.map(d =>
              d.id === doc.id ? { ...d, convertedPdfUrl: result.pdfUrl } : d
            ),
          });
        }
        window.open(result.pdfUrl, '_blank');
      } else if (result.fallback) {
        // Conversion service not available, fall back to download
        alert('Document preview is not available. The file will download instead.');
        window.open(doc.fileUrl, '_blank');
      } else {
        alert('Failed to convert document for preview. Please try again.');
      }
    } catch (err) {
      console.error('Error converting document:', err);
      alert('Failed to convert document for preview. Please try again.');
    } finally {
      setConvertingDocs(prev => {
        const next = new Set(prev);
        next.delete(doc.id);
        return next;
      });
    }
  };

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

  return (
    <div className="min-h-screen bg-[#0B1220] p-6">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="text-3xl font-bold text-white mb-2">
            Contract Approval Request
          </h1>
          <p className="text-[#8FA3BF]">Review the analyzed contract and provide your decision</p>
        </motion.div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Contract Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-[#151F2E] border border-white/10 rounded-lg p-6"
        >
          <h2 className="text-xl font-bold text-white mb-1">{review.contractName}</h2>
          <p className="text-sm text-[#8FA3BF] mb-4">{review.provisionName}</p>
          <div className="flex flex-wrap gap-4 text-sm">
            <p className="text-[#8FA3BF]">
              <span className="text-white font-medium">Submitted by:</span> {review.submittedBy}
            </p>
            <p className="text-[#8FA3BF]">
              <span className="text-white font-medium">Submitted:</span> {formatDate(review.submittedAt)}
            </p>
          </div>
        </motion.div>

        {/* Analysis Summary Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-[#151F2E] border border-white/10 rounded-lg p-6"
        >
          <h3 className="text-lg font-bold text-white mb-4">Analysis Summary</h3>
          {review.summary.length > 0 ? (
            <ul className="space-y-2">
              {review.summary.map((item, idx) => (
                <motion.li
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + idx * 0.05 }}
                  className="text-sm text-[#8FA3BF] flex items-start gap-2"
                >
                  <span className="text-[#38BDF8] mt-1 flex-shrink-0">•</span>
                  <span>{item}</span>
                </motion.li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[#64748B]">No summary available</p>
          )}
        </motion.div>

        {/* Supporting Documents */}
        {review.documents.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-[#151F2E] border border-white/10 rounded-lg p-6"
          >
            <h3 className="text-lg font-bold text-white mb-4">Supporting Documents</h3>
            <div className="space-y-2">
              {review.documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between bg-[#0B1220] border border-white/10 rounded-lg p-3 hover:border-white/20 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <svg className="w-5 h-5 text-[#8FA3BF] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-sm text-white truncate">{doc.fileName}</span>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded border flex-shrink-0 ${getDocumentTypeColor(doc.documentType)}`}>
                      {doc.documentType}
                    </span>
                  </div>
                  <button
                    onClick={() => openDocument(doc)}
                    disabled={convertingDocs.has(doc.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#38BDF8]/10 text-[#38BDF8] rounded-lg hover:bg-[#38BDF8]/20 transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-wait"
                    title="Open in new tab"
                  >
                    {convertingDocs.has(doc.id) ? (
                      <>
                        <div className="w-4 h-4 border-2 border-[#38BDF8] border-t-transparent rounded-full animate-spin" />
                        Converting...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        Open
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Redlined Document with Editor */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-[#151F2E] border border-white/10 rounded-lg p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">Redlined Document</h3>
            {hasEdits && !decision && (
              <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded border border-blue-500/30">
                You have made edits
              </span>
            )}
          </div>
          <RedlineEditor
            initialContent={review.redlinedText}
            approverEditedContent={review.approverEditedText}
            onChange={handleEditorChange}
            readOnly={!!decision}
          />
        </motion.div>

        {/* Activity Log */}
        {review.activityLog && review.activityLog.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
          >
            <ActivityLog entries={review.activityLog} />
          </motion.div>
        )}

        {/* Decision Section */}
        {!decision && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-[#151F2E] border border-white/10 rounded-lg p-6"
          >
            <h3 className="text-lg font-bold text-white mb-4">Your Decision</h3>

            {/* Email Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-[#8FA3BF] mb-2">
                Your Email <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                value={approverEmail}
                onChange={(e) => setApproverEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full px-3 py-2 bg-[#0B1220] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#38BDF8]"
              />
            </div>

            {/* Feedback Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-[#8FA3BF] mb-2">
                Feedback <span className="text-sm text-[#64748B]">(required for rejection)</span>
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Add any comments or required changes..."
                rows={4}
                className="w-full px-3 py-2 bg-[#0B1220] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#38BDF8] resize-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => handleDecision(false)}
                disabled={submitting}
                className="flex-1 px-4 py-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-50 font-medium"
              >
                {submitting ? 'Rejecting...' : 'Reject'}
              </button>
              <button
                onClick={() => handleDecision(true)}
                disabled={submitting}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 font-medium"
              >
                {submitting ? 'Approving...' : 'Approve'}
              </button>
            </div>
          </motion.div>
        )}

        {/* Success State */}
        {decision && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`bg-[#151F2E] border rounded-lg p-6 ${
              decision === 'approve'
                ? 'border-green-500/30 bg-green-500/5'
                : 'border-red-500/30 bg-red-500/5'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              {decision === 'approve' ? (
                <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              <h3 className={`text-lg font-bold ${decision === 'approve' ? 'text-green-400' : 'text-red-400'}`}>
                {decision === 'approve' ? 'Contract Approved!' : 'Contract Rejected'}
              </h3>
            </div>
            <p className="text-sm text-[#8FA3BF]">
              {decision === 'approve'
                ? 'The legal team has been notified of your approval.'
                : 'The legal team will review your feedback and make necessary changes. They can resubmit for approval once updated.'}
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
