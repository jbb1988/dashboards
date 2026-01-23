'use client';

import { motion } from 'framer-motion';

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

interface ApprovalHeaderProps {
  contractName: string;
  provisionName: string;
  submittedBy: string;
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  approverEmail: string;
  onApproverEmailChange: (email: string) => void;
  onApprove: () => void;
  onReject: () => void;
  submitting: boolean;
  hasEdits: boolean;
  readOnly: boolean;
  riskScores?: RiskScores | null;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function ApprovalHeader({
  contractName,
  provisionName,
  submittedBy,
  submittedAt,
  status,
  approverEmail,
  onApproverEmailChange,
  onApprove,
  onReject,
  submitting,
  hasEdits,
  readOnly,
  riskScores,
}: ApprovalHeaderProps) {
  const getStatusBadge = () => {
    switch (status) {
      case 'approved':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded bg-green-500/20 text-green-400 border border-green-500/30">
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded bg-red-500/20 text-red-400 border border-red-500/30">
            Rejected
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 text-xs font-medium rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
            Pending Review
          </span>
        );
    }
  };

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-[60px] bg-[#151F2E] border-b border-white/10 flex items-center px-6 gap-4 sticky top-0 z-40"
    >
      {/* Contract Info */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="min-w-0">
          <h1 className="text-sm font-semibold text-white truncate">{contractName}</h1>
          <p className="text-xs text-[#8FA3BF] truncate">{provisionName}</p>
        </div>
        {getStatusBadge()}
        {hasEdits && !readOnly && (
          <span className="px-2 py-1 text-xs rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
            Edited
          </span>
        )}
        {/* Risk Score Badges */}
        {riskScores && (riskScores.summary.high > 0 || riskScores.summary.medium > 0 || riskScores.summary.low > 0) && (
          <div className="hidden lg:flex items-center gap-1.5">
            {riskScores.summary.high > 0 && (
              <span className="px-2 py-1 text-xs font-medium rounded bg-red-500/20 text-red-400 border border-red-500/30">
                {riskScores.summary.high} High
              </span>
            )}
            {riskScores.summary.medium > 0 && (
              <span className="px-2 py-1 text-xs font-medium rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                {riskScores.summary.medium} Med
              </span>
            )}
            {riskScores.summary.low > 0 && (
              <span className="px-2 py-1 text-xs font-medium rounded bg-green-500/20 text-green-400 border border-green-500/30">
                {riskScores.summary.low} Low
              </span>
            )}
          </div>
        )}
      </div>

      {/* Submitted Info */}
      <div className="hidden md:flex items-center gap-4 text-xs text-[#8FA3BF] flex-shrink-0">
        <span>
          By <span className="text-white">{submittedBy}</span>
        </span>
        <span className="text-[#64748B]">•</span>
        <span>{formatDate(submittedAt)}</span>
      </div>

      {/* Action Section */}
      {!readOnly && (
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Email Input */}
          <input
            type="email"
            value={approverEmail}
            onChange={(e) => onApproverEmailChange(e.target.value)}
            placeholder="Your email"
            className="w-48 px-3 py-1.5 text-sm bg-[#0B1220] border border-white/10 rounded text-white placeholder-[#64748B] focus:outline-none focus:border-[#38BDF8]"
          />

          {/* Reject Button */}
          <button
            onClick={onReject}
            disabled={submitting}
            className="px-4 py-1.5 text-sm font-medium bg-red-500/10 border border-red-500/30 text-red-400 rounded hover:bg-red-500/20 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Processing...' : 'Reject'}
          </button>

          {/* Approve Button */}
          <button
            onClick={onApprove}
            disabled={submitting}
            className="px-4 py-1.5 text-sm font-medium bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white rounded hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {submitting ? 'Processing...' : 'Approve'}
          </button>
        </div>
      )}

      {/* Read-only status message */}
      {readOnly && (
        <div className="flex items-center gap-2 text-sm flex-shrink-0">
          {status === 'approved' && (
            <>
              <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-green-400 font-medium">Decision Submitted</span>
            </>
          )}
          {status === 'rejected' && (
            <>
              <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span className="text-red-400 font-medium">Decision Submitted</span>
            </>
          )}
        </div>
      )}
    </motion.header>
  );
}
