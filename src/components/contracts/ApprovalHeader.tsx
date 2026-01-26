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
          <span className="px-2 py-1 text-xs font-medium rounded bg-[#238636]/15 text-[#3FB950] border border-[#238636]/30">
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded bg-[#F85149]/15 text-[#F85149] border border-[#F85149]/30">
            Rejected
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 text-xs font-medium rounded bg-[#D29922]/15 text-[#D29922] border border-[#D29922]/30">
            Pending Review
          </span>
        );
    }
  };

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-[60px] bg-[#242A30] border-b border-white/8 flex items-center px-6 gap-4 sticky top-0 z-40"
    >
      {/* Contract Info */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="min-w-0">
          <h1 className="text-sm font-semibold text-[rgba(255,255,255,0.88)] truncate">{contractName}</h1>
          <p className="text-xs text-[rgba(255,255,255,0.62)] truncate">{provisionName}</p>
        </div>
        {getStatusBadge()}
        {hasEdits && !readOnly && (
          <span className="px-2 py-1 text-xs rounded bg-[#58A6FF]/15 text-[#58A6FF] border border-[#58A6FF]/30">
            Edited
          </span>
        )}
        {/* Risk Score Badges */}
        {riskScores && (riskScores.summary.high > 0 || riskScores.summary.medium > 0 || riskScores.summary.low > 0) && (
          <div className="hidden lg:flex items-center gap-1.5">
            {riskScores.summary.high > 0 && (
              <span className="px-2 py-1 text-xs font-medium rounded bg-[#F85149]/15 text-[#F85149] border border-[#F85149]/30">
                {riskScores.summary.high} High
              </span>
            )}
            {riskScores.summary.medium > 0 && (
              <span className="px-2 py-1 text-xs font-medium rounded bg-[#D29922]/15 text-[#D29922] border border-[#D29922]/30">
                {riskScores.summary.medium} Med
              </span>
            )}
            {riskScores.summary.low > 0 && (
              <span className="px-2 py-1 text-xs font-medium rounded bg-[#3FB950]/15 text-[#3FB950] border border-[#3FB950]/30">
                {riskScores.summary.low} Low
              </span>
            )}
          </div>
        )}
      </div>

      {/* Submitted Info */}
      <div className="hidden md:flex items-center gap-4 text-xs text-[rgba(255,255,255,0.62)] flex-shrink-0">
        <span>
          By <span className="text-[rgba(255,255,255,0.88)]">{submittedBy}</span>
        </span>
        <span className="text-[rgba(255,255,255,0.3)]">•</span>
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
            className="w-48 px-3 py-1.5 text-sm bg-[#1B1F24] border border-white/8 rounded text-[rgba(255,255,255,0.88)] placeholder-[rgba(255,255,255,0.4)] focus:outline-none focus:border-[#58A6FF]"
          />

          {/* Reject Button */}
          <button
            onClick={onReject}
            disabled={submitting}
            className="px-4 py-1.5 text-sm font-medium bg-[#F85149]/10 border border-[#F85149]/30 text-[#F85149] rounded hover:bg-[#F85149]/20 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Processing...' : 'Reject'}
          </button>

          {/* Approve Button */}
          <button
            onClick={onApprove}
            disabled={submitting}
            className="px-4 py-1.5 text-sm font-medium bg-[#238636] hover:bg-[#2ea043] text-white rounded transition-colors disabled:opacity-50"
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
              <svg className="w-5 h-5 text-[#3FB950]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-[rgba(255,255,255,0.88)] font-medium">Decision Submitted</span>
            </>
          )}
          {status === 'rejected' && (
            <>
              <svg className="w-5 h-5 text-[#F85149]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span className="text-[rgba(255,255,255,0.88)] font-medium">Decision Submitted</span>
            </>
          )}
        </div>
      )}
    </motion.header>
  );
}
