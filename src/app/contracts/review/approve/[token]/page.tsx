'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

interface ReviewData {
  id: string;
  contractName: string;
  provisionName: string;
  submittedBy: string;
  submittedAt: string;
  summary: string[];
  originalText: string;
  redlinedText: string;
  modifiedText?: string;
  approvalStatus: string;
}

export default function ApprovalPage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const [review, setReview] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [approverEmail, setApproverEmail] = useState('');

  useEffect(() => {
    fetchReviewByToken();
  }, [params.token]);

  const fetchReviewByToken = async () => {
    try {
      const response = await fetch(`/api/contracts/review/by-token/${params.token}`);

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
          token: params.token,
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Summary & Decision */}
        <div className="space-y-6">
          {/* Contract Info Card */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-[#151F2E] border border-white/10 rounded-lg p-6"
          >
            <h2 className="text-xl font-bold text-white mb-1">{review.contractName}</h2>
            <p className="text-sm text-[#8FA3BF] mb-4">{review.provisionName}</p>
            <div className="space-y-2 text-sm">
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
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
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

          {/* Decision Section */}
          {!decision && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
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

        {/* Right: Document Preview */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-[#151F2E] border border-white/10 rounded-lg p-6 h-fit lg:sticky lg:top-6"
        >
          <h3 className="text-lg font-bold text-white mb-4">Redlined Document</h3>

          {/* Document viewer */}
          <div className="bg-[#0B1220] border border-white/10 rounded-lg p-4 max-h-[600px] overflow-y-auto">
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
      </div>
    </div>
  );
}
