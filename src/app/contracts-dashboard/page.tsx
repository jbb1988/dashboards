'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar, { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from '@/components/Sidebar';
import SmartDocumentsTab from '@/components/SmartDocumentsTab';
import GlobalSearch from '@/components/GlobalSearch';
import CommandPalette, { getDefaultCommands } from './components/CommandPalette';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { StageProgressCompact } from './components/StageProgressDots';
import TaskBadge from './components/TaskBadge';
import TasksTabSupabase from './components/TasksTabSupabase';
import BundleModal from './components/BundleModal';
import { DashboardBackground, backgroundPresets, KPICard, AnimatedCounter } from '@/components/mars-ui';
import ContractDetailDrawer from '@/components/contracts/ContractDetailDrawer';
import { usePersistedFilters, FILTER_STORAGE_KEYS } from '@/hooks';

// Persisted filter state for Contracts Pipeline
interface ContractsPipelineFilters {
  activeFilter: string;
  statusFilter: string[];
  dateFilter: string;
  sortField: 'name' | 'value' | 'contractDate' | 'daysInStage';
  sortDirection: 'asc' | 'desc';
  yearFilter: string;
  contractTypeFilter: 'all' | 'renewal' | 'new';
  hideMidContract: boolean;
  contractYearFilter: number[];
  budgetedFilter: boolean;
  probabilityMin: number;
  probabilityMax: number;
  activeTab: 'pipeline' | 'tasks' | 'documents';
}

const DEFAULT_CONTRACTS_FILTERS: ContractsPipelineFilters = {
  activeFilter: 'all',
  statusFilter: [],
  dateFilter: 'all',
  sortField: 'contractDate',
  sortDirection: 'asc',
  yearFilter: new Date().getFullYear().toString(),
  contractTypeFilter: 'all',
  hideMidContract: true,
  contractYearFilter: [],
  budgetedFilter: false,
  probabilityMin: 0,
  probabilityMax: 100,
  activeTab: 'pipeline',
};

// Types
interface BundleInfo {
  bundleId: string;
  bundleName: string;
  isPrimary: boolean;
  contractCount: number;
}

interface Contract {
  id: string;
  salesforceId?: string; // Salesforce Opportunity ID (18-char)
  name: string;
  opportunityName?: string;
  value: number;
  status: string;
  statusGroup: string;
  salesStage?: string; // Raw Salesforce stage (S1, S2, R1, etc.)
  contractType: string[];
  daysInStage: number;
  daysUntilDeadline: number;
  closeDate: string | null;
  awardDate: string | null;
  contractDate: string | null;
  deliverDate: string | null;
  installDate: string | null;
  cashDate: string | null;
  statusChangeDate: string | null;
  progress: number;
  isOverdue: boolean;
  nextTask: string;
  salesRep?: string;
  probability?: number;
  salesforceUrl?: string;
  notInNotion?: boolean;
  isRenewal?: boolean;
  notionName?: string;
  notionPageId?: string; // Notion page ID for direct updates
  matchType?: string;
  budgeted?: boolean; // Budget/Forecast flag from Salesforce
  manualCloseProbability?: number | null; // Manual Close Probability from Salesforce
  redlines?: string; // AI review summary from Notion
  lastRedlineDate?: string | null; // Date of last AI review
  bundleInfo?: BundleInfo | null; // Bundle info if contract is part of a bundle
}

interface KPIs {
  totalPipeline: number;
  totalCount: number;
  overdueValue: number;
  overdueCount: number;
  dueNext30Value: number;
  dueNext30Count: number;
}

interface ContractData {
  contracts: Contract[];
  kpis: KPIs;
  statusBreakdown: Record<string, { count: number; value: number }>;
  lastUpdated: string;
  source?: 'salesforce' | 'supabase';
}

type DataSource = 'salesforce' | 'supabase';
type ActiveFilter = 'all' | 'overdue' | 'due30' | 'highValue' | string;

// Format currency
function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toLocaleString()}`;
}

// Parse "Year X of Y" from opportunity name
function parseContractYear(opportunityName?: string): { current: number; total: number } | null {
  if (!opportunityName) return null;
  const match = opportunityName.match(/Year\s+(\d+)\s+of\s+(\d+)/i);
  if (!match) return null;
  return { current: parseInt(match[1]), total: parseInt(match[2]) };
}

// Check if contract is actionable (Year 1, last year of multi-year, OR no year info)
function isActionableContract(opportunityName?: string): boolean {
  const yearInfo = parseContractYear(opportunityName);
  if (!yearInfo) return true; // No year info = actionable (new deals)
  // Year 1 = new multi-year agreement (needs action)
  // Final year = renewal needed (needs action)
  // Years 2-4 of 5 = mid-contract (no action needed)
  return yearInfo.current === 1 || yearInfo.current === yearInfo.total;
}

// Check if contract is multi-year (has Year X of Y where Y > 1)
function isMultiYearContract(opportunityName?: string): boolean {
  const yearInfo = parseContractYear(opportunityName);
  return yearInfo !== null && yearInfo.total > 1;
}

// Parse latest review summary from redlines field
// Format: "[2025-01-07] ProvisionName: change1 | change2 | change3"
function parseLatestSummary(redlines: string): string[] {
  if (!redlines) return [];
  // Get the last entry (after the last "---" separator if multiple reviews)
  const lastEntry = redlines.split('---').pop()?.trim() || redlines;
  // Extract summary part after the colon
  const match = lastEntry.match(/\[\d{4}-\d{2}-\d{2}\]\s*[^:]+:\s*(.+)/);
  if (match) {
    return match[1].split(' | ').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

// UNIFIED COLOR MAPPING - Used everywhere
// Status ↔ SF Stage alignment:
// Discussions Not Started = no stage (gray)
// Initial Agreement Development = S1 (blue)
// Review & Redlines = S2 (amber)
// Agreement Submission = S3 (purple)
// Approval & Signature = S4 (pink)
// PO Received = S5 (green)
const STAGE_COLORS = {
  '1': '#38BDF8',  // Blue
  '2': '#F59E0B',  // Amber
  '3': '#A78BFA',  // Purple
  '4': '#EC4899',  // Pink
  '5': '#22C55E',  // Green
};

const statusColors: Record<string, string> = {
  'Discussions Not Started': '#64748B',  // Gray
  'Initial Agreement Development': STAGE_COLORS['1'],  // Blue - S1
  'Review & Redlines': STAGE_COLORS['2'],  // Amber - S2
  'Agreement Submission': STAGE_COLORS['3'],  // Purple - S3
  'Approval & Signature': STAGE_COLORS['4'],  // Pink - S4
  'PO Received': STAGE_COLORS['5'],  // Green - S5
};

const getStatusColor = (status: string): string => {
  return statusColors[status] || '#64748B';
};

// Get color for SF Stage (S1, S2, R1, R2, etc.)
const getSfStageColor = (salesStage: string): string => {
  const stageNum = salesStage?.match(/[SR](\d)/)?.[1];
  return stageNum ? STAGE_COLORS[stageNum as keyof typeof STAGE_COLORS] || '#64748B' : '#64748B';
};

// Stage colors for sidebar - uses same STAGE_COLORS for consistency
const stageColors: Record<string, string> = {
  'Discussions Not Started': '#64748B',  // Gray
  'Initial Agreement Development': STAGE_COLORS['1'],  // Blue - S1
  'Review & Redlines': STAGE_COLORS['2'],  // Amber - S2
  'Agreement Submission': STAGE_COLORS['3'],  // Purple - S3
  'Approval & Signature': STAGE_COLORS['4'],  // Pink - S4
  'PO Received': STAGE_COLORS['5'],  // Green - S5
};

// Pipeline Health Snapshot - Horizontal Stage Bars (Option A - Executive Grade)
function PipelineFunnel({
  statusBreakdown,
  activeFilter,
  onFilterChange
}: {
  statusBreakdown: Record<string, { count: number; value: number }>;
  activeFilter: ActiveFilter;
  onFilterChange: (filter: ActiveFilter) => void;
}) {
  // Stages must match VALID_STATUSES exactly - use full names
  const stages = [
    { name: 'Discussions Not Started', short: 'Discussions Not Started' },
    { name: 'Initial Agreement Development', short: 'Initial Agreement Development' },
    { name: 'Agreement Submission', short: 'Agreement Submission' },
    { name: 'Review & Redlines', short: 'Review & Redlines' },
    { name: 'Approval & Signature', short: 'Approval & Signature' },
    { name: 'PO Received', short: 'PO Received' },
  ];

  // Calculate max value for bar scaling
  const maxValue = Math.max(...stages.map(s => statusBreakdown[s.name]?.value || 0), 1);

  // Find the top stage by value for emphasis
  const topStage = stages.reduce((top, stage) => {
    const val = statusBreakdown[stage.name]?.value || 0;
    return val > (statusBreakdown[top.name]?.value || 0) ? stage : top;
  }, stages[0]);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3 }}
      className="rounded-xl bg-[#151F2E] border border-white/[0.06] shadow-[0_8px_24px_rgba(0,0,0,0.35)] p-5"
    >
      <h3 className="text-[11px] font-semibold text-[#64748B] uppercase tracking-[0.08em] mb-5">
        Contracts by Stage
      </h3>

      <div className="space-y-4">
        {stages.map((stage, index) => {
          const data = statusBreakdown[stage.name] || { count: 0, value: 0 };
          const color = stageColors[stage.name] || '#64748B';
          const isActive = activeFilter === stage.name;
          const isTopStage = topStage.name === stage.name && data.value > 0;
          const barWidth = maxValue > 0 ? Math.max((data.value / maxValue) * 100, 2) : 2;

          return (
            <motion.div
              key={stage.name}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + index * 0.05 }}
              onClick={() => onFilterChange(isActive ? 'all' : stage.name)}
              className={`
                cursor-pointer rounded-lg p-3 transition-all duration-200 group
                ${isActive
                  ? 'bg-[#1E293B] ring-1 ring-white/10'
                  : 'hover:bg-[#1E293B]/50'
                }
                ${isTopStage ? 'shadow-[0_0_20px_rgba(56,189,248,0.15)]' : ''}
              `}
            >
              {/* Stage name row */}
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[13px] font-medium transition-colors duration-200 ${
                  isActive ? 'text-[#EAF2FF]' : isTopStage ? 'text-[#EAF2FF]' : 'text-[#8FA3BF] group-hover:text-[#CBD5E1]'
                }`}>
                  {stage.short}
                </span>
                <div className="flex items-center gap-3">
                  <span className={`text-[13px] font-semibold tabular-nums ${
                    isTopStage ? 'text-[#EAF2FF]' : isActive ? 'text-[#EAF2FF]' : 'text-[#8FA3BF]'
                  }`}>
                    {formatCurrency(data.value)}
                  </span>
                  <span className="text-[12px] text-[#64748B] tabular-nums min-w-[24px] text-right">
                    {data.count}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-[10px] bg-white/[0.08] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${barWidth}%` }}
                  transition={{ delay: 0.5 + index * 0.05, duration: 0.6, ease: 'easeOut' }}
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    background: color,
                    opacity: isTopStage ? 1 : 0.85,
                    boxShadow: isTopStage ? `0 0 12px ${color}50` : 'none',
                  }}
                />
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Clear Filter Button */}
      {activeFilter !== 'all' && !['overdue', 'due30', 'highValue'].includes(activeFilter) && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => onFilterChange('all')}
          className="mt-5 w-full py-2 rounded-lg bg-[#0F1722] text-[#64748B] text-xs font-medium hover:bg-[#1E293B] hover:text-[#CBD5E1] transition-colors"
        >
          Clear Filter
        </motion.button>
      )}
    </motion.div>
  );
}

// Valid statuses for Notion - in correct workflow order
const VALID_STATUSES = [
  'Discussions Not Started',
  'Initial Agreement Development',
  'Agreement Submission',
  'Review & Redlines',
  'Approval & Signature',
  'PO Received',
];

// Task interface for Notion tasks
interface NotionTask {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  priority: string | null;
  assignee: string | null;
}

// Contract Row Component - Simplified (details in drawer)
function ContractRow({
  contract,
  index,
  onUpdate,
  focusMode = false,
  pendingStatus,
  onPendingStatusChange,
  openBundleModal,
  onClick,
}: {
  contract: Contract;
  index: number;
  onUpdate?: () => void;
  focusMode?: boolean;
  pendingStatus?: string;
  onPendingStatusChange?: (contractId: string, salesforceId: string | undefined, contractName: string, notionName: string | undefined, newStatus: string, originalStatus: string) => void;
  openBundleModal?: (contract: Contract, mode: 'create' | 'add') => void;
  onClick?: () => void;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [showDateTooltip, setShowDateTooltip] = useState(false);
  const dateTooltipRef = useRef<HTMLDivElement>(null);

  // Use pending status if available (batch mode)
  const effectiveStatus = pendingStatus || contract.status;
  const hasPendingChange = pendingStatus !== undefined && pendingStatus !== contract.status;
  const statusColor = stageColors[effectiveStatus] || getStatusColor(effectiveStatus);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Compact date format for tooltip: MM/DD/YY
  const formatDateCompact = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);
    return `${month}/${day}/${year}`;
  };

  // Construct Salesforce Lightning URL
  const salesforceUrl = contract.salesforceUrl || `https://marscompany.lightning.force.com/lightning/r/Opportunity/${contract.salesforceId}/view`;

  const handleSalesforceClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(salesforceUrl, '_blank');
  };

  // Quick status change - batch mode (pending) or immediate save
  const handleQuickStatusChange = async (newStatus: string) => {
    // Get the effective current status (may be a pending change)
    const effectiveStatus = pendingStatus || contract.status;
    if (newStatus === effectiveStatus) return;

    // If batch mode is enabled, just update pending changes
    if (onPendingStatusChange) {
      onPendingStatusChange(
        contract.id,
        contract.salesforceId,
        contract.name,
        contract.notionName,
        newStatus,
        contract.status // original status for comparison
      );
      return;
    }

    // Otherwise, save immediately (legacy behavior)
    setIsSaving(true);
    try {
      const response = await fetch('/api/contracts/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salesforceId: contract.salesforceId || contract.id,
          contractName: contract.notionName || contract.name,
          updates: { status: newStatus },
        }),
      });

      const result = await response.json();

      if (response.ok) {
        onUpdate?.();
      } else {
        // Show error to user
        console.error('Failed to update status:', result);
        alert(`Failed to update: ${result.error || 'Unknown error'}\n\nContract: ${contract.opportunityName || contract.name}`);
      }
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Network error updating status');
    } finally {
      setIsSaving(false);
    }
  };

  // Alternating row background
  const isEvenRow = index % 2 === 0;

  // Focus Mode: determine if this row is "critical" (overdue, <30 days, high value)
  const isCritical = contract.isOverdue ||
    (contract.daysUntilDeadline !== undefined && contract.daysUntilDeadline <= 30 && contract.daysUntilDeadline >= 0) ||
    contract.value >= 500000;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.02 * Math.min(index, 20) }}
    >
      <div
        onClick={onClick}
        className={`group transition-all duration-150 cursor-pointer ${
          isEvenRow
            ? 'bg-[#151F2E] hover:bg-[#1a2740]'
            : 'bg-[#131B28] hover:bg-[#182437]'
        } ${contract.budgeted ? 'border-l-2 border-[#22C55E]/40' : ''}
        ${focusMode && !isCritical ? 'opacity-40' : ''}
        ${focusMode && isCritical ? 'ring-1 ring-[#F59E0B]/30 bg-[#F59E0B]/5' : ''}
        hover:shadow-[0_0_20px_rgba(56,189,248,0.05)]`}
      >
        <div className="grid gap-4 px-6 py-[14px] items-center" style={{ gridTemplateColumns: '2fr 0.8fr 1.1fr 0.5fr 0.9fr 0.8fr' }}>
          {/* Name Column */}
          <div className="flex items-center gap-2 min-w-0 overflow-hidden">
            <div
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0`}
              style={{ background: contract.isOverdue ? '#ef4444' : statusColor }}
            />
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="flex items-center gap-2">
                <span
                  className="font-semibold text-[#EAF2FF] truncate"
                  title={contract.name}
                >
                  {contract.name}
                </span>
                {contract.isRenewal && (
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[#A78BFA]/15 text-[#A78BFA] flex-shrink-0">
                    R
                  </span>
                )}
                {contract.budgeted && (
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[#22C55E]/15 text-[#22C55E] flex-shrink-0" title="Budgeted">
                    B
                  </span>
                )}
                {contract.bundleInfo && (
                  <span
                    className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[#8B5CF6]/15 text-[#8B5CF6] flex-shrink-0 cursor-help"
                    title={`Part of bundle: ${contract.bundleInfo.bundleName} (${contract.bundleInfo.contractCount} contracts)${contract.bundleInfo.isPrimary ? ' - Primary' : ''}`}
                  >
                    {contract.bundleInfo.isPrimary ? '★' : '⚏'}
                  </span>
                )}
              </div>
              {contract.opportunityName && contract.opportunityName !== contract.name && (
                <span className="text-[12px] text-[#64748B] truncate block" title={contract.opportunityName}>
                  {contract.opportunityName}
                </span>
              )}
            </div>
            {/* Salesforce link icon */}
            <button
              onClick={handleSalesforceClick}
              className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-[#00A1E0] transition-all flex-shrink-0"
              title="Open in Salesforce"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>
          </div>

          {/* Value */}
          <div className="text-right">
            <span className="text-[#CBD5E1] font-semibold text-[14px] tabular-nums">{formatCurrency(contract.value)}</span>
          </div>

          {/* Status - Editable with Quick Dropdown */}
          <div onClick={e => e.stopPropagation()}>
            <div className="relative group/status">
                <div
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full pointer-events-none z-10"
                  style={{ background: statusColor }}
                />
                <select
                  value={effectiveStatus}
                  onChange={e => handleQuickStatusChange(e.target.value)}
                  disabled={isSaving}
                  className={`
                    appearance-none cursor-pointer
                    pl-5 pr-6 py-1 rounded-full text-[12px] font-medium
                    border-0 outline-none
                    transition-all duration-200
                    ${isSaving ? 'opacity-50 cursor-wait' : 'hover:ring-1 hover:ring-white/20'}
                    ${hasPendingChange ? 'ring-2 ring-yellow-500/60' : ''}
                  `}
                  style={{
                    background: `${statusColor}20`,
                    color: statusColor,
                  }}
                >
                  {VALID_STATUSES.map(s => (
                    <option key={s} value={s} className="bg-[#0a1628] text-white">{s}</option>
                  ))}
                </select>
                {/* Pending change indicator */}
                {hasPendingChange && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-500 rounded-full" title="Unsaved change" />
                )}
                {/* Dropdown arrow */}
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg
                    className="w-3 h-3 opacity-50 group-hover/status:opacity-100 transition-opacity"
                    style={{ color: statusColor }}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
            </div>
          </div>

          {/* Sales Stage - from Salesforce - neutral gray */}
          <div className="text-center">
            {contract.salesStage ? (
              <span className="inline-flex items-center justify-center px-2 py-1 rounded text-[12px] font-semibold bg-white/10 text-[#94A3B8]">
                {contract.salesStage}
              </span>
            ) : (
              <span className="text-[#475569] text-[12px]">—</span>
            )}
          </div>

          {/* Close Date - with Date Timeline Tooltip */}
          <div
            className="text-center relative"
            onClick={e => e.stopPropagation()}
            onMouseEnter={() => setShowDateTooltip(true)}
            onMouseLeave={() => setShowDateTooltip(false)}
            ref={dateTooltipRef}
          >
            <span className="text-[14px] text-[#8FA3BF] cursor-pointer hover:text-[#38BDF8] transition-colors">
              {formatDate(contract.contractDate)}
            </span>

            {/* Sophisticated Date Timeline Tooltip */}
            <AnimatePresence>
              {showDateTooltip && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="absolute z-50 top-full mt-2 left-1/2 -translate-x-1/2"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="bg-[#0F1722] border border-white/10 rounded-xl shadow-2xl shadow-black/50 backdrop-blur-xl overflow-hidden min-w-[200px]">
                    {/* Header */}
                    <div className="px-4 py-2.5 border-b border-white/[0.06] bg-gradient-to-r from-[#0189CB]/10 to-transparent">
                      <span className="text-[10px] font-semibold text-[#0189CB] uppercase tracking-wider">Key Dates</span>
                    </div>

                    {/* Date Timeline */}
                    <div className="p-3 space-y-0">
                      {/* Award */}
                      <div className="flex items-center gap-3 py-2 px-1 rounded hover:bg-white/[0.02] transition-colors">
                        <div className="w-2 h-2 rounded-full bg-[#8B5CF6] shadow-[0_0_6px_rgba(139,92,246,0.5)]" />
                        <span className="text-[11px] text-[#64748B] w-16">Award</span>
                        <span className={`text-[13px] font-medium tabular-nums ${contract.awardDate ? 'text-[#E2E8F0]' : 'text-[#475569]'}`}>
                          {formatDateCompact(contract.awardDate)}
                        </span>
                      </div>

                      {/* Contract */}
                      <div className="flex items-center gap-3 py-2 px-1 rounded hover:bg-white/[0.02] transition-colors">
                        <div className="w-2 h-2 rounded-full bg-[#0189CB] shadow-[0_0_6px_rgba(1,137,203,0.5)]" />
                        <span className="text-[11px] text-[#64748B] w-16">Contract</span>
                        <span className={`text-[13px] font-medium tabular-nums ${contract.contractDate ? 'text-[#E2E8F0]' : 'text-[#475569]'}`}>
                          {formatDateCompact(contract.contractDate)}
                        </span>
                      </div>

                      {/* Delivery */}
                      <div className="flex items-center gap-3 py-2 px-1 rounded hover:bg-white/[0.02] transition-colors">
                        <div className="w-2 h-2 rounded-full bg-[#F59E0B] shadow-[0_0_6px_rgba(245,158,11,0.5)]" />
                        <span className="text-[11px] text-[#64748B] w-16">Delivery</span>
                        <span className={`text-[13px] font-medium tabular-nums ${contract.deliverDate ? 'text-[#E2E8F0]' : 'text-[#475569]'}`}>
                          {formatDateCompact(contract.deliverDate)}
                        </span>
                      </div>

                      {/* Install */}
                      <div className="flex items-center gap-3 py-2 px-1 rounded hover:bg-white/[0.02] transition-colors">
                        <div className="w-2 h-2 rounded-full bg-[#22C55E] shadow-[0_0_6px_rgba(34,197,94,0.5)]" />
                        <span className="text-[11px] text-[#64748B] w-16">Install</span>
                        <span className={`text-[13px] font-medium tabular-nums ${contract.installDate ? 'text-[#E2E8F0]' : 'text-[#475569]'}`}>
                          {formatDateCompact(contract.installDate)}
                        </span>
                      </div>

                      {/* Cash */}
                      <div className="flex items-center gap-3 py-2 px-1 rounded hover:bg-white/[0.02] transition-colors">
                        <div className="w-2 h-2 rounded-full bg-[#EC4899] shadow-[0_0_6px_rgba(236,72,153,0.5)]" />
                        <span className="text-[11px] text-[#64748B] w-16">Cash</span>
                        <span className={`text-[13px] font-medium tabular-nums ${contract.cashDate ? 'text-[#E2E8F0]' : 'text-[#475569]'}`}>
                          {formatDateCompact(contract.cashDate)}
                        </span>
                      </div>
                    </div>

                    {/* Tooltip Arrow */}
                    <div className="absolute -top-[6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-[#0F1722] border-l border-t border-white/10 rotate-45" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Days Until Close - Color coded by urgency with bar indicator */}
          <div className="text-center">
            {contract.daysUntilDeadline !== undefined && contract.contractDate ? (
              <div className="inline-flex flex-col items-center gap-1">
                <span className={`
                  inline-flex items-center justify-center px-2.5 py-1 rounded-full text-[12px] font-semibold min-w-[48px] tabular-nums
                  ${contract.daysUntilDeadline < 0
                    ? 'bg-[#EF4444]/15 text-[#EF4444]'  // Overdue - red
                    : contract.daysUntilDeadline <= 90
                      ? 'bg-[#EF4444]/12 text-[#F87171]'  // < 90 days - red
                      : contract.daysUntilDeadline <= 180
                        ? 'bg-[#F59E0B]/12 text-[#FBBF24]'  // 91-180 days - yellow
                        : 'bg-[#22C55E]/12 text-[#4ADE80]'  // 181+ days - green
                  }
                `}>
                  {contract.daysUntilDeadline < 0 ? `${Math.abs(contract.daysUntilDeadline)}d late` : `${contract.daysUntilDeadline}d`}
                </span>
                {/* Thin urgency bar */}
                <div className="w-10 h-[3px] rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      contract.daysUntilDeadline < 0 ? 'animate-pulse' : ''
                    }`}
                    style={{
                      width: `${Math.max(5, Math.min(100, contract.daysUntilDeadline < 0 ? 100 : (1 - contract.daysUntilDeadline / 365) * 100))}%`,
                      background: contract.daysUntilDeadline < 0 ? '#EF4444'
                        : contract.daysUntilDeadline <= 90 ? '#EF4444'
                        : contract.daysUntilDeadline <= 180 ? '#F59E0B'
                        : '#22C55E'
                    }}
                  />
                </div>
              </div>
            ) : (
              <span className="text-[#475569] text-[11px]">—</span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Main Dashboard Component
export default function ContractsDashboard() {
  const [data, setData] = useState<ContractData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Persisted filters - automatically saves to localStorage
  const [filters, setFilters] = usePersistedFilters<ContractsPipelineFilters>(
    FILTER_STORAGE_KEYS.CONTRACTS_PIPELINE,
    DEFAULT_CONTRACTS_FILTERS
  );

  // Destructure persisted filters
  const {
    activeFilter,
    statusFilter,
    dateFilter,
    sortField,
    sortDirection,
    yearFilter,
    contractTypeFilter,
    hideMidContract,
    contractYearFilter,
    budgetedFilter,
    probabilityMin,
    probabilityMax,
    activeTab,
  } = filters;

  // Filter setters that update persisted state (support both direct values and callbacks)
  const setActiveFilter = (value: ActiveFilter) => setFilters(f => ({ ...f, activeFilter: value }));
  const setStatusFilter = (value: string[]) => setFilters(f => ({ ...f, statusFilter: value }));
  const setDateFilter = (value: string) => setFilters(f => ({ ...f, dateFilter: value }));
  const setSortField = (value: 'name' | 'value' | 'contractDate' | 'daysInStage') => setFilters(f => ({ ...f, sortField: value }));
  const setSortDirection = (value: 'asc' | 'desc' | ((prev: 'asc' | 'desc') => 'asc' | 'desc')) => {
    if (typeof value === 'function') {
      setFilters(f => ({ ...f, sortDirection: value(f.sortDirection) }));
    } else {
      setFilters(f => ({ ...f, sortDirection: value }));
    }
  };
  const setYearFilter = (value: string) => setFilters(f => ({ ...f, yearFilter: value }));
  const setContractTypeFilter = (value: 'all' | 'renewal' | 'new') => setFilters(f => ({ ...f, contractTypeFilter: value }));
  const setHideMidContract = (value: boolean) => setFilters(f => ({ ...f, hideMidContract: value }));
  const setContractYearFilter = (value: number[]) => setFilters(f => ({ ...f, contractYearFilter: value }));
  const setBudgetedFilter = (value: boolean) => setFilters(f => ({ ...f, budgetedFilter: value }));
  const setProbabilityMin = (value: number) => setFilters(f => ({ ...f, probabilityMin: value }));
  const setProbabilityMax = (value: number) => setFilters(f => ({ ...f, probabilityMax: value }));
  const setActiveTab = (value: 'pipeline' | 'tasks' | 'documents') => setFilters(f => ({ ...f, activeTab: value }));

  // Non-persisted UI state
  const [contractYearDropdownOpen, setContractYearDropdownOpen] = useState(false); // Dropdown open state
  const [focusMode, setFocusMode] = useState(false); // Focus Mode - highlight critical items
  const [filterPanelOpen, setFilterPanelOpen] = useState(false); // Slide-out filter panel
  const [dataSource, setDataSource] = useState<DataSource>('supabase');
  const [salesforceStatus, setSalesforceStatus] = useState<'connected' | 'needs_auth' | 'not_configured'>('connected');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [selectedContractIndex, setSelectedContractIndex] = useState(0);
  const [taskStats, setTaskStats] = useState<{ pending: number; overdue: number } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Contract detail drawer state
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);

  // Bundle modal state
  const [bundleModalOpen, setBundleModalOpen] = useState(false);
  const [bundleModalMode, setBundleModalMode] = useState<'create' | 'add'>('create');
  const [selectedContractForBundle, setSelectedContractForBundle] = useState<Contract | null>(null);

  // Open bundle modal for a contract
  const openBundleModal = useCallback((contract: Contract, mode: 'create' | 'add') => {
    setSelectedContractForBundle(contract);
    setBundleModalMode(mode);
    setBundleModalOpen(true);
  }, []);

  // Batch editing state - track pending status changes
  const [pendingChanges, setPendingChanges] = useState<Record<string, { contractId: string; salesforceId?: string; contractName: string; notionName?: string; newStatus: string; originalStatus: string }>>({});
  const [isSavingBatch, setIsSavingBatch] = useState(false);
  const [batchSaveProgress, setBatchSaveProgress] = useState<{ current: number; total: number } | null>(null);

  // Salesforce bidirectional sync state
  const [sfSyncPending, setSfSyncPending] = useState<Array<{ id: string; salesforceId: string; name: string; pendingFields: Record<string, any>; salesStage?: string }>>([]);
  const [isPushingToSalesforce, setIsPushingToSalesforce] = useState(false);
  const [sfPushProgress, setSfPushProgress] = useState<{ current: number; total: number } | null>(null);

  // Fetch contracts with pending Salesforce sync
  const fetchSfSyncPending = useCallback(async () => {
    try {
      const response = await fetch('/api/contracts?syncStatus=pending');
      if (response.ok) {
        const result = await response.json();
        setSfSyncPending(result.pendingSync || []);
      }
    } catch (err) {
      console.error('Failed to fetch SF sync pending:', err);
    }
  }, []);

  // Check for pending syncs after data refresh
  useEffect(() => {
    if (data?.contracts) {
      fetchSfSyncPending();
    }
  }, [data?.contracts, fetchSfSyncPending]);

  // Push pending changes to Salesforce
  const handlePushToSalesforce = useCallback(async () => {
    if (sfSyncPending.length === 0) return;

    setIsPushingToSalesforce(true);
    setSfPushProgress({ current: 0, total: sfSyncPending.length });

    try {
      // Build batch update payload - only date fields sync to Salesforce
      const updates = sfSyncPending.map(item => {
        const fields: Record<string, any> = {};

        if (item.pendingFields.award_date) {
          fields.Award_Date__c = item.pendingFields.award_date;
        }
        if (item.pendingFields.contract_date) {
          fields.Contract_Date__c = item.pendingFields.contract_date;
        }
        if (item.pendingFields.deliver_date) {
          fields.Deliver_Date__c = item.pendingFields.deliver_date;
        }
        if (item.pendingFields.install_date) {
          fields.Install_Date__c = item.pendingFields.install_date;
        }
        if (item.pendingFields.cash_date) {
          fields.Cash_Date__c = item.pendingFields.cash_date;
        }

        return {
          id: item.salesforceId,
          fields,
        };
      });

      const response = await fetch('/api/salesforce/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'batchUpdate', updates }),
      });

      const result = await response.json();

      if (result.successful > 0) {
        // Clear sync status for successful pushes
        const successfulIds = result.results
          .filter((r: any) => r.success)
          .map((r: any) => r.id);

        if (successfulIds.length > 0) {
          await fetch('/api/contracts/sync-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ salesforceIds: successfulIds, status: 'synced' }),
          });
        }

        // Refresh pending list
        await fetchSfSyncPending();
      }

      // Show result
      if (result.failed > 0) {
        const failedNames = result.results
          .filter((r: any) => !r.success)
          .map((r: any) => `• ${r.id}: ${r.errors?.join(', ') || 'Unknown error'}`)
          .join('\n');
        alert(`Pushed ${result.successful}/${result.total} to Salesforce.\n\nFailed:\n${failedNames}`);
      } else {
        console.log(`[SF PUSH] All ${result.successful} records pushed successfully`);
      }
    } catch (err) {
      console.error('Salesforce push error:', err);
      alert(`Failed to push to Salesforce: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsPushingToSalesforce(false);
      setSfPushProgress(null);
    }
  }, [sfSyncPending, fetchSfSyncPending]);

  // Handle pending status change (batch mode)
  const handlePendingStatusChange = useCallback((contractId: string, salesforceId: string | undefined, contractName: string, notionName: string | undefined, newStatus: string, originalStatus: string) => {
    if (newStatus === originalStatus) {
      // If changed back to original, remove from pending
      setPendingChanges(prev => {
        const updated = { ...prev };
        delete updated[contractId];
        return updated;
      });
    } else {
      // Add or update pending change
      setPendingChanges(prev => ({
        ...prev,
        [contractId]: { contractId, salesforceId, contractName, notionName, newStatus, originalStatus }
      }));
    }
  }, []);

  // Clear all pending changes
  const handleClearPendingChanges = useCallback(() => {
    setPendingChanges({});
  }, []);

  // Save all pending changes
  const handleSavePendingChanges = useCallback(async () => {
    const changes = Object.values(pendingChanges);
    if (changes.length === 0) return;

    setIsSavingBatch(true);
    setBatchSaveProgress({ current: 0, total: changes.length });

    const results: { success: boolean; contractId: string; contractName: string; error?: string }[] = [];

    for (let i = 0; i < changes.length; i++) {
      const change = changes[i];
      setBatchSaveProgress({ current: i + 1, total: changes.length });

      // Use salesforceId if available, otherwise fall back to contractId
      const idToUse = change.salesforceId || change.contractId;
      console.log(`[BATCH SAVE] Saving ${change.contractName} (${idToUse}) -> ${change.newStatus}`);

      try {
        const response = await fetch('/api/contracts/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            salesforceId: idToUse,
            contractName: change.notionName || change.contractName,
            updates: { status: change.newStatus },
          }),
        });

        const result = await response.json();
        console.log(`[BATCH SAVE] ${change.contractName}: ${response.ok ? 'SUCCESS' : 'FAILED'} - ${JSON.stringify(result)}`);

        results.push({
          success: response.ok,
          contractId: change.contractId,
          contractName: change.contractName,
          error: response.ok ? undefined : (result.error || result.details || 'Unknown error')
        });
      } catch (err) {
        console.error(`[BATCH SAVE] ${change.contractName}: Network error`, err);
        results.push({
          success: false,
          contractId: change.contractId,
          contractName: change.contractName,
          error: err instanceof Error ? err.message : 'Network error'
        });
      }
    }

    setIsSavingBatch(false);
    setBatchSaveProgress(null);

    // Show summary
    const succeeded = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    // Only clear changes that succeeded - keep failed ones for retry
    if (succeeded.length > 0) {
      setPendingChanges(prev => {
        const updated = { ...prev };
        succeeded.forEach(r => {
          delete updated[r.contractId];
        });
        return updated;
      });
      // Refresh data only if some succeeded - MUST await to ensure UI updates
      await fetchData();
    }

    // Show appropriate message
    if (failed.length > 0 && succeeded.length === 0) {
      // All failed
      const failedNames = failed.map(f => `• ${f.contractName}: ${f.error}`).join('\n');
      alert(`Failed to save all ${failed.length} changes:\n\n${failedNames}\n\nYour changes are preserved - try again or contact support.`);
    } else if (failed.length > 0) {
      // Some failed
      const failedNames = failed.map(f => `• ${f.contractName}: ${f.error}`).join('\n');
      alert(`Saved ${succeeded.length}/${results.length} contracts.\n\nFailed (still pending):\n${failedNames}`);
    } else if (succeeded.length > 0) {
      // All succeeded - no alert needed, just refresh
      console.log(`[BATCH SAVE] All ${succeeded.length} contracts saved successfully`);
    }
  }, [pendingChanges]);

  // Fetch task stats for KPI display
  useEffect(() => {
    async function fetchTaskStats() {
      try {
        const response = await fetch('/api/tasks?stats=true');
        if (response.ok) {
          const stats = await response.json();
          setTaskStats({ pending: stats.pending + stats.inProgress, overdue: stats.overdue });
        }
      } catch (err) {
        console.error('Failed to fetch task stats:', err);
      }
    }
    fetchTaskStats();
  }, [activeTab]); // Refresh when switching tabs

  // Check Salesforce status
  useEffect(() => {
    async function checkSalesforce() {
      try {
        const response = await fetch('/api/salesforce');
        const result = await response.json();

        if (result.configured === false) {
          setSalesforceStatus('not_configured');
          // Keep supabase - don't switch
        } else if (result.needsAuth) {
          setSalesforceStatus('needs_auth');
          // Keep supabase - don't switch
        } else if (!result.error) {
          setSalesforceStatus('connected');
          // DON'T auto-switch to salesforce - status field lives in Supabase
          // User can manually switch if needed
        }
      } catch {
        setSalesforceStatus('not_configured');
        // Keep supabase - don't switch
      }
    }
    checkSalesforce();

    // Check URL params for OAuth callback
    const params = new URLSearchParams(window.location.search);
    if (params.get('salesforce') === 'connected') {
      setSalesforceStatus('connected');
      // Don't auto-switch to salesforce - keep supabase for status tracking
      window.history.replaceState({}, '', '/contracts-dashboard');
    }
  }, []);

  // Fetch data based on selected source
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = dataSource === 'salesforce' ? '/api/salesforce' : '/api/contracts';
      // Add cache-busting timestamp to force fresh data
      const cacheBuster = `?t=${Date.now()}`;
      const response = await fetch(endpoint + cacheBuster, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (!response.ok) throw new Error('Failed to fetch contracts');
      const result = await response.json();
      if (result.error) {
        throw new Error(result.message || result.error);
      }
      setData({ ...result, source: dataSource });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dataSource]);

  // Refresh data callback for inline editing
  const handleDataRefresh = () => {
    fetchData();
  };

  // Handle KPI card clicks
  const handleFilterChange = (filter: ActiveFilter) => {
    setActiveFilter(filter === activeFilter ? 'all' : filter);
  };

  // Command palette commands
  const commandPaletteCommands = useMemo(() => getDefaultCommands({
    createTask: () => {
      setActiveTab('tasks');
      // TasksTab will handle showing the add task form
    },
    filterOverdue: () => {
      setDateFilter('overdue');
      setActiveFilter('overdue');
    },
    filterDue30: () => {
      setDateFilter('this-month');
      setActiveFilter('due30');
    },
    filterHighValue: () => {
      setActiveFilter('highValue');
    },
    clearFilters: () => {
      setActiveFilter('all');
      setStatusFilter([]);
      setDateFilter('all');
      setSearchQuery('');
    },
    goToPipeline: () => setActiveTab('pipeline'),
    goToTasks: () => setActiveTab('tasks'),
    goToDocuments: () => setActiveTab('documents'),
    refresh: () => fetchData(),
    exportData: () => {
      // Simple CSV export
      if (!data) return;
      const csv = [
        ['Name', 'Value', 'Status', 'Close Date', 'Sales Rep'].join(','),
        ...data.contracts.map(c =>
          [c.name, c.value, c.status, c.closeDate || '', c.salesRep || ''].join(',')
        )
      ].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'contracts-export.csv';
      a.click();
    },
  }), [data, fetchData]);

  // Keyboard shortcuts
  useKeyboardShortcuts(
    [
      { key: 't', description: 'Create task', action: () => setActiveTab('tasks') },
      { key: '/', description: 'Focus search', action: () => searchInputRef.current?.focus() },
      { key: 'f', description: 'Toggle filters', action: () => setFilterPanelOpen(p => !p) },
      { key: 'r', description: 'Refresh', action: () => fetchData() },
      { key: 'p', sequence: ['g', 'p'], description: 'Go to Pipeline', action: () => setActiveTab('pipeline') },
      { key: 't', sequence: ['g', 't'], description: 'Go to Tasks', action: () => setActiveTab('tasks') },
      { key: 'd', sequence: ['g', 'd'], description: 'Go to Documents', action: () => setActiveTab('documents') },
    ],
    { enabled: !commandPaletteOpen, onCommandPalette: () => setCommandPaletteOpen(true) }
  );

  // Get unique statuses for filter dropdown - use VALID_STATUSES to ensure all stages appear in correct order
  const statuses = useMemo(() => {
    return VALID_STATUSES;
  }, []);

  // Get available years for year filter
  const availableYears = useMemo(() => {
    if (!data) return [];
    const years = new Set<string>();
    data.contracts.forEach(c => {
      const dateStr = c.contractDate || c.closeDate;
      if (dateStr) {
        const year = new Date(dateStr).getFullYear().toString();
        years.add(year);
      }
    });
    return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a)); // Descending
  }, [data]);

  // Get available contract years for Year X of Y filter (dynamically from data)
  const availableContractYears = useMemo(() => {
    if (!data) return [];
    const years = new Set<number>();
    data.contracts.forEach(c => {
      const yearInfo = parseContractYear(c.opportunityName);
      if (yearInfo) {
        years.add(yearInfo.current);
      }
    });
    return Array.from(years).sort((a, b) => a - b); // Ascending order (1, 2, 3, 4, 5)
  }, [data]);

  // Calculate active filters for display
  const activeFilters = useMemo(() => {
    const filters: { key: string; label: string; onRemove: () => void }[] = [];

    if (statusFilter.length > 0) {
      const label = statusFilter.length === 1 ? statusFilter[0] : `${statusFilter.length} statuses`;
      filters.push({ key: 'status', label, onRemove: () => setStatusFilter([]) });
    }
    if (dateFilter !== 'all') {
      const dateLabels: Record<string, string> = {
        'overdue': 'Overdue',
        'this-week': 'This Week',
        'this-month': 'Next 30 Days',
        'this-quarter': 'Next 90 Days',
        'next-6-months': 'Next 6 Months',
      };
      filters.push({ key: 'date', label: dateLabels[dateFilter] || dateFilter, onRemove: () => setDateFilter('all') });
    }
    if (yearFilter !== 'all' && yearFilter !== new Date().getFullYear().toString()) {
      filters.push({ key: 'year', label: yearFilter, onRemove: () => setYearFilter(new Date().getFullYear().toString()) });
    }
    if (contractTypeFilter !== 'all') {
      filters.push({ key: 'type', label: contractTypeFilter === 'renewal' ? 'Renewals' : 'New Business', onRemove: () => setContractTypeFilter('all') });
    }
    if (contractYearFilter.length > 0) {
      const label = contractYearFilter.length === 1 ? `Year ${contractYearFilter[0]}` : `Years ${contractYearFilter.join(', ')}`;
      filters.push({ key: 'contractYear', label, onRemove: () => setContractYearFilter([]) });
    }
    if (budgetedFilter) {
      filters.push({ key: 'budgeted', label: 'Budgeted', onRemove: () => setBudgetedFilter(false) });
    }
    if (probabilityMin > 0) {
      filters.push({ key: 'probability', label: `${probabilityMin}%+`, onRemove: () => setProbabilityMin(0) });
    }
    if (hideMidContract) {
      filters.push({ key: 'actionable', label: 'Actionable Only', onRemove: () => setHideMidContract(false) });
    }

    return filters;
  }, [statusFilter, dateFilter, yearFilter, contractTypeFilter, contractYearFilter, budgetedFilter, probabilityMin, hideMidContract]);

  // Filter and sort contracts
  const filteredContracts = useMemo(() => {
    if (!data) return [];

    let filtered = data.contracts;

    // Apply KPI card filter
    switch (activeFilter) {
      case 'overdue':
        filtered = filtered.filter(c => c.isOverdue);
        break;
      case 'due30':
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        filtered = filtered.filter(c => {
          if (!c.closeDate) return false;
          const closeDate = new Date(c.closeDate);
          return closeDate <= thirtyDaysFromNow && closeDate >= new Date();
        });
        break;
      case 'highValue':
        const avgValue = data.contracts.reduce((sum, c) => sum + c.value, 0) / data.contracts.length;
        filtered = filtered.filter(c => c.value > avgValue);
        break;
      default:
        // Check if it's a stage filter from funnel click
        if (activeFilter !== 'all') {
          filtered = filtered.filter(c => c.status === activeFilter);
        }
    }

    // Apply status dropdown filter (multi-select)
    if (statusFilter.length > 0) {
      filtered = filtered.filter(c => statusFilter.includes(c.status));
    }

    // Apply date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      filtered = filtered.filter(c => {
        if (!c.closeDate) return dateFilter === 'no-date';
        const closeDate = new Date(c.closeDate);

        switch (dateFilter) {
          case 'overdue':
            return closeDate < today;
          case 'this-week':
            const weekEnd = new Date(today);
            weekEnd.setDate(weekEnd.getDate() + 7);
            return closeDate >= today && closeDate <= weekEnd;
          case 'this-month':
            const monthEnd = new Date(today);
            monthEnd.setDate(monthEnd.getDate() + 30);
            return closeDate >= today && closeDate <= monthEnd;
          case 'this-quarter':
            const quarterEnd = new Date(today);
            quarterEnd.setDate(quarterEnd.getDate() + 90);
            return closeDate >= today && closeDate <= quarterEnd;
          case 'next-6-months':
            const sixMonthsEnd = new Date(today);
            sixMonthsEnd.setDate(sixMonthsEnd.getDate() + 180);
            return closeDate >= today && closeDate <= sixMonthsEnd;
          default:
            return true;
        }
      });
    }

    // Year filter
    if (yearFilter !== 'all') {
      filtered = filtered.filter(c => {
        const dateStr = c.contractDate || c.closeDate;
        if (!dateStr) return false;
        const year = new Date(dateStr).getFullYear().toString();
        return year === yearFilter;
      });
    }

    // Contract type filter (Renewal vs New Business)
    if (contractTypeFilter !== 'all') {
      if (contractTypeFilter === 'renewal') {
        filtered = filtered.filter(c => c.isRenewal === true);
      } else if (contractTypeFilter === 'new') {
        filtered = filtered.filter(c => c.isRenewal !== true);
      }
    }

    // Actionable contracts filter (hide mid-contract Year 1-4 of 5, only show Year 5 of 5)
    if (hideMidContract) {
      filtered = filtered.filter(c => isActionableContract(c.opportunityName));
    }

    // Contract year filter (Year 1, Year 2, etc.) - multi-select
    if (contractYearFilter.length > 0) {
      filtered = filtered.filter(c => {
        const yearInfo = parseContractYear(c.opportunityName);
        if (!yearInfo) return false; // No year info = exclude when filtering by specific year
        return contractYearFilter.includes(yearInfo.current);
      });
    }

    // Budgeted filter
    if (budgetedFilter) {
      filtered = filtered.filter(c => c.budgeted === true);
    }

    // Probability filter (minimum threshold)
    if (probabilityMin > 0) {
      filtered = filtered.filter(c => {
        const prob = c.manualCloseProbability ?? c.probability ?? 0;
        return prob >= probabilityMin;
      });
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(query) ||
        c.status.toLowerCase().includes(query) ||
        c.contractType.some(t => t.toLowerCase().includes(query)) ||
        (c.salesRep && c.salesRep.toLowerCase().includes(query))
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'value':
          comparison = a.value - b.value;
          break;
        case 'contractDate':
          const dateA = a.contractDate ? new Date(a.contractDate).getTime() : Infinity;
          const dateB = b.contractDate ? new Date(b.contractDate).getTime() : Infinity;
          comparison = dateA - dateB;
          break;
        case 'daysInStage':
          comparison = a.daysInStage - b.daysInStage;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [data, searchQuery, activeFilter, statusFilter, dateFilter, yearFilter, contractTypeFilter, hideMidContract, contractYearFilter, budgetedFilter, probabilityMin, sortField, sortDirection]);

  // Calculate KPIs from filtered contracts (reflects ALL filters including search)
  const filteredKpis = useMemo(() => {
    if (!filteredContracts || filteredContracts.length === 0) {
      return { totalPipeline: 0, totalCount: 0, overdueValue: 0, overdueCount: 0, dueNext30Value: 0, dueNext30Count: 0, highValueCount: 0 };
    }

    // Use the already filtered contracts so KPIs reflect all filters
    const baseContracts = filteredContracts;

    const totalPipeline = baseContracts.reduce((sum, c) => sum + c.value, 0);
    const totalCount = baseContracts.length;

    const overdueContracts = baseContracts.filter(c => c.isOverdue);
    const overdueValue = overdueContracts.reduce((sum, c) => sum + c.value, 0);
    const overdueCount = overdueContracts.length;

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const dueNext30 = baseContracts.filter(c => {
      if (!c.closeDate) return false;
      const closeDate = new Date(c.closeDate);
      return closeDate <= thirtyDaysFromNow && closeDate >= new Date();
    });
    const dueNext30Value = dueNext30.reduce((sum, c) => sum + c.value, 0);
    const dueNext30Count = dueNext30.length;

    const avgValue = totalCount > 0 ? totalPipeline / totalCount : 0;
    const highValueCount = baseContracts.filter(c => c.value > avgValue).length;

    return { totalPipeline, totalCount, overdueValue, overdueCount, dueNext30Value, dueNext30Count, highValueCount };
  }, [filteredContracts]);

  // Calculate status breakdown from filtered contracts for the stage chart
  const filteredStatusBreakdown = useMemo(() => {
    if (!filteredContracts || filteredContracts.length === 0) return {};

    // Use the already filtered contracts so status breakdown reflects all filters
    const breakdown: Record<string, { count: number; value: number }> = {};
    filteredContracts.forEach(c => {
      if (!breakdown[c.status]) {
        breakdown[c.status] = { count: 0, value: 0 };
      }
      breakdown[c.status].count++;
      breakdown[c.status].value += c.value;
    });
    return breakdown;
  }, [filteredContracts]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F1722] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-[#38BDF8]/20 border-t-[#38BDF8] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#64748B] text-[13px]">Loading contracts...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0F1722] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-[#EF4444] text-[15px] font-medium mb-3">Error loading contracts</div>
          <p className="text-[#64748B] text-[13px] mb-6">{error}</p>
          {salesforceStatus === 'needs_auth' && (
            <a
              href="/api/salesforce/auth"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#38BDF8] text-[#0F1722] text-sm font-semibold rounded-lg hover:bg-[#38BDF8]/90 transition-colors"
            >
              Connect to Salesforce
            </a>
          )}
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-[#0F1722] relative overflow-hidden">
      <DashboardBackground {...backgroundPresets.contracts} />
      {/* Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        commands={commandPaletteCommands}
        contracts={data?.contracts.map(c => ({
          id: c.id,
          salesforceId: c.salesforceId,
          name: c.name,
          status: c.status,
          value: c.value,
        })) || []}
        onContractSelect={(contractId) => {
          // Scroll to and highlight the contract
          setSearchQuery(data?.contracts.find(c => c.id === contractId)?.name || '');
          setActiveTab('pipeline');
        }}
        placeholder="Type a command or search contracts..."
      />

      {/* Sidebar */}
      <Sidebar isCollapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />

      {/* Background - subtle gradient for depth */}
      <div className="fixed inset-0 bg-gradient-to-b from-[#121C2B] via-[#0F1722] to-[#0F1722]" />

      {/* Main Content - offset by sidebar width */}
      <motion.div
        className="relative z-10"
        animate={{ marginLeft: sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        <div className="max-w-[1600px] mx-auto px-8 py-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-white tracking-tight">
                  Contracts Pipeline
                </h1>
                <p className="text-gray-500 mt-1">Real-time Salesforce data • Click cards to filter</p>
              </div>
              <div className="flex items-center gap-6">
                {/* Command Palette Trigger */}
                <button
                  onClick={() => setCommandPaletteOpen(true)}
                  className="flex items-center gap-3 px-4 py-2 bg-[#0B1220] border border-white/[0.08] rounded-lg text-[#64748B] hover:text-white hover:border-[#38BDF8]/30 transition-all group"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span className="text-sm">Search or command...</span>
                  <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-[#64748B] bg-[#151F2E] rounded border border-white/[0.06] group-hover:border-[#38BDF8]/20">
                    <span className="text-[11px]">⌘</span>K
                  </kbd>
                </button>

                {/* Global Search */}
                <GlobalSearch />

                <div className="text-right">
                  <div className="text-sm text-gray-500 flex items-center gap-2 justify-end">
                    <span className="w-2 h-2 rounded-full bg-[#00A1E0] animate-pulse" />
                    Salesforce
                  </div>
                  <div className="text-white font-medium text-sm">
                    Updated {(() => {
                      const mins = Math.floor((Date.now() - new Date(data.lastUpdated).getTime()) / 60000);
                      if (mins < 1) return 'just now';
                      if (mins < 60) return `${mins} min ago`;
                      const hours = Math.floor(mins / 60);
                      if (hours < 24) return `${hours}h ago`;
                      return `${Math.floor(hours / 24)}d ago`;
                    })()}
                  </div>
                </div>
                {/* Focus Mode Toggle */}
                <div className="relative group">
                  <button
                    onClick={() => setFocusMode(!focusMode)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-2 ${
                      focusMode
                        ? 'bg-[#F59E0B]/20 text-[#F59E0B] ring-1 ring-[#F59E0B]/30'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    Focus
                  </button>
                  {/* Tooltip */}
                  <div className="absolute top-full right-0 mt-2 w-56 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
                    <div className="bg-[#1E293B] border border-white/10 rounded-lg p-3 shadow-xl">
                      <p className="text-[12px] text-[#94A3B8] leading-relaxed">
                        Highlights overdue, closing within 30 days, and high-value contracts. Dims lower priority items.
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => window.location.reload()}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                  title="Refresh data"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-1 mt-6 bg-[#111827] rounded-lg p-1 w-fit">
              <button
                onClick={() => setActiveTab('pipeline')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'pipeline'
                    ? 'bg-[#38BDF8]/20 text-[#38BDF8]'
                    : 'text-[#8FA3BF] hover:text-white hover:bg-white/5'
                }`}
              >
                Pipeline
              </button>
              <button
                onClick={() => setActiveTab('tasks')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                  activeTab === 'tasks'
                    ? 'bg-[#38BDF8]/20 text-[#38BDF8]'
                    : 'text-[#8FA3BF] hover:text-white hover:bg-white/5'
                }`}
              >
                Tasks
                {taskStats && taskStats.overdue > 0 ? (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full min-w-[18px] text-center">
                    {taskStats.overdue}
                  </span>
                ) : taskStats && taskStats.pending > 0 ? (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold bg-[#38BDF8]/20 text-[#38BDF8] rounded-full min-w-[18px] text-center">
                    {taskStats.pending}
                  </span>
                ) : null}
              </button>
              <button
                onClick={() => setActiveTab('documents')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'documents'
                    ? 'bg-[#38BDF8]/20 text-[#38BDF8]'
                    : 'text-[#8FA3BF] hover:text-white hover:bg-white/5'
                }`}
              >
                Documents
              </button>
            </div>
          </motion.div>

          {/* Tab Content */}
          {activeTab === 'pipeline' && (
          <>
          {/* Interactive KPI Cards - reflect current year/type filters */}
          <div className="grid grid-cols-4 gap-6 mb-8">
            <KPICard
              title={yearFilter !== 'all' ? `${yearFilter} Pipeline` : 'Total Pipeline'}
              value={<AnimatedCounter value={filteredKpis.totalPipeline / 1000000} prefix="$" suffix="M" decimals={1} />}
              subtitle={`${filteredKpis.totalCount} active contracts`}
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              color="#0189CB"
              delay={0.1}
              isActive={activeFilter === 'all'}
              onClick={() => handleFilterChange('all')}
            />
            <KPICard
              title="Due Next 30 Days"
              value={<AnimatedCounter value={filteredKpis.dueNext30Value / 1000000} prefix="$" suffix="M" decimals={1} />}
              subtitle={`${filteredKpis.dueNext30Count} contracts closing soon`}
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
              color="#3b82f6"
              delay={0.2}
              isActive={activeFilter === 'due30'}
              onClick={() => handleFilterChange('due30')}
            />
            <KPICard
              title="Overdue"
              value={<AnimatedCounter value={filteredKpis.overdueValue / 1000000} prefix="$" suffix="M" decimals={1} />}
              subtitle={`${filteredKpis.overdueCount} contracts past deadline`}
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              color="#ef4444"
              delay={0.3}
              isActive={activeFilter === 'overdue'}
              onClick={() => handleFilterChange('overdue')}
            />
            <KPICard
              title="High Value"
              value={<AnimatedCounter value={filteredKpis.highValueCount} suffix=" deals" />}
              subtitle="Above average contract value"
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
              color="#10b981"
              delay={0.4}
              isActive={activeFilter === 'highValue'}
              onClick={() => handleFilterChange('highValue')}
            />
          </div>

          {/* Active Filter Indicator */}
          {activeFilter !== 'all' && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 flex items-center gap-3"
            >
              <span className="text-gray-400 text-sm">Showing:</span>
              <span className="px-3 py-1 rounded-full bg-[#0189CB]/20 text-[#0189CB] text-sm font-medium">
                {activeFilter === 'overdue' ? 'Overdue Contracts' :
                 activeFilter === 'due30' ? 'Due in 30 Days' :
                 activeFilter === 'highValue' ? 'High Value Deals' :
                 activeFilter}
              </span>
              <span className="text-gray-500 text-sm">({filteredContracts.length} results)</span>
            </motion.div>
          )}

          <div className="grid grid-cols-4 gap-6">
            {/* Left Column - Pipeline Funnel */}
            <div className="col-span-1">
              <PipelineFunnel
                statusBreakdown={filteredStatusBreakdown}
                activeFilter={activeFilter}
                onFilterChange={handleFilterChange}
              />
            </div>

            {/* Contracts Table - Main Content */}
            <div className="col-span-3">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="rounded-xl bg-[#151F2E] border border-white/[0.06] shadow-[0_8px_24px_rgba(0,0,0,0.35)] overflow-hidden"
              >
                {/* Table Header / Filters - Redesigned for Board Presentation */}
                <div className="px-6 py-4 border-b border-white/[0.06]">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-[14px] font-semibold text-[#EAF2FF] flex items-center gap-3 shrink-0">
                      Active Contracts
                      <span className="text-[11px] font-medium text-[#64748B] bg-[#1E293B] px-2.5 py-1 rounded-full">{filteredContracts.length}</span>
                    </h3>

                    <div className="flex items-center gap-3">
                      {/* Search */}
                      <div className="relative">
                        <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                          type="text"
                          placeholder="Search contracts..."
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          className="pl-9 pr-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-[#0189CB]/50 text-sm w-56"
                        />
                      </div>

                      {/* Year Quick Filter */}
                      <select
                        value={yearFilter}
                        onChange={e => setYearFilter(e.target.value)}
                        className="px-4 py-2.5 rounded-lg bg-[#0189CB]/20 border border-[#0189CB]/30 text-[#0189CB] focus:outline-none focus:border-[#0189CB]/50 text-sm font-medium"
                      >
                        <option value="all" className="bg-[#0a1628] text-white">All Years</option>
                        {availableYears.map(year => (
                          <option key={year} value={year} className="bg-[#0a1628] text-white">{year}</option>
                        ))}
                      </select>

                      {/* Filter Button */}
                      <button
                        onClick={() => setFilterPanelOpen(true)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                          activeFilters.length > 0
                            ? 'bg-[#0189CB]/20 border-[#0189CB]/40 text-[#0189CB]'
                            : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                        </svg>
                        Filters
                        {activeFilters.length > 0 && (
                          <span className="bg-[#0189CB] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                            {activeFilters.length}
                          </span>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Active Filter Pills */}
                  {activeFilters.length > 0 && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/[0.04]">
                      <span className="text-[11px] font-medium text-[#64748B] uppercase tracking-wider">Active:</span>
                      <div className="flex items-center gap-2 flex-wrap">
                        {activeFilters.map(filter => (
                          <button
                            key={filter.key}
                            onClick={filter.onRemove}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white hover:bg-white/10 transition-colors group"
                          >
                            {filter.label}
                            <svg className="w-3 h-3 text-gray-400 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        ))}
                        <button
                          onClick={() => {
                            setStatusFilter([]);
                            setDateFilter('all');
                            setYearFilter(new Date().getFullYear().toString());
                            setContractTypeFilter('all');
                            setContractYearFilter([]);
                            setBudgetedFilter(false);
                            setProbabilityMin(0);
                            setHideMidContract(false);
                            setSearchQuery('');
                            setActiveFilter('all');
                          }}
                          className="text-[11px] text-gray-400 hover:text-white transition-colors ml-1"
                        >
                          Clear all
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Slide-out Filter Panel */}
                <AnimatePresence>
                  {filterPanelOpen && (
                    <>
                      {/* Backdrop */}
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 z-40"
                        onClick={() => setFilterPanelOpen(false)}
                      />
                      {/* Panel */}
                      <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 h-full w-[380px] bg-[#0F1722] border-l border-white/10 shadow-2xl z-50 overflow-y-auto"
                      >
                        {/* Panel Header */}
                        <div className="sticky top-0 bg-[#0F1722] px-6 py-5 border-b border-white/10 flex items-center justify-between">
                          <h2 className="text-lg font-semibold text-white">Filters</h2>
                          <button
                            onClick={() => setFilterPanelOpen(false)}
                            className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>

                        <div className="p-6 space-y-8">
                          {/* Status Section */}
                          <div>
                            <h3 className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-3 flex items-center gap-2">
                              <span className="w-5 h-5 rounded bg-blue-500/20 flex items-center justify-center text-blue-400">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                              </span>
                              Status
                              {statusFilter.length > 0 && (
                                <button
                                  onClick={() => setStatusFilter([])}
                                  className="ml-auto text-[10px] text-[#64748B] hover:text-white"
                                >
                                  Clear
                                </button>
                              )}
                            </h3>
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                              {statuses.map(status => {
                                const isSelected = statusFilter.includes(status);
                                const statusColor = getStatusColor(status);
                                return (
                                  <label
                                    key={status}
                                    className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all ${
                                      isSelected
                                        ? 'bg-white/10 border border-white/20'
                                        : 'bg-white/5 border border-transparent hover:bg-white/8'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => {
                                        if (isSelected) {
                                          setStatusFilter(statusFilter.filter(s => s !== status));
                                        } else {
                                          setStatusFilter([...statusFilter, status]);
                                        }
                                      }}
                                      className="sr-only"
                                    />
                                    <span
                                      className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                                        isSelected ? 'bg-[#0189CB] border-[#0189CB]' : 'border-white/30'
                                      }`}
                                    >
                                      {isSelected && (
                                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                      )}
                                    </span>
                                    <span
                                      className="w-2 h-2 rounded-full flex-shrink-0"
                                      style={{ background: statusColor }}
                                    />
                                    <span className="text-sm text-white truncate">{status}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>

                          {/* Timeline Section */}
                          <div>
                            <h3 className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-3 flex items-center gap-2">
                              <span className="w-5 h-5 rounded bg-amber-500/20 flex items-center justify-center text-amber-400">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                              </span>
                              Timeline
                            </h3>
                            <div className="grid grid-cols-2 gap-2">
                              {[
                                { value: 'all', label: 'All Dates' },
                                { value: 'overdue', label: 'Overdue' },
                                { value: 'this-week', label: 'This Week' },
                                { value: 'this-month', label: 'Next 30 Days' },
                                { value: 'this-quarter', label: 'Next 90 Days' },
                                { value: 'next-6-months', label: 'Next 6 Months' },
                              ].map(option => (
                                <button
                                  key={option.value}
                                  onClick={() => setDateFilter(option.value)}
                                  className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                                    dateFilter === option.value
                                      ? 'bg-[#0189CB]/20 border border-[#0189CB]/40 text-[#0189CB]'
                                      : 'bg-white/5 border border-white/10 text-white hover:bg-white/10'
                                  }`}
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Contract Type Section */}
                          <div>
                            <h3 className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-3 flex items-center gap-2">
                              <span className="w-5 h-5 rounded bg-purple-500/20 flex items-center justify-center text-purple-400">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                              </span>
                              Contract Type
                            </h3>
                            <div className="flex gap-2">
                              {[
                                { value: 'all', label: 'All' },
                                { value: 'renewal', label: 'Renewals' },
                                { value: 'new', label: 'New Business' },
                              ].map(option => (
                                <button
                                  key={option.value}
                                  onClick={() => setContractTypeFilter(option.value as 'all' | 'renewal' | 'new')}
                                  className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                                    contractTypeFilter === option.value
                                      ? 'bg-purple-500/20 border border-purple-500/40 text-purple-300'
                                      : 'bg-white/5 border border-white/10 text-white hover:bg-white/10'
                                  }`}
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Budget Section */}
                          <div>
                            <h3 className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-3 flex items-center gap-2">
                              <span className="w-5 h-5 rounded bg-green-500/20 flex items-center justify-center text-green-400">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              </span>
                              Budget & Probability
                            </h3>
                            <div className="space-y-4">
                              {/* Budgeted Toggle */}
                              <label className="flex items-center gap-3 cursor-pointer group">
                                <div className={`relative w-11 h-6 rounded-full transition-colors ${budgetedFilter ? 'bg-green-500' : 'bg-white/10'}`}>
                                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${budgetedFilter ? 'translate-x-6' : 'translate-x-1'}`} />
                                </div>
                                <span className="text-sm text-white group-hover:text-[#0189CB] transition-colors">Budgeted / Forecasted Only</span>
                                <input
                                  type="checkbox"
                                  checked={budgetedFilter}
                                  onChange={e => setBudgetedFilter(e.target.checked)}
                                  className="sr-only"
                                />
                              </label>

                              {/* Minimum Probability */}
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm text-gray-400">Minimum Probability</span>
                                  <span className="text-sm font-medium text-white">{probabilityMin}%+</span>
                                </div>
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  step="5"
                                  value={probabilityMin}
                                  onChange={e => setProbabilityMin(Number(e.target.value))}
                                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-[#0189CB] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
                                />
                                <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                                  <span>0%</span>
                                  <span>50%</span>
                                  <span>100%</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Contract Year Section */}
                          <div>
                            <h3 className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-3 flex items-center gap-2">
                              <span className="w-5 h-5 rounded bg-pink-500/20 flex items-center justify-center text-pink-400">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                              </span>
                              Contract Year
                            </h3>
                            <div className="grid grid-cols-5 gap-2">
                              {availableContractYears.map(year => (
                                <button
                                  key={year}
                                  onClick={() => {
                                    if (contractYearFilter.includes(year)) {
                                      setContractYearFilter(contractYearFilter.filter(y => y !== year));
                                    } else {
                                      setContractYearFilter([...contractYearFilter, year].sort((a, b) => a - b));
                                    }
                                  }}
                                  className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                                    contractYearFilter.includes(year)
                                      ? 'bg-pink-500/20 border border-pink-500/40 text-pink-300'
                                      : 'bg-white/5 border border-white/10 text-white hover:bg-white/10'
                                  }`}
                                >
                                  Y{year}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Multi-Year Section */}
                          <div>
                            <h3 className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-3 flex items-center gap-2">
                              <span className="w-5 h-5 rounded bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                              </span>
                              Multi-Year Contracts
                            </h3>
                            <label className="flex items-center gap-3 cursor-pointer group">
                              <div className={`relative w-11 h-6 rounded-full transition-colors ${hideMidContract ? 'bg-cyan-500' : 'bg-white/10'}`}>
                                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${hideMidContract ? 'translate-x-6' : 'translate-x-1'}`} />
                              </div>
                              <span className="text-sm text-white group-hover:text-[#0189CB] transition-colors">Actionable Only (Year 1 & Final)</span>
                              <input
                                type="checkbox"
                                checked={hideMidContract}
                                onChange={e => setHideMidContract(e.target.checked)}
                                className="sr-only"
                              />
                            </label>
                          </div>
                        </div>

                        {/* Panel Footer */}
                        <div className="sticky bottom-0 bg-[#0F1722] px-6 py-4 border-t border-white/10 flex gap-3">
                          <button
                            onClick={() => {
                              setActiveFilter('all');
                              setStatusFilter([]);
                              setDateFilter('all');
                              setContractTypeFilter('all');
                              setContractYearFilter([]);
                              setBudgetedFilter(false);
                              setProbabilityMin(0);
                              setHideMidContract(true);
                              setSearchQuery('');
                            }}
                            className="flex-1 px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-medium hover:bg-white/10 transition-colors"
                          >
                            Reset All
                          </button>
                          <button
                            onClick={() => setFilterPanelOpen(false)}
                            className="flex-1 px-4 py-3 rounded-lg bg-[#0189CB] text-white text-sm font-medium hover:bg-[#0189CB]/90 transition-colors"
                          >
                            Apply Filters
                          </button>
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>

                {/* Table Column Headers */}
                <div className="grid gap-4 px-6 py-3 text-[12px] font-semibold text-[#64748B] uppercase tracking-[0.05em] border-b border-white/[0.06] bg-[#0F1722]" style={{ gridTemplateColumns: '2fr 0.8fr 1.1fr 0.5fr 0.9fr 0.8fr' }}>
                  <button
                    className="text-left hover:text-white flex items-center gap-1"
                    onClick={() => { setSortField('name'); setSortDirection(d => d === 'asc' ? 'desc' : 'asc'); }}
                  >
                    Contract
                    {sortField === 'name' && (sortDirection === 'asc' ? ' ↑' : ' ↓')}
                  </button>
                  <button
                    className="text-right hover:text-white"
                    onClick={() => { setSortField('value'); setSortDirection(d => d === 'asc' ? 'desc' : 'asc'); }}
                  >
                    Value
                    {sortField === 'value' && (sortDirection === 'asc' ? ' ↑' : ' ↓')}
                  </button>
                  <div>Status</div>
                  <div className="text-center">SF Stage</div>
                  <button
                    className="text-center hover:text-white"
                    onClick={() => { setSortField('contractDate'); setSortDirection(d => d === 'asc' ? 'desc' : 'asc'); }}
                  >
                    Contract Date
                    {sortField === 'contractDate' && (sortDirection === 'asc' ? ' ↑' : ' ↓')}
                  </button>
                  <button
                    className="text-center hover:text-white"
                    onClick={() => { setSortField('daysInStage'); setSortDirection(d => d === 'asc' ? 'desc' : 'asc'); }}
                  >
                    Days Left
                    {sortField === 'daysInStage' && (sortDirection === 'asc' ? ' ↑' : ' ↓')}
                  </button>
                </div>

                {/* Table Body */}
                <div className="max-h-[600px] overflow-y-auto">
                  {filteredContracts.length > 0 ? (
                    filteredContracts.map((contract, index) => (
                      <ContractRow
                        key={contract.id}
                        contract={contract}
                        index={index}
                        onUpdate={handleDataRefresh}
                        focusMode={focusMode}
                        pendingStatus={pendingChanges[contract.id]?.newStatus}
                        onPendingStatusChange={handlePendingStatusChange}
                        openBundleModal={openBundleModal}
                        onClick={() => setSelectedContract(contract)}
                      />
                    ))
                  ) : (
                    <div className="px-6 py-12 text-center text-gray-500">
                      No contracts match the current filter
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          </div>
          </>
          )}

          {/* Tasks Tab */}
          {activeTab === 'tasks' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <TasksTabSupabase contracts={data.contracts.map(c => ({
                id: c.id,
                salesforceId: c.salesforceId,
                name: c.name,
                status: c.status,
                contractType: c.contractType,
              }))} />
            </motion.div>
          )}

          {/* Documents Tab - Smart Document Management */}
          {activeTab === 'documents' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <SmartDocumentsTab contracts={data.contracts} openBundleModal={openBundleModal} />
            </motion.div>
          )}

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="mt-8 text-center text-gray-600 text-sm"
          >
            <span className="text-[#0189CB]">MARS</span> Company Confidential • Executive Dashboards v2.0
          </motion.div>
        </div>
      </motion.div>

      {/* Floating Save All Button - appears when there are pending changes */}
      <AnimatePresence>
        {Object.keys(pendingChanges).length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-8 right-8 z-50 flex items-center gap-3"
          >
            {/* Change count badge */}
            <div className="bg-[#1E293B] border border-yellow-500/30 rounded-lg px-4 py-2 shadow-lg">
              <span className="text-yellow-400 font-medium">
                {Object.keys(pendingChanges).length} unsaved {Object.keys(pendingChanges).length === 1 ? 'change' : 'changes'}
              </span>
            </div>

            {/* Discard button */}
            <button
              onClick={handleClearPendingChanges}
              disabled={isSavingBatch}
              className="px-4 py-3 bg-[#1E293B] border border-white/10 text-[#8FA3BF] rounded-lg hover:bg-[#2D3B4F] hover:text-white transition-colors disabled:opacity-50 shadow-lg"
            >
              Discard
            </button>

            {/* Save All button */}
            <button
              onClick={handleSavePendingChanges}
              disabled={isSavingBatch}
              className="px-6 py-3 bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 shadow-lg flex items-center gap-2"
            >
              {isSavingBatch ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {batchSaveProgress ? `Saving ${batchSaveProgress.current}/${batchSaveProgress.total}...` : 'Saving...'}
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Save All Changes
                </>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Push to Salesforce Button - appears when there are pending SF syncs */}
      <AnimatePresence>
        {sfSyncPending.length > 0 && Object.keys(pendingChanges).length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-8 right-8 z-50 flex items-center gap-3"
          >
            {/* Pending sync count badge */}
            <div className="bg-[#1E293B] border border-blue-500/30 rounded-lg px-4 py-2 shadow-lg">
              <span className="text-blue-400 font-medium">
                {sfSyncPending.length} pending Salesforce {sfSyncPending.length === 1 ? 'sync' : 'syncs'}
              </span>
            </div>

            {/* Push to Salesforce button */}
            <button
              onClick={handlePushToSalesforce}
              disabled={isPushingToSalesforce}
              className="px-6 py-3 bg-gradient-to-r from-[#0189CB] to-[#0066A1] text-white font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 shadow-lg flex items-center gap-2"
            >
              {isPushingToSalesforce ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {sfPushProgress ? `Pushing ${sfPushProgress.current}/${sfPushProgress.total}...` : 'Pushing...'}
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Push to Salesforce
                </>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bundle Modal */}
      {selectedContractForBundle && (
        <BundleModal
          isOpen={bundleModalOpen}
          onClose={() => {
            setBundleModalOpen(false);
            setSelectedContractForBundle(null);
          }}
          onSuccess={() => {
            fetchData(); // Refresh to show bundle info
          }}
          currentContract={{
            id: selectedContractForBundle.id,
            name: selectedContractForBundle.name,
            opportunityName: selectedContractForBundle.opportunityName,
            value: selectedContractForBundle.value,
            contractType: selectedContractForBundle.contractType,
          }}
          allContracts={data?.contracts.map(c => ({
            id: c.id,
            name: c.name,
            opportunityName: c.opportunityName,
            value: c.value,
            contractType: c.contractType,
          })) || []}
          mode={bundleModalMode}
          existingBundleId={selectedContractForBundle.bundleInfo?.bundleId}
        />
      )}

      {/* Contract Detail Drawer */}
      <ContractDetailDrawer
        contract={selectedContract}
        onClose={() => setSelectedContract(null)}
        onUpdate={fetchData}
        openBundleModal={openBundleModal}
      />
    </div>
  );
}

// Tasks Tab Component - Enhanced with Summary KPIs, View Toggle, and Contract Rollup
function TasksTab({ contracts }: { contracts: Contract[] }) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'board' | 'byContract'>('byContract');
  const [filter, setFilter] = useState<'all' | 'overdue' | 'pending' | 'completed' | 'dueToday'>('all');
  const [showAddTask, setShowAddTask] = useState(false);
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [newTask, setNewTask] = useState({ title: '', contractId: '', dueDate: '', priority: 'medium' });
  const [expandedContracts, setExpandedContracts] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchTasks();
  }, []);

  // Auto-expand contracts with overdue tasks on load
  useEffect(() => {
    if (tasks.length > 0 && expandedContracts.size === 0) {
      const contractsWithOverdue = new Set<string>();
      tasks.forEach(task => {
        if (task.dueDate && new Date(task.dueDate) < new Date() && !task.completed) {
          contractsWithOverdue.add(task.contractName || 'Unassigned');
        }
      });
      // Expand first 5 contracts by default
      const defaultExpanded = new Set([...contractsWithOverdue, ...Array.from(new Set(tasks.map(t => t.contractName || 'Unassigned'))).slice(0, 5)]);
      setExpandedContracts(defaultExpanded);
    }
  }, [tasks]);

  async function fetchTasks() {
    try {
      const response = await fetch('/api/contracts/tasks');
      if (response.ok) {
        const data = await response.json();
        setTasks(data.tasks || []);
      }
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddTask() {
    if (!newTask.title.trim()) return;
    const selectedContract = contracts.find(c => c.id === newTask.contractId);

    try {
      const response = await fetch('/api/contracts/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newTask,
          contractName: selectedContract?.name || newTask.contractId,
        }),
      });

      if (response.ok) {
        fetchTasks();
        setNewTask({ title: '', contractId: '', dueDate: '', priority: 'medium' });
        setShowAddTask(false);
      }
    } catch (err) {
      console.error('Failed to add task:', err);
    }
  }

  async function handleUpdateTask() {
    if (!editingTask) return;

    try {
      const response = await fetch('/api/contracts/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: editingTask.id,
          updates: {
            title: editingTask.title,
            status: editingTask.completed ? 'Done' : 'To Do',
            dueDate: editingTask.dueDate,
          },
        }),
      });

      if (response.ok) {
        fetchTasks();
        setEditingTask(null);
      }
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  }

  async function toggleTaskComplete(taskId: string, completed: boolean) {
    try {
      await fetch('/api/contracts/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          updates: { status: completed ? 'Done' : 'To Do' },
        }),
      });
      fetchTasks();
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  }

  async function handleDeleteTask(taskId: string) {
    if (!confirm('Delete this task?')) return;
    try {
      const response = await fetch(`/api/contracts/tasks?taskId=${taskId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setTasks(prev => prev.filter(t => t.id !== taskId));
      }
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  }

  // Task KPIs
  const taskKpis = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const totalActive = tasks.filter(t => !t.completed).length;
    const overdue = tasks.filter(t => !t.completed && t.dueDate && new Date(t.dueDate) < today).length;
    const dueSoon = tasks.filter(t => {
      if (t.completed || !t.dueDate) return false;
      const due = new Date(t.dueDate);
      return due >= today && due <= tomorrow;
    }).length;
    const completedRecent = tasks.filter(t => t.completed).length;
    const total = tasks.length;
    const progressPercent = total > 0 ? Math.round((completedRecent / total) * 100) : 0;

    return { totalActive, overdue, dueSoon, completedRecent, progressPercent, total };
  }, [tasks]);

  // Group tasks by contract
  const tasksByContract = useMemo(() => {
    const grouped = new Map<string, any[]>();

    tasks.forEach(task => {
      const key = task.contractName || 'Unassigned';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(task);
    });

    return Array.from(grouped.entries())
      .map(([contractName, contractTasks]) => ({
        contractName,
        tasks: contractTasks,
        overdueCount: contractTasks.filter(t => !t.completed && t.dueDate && new Date(t.dueDate) < new Date()).length,
        activeCount: contractTasks.filter(t => !t.completed).length,
        totalCount: contractTasks.length,
      }))
      .sort((a, b) => b.overdueCount - a.overdueCount || b.activeCount - a.activeCount);
  }, [tasks]);

  // Group tasks by status for board view
  const tasksByStatus = useMemo(() => {
    return {
      todo: tasks.filter(t => !t.completed && t.status !== 'In Progress'),
      inProgress: tasks.filter(t => !t.completed && t.status === 'In Progress'),
      done: tasks.filter(t => t.completed),
    };
  }, [tasks]);

  const filteredTasks = tasks.filter(task => {
    if (filter === 'all') return true;
    if (filter === 'overdue') return task.dueDate && new Date(task.dueDate) < new Date() && !task.completed;
    if (filter === 'pending') return !task.completed;
    if (filter === 'completed') return task.completed;
    if (filter === 'dueToday') {
      if (task.completed || !task.dueDate) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const due = new Date(task.dueDate);
      return due >= today && due < tomorrow;
    }
    return true;
  });

  const toggleContractExpanded = (contractName: string) => {
    const newExpanded = new Set(expandedContracts);
    if (newExpanded.has(contractName)) {
      newExpanded.delete(contractName);
    } else {
      newExpanded.add(contractName);
    }
    setExpandedContracts(newExpanded);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#38BDF8] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Task Row Component - with polish animations
  const TaskRow = ({ task, showContract = false, index = 0 }: { task: any; showContract?: boolean; index?: number }) => {
    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !task.completed;
    // Look up contract to get type
    const linkedContract = task.contractName
      ? contracts.find(c => c.name === task.contractName)
      : null;
    const contractType = linkedContract?.contractType?.join(', ') || '';

    return (
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 10, height: 0 }}
        transition={{ delay: index * 0.03, duration: 0.2 }}
        whileHover={{ scale: 1.005, transition: { duration: 0.1 } }}
        className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-all cursor-pointer ${
          task.completed ? 'bg-[#0B1220]/30 border-white/[0.02] opacity-50' :
          isOverdue ? 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10' :
          'bg-[#0B1220] border-white/[0.04] hover:border-[#38BDF8]/30 hover:bg-[#0B1220]/80'
        }`}
      >
        <motion.button
          onClick={() => toggleTaskComplete(task.id, !task.completed)}
          whileTap={{ scale: 0.9 }}
          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 ${
            task.completed ? 'bg-[#22C55E] border-[#22C55E]' : 'border-[#475569] hover:border-[#38BDF8] hover:shadow-[0_0_8px_rgba(56,189,248,0.3)]'
          }`}
        >
          {task.completed && (
            <motion.svg
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 20 }}
              className="w-3 h-3 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </motion.svg>
          )}
        </motion.button>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium transition-all ${task.completed ? 'text-[#64748B] line-through' : 'text-white'}`}>{task.title}</p>
          {showContract && task.contractName && (
            <div className="flex items-center gap-2 text-xs mt-0.5">
              <span className="text-[#38BDF8] truncate">{task.contractName}</span>
              {contractType && (
                <>
                  <span className="text-[#475569]">•</span>
                  <span className="text-[#64748B]">{contractType}</span>
                </>
              )}
            </div>
          )}
        </div>
        {task.dueDate && (
          <div className={`text-xs flex-shrink-0 flex items-center gap-1 ${isOverdue ? 'text-red-400 font-medium' : 'text-[#64748B]'}`}>
            {isOverdue && (
              <motion.span
                initial={{ scale: 1 }}
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="text-red-400"
              >
                ⚠
              </motion.span>
            )}
            {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
        )}
        <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded flex-shrink-0 font-medium transition-colors ${
          task.priority === 'high' ? 'bg-red-500/15 text-red-400' :
          task.priority === 'medium' ? 'bg-amber-500/15 text-amber-400' :
          'bg-[#475569]/20 text-[#64748B]'
        }`}>{task.priority}</span>
        <motion.button
          onClick={() => setEditingTask(task)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="p-1.5 rounded-lg hover:bg-white/10 text-[#64748B] hover:text-white transition-colors flex-shrink-0"
          title="Edit task"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
        </motion.button>
        <motion.button
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteTask(task.id);
          }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs font-medium flex-shrink-0"
          title="Delete task"
        >
          ✕
        </motion.button>
      </motion.div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Task Summary KPIs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#111827] rounded-xl border border-white/[0.04] p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[#64748B] uppercase tracking-wider">Task Overview</h2>
          <div className="text-xs text-[#64748B]">{taskKpis.total} total tasks</div>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Active', value: taskKpis.totalActive, color: 'white', bgColor: 'bg-[#0B1220]', borderColor: 'border-white/[0.04]', filterKey: 'pending' as const },
            { label: 'Overdue', value: taskKpis.overdue, color: taskKpis.overdue > 0 ? 'text-red-400' : 'text-white', bgColor: taskKpis.overdue > 0 ? 'bg-red-500/10' : 'bg-[#0B1220]', borderColor: taskKpis.overdue > 0 ? 'border-red-500/20' : 'border-white/[0.04]', labelColor: taskKpis.overdue > 0 ? 'text-red-400/70' : 'text-[#64748B]', filterKey: 'overdue' as const },
            { label: 'Due Today', value: taskKpis.dueSoon, color: taskKpis.dueSoon > 0 ? 'text-amber-400' : 'text-white', bgColor: taskKpis.dueSoon > 0 ? 'bg-amber-500/10' : 'bg-[#0B1220]', borderColor: taskKpis.dueSoon > 0 ? 'border-amber-500/20' : 'border-white/[0.04]', labelColor: taskKpis.dueSoon > 0 ? 'text-amber-400/70' : 'text-[#64748B]', filterKey: 'dueToday' as const },
            { label: 'Completed', value: taskKpis.completedRecent, color: 'text-[#22C55E]', bgColor: 'bg-[#0B1220]', borderColor: 'border-white/[0.04]', filterKey: 'completed' as const },
          ].map((kpi, i) => (
            <motion.button
              key={kpi.label}
              onClick={() => {
                const newFilter = filter === kpi.filterKey ? 'all' : kpi.filterKey;
                setFilter(newFilter);
                if (newFilter !== 'all') setViewMode('list'); // Switch to list view to show filtered results
              }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08, duration: 0.3 }}
              whileHover={{ scale: 1.02, transition: { duration: 0.15 } }}
              whileTap={{ scale: 0.98 }}
              className={`${kpi.bgColor} rounded-lg p-4 border ${kpi.borderColor} cursor-pointer transition-all hover:shadow-lg hover:shadow-black/20 text-left ${
                filter === kpi.filterKey ? 'ring-2 ring-[#38BDF8] ring-offset-2 ring-offset-[#111827]' : ''
              }`}
            >
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 + i * 0.08 }}
                className={`text-3xl font-bold mb-1 ${kpi.color}`}
              >
                {kpi.value}
              </motion.div>
              <div className={`text-xs uppercase tracking-wider ${kpi.labelColor || 'text-[#64748B]'}`}>{kpi.label}</div>
            </motion.button>
          ))}
        </div>
        {/* Progress Bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-[#64748B]">Completion Progress</span>
            <span className="text-white font-medium">{taskKpis.progressPercent}%</span>
          </div>
          <div className="h-2 bg-[#0B1220] rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${taskKpis.progressPercent}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-[#22C55E] to-[#38BDF8] rounded-full"
            />
          </div>
        </div>
      </motion.div>

      {/* View Toggle & Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-[#0B1220] rounded-lg p-1 border border-white/[0.04]">
          {[
            { key: 'byContract', label: 'By Contract', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
            { key: 'list', label: 'List', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
            { key: 'board', label: 'Board', icon: 'M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2' },
          ].map(view => (
            <button
              key={view.key}
              onClick={() => setViewMode(view.key as any)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                viewMode === view.key
                  ? 'bg-[#38BDF8]/20 text-[#38BDF8]'
                  : 'text-[#64748B] hover:text-white hover:bg-white/5'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={view.icon} />
              </svg>
              {view.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {viewMode === 'list' && (
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="bg-[#0B1220] border border-white/[0.04] rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="all">All Tasks</option>
              <option value="pending">Active</option>
              <option value="overdue">Overdue</option>
              <option value="dueToday">Due Today</option>
              <option value="completed">Completed</option>
            </select>
          )}
          <button
            onClick={() => setShowAddTask(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#38BDF8] text-[#0B1220] font-medium text-sm rounded-lg hover:bg-[#38BDF8]/90 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Task
          </button>
        </div>
      </div>

      {/* Add Task Form */}
      <AnimatePresence>
        {showAddTask && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-[#111827] rounded-xl border border-white/[0.04] p-6"
          >
            <h3 className="text-sm font-semibold text-white mb-4">New Task</h3>
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Task title..."
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                className="col-span-2 bg-[#0B1220] border border-white/[0.08] rounded-lg px-4 py-3 text-white text-sm placeholder-[#475569]"
                autoFocus
              />
              <select
                value={newTask.contractId}
                onChange={(e) => setNewTask({ ...newTask, contractId: e.target.value })}
                className="bg-[#0B1220] border border-white/[0.08] rounded-lg px-4 py-3 text-white text-sm"
              >
                <option value="">Link to contract...</option>
                {contracts.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <div
                className="bg-[#0B1220] border border-white/[0.08] rounded-lg px-4 py-3 text-sm cursor-pointer relative"
                onClick={(e) => {
                  e.stopPropagation();
                  const input = e.currentTarget.querySelector('input');
                  input?.showPicker?.();
                }}
              >
                <input
                  type="date"
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  style={{ colorScheme: 'dark' }}
                />
                <span className={newTask.dueDate ? 'text-white' : 'text-[#475569]'}>
                  {newTask.dueDate ? new Date(newTask.dueDate + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Due date...'}
                </span>
              </div>
              <select
                value={newTask.priority}
                onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                className="bg-[#0B1220] border border-white/[0.08] rounded-lg px-4 py-3 text-white text-sm"
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
              </select>
              <div className="flex items-center justify-end gap-3">
                <button onClick={() => setShowAddTask(false)} className="px-4 py-2 text-[#64748B] hover:text-white text-sm font-medium transition-colors">Cancel</button>
                <button onClick={handleAddTask} className="px-6 py-2 bg-[#22C55E] text-white font-medium text-sm rounded-lg hover:bg-[#22C55E]/90 transition-colors">Create Task</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Task Modal */}
      <AnimatePresence>
        {editingTask && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setEditingTask(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-[#111827] rounded-xl border border-white/[0.08] p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-white mb-4">Edit Task</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-[#64748B] text-xs uppercase tracking-wider mb-2">Title</label>
                  <input type="text" value={editingTask.title} onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })} className="w-full bg-[#0B1220] border border-white/[0.08] rounded-lg px-4 py-3 text-white text-sm" />
                </div>
                <div>
                  <label className="block text-[#64748B] text-xs uppercase tracking-wider mb-2">Contract</label>
                  <div className="bg-[#0B1220] border border-white/[0.08] rounded-lg px-4 py-3 text-[#38BDF8] text-sm">{editingTask.contractName || 'No contract linked'}</div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[#64748B] text-xs uppercase tracking-wider mb-2">Due Date</label>
                    <input type="date" value={editingTask.dueDate || ''} onChange={(e) => setEditingTask({ ...editingTask, dueDate: e.target.value })} onClick={e => { e.stopPropagation(); (e.target as HTMLInputElement).showPicker?.(); }} onMouseDown={e => e.stopPropagation()} onFocus={e => (e.target as HTMLInputElement).showPicker?.()} className="w-full bg-[#0B1220] border border-white/[0.08] rounded-lg px-4 py-3 text-white text-sm cursor-pointer pointer-events-auto relative z-10" style={{ colorScheme: 'dark' }} />
                  </div>
                  <div>
                    <label className="block text-[#64748B] text-xs uppercase tracking-wider mb-2">Status</label>
                    <select value={editingTask.completed ? 'done' : 'pending'} onChange={(e) => setEditingTask({ ...editingTask, completed: e.target.value === 'done' })} className="w-full bg-[#0B1220] border border-white/[0.08] rounded-lg px-4 py-3 text-white text-sm">
                      <option value="pending">Pending</option>
                      <option value="done">Done</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setEditingTask(null)} className="px-4 py-2 text-[#64748B] hover:text-white text-sm font-medium transition-colors">Cancel</button>
                <button onClick={handleUpdateTask} className="px-6 py-2 bg-[#38BDF8] text-[#0B1220] font-medium text-sm rounded-lg hover:bg-[#38BDF8]/90 transition-colors">Save Changes</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Task Views */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-[#111827] rounded-xl border border-white/[0.04] overflow-hidden"
      >
        {/* By Contract View (Rollup) */}
        {viewMode === 'byContract' && (
          <div className="divide-y divide-white/[0.04]">
            {tasksByContract.length > 0 ? (
              tasksByContract.map(({ contractName, tasks: contractTasks, overdueCount, activeCount, totalCount }) => {
                const linkedContract = contracts.find(c => c.name === contractName);
                const contractType = linkedContract?.contractType?.join(', ') || '';
                return (
                <div key={contractName}>
                  <button
                    onClick={() => toggleContractExpanded(contractName)}
                    className="w-full flex items-center gap-3 px-6 py-4 hover:bg-white/[0.02] transition-colors"
                  >
                    <svg className={`w-4 h-4 text-[#64748B] transition-transform ${expandedContracts.has(contractName) ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <div className="flex-1 text-left">
                      <span className="font-medium text-white">{contractName}</span>
                      {contractType && (
                        <span className="text-[#64748B] text-sm ml-2">• {contractType}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {overdueCount > 0 && (
                        <span className="flex items-center gap-1 text-xs text-red-400 bg-red-500/10 px-2 py-1 rounded">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                          {overdueCount}
                        </span>
                      )}
                      <span className="text-xs text-[#64748B] bg-white/[0.04] px-2 py-1 rounded">
                        {activeCount} active / {totalCount} total
                      </span>
                    </div>
                  </button>
                  <AnimatePresence>
                    {expandedContracts.has(contractName) && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-6 pb-4 space-y-2 pl-12">
                          {contractTasks.map((task, idx) => (
                            <TaskRow key={task.id} task={task} index={idx} />
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );})
            ) : (
              <div className="text-center py-16 text-[#475569]">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                <p className="text-sm">No tasks yet</p>
                <p className="text-xs mt-1">Click "Add Task" to create your first task</p>
              </div>
            )}
          </div>
        )}

        {/* List View */}
        {viewMode === 'list' && (
          <div className="p-6 space-y-2">
            {filteredTasks.length > 0 ? (
              filteredTasks.map((task, idx) => (
                <TaskRow key={task.id} task={task} showContract index={idx} />
              ))
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12 text-[#475569]"
              >
                <p className="text-sm">No tasks found</p>
              </motion.div>
            )}
          </div>
        )}

        {/* Board View (Kanban) */}
        {viewMode === 'board' && (
          <div className="grid grid-cols-3 divide-x divide-white/[0.04]">
            {[
              { key: 'todo', title: 'To Do', tasks: tasksByStatus.todo, color: '#64748B', icon: '○' },
              { key: 'inProgress', title: 'In Progress', tasks: tasksByStatus.inProgress, color: '#38BDF8', icon: '◐' },
              { key: 'done', title: 'Done', tasks: tasksByStatus.done, color: '#22C55E', icon: '●' },
            ].map((column, colIdx) => (
              <motion.div
                key={column.key}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: colIdx * 0.1 }}
                className="min-h-[400px]"
              >
                <div className="px-4 py-3 border-b border-white/[0.04] flex items-center gap-2 sticky top-0 bg-[#111827] z-10">
                  <motion.div
                    animate={{ rotate: column.key === 'inProgress' ? 360 : 0 }}
                    transition={{ duration: 2, repeat: column.key === 'inProgress' ? Infinity : 0, ease: 'linear' }}
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: column.color }}
                  />
                  <span className="text-sm font-medium text-white">{column.title}</span>
                  <motion.span
                    key={column.tasks.length}
                    initial={{ scale: 1.3 }}
                    animate={{ scale: 1 }}
                    className="text-xs text-[#64748B] bg-white/[0.04] px-1.5 py-0.5 rounded"
                  >
                    {column.tasks.length}
                  </motion.span>
                </div>
                <div className="p-3 space-y-2">
                  <AnimatePresence>
                    {column.tasks.map((task, idx) => {
                      const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !task.completed;
                      const linkedContract = task.contractName
                        ? contracts.find(c => c.name === task.contractName)
                        : null;
                      const contractType = linkedContract?.contractType?.join(', ') || '';
                      return (
                        <motion.div
                          key={task.id}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ delay: idx * 0.03, duration: 0.2 }}
                          whileHover={{
                            scale: 1.02,
                            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                            transition: { duration: 0.15 }
                          }}
                          className={`p-3 rounded-lg border bg-[#0B1220] cursor-pointer transition-colors ${
                            isOverdue ? 'border-red-500/30 hover:border-red-500/50' : 'border-white/[0.04] hover:border-[#38BDF8]/30'
                          }`}
                          onClick={() => setEditingTask(task)}
                        >
                          <p className="text-sm text-white font-medium mb-2">{task.title}</p>
                          {task.contractName && (
                            <div className="text-xs mb-2 truncate flex items-center gap-1.5">
                              <span className="w-1 h-1 rounded-full bg-[#38BDF8]" />
                              <span className="text-[#38BDF8]">{task.contractName}</span>
                              {contractType && (
                                <>
                                  <span className="text-[#475569]">•</span>
                                  <span className="text-[#64748B]">{contractType}</span>
                                </>
                              )}
                            </div>
                          )}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {task.dueDate && (
                                <span className={`text-[10px] flex items-center gap-1 ${isOverdue ? 'text-red-400' : 'text-[#64748B]'}`}>
                                  {isOverdue && <span className="animate-pulse">⚠</span>}
                                  {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                              )}
                              <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-medium ${
                                task.priority === 'high' ? 'bg-red-500/15 text-red-400' :
                                task.priority === 'medium' ? 'bg-amber-500/15 text-amber-400' :
                                'bg-[#475569]/20 text-[#64748B]'
                              }`}>{task.priority}</span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTask(task.id);
                              }}
                              className="px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs font-medium"
                              title="Delete task"
                            >
                              ✕
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                  {column.tasks.length === 0 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center py-8 text-[#475569] text-xs"
                    >
                      No tasks
                    </motion.div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}

// Documents Tab Component
function DocumentsTab({ contracts }: { contracts: Contract[] }) {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadTarget, setUploadTarget] = useState<{ contractId: string; contractName: string; docType: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const documentTypes = [
    'Original Contract/RFP',
    'MARS Redlines',
    'Client Response',
    'Final Agreement',
    'Executed Contract',
    'Purchase Order',
  ];

  useEffect(() => {
    fetchDocuments();
  }, []);

  async function fetchDocuments() {
    try {
      const response = await fetch('/api/contracts/documents');
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);
      }
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleDocumentClick(contractId: string, contractName: string, docType: string, existingDoc: any) {
    if (existingDoc) {
      // If document exists, could open/download it
      if (existingDoc.fileUrl) {
        window.open(existingDoc.fileUrl, '_blank');
      }
      return;
    }
    // Set upload target and trigger file input
    setUploadTarget({ contractId, contractName, docType });
    fileInputRef.current?.click();
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !uploadTarget) return;

    const uploadKey = `${uploadTarget.contractId}-${uploadTarget.docType}`;
    setUploading(uploadKey);

    try {
      // For now, we'll create a document record without actual file storage
      // In production, you'd upload to S3/Supabase storage first
      const response = await fetch('/api/contracts/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractId: uploadTarget.contractId,
          contractName: uploadTarget.contractName,
          type: uploadTarget.docType,
          status: 'received',
          fileUrl: `#local:${file.name}`, // Placeholder - would be real URL
          notes: `Uploaded: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`,
        }),
      });

      if (response.ok) {
        await fetchDocuments();
      } else {
        console.error('Failed to save document record');
      }
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(null);
      setUploadTarget(null);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  // Group documents by contract
  const documentsByContract = contracts.reduce((acc, contract) => {
    acc[contract.id] = {
      contract,
      docs: documents.filter(d => d.contractId === contract.id),
    };
    return acc;
  }, {} as Record<string, { contract: Contract; docs: any[] }>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#38BDF8] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-[#111827] rounded-xl border border-white/[0.04] p-6">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".pdf,.doc,.docx,.txt"
        className="hidden"
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white">Contract Documents</h2>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-[#0B1220] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white"
        >
          <option value="all">All Document Types</option>
          {documentTypes.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>

      {/* Document Checklist by Contract */}
      <div className="space-y-4">
        {contracts.slice(0, 10).map((contract) => {
          const contractDocs = documentsByContract[contract.id]?.docs || [];

          return (
            <div
              key={contract.id}
              className="p-4 bg-[#0B1220] rounded-lg border border-white/[0.04]"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-white font-medium">{contract.name}</h3>
                  <p className="text-[#64748B] text-sm">
                    {contractDocs.length} of {documentTypes.length} documents
                  </p>
                </div>
                <div className="w-32 h-2 bg-[#151F2E] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#38BDF8] to-[#22C55E] transition-all"
                    style={{ width: `${(contractDocs.length / documentTypes.length) * 100}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {documentTypes.map((docType) => {
                  const doc = contractDocs.find(d => d.type === docType);
                  const hasDoc = !!doc;
                  const isUploading = uploading === `${contract.id}-${docType}`;

                  return (
                    <button
                      key={docType}
                      onClick={() => handleDocumentClick(contract.id, contract.name, docType, doc)}
                      disabled={isUploading}
                      className={`flex items-center gap-2 p-2 rounded text-sm text-left transition-all ${
                        hasDoc
                          ? 'bg-[#22C55E]/10 text-[#22C55E] hover:bg-[#22C55E]/20'
                          : 'bg-[#151F2E] text-[#64748B] hover:bg-[#1E293B] hover:text-white'
                      } ${isUploading ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                    >
                      {isUploading ? (
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0" />
                      ) : hasDoc ? (
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      )}
                      <span className="truncate">{docType}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
