'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';

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
  riskScores?: {
    summary: { high: number; medium: number; low: number };
    sections: Array<{ sectionTitle: string; riskLevel: 'high' | 'medium' | 'low' }>;
  } | null;
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
}: ApprovalHeaderProps) {

  // Status chip - muted, not bright
  const getStatusChip = () => {
    const baseClass = "px-2 py-0.5 text-[11px] font-medium rounded-md";
    switch (status) {
      case 'approved':
        return <span className={`${baseClass} bg-[#3FB950]/10 text-[#3FB950]/80`}>Approved</span>;
      case 'rejected':
        return <span className={`${baseClass} bg-[#F85149]/10 text-[#F85149]/80`}>Rejected</span>;
      default:
        return <span className={`${baseClass} bg-white/[0.06] text-white/60`}>Pending Review</span>;
    }
  };

  return (
    <motion.header
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="h-14 bg-black/35 flex items-center px-6 gap-5 sticky top-0 z-40"
    >
      {/* Left cluster: Title + Subtitle + Status */}
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <div className="min-w-0">
          <h1 className="text-[15px] font-semibold text-white/90 truncate leading-tight">
            {contractName}
          </h1>
          <p className="text-[12px] text-white/50 truncate leading-tight mt-0.5">
            {provisionName}
          </p>
        </div>

        {getStatusChip()}

        {hasEdits && !readOnly && (
          <span className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-[#58A6FF]/10 text-[#58A6FF]/80">
            Edited
          </span>
        )}

        {/* Submitted info - muted */}
        <div className="hidden lg:flex items-center gap-2 text-[12px] text-white/40 ml-4">
          <span>by {submittedBy}</span>
          <span className="text-white/20">·</span>
          <span>{formatDate(submittedAt)}</span>
        </div>
      </div>

      {/* Right cluster: Email + Actions */}
      {!readOnly && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Email input - pill style */}
          <input
            type="email"
            value={approverEmail}
            onChange={(e) => onApproverEmailChange(e.target.value)}
            placeholder="your@email.com"
            className="w-48 h-8 px-4 text-[13px] input-pill"
          />

          {/* Reject - neutral surface button */}
          <button
            onClick={onReject}
            disabled={submitting}
            className="h-8 px-3 flex items-center gap-1.5 text-[13px] font-medium text-white/70 bg-white/[0.04] hover:bg-white/[0.06] rounded-[10px] transition-all duration-[180ms] disabled:opacity-40"
          >
            <X className="w-3.5 h-3.5" />
            <span>Reject</span>
          </button>

          {/* Approve - neutral surface button (color on confirm step) */}
          <button
            onClick={onApprove}
            disabled={submitting}
            className="h-8 px-3 flex items-center gap-1.5 text-[13px] font-medium text-white/70 bg-white/[0.04] hover:bg-white/[0.06] rounded-[10px] transition-all duration-[180ms] disabled:opacity-40"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Approve</span>
          </button>
        </div>
      )}

      {/* Read-only status */}
      {readOnly && (
        <div className="flex items-center gap-2 text-[13px] flex-shrink-0">
          {status === 'approved' && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-[10px] bg-[#3FB950]/10">
              <Check className="w-3.5 h-3.5 text-[#3FB950]/80" />
              <span className="text-[#3FB950]/80 font-medium">Approved</span>
            </div>
          )}
          {status === 'rejected' && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-[10px] bg-[#F85149]/10">
              <X className="w-3.5 h-3.5 text-[#F85149]/80" />
              <span className="text-[#F85149]/80 font-medium">Rejected</span>
            </div>
          )}
        </div>
      )}
    </motion.header>
  );
}
