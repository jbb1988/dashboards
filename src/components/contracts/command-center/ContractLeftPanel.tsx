'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  ChevronRight,
  ChevronDown,
  FileText,
  Inbox,
  History,
  Trash2,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import { elevation, colors, radius } from '@/components/mars-ui/tokens';
import type { Approval, ReviewHistory } from './ContractCommandCenter';

// =============================================================================
// TYPES
// =============================================================================

interface ContractLeftPanelProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  pendingApprovals: Approval[];
  pendingCount: number;
  inProgressReviews: ReviewHistory[];
  recentHistory: ReviewHistory[];
  allHistory: ReviewHistory[];
  isLoadingApprovals: boolean;
  isLoadingHistory: boolean;
  selectedItemId: string | null;
  onNewReview: () => void;
  onSelectApproval: (approval: Approval) => void;
  onSelectHistory: (item: ReviewHistory) => void;
  onDeleteHistory: (id: string) => void;
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function SectionHeader({
  title,
  count,
  isExpanded,
  onToggle,
  accentColor = 'blue',
}: {
  title: string;
  count?: number;
  isExpanded: boolean;
  onToggle: () => void;
  accentColor?: 'blue' | 'amber' | 'green';
}) {
  const colorMap = {
    blue: 'bg-[rgba(90,130,255,0.15)] text-[rgba(90,130,255,0.95)]',
    amber: 'bg-[rgba(255,190,90,0.15)] text-[rgba(255,190,90,0.95)]',
    green: 'bg-[rgba(80,210,140,0.15)] text-[rgba(80,210,140,0.95)]',
  };

  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-3 py-2 group hover:bg-[rgba(255,255,255,0.04)] rounded-lg transition-colors duration-[180ms]"
    >
      <div className="flex items-center gap-2">
        <motion.div
          animate={{ rotate: isExpanded ? 90 : 0 }}
          transition={{ duration: 0.18 }}
        >
          <ChevronRight className="w-3.5 h-3.5 text-[rgba(200,210,235,0.50)]" />
        </motion.div>
        <span className="text-[12px] font-semibold text-[rgba(200,210,235,0.75)] tracking-wide">
          {title}
        </span>
      </div>
      {count !== undefined && count > 0 && (
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${colorMap[accentColor]}`}>
          {count}
        </span>
      )}
    </button>
  );
}

function ApprovalItem({
  approval,
  isSelected,
  onSelect,
}: {
  approval: Approval;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const statusColors = {
    pending: 'bg-[rgba(255,190,90,0.12)] border-[rgba(255,190,90,0.25)]',
    approved: 'bg-[rgba(80,210,140,0.12)] border-[rgba(80,210,140,0.25)]',
    rejected: 'bg-[rgba(255,95,95,0.12)] border-[rgba(255,95,95,0.25)]',
  };

  const urgencyDot = {
    critical: 'bg-[rgba(255,95,95,0.95)]',
    high: 'bg-[rgba(255,190,90,0.95)]',
    normal: 'bg-[rgba(200,210,235,0.50)]',
  };

  return (
    <motion.button
      onClick={onSelect}
      className={`
        w-full text-left px-3 py-2.5 rounded-xl transition-all duration-[180ms]
        ${isSelected
          ? 'bg-[rgba(90,130,255,0.12)] border border-[rgba(90,130,255,0.30)]'
          : `${statusColors[approval.approvalStatus]} border hover:bg-[rgba(255,255,255,0.06)]`
        }
      `}
      style={{
        boxShadow: isSelected ? 'inset 0 1px 0 rgba(255,255,255,0.08)' : undefined,
      }}
      whileHover={{ x: 2 }}
      transition={{ duration: 0.15 }}
    >
      <div className="flex items-start gap-2">
        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${urgencyDot[approval.urgency]}`} />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-[rgba(235,240,255,0.92)] truncate">
            {approval.contractName}
          </p>
          {approval.provisionName && (
            <p className="text-[11px] text-[rgba(200,210,235,0.50)] truncate mt-0.5">
              {approval.provisionName}
            </p>
          )}
          <p className="text-[10px] text-[rgba(200,210,235,0.50)] mt-1">
            {formatRelativeTime(approval.submittedAt)}
          </p>
        </div>
      </div>
    </motion.button>
  );
}

function HistoryItem({
  item,
  isSelected,
  onSelect,
  onDelete,
  showDeleteOnHover = true,
}: {
  item: ReviewHistory;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  showDeleteOnHover?: boolean;
}) {
  const statusColors = {
    draft: 'text-[rgba(200,210,235,0.50)]',
    sent_to_boss: 'text-[rgba(255,190,90,0.95)]',
    sent_to_client: 'text-[rgba(90,130,255,0.95)]',
    approved: 'text-[rgba(80,210,140,0.95)]',
  };

  const statusIcons = {
    draft: <FileText className="w-3 h-3" />,
    sent_to_boss: <Clock className="w-3 h-3" />,
    sent_to_client: <Clock className="w-3 h-3" />,
    approved: <CheckCircle className="w-3 h-3" />,
  };

  return (
    <motion.div
      className={`
        group relative w-full text-left px-3 py-2.5 rounded-xl transition-all duration-[180ms] cursor-pointer
        ${isSelected
          ? 'bg-[rgba(90,130,255,0.12)] border border-[rgba(90,130,255,0.30)]'
          : 'hover:bg-[rgba(255,255,255,0.04)] border border-transparent'
        }
      `}
      style={{
        boxShadow: isSelected ? 'inset 0 1px 0 rgba(255,255,255,0.08)' : undefined,
      }}
      onClick={onSelect}
      whileHover={{ x: 2 }}
      transition={{ duration: 0.15 }}
    >
      <div className="flex items-start gap-2">
        <div className={`mt-0.5 ${statusColors[item.status]}`}>
          {statusIcons[item.status]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-[rgba(235,240,255,0.92)] truncate">
            {item.provisionName || 'Untitled Review'}
          </p>
          <p className="text-[11px] text-[rgba(200,210,235,0.50)] truncate mt-0.5">
            {item.contractName || 'No contract'}
          </p>
        </div>
        {showDeleteOnHover && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-[rgba(255,95,95,0.15)] text-[rgba(200,210,235,0.50)] hover:text-[rgba(255,95,95,0.95)] transition-all duration-[180ms]"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </motion.div>
  );
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

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function ContractLeftPanel({
  collapsed,
  onToggleCollapse,
  searchQuery,
  onSearchChange,
  pendingApprovals,
  pendingCount,
  inProgressReviews,
  recentHistory,
  allHistory,
  isLoadingApprovals,
  isLoadingHistory,
  selectedItemId,
  onNewReview,
  onSelectApproval,
  onSelectHistory,
  onDeleteHistory,
}: ContractLeftPanelProps) {
  const [expandedSections, setExpandedSections] = useState({
    pending: true,
    inProgress: true,
    recent: true,
    all: false,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const panelWidth = collapsed ? 56 : 280;

  return (
    <motion.aside
      animate={{ width: panelWidth }}
      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
      className="flex-shrink-0 h-full flex flex-col border-r border-[rgba(255,255,255,0.06)]"
      style={{
        background: elevation.L1.background,
        boxShadow: elevation.L1.shadow,
      }}
    >
      {/* Collapsed State */}
      {collapsed ? (
        <div className="flex flex-col items-center py-4 gap-2">
          <button
            onClick={onToggleCollapse}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[rgba(255,255,255,0.06)] text-[rgba(200,210,235,0.75)] hover:text-[rgba(235,240,255,0.92)] transition-colors duration-[180ms]"
          >
            <PanelLeft className="w-5 h-5" />
          </button>
          <div className="w-8 h-px bg-[rgba(255,255,255,0.06)] my-2" />
          <button
            onClick={onNewReview}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-[rgba(90,130,255,0.15)] hover:bg-[rgba(90,130,255,0.25)] text-[rgba(90,130,255,0.95)] transition-colors duration-[180ms]"
          >
            <Plus className="w-5 h-5" />
          </button>
          {pendingCount > 0 && (
            <div className="relative">
              <button className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[rgba(255,255,255,0.06)] text-[rgba(255,190,90,0.95)] transition-colors duration-[180ms]">
                <Inbox className="w-5 h-5" />
              </button>
              <span className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center text-[10px] font-bold bg-[rgba(255,190,90,0.95)] text-[#0a0e14] rounded-full">
                {pendingCount > 9 ? '9+' : pendingCount}
              </span>
            </div>
          )}
          <button className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[rgba(255,255,255,0.06)] text-[rgba(200,210,235,0.50)] hover:text-[rgba(235,240,255,0.92)] transition-colors duration-[180ms]">
            <History className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex-shrink-0 p-3 border-b border-[rgba(255,255,255,0.06)]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[14px] font-semibold text-[rgba(235,240,255,0.92)]">
                Contracts
              </h2>
              <button
                onClick={onToggleCollapse}
                className="p-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.06)] text-[rgba(200,210,235,0.50)] hover:text-[rgba(235,240,255,0.92)] transition-colors duration-[180ms]"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>

            {/* New Review Button */}
            <button
              onClick={onNewReview}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-[13px] transition-all duration-[180ms]"
              style={{
                background: 'linear-gradient(180deg, rgba(90,130,255,0.25), rgba(90,130,255,0.15))',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10), 0 2px 8px rgba(90,130,255,0.20)',
                color: 'rgba(235,240,255,0.95)',
              }}
            >
              <Plus className="w-4 h-4" />
              New Review
            </button>
          </div>

          {/* Search */}
          <div className="flex-shrink-0 p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[rgba(200,210,235,0.50)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search..."
                className="w-full pl-9 pr-3 py-2 text-[13px] rounded-xl bg-[rgba(10,14,20,0.60)] border border-[rgba(255,255,255,0.06)] text-[rgba(235,240,255,0.92)] placeholder-[rgba(200,210,235,0.40)] focus:outline-none focus:border-[rgba(90,130,255,0.50)] transition-colors duration-[180ms]"
              />
              {searchQuery && (
                <button
                  onClick={() => onSearchChange('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgba(200,210,235,0.50)] hover:text-[rgba(235,240,255,0.92)]"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
            {/* Pending Approvals Section */}
            <div>
              <SectionHeader
                title="Pending Approvals"
                count={pendingCount}
                isExpanded={expandedSections.pending}
                onToggle={() => toggleSection('pending')}
                accentColor="amber"
              />
              <AnimatePresence>
                {expandedSections.pending && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-1 pt-1 pl-2">
                      {isLoadingApprovals ? (
                        <div className="flex items-center justify-center py-4">
                          <div className="w-5 h-5 border-2 border-[rgba(255,190,90,0.95)] border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : pendingApprovals.length > 0 ? (
                        pendingApprovals.map((approval) => (
                          <ApprovalItem
                            key={approval.reviewId}
                            approval={approval}
                            isSelected={selectedItemId === approval.reviewId}
                            onSelect={() => onSelectApproval(approval)}
                          />
                        ))
                      ) : (
                        <p className="text-[12px] text-[rgba(200,210,235,0.40)] py-2 px-3">
                          No pending approvals
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* In Progress Section */}
            <div>
              <SectionHeader
                title="In Progress"
                count={inProgressReviews.length}
                isExpanded={expandedSections.inProgress}
                onToggle={() => toggleSection('inProgress')}
                accentColor="blue"
              />
              <AnimatePresence>
                {expandedSections.inProgress && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-1 pt-1 pl-2">
                      {isLoadingHistory ? (
                        <div className="flex items-center justify-center py-4">
                          <div className="w-5 h-5 border-2 border-[rgba(90,130,255,0.95)] border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : inProgressReviews.length > 0 ? (
                        inProgressReviews.map((item) => (
                          <HistoryItem
                            key={item.id}
                            item={item}
                            isSelected={selectedItemId === item.id}
                            onSelect={() => onSelectHistory(item)}
                            onDelete={() => onDeleteHistory(item.id)}
                          />
                        ))
                      ) : (
                        <p className="text-[12px] text-[rgba(200,210,235,0.40)] py-2 px-3">
                          No reviews in progress
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Recent Section */}
            <div>
              <SectionHeader
                title="Recent"
                count={recentHistory.length}
                isExpanded={expandedSections.recent}
                onToggle={() => toggleSection('recent')}
                accentColor="green"
              />
              <AnimatePresence>
                {expandedSections.recent && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-1 pt-1 pl-2">
                      {isLoadingHistory ? (
                        <div className="flex items-center justify-center py-4">
                          <div className="w-5 h-5 border-2 border-[rgba(80,210,140,0.95)] border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : recentHistory.length > 0 ? (
                        recentHistory.map((item) => (
                          <HistoryItem
                            key={item.id}
                            item={item}
                            isSelected={selectedItemId === item.id}
                            onSelect={() => onSelectHistory(item)}
                            onDelete={() => onDeleteHistory(item.id)}
                            showDeleteOnHover={false}
                          />
                        ))
                      ) : (
                        <p className="text-[12px] text-[rgba(200,210,235,0.40)] py-2 px-3">
                          No recent reviews
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* All History Section */}
            <div>
              <SectionHeader
                title="All History"
                count={allHistory.length}
                isExpanded={expandedSections.all}
                onToggle={() => toggleSection('all')}
              />
              <AnimatePresence>
                {expandedSections.all && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-1 pt-1 pl-2 max-h-[300px] overflow-y-auto">
                      {allHistory.length > 0 ? (
                        allHistory.map((item) => (
                          <HistoryItem
                            key={item.id}
                            item={item}
                            isSelected={selectedItemId === item.id}
                            onSelect={() => onSelectHistory(item)}
                            onDelete={() => onDeleteHistory(item.id)}
                          />
                        ))
                      ) : (
                        <p className="text-[12px] text-[rgba(200,210,235,0.40)] py-2 px-3">
                          No history yet
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </>
      )}
    </motion.aside>
  );
}
