'use client';

import { useState, useEffect, use } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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
  authorEmail: string;
  authorName: string | null;
  comment: string;
  createdAt: string;
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
  documents: Document[];
  comments: Comment[];
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

  // Document preview state
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);

  // Comments state
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentAuthorName, setCommentAuthorName] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Sections expanded state
  const [documentsExpanded, setDocumentsExpanded] = useState(true);
  const [commentsExpanded, setCommentsExpanded] = useState(true);

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
      setComments(data.comments || []);

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

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    if (!approverEmail.trim()) {
      alert('Please enter your email address first.');
      return;
    }

    setSubmittingComment(true);
    try {
      const response = await fetch('/api/contracts/review/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: resolvedParams.token,
          authorEmail: approverEmail.trim(),
          authorName: commentAuthorName.trim() || null,
          comment: newComment.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        alert(result.error || 'Failed to add comment');
        setSubmittingComment(false);
        return;
      }

      // Add the new comment to the list
      setComments([...comments, {
        id: result.comment.id,
        authorEmail: result.comment.author_email,
        authorName: result.comment.author_name,
        comment: result.comment.comment,
        createdAt: result.comment.created_at,
      }]);
      setNewComment('');
    } catch (err) {
      console.error('Error adding comment:', err);
      alert('Failed to add comment');
    } finally {
      setSubmittingComment(false);
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

  const formatCommentDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
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

  const getPreviewUrl = (doc: Document) => {
    // If we have a converted PDF URL, use that
    if (doc.convertedPdfUrl) {
      return doc.convertedPdfUrl;
    }
    // For PDFs, use the direct URL
    if (doc.mimeType === 'application/pdf' || doc.fileName.toLowerCase().endsWith('.pdf')) {
      return doc.fileUrl;
    }
    // For DOCX files, we'll need to convert them (API call would be needed)
    return null;
  };

  const toggleDocPreview = (docId: string) => {
    if (expandedDoc === docId) {
      setExpandedDoc(null);
    } else {
      setExpandedDoc(docId);
      setPreviewLoading(docId);
    }
  };

  const handleDownload = (doc: Document) => {
    window.open(doc.fileUrl, '_blank');
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

  // Group documents by type
  const groupedDocs = review.documents.reduce((acc, doc) => {
    const type = doc.documentType || 'Other';
    if (!acc[type]) acc[type] = [];
    acc[type].push(doc);
    return acc;
  }, {} as Record<string, Document[]>);

  return (
    <div className="min-h-screen bg-[#0B1220] p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="text-3xl font-bold text-white mb-2">
            Contract Approval Request
          </h1>
          <p className="text-[#8FA3BF]">Review the AI-analyzed contract and provide your decision</p>
        </motion.div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto space-y-6">
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

        {/* AI Summary Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-[#151F2E] border border-white/10 rounded-lg p-6"
        >
          <h3 className="text-lg font-bold text-white mb-4">AI Analysis Summary</h3>
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
        </motion.div>

        {/* Supporting Documents Section */}
        {review.documents.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-[#151F2E] border border-white/10 rounded-lg overflow-hidden"
          >
            <button
              onClick={() => setDocumentsExpanded(!documentsExpanded)}
              className="w-full flex items-center justify-between p-6 text-left hover:bg-white/5 transition-colors"
            >
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-[#38BDF8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Supporting Documents ({review.documents.length})
              </h3>
              <svg
                className={`w-5 h-5 text-[#8FA3BF] transition-transform ${documentsExpanded ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <AnimatePresence>
              {documentsExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-6 pb-6 space-y-4">
                    {Object.entries(groupedDocs).map(([type, docs]) => (
                      <div key={type}>
                        <h4 className="text-xs font-semibold text-[#8FA3BF] uppercase tracking-wider mb-2">
                          {type}
                        </h4>
                        <div className="space-y-2">
                          {docs.map((doc) => (
                            <div key={doc.id}>
                              <div className="flex items-center justify-between bg-[#0B1220] border border-white/10 rounded-lg p-3">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <button
                                    onClick={() => toggleDocPreview(doc.id)}
                                    className="text-[#8FA3BF] hover:text-white transition-colors flex-shrink-0"
                                  >
                                    <svg
                                      className={`w-5 h-5 transition-transform ${expandedDoc === doc.id ? 'rotate-90' : ''}`}
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                  </button>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm text-white truncate">{doc.fileName}</p>
                                    <p className="text-xs text-[#64748B]">
                                      Uploaded {formatCommentDate(doc.uploadedAt)}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className={`px-2 py-0.5 text-xs font-medium rounded border ${getDocumentTypeColor(doc.documentType)}`}>
                                    {doc.documentType}
                                  </span>
                                  <button
                                    onClick={() => toggleDocPreview(doc.id)}
                                    className="px-2 py-1 text-xs bg-[#38BDF8]/10 text-[#38BDF8] rounded hover:bg-[#38BDF8]/20 transition-colors"
                                  >
                                    Preview
                                  </button>
                                  <button
                                    onClick={() => handleDownload(doc)}
                                    className="px-2 py-1 text-xs bg-white/10 text-white rounded hover:bg-white/20 transition-colors"
                                  >
                                    Download
                                  </button>
                                </div>
                              </div>

                              {/* Expanded Preview */}
                              <AnimatePresence>
                                {expandedDoc === doc.id && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                  >
                                    <div className="mt-2 bg-[#0B1220] border border-[#38BDF8]/30 rounded-lg p-4">
                                      <div className="flex items-center justify-between mb-3">
                                        <h5 className="text-sm font-medium text-white">
                                          Preview: {doc.fileName}
                                        </h5>
                                        <button
                                          onClick={() => setExpandedDoc(null)}
                                          className="text-[#8FA3BF] hover:text-white"
                                        >
                                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                        </button>
                                      </div>
                                      {(() => {
                                        const previewUrl = getPreviewUrl(doc);
                                        if (previewUrl) {
                                          return (
                                            <iframe
                                              src={previewUrl}
                                              className="w-full h-[500px] rounded border border-white/10"
                                              onLoad={() => setPreviewLoading(null)}
                                            />
                                          );
                                        }
                                        // For DOCX without converted PDF
                                        if (doc.fileName.toLowerCase().endsWith('.docx') || doc.fileName.toLowerCase().endsWith('.doc')) {
                                          return (
                                            <div className="text-center py-8">
                                              <svg className="w-12 h-12 text-[#8FA3BF] mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                              </svg>
                                              <p className="text-[#8FA3BF] mb-2">Word document preview not available</p>
                                              <button
                                                onClick={() => handleDownload(doc)}
                                                className="px-4 py-2 text-sm bg-[#38BDF8]/10 text-[#38BDF8] rounded-lg hover:bg-[#38BDF8]/20 transition-colors"
                                              >
                                                Download to View
                                              </button>
                                            </div>
                                          );
                                        }
                                        return (
                                          <div className="text-center py-8 text-[#8FA3BF]">
                                            Preview not available for this file type
                                          </div>
                                        );
                                      })()}
                                      {previewLoading === doc.id && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-[#0B1220]/80">
                                          <div className="w-8 h-8 border-4 border-[#38BDF8] border-t-transparent rounded-full animate-spin" />
                                        </div>
                                      )}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Redlined Document */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-[#151F2E] border border-white/10 rounded-lg p-6"
        >
          <h3 className="text-lg font-bold text-white mb-4">Redlined Document</h3>
          <div className="bg-[#0B1220] border border-white/10 rounded-lg p-4 max-h-[400px] overflow-y-auto">
            <div className="space-y-4">
              {/* Original Text */}
              <div>
                <h4 className="text-xs font-semibold text-[#8FA3BF] uppercase tracking-wider mb-2">Original</h4>
                <div className="text-sm text-[#8FA3BF] whitespace-pre-wrap leading-relaxed">
                  {review.originalText}
                </div>
              </div>

              <div className="h-px bg-white/10" />

              {/* Redlined Text */}
              <div>
                <h4 className="text-xs font-semibold text-[#38BDF8] uppercase tracking-wider mb-2">Redlined</h4>
                <div className="text-sm text-white whitespace-pre-wrap leading-relaxed">
                  {review.redlinedText}
                </div>
              </div>

              {/* Modified Text (if available) */}
              {review.modifiedText && (
                <>
                  <div className="h-px bg-white/10" />
                  <div>
                    <h4 className="text-xs font-semibold text-[#22C55E] uppercase tracking-wider mb-2">Modified</h4>
                    <div className="text-sm text-white whitespace-pre-wrap leading-relaxed">
                      {review.modifiedText}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </motion.div>

        {/* Comments Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-[#151F2E] border border-white/10 rounded-lg overflow-hidden"
        >
          <button
            onClick={() => setCommentsExpanded(!commentsExpanded)}
            className="w-full flex items-center justify-between p-6 text-left hover:bg-white/5 transition-colors"
          >
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-[#38BDF8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Comments ({comments.length})
            </h3>
            <svg
              className={`w-5 h-5 text-[#8FA3BF] transition-transform ${commentsExpanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <AnimatePresence>
            {commentsExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-6 pb-6 space-y-4">
                  {/* Existing Comments */}
                  {comments.length > 0 ? (
                    <div className="space-y-3 max-h-[300px] overflow-y-auto">
                      {comments.map((comment) => (
                        <div
                          key={comment.id}
                          className="bg-[#0B1220] border border-white/10 rounded-lg p-4"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-full bg-[#38BDF8]/20 flex items-center justify-center">
                              <span className="text-[#38BDF8] text-sm font-medium">
                                {(comment.authorName || comment.authorEmail).charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm text-white font-medium">
                                {comment.authorName || comment.authorEmail.split('@')[0]}
                              </p>
                              <p className="text-xs text-[#64748B]">
                                {formatCommentDate(comment.createdAt)}
                              </p>
                            </div>
                          </div>
                          <p className="text-sm text-[#8FA3BF] pl-10">
                            {comment.comment}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-[#8FA3BF] text-sm">
                      No comments yet. Start the conversation.
                    </div>
                  )}

                  {/* Add Comment Form */}
                  <div className="border-t border-white/10 pt-4">
                    <div className="flex gap-3 mb-3">
                      <input
                        type="text"
                        value={commentAuthorName}
                        onChange={(e) => setCommentAuthorName(e.target.value)}
                        placeholder="Your name (optional)"
                        className="flex-1 px-3 py-2 bg-[#0B1220] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#38BDF8]"
                      />
                    </div>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleAddComment();
                          }
                        }}
                        placeholder="Add a comment..."
                        className="flex-1 px-3 py-2 bg-[#0B1220] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#38BDF8]"
                      />
                      <button
                        onClick={handleAddComment}
                        disabled={submittingComment || !newComment.trim()}
                        className="px-4 py-2 bg-[#38BDF8] text-white rounded-lg hover:bg-[#38BDF8]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
                      >
                        {submittingComment ? 'Sending...' : 'Send'}
                      </button>
                    </div>
                    {!approverEmail.trim() && (
                      <p className="text-xs text-amber-400 mt-2">
                        Enter your email in the Decision section below to add comments
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Decision Section */}
        {!decision && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
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
                className="flex-1 px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-50 font-medium"
              >
                {submitting ? 'Rejecting...' : 'Reject'}
              </button>
              <button
                onClick={() => handleDecision(true)}
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 font-medium"
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
                : 'The legal team will review your feedback and make necessary changes.'}
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
