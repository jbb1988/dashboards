'use client';

import { motion } from 'framer-motion';
import {
  Send,
  Edit3,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
} from 'lucide-react';

export interface ActivityLogEntry {
  action: 'submitted' | 'viewed' | 'edited' | 'approved' | 'rejected' | 'resubmitted';
  by: string;
  at: string;
  note?: string;
  feedback?: string;
}

interface ActivityLogProps {
  entries: ActivityLogEntry[];
}

function getActionIcon(action: ActivityLogEntry['action']) {
  switch (action) {
    case 'submitted':
      return <Send className="w-4 h-4" />;
    case 'viewed':
      return <Clock className="w-4 h-4" />;
    case 'edited':
      return <Edit3 className="w-4 h-4" />;
    case 'approved':
      return <CheckCircle className="w-4 h-4" />;
    case 'rejected':
      return <XCircle className="w-4 h-4" />;
    case 'resubmitted':
      return <RefreshCw className="w-4 h-4" />;
    default:
      return <Clock className="w-4 h-4" />;
  }
}

function getActionColor(action: ActivityLogEntry['action']) {
  switch (action) {
    case 'submitted':
      return 'text-blue-400 bg-blue-400/10 border-blue-400/30';
    case 'viewed':
      return 'text-gray-400 bg-gray-400/10 border-gray-400/30';
    case 'edited':
      return 'text-amber-400 bg-amber-400/10 border-amber-400/30';
    case 'approved':
      return 'text-green-400 bg-green-400/10 border-green-400/30';
    case 'rejected':
      return 'text-red-400 bg-red-400/10 border-red-400/30';
    case 'resubmitted':
      return 'text-purple-400 bg-purple-400/10 border-purple-400/30';
    default:
      return 'text-gray-400 bg-gray-400/10 border-gray-400/30';
  }
}

function getActionLabel(action: ActivityLogEntry['action']) {
  switch (action) {
    case 'submitted':
      return 'Submitted';
    case 'viewed':
      return 'Viewed';
    case 'edited':
      return 'Edited';
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Rejected';
    case 'resubmitted':
      return 'Resubmitted';
    default:
      return action;
  }
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export default function ActivityLog({ entries }: ActivityLogProps) {
  if (!entries || entries.length === 0) {
    return (
      <div className="bg-[#151F2E] border border-white/10 rounded-lg p-4">
        <h4 className="text-sm font-medium text-white mb-2">Activity Log</h4>
        <p className="text-xs text-[#64748B]">No activity recorded yet</p>
      </div>
    );
  }

  return (
    <div className="bg-[#151F2E] border border-white/10 rounded-lg p-4">
      <h4 className="text-sm font-medium text-white mb-3">Activity Log</h4>
      <div className="space-y-2">
        {entries.map((entry, idx) => (
          <motion.div
            key={`${entry.action}-${entry.at}-${idx}`}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="flex items-start gap-3 text-sm"
          >
            {/* Icon */}
            <div
              className={`p-1.5 rounded border ${getActionColor(entry.action)}`}
            >
              {getActionIcon(entry.action)}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-white font-medium">
                  {getActionLabel(entry.action)}
                </span>
                <span className="text-[#8FA3BF]">by</span>
                <span className="text-[#38BDF8] truncate">{entry.by}</span>
              </div>
              <div className="text-xs text-[#64748B]">{formatDate(entry.at)}</div>
              {entry.note && (
                <p className="text-xs text-[#8FA3BF] mt-1 italic">
                  Note: {entry.note}
                </p>
              )}
              {entry.feedback && (
                <p className="text-xs text-[#8FA3BF] mt-1">
                  Feedback: &ldquo;{entry.feedback}&rdquo;
                </p>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
