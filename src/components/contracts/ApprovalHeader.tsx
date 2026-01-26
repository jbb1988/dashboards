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
          <span className="px-2 py-1 text-xs font-medium rounded text-[#3FB950]">
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded text-[#F85149]">
            Rejected
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 text-xs font-medium rounded text-[#D29922]">
            Pending
          </span>
        );
    }
  };

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-[60px] bg-[#1E2328] border-b border-white/5 flex items-center px-6 gap-4 sticky top-0 z-40"
    >
      {/* Contract Info */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="min-w-0">
          <h1 className="text-sm font-medium text-[#E6EDF3] truncate">{contractName}</h1>
          <p className="text-xs text-[#8B949E] truncate">{provisionName}</p>
        </div>
        {getStatusBadge()}
        {hasEdits && !readOnly && (
          <span className="text-xs text-[#58A6FF]">
            Edited
          </span>
        )}
        {/* Risk Score Labels - text only, no backgrounds */}
        {riskScores && (riskScores.summary.high > 0 || riskScores.summary.medium > 0 || riskScores.summary.low > 0) && (
          <div className="hidden lg:flex items-center gap-3 text-xs">
            {riskScores.summary.high > 0 && (
              <span className="text-[#F85149]">
                {riskScores.summary.high} High
              </span>
            )}
            {riskScores.summary.medium > 0 && (
              <span className="text-[#D29922]">
                {riskScores.summary.medium} Med
              </span>
            )}
            {riskScores.summary.low > 0 && (
              <span className="text-[#3FB950]">
                {riskScores.summary.low} Low
              </span>
            )}
          </div>
        )}
      </div>

      {/* Submitted Info */}
      <div className="hidden md:flex items-center gap-3 text-xs text-[#8B949E] flex-shrink-0">
        <span>
          By <span className="text-[#E6EDF3]">{submittedBy}</span>
        </span>
        <span className="text-[#484F58]">•</span>
        <span>{formatDate(submittedAt)}</span>
      </div>

      {/* Action Section - Single primary CTA */}
      {!readOnly && (
        <div className="flex items-center gap-4 flex-shrink-0">
          {/* Email Input */}
          <input
            type="email"
            value={approverEmail}
            onChange={(e) => onApproverEmailChange(e.target.value)}
            placeholder="Your email"
            className="w-44 px-3 py-1.5 text-sm bg-[#161B22] border border-white/10 rounded text-[#E6EDF3] placeholder-[#8B949E] focus:outline-none focus:border-[#58A6FF]"
          />

          {/* Reject - quiet text link */}
          <button
            onClick={onReject}
            disabled={submitting}
            className="text-sm text-[#8B949E] hover:text-[#F85149] transition-colors disabled:opacity-50"
          >
            Reject
          </button>

          {/* Approve - single primary CTA */}
          <button
            onClick={onApprove}
            disabled={submitting}
            className="px-5 py-1.5 text-sm font-medium bg-[#238636] hover:bg-[#2ea043] text-white rounded transition-colors disabled:opacity-50"
          >
            {submitting ? 'Processing...' : 'Approve'}
          </button>
        </div>
      )}

      {/* Read-only status message - minimal */}
      {readOnly && (
        <div className="flex items-center gap-2 text-sm flex-shrink-0">
          {status === 'approved' && (
            <span className="text-[#3FB950]">Decision Submitted</span>
          )}
          {status === 'rejected' && (
            <span className="text-[#F85149]">Decision Submitted</span>
          )}
        </div>
      )}
    </motion.header>
  );
}
