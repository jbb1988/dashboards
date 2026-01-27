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
          <span className="px-2.5 py-1 text-xs font-medium rounded-md bg-[#238636]/15 text-[#3FB950] border border-[#238636]/30">
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="px-2.5 py-1 text-xs font-medium rounded-md bg-[#F85149]/15 text-[#F85149] border border-[#F85149]/30">
            Rejected
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 text-xs font-medium rounded-md bg-[#D29922]/15 text-[#D29922] border border-[#D29922]/30">
            Pending Review
          </span>
        );
    }
  };

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-[64px] bg-gradient-to-b from-[var(--approval-bg-panel)] to-[#1F252B] border-b border-white/8 shadow-lg flex items-center px-8 gap-6 sticky top-0 z-40"
    >
      {/* Contract Info */}
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <div className="min-w-0">
          <h1 className="text-[15px] font-semibold text-[rgba(255,255,255,0.92)] truncate tracking-tight">{contractName}</h1>
          <p className="text-xs text-[rgba(255,255,255,0.55)] truncate mt-0.5">{provisionName}</p>
        </div>
        {getStatusBadge()}
        {hasEdits && !readOnly && (
          <span className="px-2.5 py-1 text-xs font-medium rounded-md bg-[#58A6FF]/15 text-[#58A6FF] border border-[#58A6FF]/30">
            Edited
          </span>
        )}
        {/* Risk Score Badges */}
        {riskScores && (riskScores.summary.high > 0 || riskScores.summary.medium > 0 || riskScores.summary.low > 0) && (
          <div className="hidden lg:flex items-center gap-2">
            {riskScores.summary.high > 0 && (
              <span className="px-2.5 py-1 text-xs font-medium rounded-md bg-[#F85149]/15 text-[#F85149] border border-[#F85149]/30">
                {riskScores.summary.high} High
              </span>
            )}
            {riskScores.summary.medium > 0 && (
              <span className="px-2.5 py-1 text-xs font-medium rounded-md bg-[#D29922]/15 text-[#D29922] border border-[#D29922]/30">
                {riskScores.summary.medium} Med
              </span>
            )}
            {riskScores.summary.low > 0 && (
              <span className="px-2.5 py-1 text-xs font-medium rounded-md bg-[#3FB950]/15 text-[#3FB950] border border-[#3FB950]/30">
                {riskScores.summary.low} Low
              </span>
            )}
          </div>
        )}
      </div>

      {/* Submitted Info */}
      <div className="hidden md:flex items-center gap-4 text-xs text-[rgba(255,255,255,0.55)] flex-shrink-0">
        <span>
          By <span className="text-[rgba(255,255,255,0.85)] font-medium">{submittedBy}</span>
        </span>
        <span className="text-[rgba(255,255,255,0.25)]">•</span>
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
            className="w-52 px-3 py-2 text-sm bg-[var(--approval-bg-base)] border border-white/10 rounded-lg text-[rgba(255,255,255,0.88)] placeholder-[rgba(255,255,255,0.35)] focus:outline-none focus:border-[#58A6FF] focus:ring-1 focus:ring-[#58A6FF]/30 transition-all"
          />

          {/* Reject Button */}
          <button
            onClick={onReject}
            disabled={submitting}
            className="px-5 py-2 text-sm font-medium bg-[#F85149]/10 border border-[#F85149]/40 text-[#F85149] rounded-lg hover:bg-[#F85149]/20 hover:border-[#F85149]/60 transition-all disabled:opacity-50 shadow-sm"
          >
            {submitting ? 'Processing...' : 'Reject'}
          </button>

          {/* Approve Button */}
          <button
            onClick={onApprove}
            disabled={submitting}
            className="px-5 py-2 text-sm font-semibold bg-[#238636] hover:bg-[#2ea043] text-white rounded-lg transition-all disabled:opacity-50 shadow-md shadow-[#238636]/25"
          >
            {submitting ? 'Processing...' : 'Approve'}
          </button>
        </div>
      )}

      {/* Read-only status message */}
      {readOnly && (
        <div className="flex items-center gap-2.5 text-sm flex-shrink-0">
          {status === 'approved' && (
            <>
              <div className="w-6 h-6 rounded-full bg-[#3FB950]/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-[#3FB950]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-[rgba(255,255,255,0.88)] font-medium">Decision Submitted</span>
            </>
          )}
          {status === 'rejected' && (
            <>
              <div className="w-6 h-6 rounded-full bg-[#F85149]/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-[#F85149]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <span className="text-[rgba(255,255,255,0.88)] font-medium">Decision Submitted</span>
            </>
          )}
        </div>
      )}
    </motion.header>
  );
}
