'use client';

import { motion } from 'framer-motion';
import {
  AlertCircle,
  Clock,
  FileText,
  XCircle,
  Trash2,
} from 'lucide-react';
import type { InboxItem } from './useInboxFiltering';
import type { Approval, ReviewHistory } from './ContractCommandCenter';

interface InboxListProps {
  items: InboxItem[];
  selectedItemId: string | null;
  onSelectApproval: (approval: Approval) => void;
  onSelectHistory: (item: ReviewHistory) => void;
  onDeleteHistory: (id: string) => void;
  onDeleteApproval: (reviewId: string) => void;
}

function formatRelativeTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function InboxItemCard({
  item,
  isSelected,
  onSelect,
  onDelete,
}: {
  item: InboxItem;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const urgencyConfig = {
    critical: {
      dot: 'bg-[rgba(255,95,95,0.95)]',
      bg: 'bg-[rgba(255,95,95,0.12)] border-[rgba(255,95,95,0.25)]',
      icon: <AlertCircle className="w-3 h-3" />,
    },
    high: {
      dot: 'bg-[rgba(255,190,90,0.95)]',
      bg: 'bg-[rgba(255,190,90,0.12)] border-[rgba(255,190,90,0.25)]',
      icon: <Clock className="w-3 h-3" />,
    },
    normal: {
      dot: 'bg-[rgba(200,210,235,0.50)]',
      bg: 'bg-[rgba(255,255,255,0.04)] border-transparent',
      icon: <FileText className="w-3 h-3" />,
    },
  };

  const typeConfig = {
    approval: {
      label: 'Needs Approval',
      color: 'text-[rgba(255,190,90,0.95)]',
    },
    draft: {
      label: 'Draft',
      color: 'text-[rgba(200,210,235,0.50)]',
    },
    rejection: {
      label: 'Rejected',
      color: 'text-[rgba(255,95,95,0.95)]',
    },
  };

  const config = urgencyConfig[item.urgency];
  const typeInfo = typeConfig[item.type];

  // Get display info based on item type
  let title = '';
  let subtitle = '';
  let submitter = '';

  if (item.type === 'approval' || item.type === 'rejection') {
    const approval = item.data as Approval;
    title = approval.provisionName || approval.contractName;
    subtitle = approval.contractName;
    submitter = approval.submittedBy;
  } else {
    const history = item.data as ReviewHistory;
    title = history.provisionName || 'Untitled Review';
    subtitle = history.contractName || 'No contract';
  }

  return (
    <motion.div
      onClick={onSelect}
      className={`
        group relative w-full text-left px-3 py-2.5 rounded-xl transition-all duration-[180ms] cursor-pointer border
        ${isSelected
          ? 'bg-[rgba(90,130,255,0.12)] border-[rgba(90,130,255,0.30)]'
          : `${config.bg} hover:bg-[rgba(255,255,255,0.06)]`
        }
      `}
      style={{
        boxShadow: isSelected ? 'inset 0 1px 0 rgba(255,255,255,0.08)' : undefined,
      }}
      whileHover={{ x: 2 }}
      transition={{ duration: 0.15 }}
    >
      <div className="flex items-start gap-2">
        {/* Urgency Indicator */}
        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${config.dot}`} />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <p className="text-[13px] font-medium text-[rgba(235,240,255,0.92)] truncate">
              {title}
            </p>
          </div>

          {subtitle && (
            <p className="text-[11px] text-[rgba(200,210,235,0.50)] truncate">
              {subtitle}
            </p>
          )}

          <div className="flex items-center gap-2 mt-1.5">
            <span className={`text-[10px] font-semibold ${typeInfo.color}`}>
              {typeInfo.label}
            </span>
            {submitter && (
              <>
                <span className="text-[10px] text-[rgba(200,210,235,0.30)]">•</span>
                <span className="text-[10px] text-[rgba(200,210,235,0.50)] truncate">
                  {submitter}
                </span>
              </>
            )}
            <span className="text-[10px] text-[rgba(200,210,235,0.30)]">•</span>
            <span className="text-[10px] text-[rgba(200,210,235,0.50)]">
              {formatRelativeTime(item.timestamp)}
            </span>
          </div>
        </div>

        {/* Delete Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-[rgba(255,95,95,0.15)] text-[rgba(200,210,235,0.50)] hover:text-[rgba(255,95,95,0.95)] transition-all duration-[180ms]"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

function InboxGroup({
  title,
  items,
  selectedItemId,
  onSelectApproval,
  onSelectHistory,
  onDeleteHistory,
  onDeleteApproval,
}: {
  title: string;
  items: InboxItem[];
  selectedItemId: string | null;
  onSelectApproval: (approval: Approval) => void;
  onSelectHistory: (item: ReviewHistory) => void;
  onDeleteHistory: (id: string) => void;
  onDeleteApproval: (reviewId: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 px-3 py-1">
        <h3 className="text-[11px] font-bold text-[rgba(200,210,235,0.60)] tracking-wide uppercase">
          {title}
        </h3>
        <span className="text-[10px] font-bold text-[rgba(200,210,235,0.40)]">
          {items.length}
        </span>
      </div>
      {items.map((item) => (
        <InboxItemCard
          key={item.id}
          item={item}
          isSelected={selectedItemId === item.id}
          onSelect={() => {
            if (item.type === 'approval' || item.type === 'rejection') {
              onSelectApproval(item.data as Approval);
            } else {
              onSelectHistory(item.data as ReviewHistory);
            }
          }}
          onDelete={() => {
            if (item.type === 'approval' || item.type === 'rejection') {
              onDeleteApproval(item.id);
            } else {
              onDeleteHistory(item.id);
            }
          }}
        />
      ))}
    </div>
  );
}

export default function InboxList({
  items,
  selectedItemId,
  onSelectApproval,
  onSelectHistory,
  onDeleteHistory,
  onDeleteApproval,
}: InboxListProps) {
  // Group items by category
  const critical = items.filter(i => i.urgency === 'critical');
  const high = items.filter(i => i.urgency === 'high');
  const drafts = items.filter(i => i.type === 'draft');
  const rejections = items.filter(i => i.type === 'rejection');

  // Empty state
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[rgba(80,210,140,0.12)] flex items-center justify-center mb-4">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            🎉
          </motion.div>
        </div>
        <h3 className="text-[14px] font-semibold text-[rgba(235,240,255,0.92)] mb-1">
          Inbox Zero!
        </h3>
        <p className="text-[12px] text-[rgba(200,210,235,0.50)]">
          No items need your attention
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-2 pb-4">
      <InboxGroup
        title="Critical"
        items={critical}
        selectedItemId={selectedItemId}
        onSelectApproval={onSelectApproval}
        onSelectHistory={onSelectHistory}
        onDeleteHistory={onDeleteHistory}
        onDeleteApproval={onDeleteApproval}
      />

      <InboxGroup
        title="High Priority"
        items={high.filter(i => i.type !== 'rejection')}
        selectedItemId={selectedItemId}
        onSelectApproval={onSelectApproval}
        onSelectHistory={onSelectHistory}
        onDeleteHistory={onDeleteHistory}
        onDeleteApproval={onDeleteApproval}
      />

      <InboxGroup
        title="Your Drafts"
        items={drafts}
        selectedItemId={selectedItemId}
        onSelectApproval={onSelectApproval}
        onSelectHistory={onSelectHistory}
        onDeleteHistory={onDeleteHistory}
        onDeleteApproval={onDeleteApproval}
      />

      <InboxGroup
        title="Needs Revision"
        items={rejections}
        selectedItemId={selectedItemId}
        onSelectApproval={onSelectApproval}
        onSelectHistory={onSelectHistory}
        onDeleteHistory={onDeleteHistory}
        onDeleteApproval={onDeleteApproval}
      />
    </div>
  );
}
