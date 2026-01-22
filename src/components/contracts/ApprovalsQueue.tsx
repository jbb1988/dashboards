'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface Approval {
  reviewId: string;
  contractId?: string;
  contractName: string;
  provisionName?: string;
  submittedBy: string;
  submittedAt: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  approver?: string;
  approvedAt?: string;
  feedback?: string;
  daysInQueue: number;
  summary: string[];
  urgency: 'critical' | 'high' | 'normal';
  approvalToken?: string;
}

interface ApprovalsData {
  approvals: Approval[];
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

export default function ApprovalsQueue() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });

  useEffect(() => {
    fetchApprovals();
    const interval = setInterval(fetchApprovals, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [filter]);

  const fetchApprovals = async () => {
    try {
      const response = await fetch(`/api/contracts/review/approvals/queue?status=${filter}`);
      const data: ApprovalsData = await response.json();
      setApprovals(data.approvals || []);
      setCounts({
        pending: data.pending || 0,
        approved: data.approved || 0,
        rejected: data.rejected || 0,
      });
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch approvals:', error);
      setLoading(false);
    }
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const copyApprovalLink = (token?: string) => {
    if (!token) return;
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/contracts/review/approve/${token}`;
    navigator.clipboard.writeText(link);
    alert('Approval link copied to clipboard!');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-[#38BDF8] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter('pending')}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
            filter === 'pending'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : 'bg-[#151F2E] text-[#8FA3BF] hover:bg-[#1E293B]'
          }`}
        >
          Pending ({counts.pending})
        </button>
        <button
          onClick={() => setFilter('approved')}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
            filter === 'approved'
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-[#151F2E] text-[#8FA3BF] hover:bg-[#1E293B]'
          }`}
        >
          Approved ({counts.approved})
        </button>
        <button
          onClick={() => setFilter('rejected')}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
            filter === 'rejected'
              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
              : 'bg-[#151F2E] text-[#8FA3BF] hover:bg-[#1E293B]'
          }`}
        >
          Rejected ({counts.rejected})
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
            filter === 'all'
              ? 'bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/30'
              : 'bg-[#151F2E] text-[#8FA3BF] hover:bg-[#1E293B]'
          }`}
        >
          All ({counts.pending + counts.approved + counts.rejected})
        </button>
      </div>

      {/* Approvals List */}
      <div className="space-y-3">
        {approvals.map((approval) => (
          <motion.div
            key={approval.reviewId}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#151F2E] border border-white/10 rounded-lg p-4 hover:border-[#38BDF8]/30 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-white font-medium mb-1">{approval.contractName}</h3>
                {approval.provisionName && (
                  <p className="text-xs text-[#64748B] mb-2">{approval.provisionName}</p>
                )}
                <div className="flex items-center flex-wrap gap-4 text-xs text-[#8FA3BF] mb-2">
                  <span>Submitted by {approval.submittedBy}</span>
                  <span>•</span>
                  <span>{formatRelativeTime(approval.submittedAt)}</span>
                  {approval.approvalStatus === 'pending' && (
                    <>
                      <span>•</span>
                      <span
                        className={`font-medium ${
                          approval.urgency === 'critical'
                            ? 'text-red-400'
                            : approval.urgency === 'high'
                            ? 'text-amber-400'
                            : 'text-[#8FA3BF]'
                        }`}
                      >
                        {approval.daysInQueue} days in queue
                      </span>
                    </>
                  )}
                </div>

                {/* Summary Preview */}
                <div className="mt-2 space-y-1">
                  {approval.summary.slice(0, 3).map((item, idx) => (
                    <p key={idx} className="text-xs text-[#8FA3BF] truncate">
                      • {item}
                    </p>
                  ))}
                  {approval.summary.length > 3 && (
                    <p className="text-xs text-[#38BDF8]">+ {approval.summary.length - 3} more changes</p>
                  )}
                </div>

                {/* Approval Info (if decided) */}
                {approval.approvalStatus !== 'pending' && approval.approver && (
                  <div className="mt-3 flex items-center gap-2">
                    <span
                      className={`text-xs font-medium ${
                        approval.approvalStatus === 'approved' ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {approval.approvalStatus === 'approved' ? '✓ Approved' : '✗ Rejected'}
                    </span>
                    <span className="text-xs text-[#8FA3BF]">
                      by {approval.approver}
                      {approval.approvedAt && ` • ${formatRelativeTime(approval.approvedAt)}`}
                    </span>
                  </div>
                )}

                {/* Feedback (if provided) */}
                {approval.feedback && (
                  <div className="mt-2 p-2 bg-[#0B1220] border border-white/10 rounded text-xs text-[#8FA3BF]">
                    <strong className="text-white">Feedback:</strong> {approval.feedback}
                  </div>
                )}
              </div>

              {/* Status Badge */}
              <div
                className={`px-3 py-1 text-xs font-medium rounded-full flex-shrink-0 ${
                  approval.approvalStatus === 'pending'
                    ? 'bg-amber-500/20 text-amber-400'
                    : approval.approvalStatus === 'approved'
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-red-500/20 text-red-400'
                }`}
              >
                {approval.approvalStatus.toUpperCase()}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-3 flex gap-2">
              {approval.approvalToken ? (
                <button
                  onClick={() => window.open(`/contracts/review/approve/${approval.approvalToken}`, '_blank')}
                  className="flex-1 px-3 py-1.5 text-xs bg-[#38BDF8]/10 border border-[#38BDF8]/30 text-[#38BDF8] rounded-lg hover:bg-[#38BDF8]/20 transition-colors"
                >
                  {approval.approvalStatus === 'pending' ? 'Review & Approve' : 'View Full Review'}
                </button>
              ) : (
                <button
                  onClick={() => window.open(`/contracts/review?reviewId=${approval.reviewId}`, '_blank')}
                  className="flex-1 px-3 py-1.5 text-xs bg-[#38BDF8]/10 border border-[#38BDF8]/30 text-[#38BDF8] rounded-lg hover:bg-[#38BDF8]/20 transition-colors"
                >
                  View Full Review
                </button>
              )}
              {approval.approvalStatus === 'pending' && approval.approvalToken && (
                <button
                  onClick={() => copyApprovalLink(approval.approvalToken)}
                  className="px-3 py-1.5 text-xs bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 text-[#8B5CF6] rounded-lg hover:bg-[#8B5CF6]/20 transition-colors whitespace-nowrap"
                >
                  Copy Link
                </button>
              )}
            </div>
          </motion.div>
        ))}

        {/* Empty State */}
        {approvals.length === 0 && (
          <div className="text-center py-12 text-[#8FA3BF]">
            <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-lg">No {filter !== 'all' ? filter : ''} approvals</p>
            <p className="text-sm mt-1">Approval requests will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
}
