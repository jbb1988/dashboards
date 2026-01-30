'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle,
  XCircle,
  FileText,
  Clock,
  Trash2,
} from 'lucide-react';
import type { Approval, ReviewHistory } from './ContractCommandCenter';

interface ArchiveListProps {
  approvals: Approval[];
  history: ReviewHistory[];
  selectedItemId: string | null;
  onSelectApproval: (approval: Approval) => void;
  onSelectHistory: (item: ReviewHistory) => void;
  onDeleteHistory: (id: string) => void;
  onDeleteApproval: (reviewId: string) => void;
}

type StatusFilter = 'all' | 'approved' | 'rejected' | 'draft';

interface ArchiveItem {
  id: string;
  type: 'approval' | 'history';
  data: Approval | ReviewHistory;
  timestamp: string;
  status: 'approved' | 'rejected' | 'draft' | 'pending';
  title: string;
  subtitle: string;
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

function groupByDateRange(items: ArchiveItem[]) {
  const today: ArchiveItem[] = [];
  const thisWeek: ArchiveItem[] = [];
  const thisMonth: ArchiveItem[] = [];
  const older: ArchiveItem[] = [];

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  items.forEach(item => {
    const itemDate = new Date(item.timestamp);

    if (itemDate >= todayStart) {
      today.push(item);
    } else if (itemDate >= weekAgo) {
      thisWeek.push(item);
    } else if (itemDate >= monthAgo) {
      thisMonth.push(item);
    } else {
      older.push(item);
    }
  });

  return { today, thisWeek, thisMonth, older };
}

function ArchiveItemCard({
  item,
  isSelected,
  onSelect,
  onDelete,
}: {
  item: ArchiveItem;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const statusConfig = {
    approved: {
      icon: <CheckCircle className="w-3 h-3" />,
      color: 'text-[rgba(80,210,140,0.95)]',
      bg: 'bg-[rgba(80,210,140,0.12)] border-[rgba(80,210,140,0.25)]',
    },
    rejected: {
      icon: <XCircle className="w-3 h-3" />,
      color: 'text-[rgba(255,95,95,0.95)]',
      bg: 'bg-[rgba(255,95,95,0.12)] border-[rgba(255,95,95,0.25)]',
    },
    draft: {
      icon: <FileText className="w-3 h-3" />,
      color: 'text-[rgba(200,210,235,0.50)]',
      bg: 'bg-[rgba(255,255,255,0.04)] border-transparent',
    },
    pending: {
      icon: <Clock className="w-3 h-3" />,
      color: 'text-[rgba(255,190,90,0.95)]',
      bg: 'bg-[rgba(255,190,90,0.12)] border-[rgba(255,190,90,0.25)]',
    },
  };

  const config = statusConfig[item.status];

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
        {/* Status Icon */}
        <div className={`mt-0.5 ${config.color}`}>
          {config.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-[rgba(235,240,255,0.92)] truncate">
            {item.title}
          </p>
          {item.subtitle && (
            <p className="text-[11px] text-[rgba(200,210,235,0.50)] truncate mt-0.5">
              {item.subtitle}
            </p>
          )}
          <p className="text-[10px] text-[rgba(200,210,235,0.50)] mt-1">
            {formatRelativeTime(item.timestamp)}
          </p>
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

function DateGroup({
  title,
  items,
  selectedItemId,
  onSelectApproval,
  onSelectHistory,
  onDeleteHistory,
  onDeleteApproval,
}: {
  title: string;
  items: ArchiveItem[];
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
        <ArchiveItemCard
          key={item.id}
          item={item}
          isSelected={selectedItemId === item.id}
          onSelect={() => {
            if (item.type === 'approval') {
              onSelectApproval(item.data as Approval);
            } else {
              onSelectHistory(item.data as ReviewHistory);
            }
          }}
          onDelete={() => {
            if (item.type === 'approval') {
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

export default function ArchiveList({
  approvals,
  history,
  selectedItemId,
  onSelectApproval,
  onSelectHistory,
  onDeleteHistory,
  onDeleteApproval,
}: ArchiveListProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Convert all items to unified ArchiveItem format
  const allItems: ArchiveItem[] = [
    // Add approvals
    ...approvals.map(approval => ({
      id: approval.reviewId,
      type: 'approval' as const,
      data: approval,
      timestamp: approval.approvedAt || approval.submittedAt,
      status: approval.approvalStatus === 'approved' ? 'approved' as const :
              approval.approvalStatus === 'rejected' ? 'rejected' as const :
              'pending' as const,
      title: approval.provisionName || approval.contractName,
      subtitle: approval.contractName,
    })),
    // Add history items
    ...history.map(item => ({
      id: item.id,
      type: 'history' as const,
      data: item,
      timestamp: item.createdAt,
      status: item.status === 'approved' ? 'approved' as const :
              item.status === 'draft' ? 'draft' as const :
              'pending' as const,
      title: item.provisionName || 'Untitled Review',
      subtitle: item.contractName || 'No contract',
    })),
  ];

  // Apply status filter
  const filteredItems = allItems.filter(item => {
    if (statusFilter === 'all') return true;
    return item.status === statusFilter;
  });

  // Sort by most recent first
  const sortedItems = filteredItems.sort((a, b) => {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  // Group by date range
  const grouped = groupByDateRange(sortedItems);

  return (
    <div className="flex flex-col h-full">
      {/* Status Filters */}
      <div className="flex-shrink-0 px-2 pb-3">
        <div className="flex items-center gap-1 p-1 bg-[rgba(10,14,20,0.60)] rounded-xl border border-[rgba(255,255,255,0.06)]">
          {(['all', 'approved', 'rejected', 'draft'] as StatusFilter[]).map((filter) => {
            const labels = {
              all: 'All',
              approved: 'Approved',
              rejected: 'Rejected',
              draft: 'Draft',
            };

            const counts = {
              all: allItems.length,
              approved: allItems.filter(i => i.status === 'approved').length,
              rejected: allItems.filter(i => i.status === 'rejected').length,
              draft: allItems.filter(i => i.status === 'draft').length,
            };

            return (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`
                  relative flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg
                  text-[11px] font-semibold transition-all duration-[180ms]
                  ${statusFilter === filter
                    ? 'text-[rgba(235,240,255,0.95)]'
                    : 'text-[rgba(200,210,235,0.50)] hover:text-[rgba(235,240,255,0.92)]'
                  }
                `}
              >
                {statusFilter === filter && (
                  <motion.div
                    layoutId="activeFilterBg"
                    className="absolute inset-0 rounded-lg bg-[rgba(90,130,255,0.20)]"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{labels[filter]}</span>
                {counts[filter] > 0 && (
                  <span className="relative z-10 text-[9px] opacity-60">
                    {counts[filter]}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable Date Groups */}
      <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-4">
        {sortedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[rgba(200,210,235,0.08)] flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-[rgba(200,210,235,0.30)]" />
            </div>
            <h3 className="text-[14px] font-semibold text-[rgba(235,240,255,0.92)] mb-1">
              No archived items
            </h3>
            <p className="text-[12px] text-[rgba(200,210,235,0.50)]">
              {statusFilter === 'all'
                ? 'Your archive is empty'
                : `No ${statusFilter} items found`
              }
            </p>
          </div>
        ) : (
          <>
            <DateGroup
              title="Today"
              items={grouped.today}
              selectedItemId={selectedItemId}
              onSelectApproval={onSelectApproval}
              onSelectHistory={onSelectHistory}
              onDeleteHistory={onDeleteHistory}
              onDeleteApproval={onDeleteApproval}
            />

            <DateGroup
              title="This Week"
              items={grouped.thisWeek}
              selectedItemId={selectedItemId}
              onSelectApproval={onSelectApproval}
              onSelectHistory={onSelectHistory}
              onDeleteHistory={onDeleteHistory}
              onDeleteApproval={onDeleteApproval}
            />

            <DateGroup
              title="This Month"
              items={grouped.thisMonth}
              selectedItemId={selectedItemId}
              onSelectApproval={onSelectApproval}
              onSelectHistory={onSelectHistory}
              onDeleteHistory={onDeleteHistory}
              onDeleteApproval={onDeleteApproval}
            />

            <DateGroup
              title="Older"
              items={grouped.older}
              selectedItemId={selectedItemId}
              onSelectApproval={onSelectApproval}
              onSelectHistory={onSelectHistory}
              onDeleteHistory={onDeleteHistory}
              onDeleteApproval={onDeleteApproval}
            />
          </>
        )}
      </div>
    </div>
  );
}
