'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ContractDetailDrawer, { ContractItem, ContractDocument } from './ContractDetailDrawer';
import FilterDrawer, { FilterState } from './FilterDrawer';
import { usePersistedFilters, FILTER_STORAGE_KEYS } from '@/hooks';

// Re-export FilterState for parent components
export type { FilterState };

// Default filter values
const DEFAULT_FILTERS: FilterState = {
  searchQuery: '',
  selectedStatuses: [],
  dateFilter: 'all',
  budgetedFilter: 'all',
  completenessFilter: 'all',
  sortBy: 'name',
};

// Contract status stages
const CONTRACT_STATUSES = [
  'Discussions Not Started',
  'Initial Agreement Development',
  'Review & Redlines',
  'Approval & Signature',
  'Agreement Submission',
  'PO Received',
] as const;

// Status colors matching the pipeline
const STATUS_COLORS: Record<string, string> = {
  'Discussions Not Started': '#64748B',
  'Initial Agreement Development': '#38BDF8',
  'Review & Redlines': '#F59E0B',
  'Approval & Signature': '#10B981',
  'Agreement Submission': '#A78BFA',
  'PO Received': '#22C55E',
};

interface ContractListViewProps {
  contracts: ContractItem[];
  onUpload?: (file: File, documentType: string, contractId: string) => void;
  onDownload?: (doc: ContractDocument) => void;
  onShare?: (doc: ContractDocument) => void;
  onView?: (doc: ContractDocument) => void;
  onDelete?: (doc: ContractDocument) => void;
  openBundleModal?: (contract: ContractItem, mode: 'create' | 'add') => void;
  filterPreset?: 'needsAttention' | 'closingSoon' | 'budgeted' | 'complete' | null;
}

// Format date for display
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${month}/${day}/${year}`;
}

// Calculate days until date
function getDaysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// Get urgency color based on days until due
function getUrgencyColor(daysUntil: number | null): string {
  if (daysUntil === null) return '#64748B';
  if (daysUntil < 0) return '#EF4444'; // Overdue - red
  if (daysUntil <= 7) return '#EF4444'; // Due within a week - red
  if (daysUntil <= 30) return '#F59E0B'; // Due within a month - amber
  if (daysUntil <= 60) return '#3B82F6'; // Due within 2 months - blue
  return '#22C55E'; // More than 2 months - green
}

// Contract Row Component
function ContractRow({
  contract,
  onClick,
  index,
}: {
  contract: ContractItem;
  onClick: () => void;
  index: number;
}) {
  const { completeness } = contract;
  const hasMissingRequired = completeness.uploaded < completeness.required;

  // Determine status color based on completeness
  const getStatusColor = () => {
    if (completeness.percentage >= 100) return { color: '#22C55E', label: 'Complete' };
    if (completeness.percentage >= 75) return { color: '#3B82F6', label: 'Almost Complete' };
    if (completeness.percentage >= 50) return { color: '#F59E0B', label: 'In Progress' };
    return { color: '#EF4444', label: 'Needs Attention' };
  };

  const status = getStatusColor();
  const contractStatusColor = contract.status ? STATUS_COLORS[contract.status] : '#64748B';

  // Contract date info
  const contractDate = contract.contract_date || contract.close_date;
  const daysUntil = getDaysUntil(contractDate);
  const urgencyColor = getUrgencyColor(daysUntil);

  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02, duration: 0.2 }}
      onClick={onClick}
      className={`w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-white/[0.03] transition-colors border-b border-white/[0.04] group ${
        hasMissingRequired ? 'bg-red-500/[0.02]' : ''
      }`}
    >
      {/* Progress Circle */}
      <div className="flex-shrink-0 relative">
        <svg className="w-12 h-12 transform -rotate-90">
          <circle
            cx="24"
            cy="24"
            r="20"
            stroke="currentColor"
            strokeWidth="3"
            fill="none"
            className="text-white/[0.06]"
          />
          <circle
            cx="24"
            cy="24"
            r="20"
            stroke={status.color}
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${completeness.percentage * 1.256} 125.6`}
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[11px] font-semibold text-white tabular-nums">
            {completeness.uploaded}/{completeness.required}
          </span>
        </div>
      </div>

      {/* Contract Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[15px] font-medium text-white truncate">
            {contract.contract_name}
          </span>
          {hasMissingRequired && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 font-medium uppercase flex-shrink-0">
              Missing Required
            </span>
          )}
          {contract.budgeted && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 font-medium uppercase flex-shrink-0">
              Budgeted
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[13px] text-[#8FA3BF]">
          <span className="truncate">{contract.opportunity_name || contract.contract_name}</span>
          {contract.status && (
            <>
              <span className="text-[#475569]">•</span>
              <span
                className="text-[11px] font-medium"
                style={{ color: contractStatusColor }}
              >
                {contract.status}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Status & Documents Count */}
      <div className="flex-shrink-0 flex items-center gap-4">
        {/* Contract Date */}
        {contractDate && (
          <div className="text-right min-w-[100px]">
            <div className="text-[12px] text-white font-medium">
              {formatDate(contractDate)}
            </div>
            <div
              className="text-[11px] font-medium"
              style={{ color: urgencyColor }}
            >
              {daysUntil === null ? '' :
               daysUntil < 0 ? `${Math.abs(daysUntil)} days overdue` :
               daysUntil === 0 ? 'Due today' :
               daysUntil === 1 ? 'Due tomorrow' :
               `${daysUntil} days left`}
            </div>
          </div>
        )}

        {/* Status Badge */}
        <span
          className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-white/[0.04] border border-white/[0.06]"
          style={{ color: status.color }}
        >
          {status.label}
        </span>

        {/* Documents Count */}
        <div className="text-right min-w-[80px]">
          <div className="text-[12px] text-[#8FA3BF]">
            {contract.documents.filter(d => d.status === 'uploaded').length} documents
          </div>
          <div className="text-[11px] text-[#64748B]">
            {completeness.total - completeness.uploaded} missing
          </div>
        </div>

        {/* Arrow */}
        <svg className="w-5 h-5 text-[#475569] group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </motion.button>
  );
}

export default function ContractListView({
  contracts,
  onUpload,
  onDownload,
  onShare,
  onView,
  onDelete,
  openBundleModal,
  filterPreset,
}: ContractListViewProps) {
  const [selectedContract, setSelectedContract] = useState<ContractItem | null>(null);
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

  // Persisted filter state - automatically saves to localStorage
  const [filters, setFilters, clearPersistedFilters] = usePersistedFilters<FilterState>(
    FILTER_STORAGE_KEYS.DOCUMENTS,
    DEFAULT_FILTERS
  );

  // Apply filter preset when it changes
  useEffect(() => {
    if (!filterPreset) return;

    switch (filterPreset) {
      case 'needsAttention':
        setFilters({
          ...DEFAULT_FILTERS,
          completenessFilter: 'needs_attention',
        });
        break;
      case 'closingSoon':
        setFilters({
          ...DEFAULT_FILTERS,
          dateFilter: '90',
        });
        break;
      case 'budgeted':
        setFilters({
          ...DEFAULT_FILTERS,
          budgetedFilter: 'budgeted',
        });
        break;
      case 'complete':
        setFilters({
          ...DEFAULT_FILTERS,
          completenessFilter: 'complete',
        });
        break;
    }
  }, [filterPreset, setFilters]);

  // Update selectedContract when contracts change (e.g., after document deletion)
  useEffect(() => {
    if (selectedContract) {
      const updatedContract = contracts.find(c => c.id === selectedContract.id);
      if (updatedContract) {
        // Always update to get the latest documents data
        setSelectedContract(updatedContract);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contracts]);

  // Count contracts per status
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    CONTRACT_STATUSES.forEach(status => {
      counts[status] = contracts.filter(c => c.status === status).length;
    });
    return counts;
  }, [contracts]);

  // Check if any filters are active
  const hasActiveFilters =
    filters.selectedStatuses.length > 0 ||
    filters.dateFilter !== 'all' ||
    filters.budgetedFilter !== 'all' ||
    filters.completenessFilter !== 'all' ||
    filters.searchQuery !== '';

  const activeFilterCount = [
    filters.selectedStatuses.length > 0,
    filters.dateFilter !== 'all',
    filters.budgetedFilter !== 'all',
    filters.completenessFilter !== 'all',
    filters.searchQuery !== '',
  ].filter(Boolean).length;

  // Clear all filters (uses the persisted hook's clear function)
  const clearFilters = clearPersistedFilters;

  // Filter and sort contracts
  const filteredContracts = useMemo(() => {
    let result = [...contracts];

    // Apply search filter
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      result = result.filter(c =>
        c.contract_name.toLowerCase().includes(query) ||
        c.account_name.toLowerCase().includes(query) ||
        (c.opportunity_name?.toLowerCase().includes(query) ?? false) ||
        (c.contract_type?.toLowerCase().includes(query) ?? false)
      );
    }

    // Apply status filter
    if (filters.selectedStatuses.length > 0) {
      result = result.filter(c => c.status && filters.selectedStatuses.includes(c.status));
    }

    // Apply date filter
    if (filters.dateFilter !== 'all') {
      const now = new Date();
      result = result.filter(c => {
        const dateStr = c.contract_date || c.close_date;
        if (!dateStr) {
          // If no date set, only show in 'all' mode, not in filtered modes
          return false;
        }
        const date = new Date(dateStr);
        const daysUntil = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (filters.dateFilter === 'overdue') return daysUntil < 0;
        return daysUntil >= 0 && daysUntil <= parseInt(filters.dateFilter);
      });
    }

    // Apply budgeted filter
    if (filters.budgetedFilter !== 'all') {
      result = result.filter(c =>
        filters.budgetedFilter === 'budgeted' ? c.budgeted === true : c.budgeted !== true
      );
    }

    // Apply completeness filter
    if (filters.completenessFilter !== 'all') {
      switch (filters.completenessFilter) {
        case 'complete':
          result = result.filter(c => c.completeness.percentage >= 100);
          break;
        case 'in_progress':
          result = result.filter(c => c.completeness.percentage > 0 && c.completeness.percentage < 100);
          break;
        case 'needs_attention':
          result = result.filter(c => c.completeness.uploaded < c.completeness.required);
          break;
      }
    }

    // Sort
    result.sort((a, b) => {
      switch (filters.sortBy) {
        case 'name':
          return a.contract_name.localeCompare(b.contract_name);
        case 'account':
          return a.account_name.localeCompare(b.account_name);
        case 'progress':
          const aMissing = a.completeness.required - a.completeness.uploaded;
          const bMissing = b.completeness.required - b.completeness.uploaded;
          if (aMissing !== bMissing) return bMissing - aMissing;
          return a.completeness.percentage - b.completeness.percentage;
        case 'date':
          const aDate = a.contract_date || a.close_date || '';
          const bDate = b.contract_date || b.close_date || '';
          return aDate.localeCompare(bDate);
        case 'value':
          return (b.value || 0) - (a.value || 0);
        default:
          return 0;
      }
    });

    return result;
  }, [contracts, filters]);

  // Stats
  const stats = useMemo(() => ({
    total: contracts.length,
    complete: contracts.filter(c => c.completeness.percentage >= 100).length,
    needsAttention: contracts.filter(c => c.completeness.uploaded < c.completeness.required).length,
    inProgress: contracts.filter(c => c.completeness.percentage > 0 && c.completeness.percentage < 100).length,
  }), [contracts]);

  return (
    <div className="space-y-4">
      {/* Compact Header Bar */}
      <div className="bg-[#151F2E] rounded-xl border border-white/[0.06] p-4">
        <div className="flex items-center justify-between">
          {/* Search */}
          <div className="flex-1 max-w-md relative">
            <svg
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#64748B]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search contracts..."
              value={filters.searchQuery}
              onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
              className="w-full pl-10 pr-4 py-2.5 bg-[#0B1220] border border-white/[0.06] rounded-lg text-white placeholder-[#64748B] text-sm focus:outline-none focus:border-[#8B5CF6]/50 transition-colors"
            />
          </div>

          {/* Stats & Filter Button */}
          <div className="flex items-center gap-4">
            {/* Quick Stats */}
            <div className="flex items-center gap-4 text-[11px]">
              <span className="text-[#64748B]">
                Showing <span className="text-white font-medium">{filteredContracts.length}</span> of {stats.total}
              </span>
              {stats.needsAttention > 0 && (
                <span className="text-red-400 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {stats.needsAttention} need attention
                </span>
              )}
            </div>

            {/* Filter Button */}
            <button
              onClick={() => setShowFilterDrawer(true)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-medium transition-all ${
                hasActiveFilters
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  : 'bg-[#0B1220] text-[#8FA3BF] border border-white/[0.06] hover:border-white/[0.12] hover:text-white'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filters
              {activeFilterCount > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-purple-500/30 text-[10px] font-semibold">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Clear Filters (shown when active) */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-[12px] text-red-400 hover:text-red-300 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Active Filter Pills */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/[0.04]">
            <span className="text-[11px] text-[#64748B]">Active:</span>
            {filters.selectedStatuses.map(status => (
              <span
                key={status}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.06] text-[11px] text-white"
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: STATUS_COLORS[status] }}
                />
                {status}
                <button
                  onClick={() => setFilters({
                    ...filters,
                    selectedStatuses: filters.selectedStatuses.filter(s => s !== status)
                  })}
                  className="ml-1 text-[#64748B] hover:text-white"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
            {filters.dateFilter !== 'all' && (
              <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.06] text-[11px] text-white">
                {filters.dateFilter === 'overdue' ? 'Overdue' : `Next ${filters.dateFilter} Days`}
                <button
                  onClick={() => setFilters({ ...filters, dateFilter: 'all' })}
                  className="ml-1 text-[#64748B] hover:text-white"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
            {filters.budgetedFilter !== 'all' && (
              <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.06] text-[11px] text-white">
                {filters.budgetedFilter === 'budgeted' ? 'Budgeted' : 'Not Budgeted'}
                <button
                  onClick={() => setFilters({ ...filters, budgetedFilter: 'all' })}
                  className="ml-1 text-[#64748B] hover:text-white"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
            {filters.completenessFilter !== 'all' && (
              <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.06] text-[11px] text-white">
                {filters.completenessFilter === 'complete' ? 'Complete' :
                 filters.completenessFilter === 'in_progress' ? 'In Progress' : 'Needs Attention'}
                <button
                  onClick={() => setFilters({ ...filters, completenessFilter: 'all' })}
                  className="ml-1 text-[#64748B] hover:text-white"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Contract List */}
      <div className="bg-[#151F2E] rounded-xl border border-white/[0.06] overflow-hidden">
        {filteredContracts.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#0B1220] flex items-center justify-center border border-white/5">
              <svg className="w-8 h-8 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-[#8FA3BF] text-sm mb-1">No contracts found</p>
            <p className="text-[#64748B] text-xs">Try adjusting your search or filters</p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="mt-4 px-4 py-2 text-[12px] text-[#8B5CF6] hover:text-white hover:bg-[#8B5CF6]/20 border border-[#8B5CF6]/30 rounded-lg transition-colors"
              >
                Clear All Filters
              </button>
            )}
          </div>
        ) : (
          <div>
            {filteredContracts.map((contract, index) => (
              <ContractRow
                key={contract.id}
                contract={contract}
                onClick={() => setSelectedContract(contract)}
                index={index}
              />
            ))}
          </div>
        )}
      </div>

      {/* Contract Detail Drawer */}
      <ContractDetailDrawer
        contract={selectedContract}
        onClose={() => setSelectedContract(null)}
        onUpload={onUpload}
        onDownload={onDownload}
        onShare={onShare}
        onView={onView}
        onDelete={(doc) => {
          // Close drawer first, then delete - this ensures UI refreshes properly
          setSelectedContract(null);
          onDelete?.(doc);
        }}
        openBundleModal={openBundleModal}
      />

      {/* Filter Drawer */}
      <AnimatePresence>
        {showFilterDrawer && (
          <FilterDrawer
            filters={filters}
            onFilterChange={setFilters}
            onClose={() => setShowFilterDrawer(false)}
            statusCounts={statusCounts}
            totalContracts={contracts.length}
            filteredCount={filteredContracts.length}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
