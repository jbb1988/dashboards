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

  // Status chip with color
  const getStatusChip = () => {
    switch (status) {
      case 'approved':
        return (
          <span className="status-approved px-2.5 py-1 text-[11px] font-semibold rounded-md flex items-center gap-1.5">
            <Check className="w-3 h-3" />
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="status-rejected px-2.5 py-1 text-[11px] font-semibold rounded-md flex items-center gap-1.5">
            <X className="w-3 h-3" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="status-pending px-2.5 py-1 text-[11px] font-semibold rounded-md">
            Pending Review
          </span>
        );
    }
  };

  return (
    <motion.header
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="header-bar h-16 flex items-center px-6 gap-6 sticky top-0 z-40"
    >
      {/* Left cluster: Title + Subtitle + Status */}
      <div className="flex items-center gap-5 min-w-0 flex-1">
        <div className="min-w-0">
          <h1 className="text-[15px] font-semibold text-[var(--text-primary)] truncate leading-tight">
            {contractName}
          </h1>
          <p className="text-[12px] text-[var(--text-muted)] truncate leading-tight mt-0.5">
            {provisionName}
          </p>
        </div>

        {getStatusChip()}

        {hasEdits && !readOnly && (
          <span className="px-2.5 py-1 text-[11px] font-semibold rounded-md bg-[var(--accent-blue-glow)] text-[var(--accent-blue)] border border-[var(--accent-blue)]/30">
            Edited
          </span>
        )}

        {/* Submitted info */}
        <div className="hidden lg:flex items-center gap-2 text-[12px] text-[var(--text-muted)] ml-2">
          <span>by {submittedBy}</span>
          <span className="text-[var(--border-medium)]">|</span>
          <span>{formatDate(submittedAt)}</span>
        </div>
      </div>

      {/* Right cluster: Email + Actions */}
      {!readOnly && (
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Email input - elevated pill */}
          <input
            type="email"
            value={approverEmail}
            onChange={(e) => onApproverEmailChange(e.target.value)}
            placeholder="your@email.com"
            className="w-52 h-9 px-4 text-[13px] input-pill"
          />

          {/* Reject button - surface style */}
          <button
            onClick={onReject}
            disabled={submitting}
            className="btn-surface h-9 px-4 flex items-center gap-2 text-[13px] disabled:opacity-40"
          >
            <X className="w-4 h-4" />
            <span>Reject</span>
          </button>

          {/* Approve button - success gradient */}
          <button
            onClick={onApprove}
            disabled={submitting}
            className="btn-success h-9 px-5 flex items-center gap-2 text-[13px] disabled:opacity-40"
          >
            <Check className="w-4 h-4" />
            <span>Approve</span>
          </button>
        </div>
      )}

      {/* Read-only status display */}
      {readOnly && (
        <div className="flex items-center gap-3 flex-shrink-0">
          {status === 'approved' && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-green-glow)] border border-[var(--accent-green)]/30">
              <Check className="w-4 h-4 text-[var(--accent-green)]" />
              <span className="text-[var(--accent-green)] font-semibold text-[13px]">Approved</span>
            </div>
          )}
          {status === 'rejected' && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-red-glow)] border border-[var(--accent-red)]/30">
              <X className="w-4 h-4 text-[var(--accent-red)]" />
              <span className="text-[var(--accent-red)] font-semibold text-[13px]">Rejected</span>
            </div>
          )}
        </div>
      )}
    </motion.header>
  );
}
