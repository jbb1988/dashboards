'use client';

import { motion } from 'framer-motion';

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

// Date filter options
const DATE_FILTERS = [
  { value: 'all', label: 'All Dates' },
  { value: 'overdue', label: 'Overdue' },
  { value: '30', label: 'Next 30 Days' },
  { value: '60', label: 'Next 60 Days' },
  { value: '90', label: 'Next 90 Days' },
  { value: '180', label: 'Next 6 Months' },
] as const;

// Completeness options
const COMPLETENESS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'complete', label: 'Complete' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'needs_attention', label: 'Needs Attention' },
] as const;

// Sort options
const SORT_OPTIONS = [
  { value: 'name', label: 'Contract Name' },
  { value: 'account', label: 'Account' },
  { value: 'progress', label: 'Progress' },
  { value: 'date', label: 'Contract Date' },
  { value: 'value', label: 'Value' },
] as const;

export interface FilterState {
  searchQuery: string;
  selectedStatuses: string[];
  dateFilter: string;
  budgetedFilter: 'all' | 'budgeted' | 'not_budgeted';
  completenessFilter: 'all' | 'complete' | 'in_progress' | 'needs_attention';
  sortBy: 'name' | 'account' | 'progress' | 'date' | 'value';
}

interface FilterDrawerProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  onClose: () => void;
  statusCounts: Record<string, number>;
  totalContracts: number;
  filteredCount: number;
}

export default function FilterDrawer({
  filters,
  onFilterChange,
  onClose,
  statusCounts,
  totalContracts,
  filteredCount,
}: FilterDrawerProps) {
  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const toggleStatus = (status: string) => {
    const newStatuses = filters.selectedStatuses.includes(status)
      ? filters.selectedStatuses.filter(s => s !== status)
      : [...filters.selectedStatuses, status];
    updateFilter('selectedStatuses', newStatuses);
  };

  const clearFilters = () => {
    onFilterChange({
      searchQuery: '',
      selectedStatuses: [],
      dateFilter: 'all',
      budgetedFilter: 'all',
      completenessFilter: 'all',
      sortBy: 'name',
    });
  };

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

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 z-50"
      />

      {/* Drawer */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 bottom-0 w-[380px] bg-[#151F2E] border-l border-white/[0.06] shadow-2xl z-50 overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-[#0F1722] border-b border-white/[0.06] px-6 py-4 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
              </div>
              <div>
                <h2 className="text-[16px] font-semibold text-white">Filter Documents</h2>
                <span className="text-[12px] text-[#64748B]">
                  {filteredCount} of {totalContracts} contracts
                  {activeFilterCount > 0 && ` (${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''} active)`}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/5 text-[#8FA3BF] hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Search */}
          <div>
            <label className="block text-[12px] font-medium text-[#64748B] mb-2 uppercase tracking-wider">
              Search
            </label>
            <div className="relative">
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
                onChange={(e) => updateFilter('searchQuery', e.target.value)}
                className="w-full pl-10 pr-10 py-3 bg-[#0B1220] border border-white/[0.06] rounded-xl text-white placeholder-[#64748B] text-[14px] focus:outline-none focus:border-[#8B5CF6]/50 transition-colors"
              />
              {filters.searchQuery && (
                <button
                  onClick={() => updateFilter('searchQuery', '')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#64748B] hover:text-white transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Contract Status */}
          <div>
            <label className="block text-[12px] font-medium text-[#64748B] mb-3 uppercase tracking-wider">
              Contract Status
            </label>
            <div className="space-y-2">
              {CONTRACT_STATUSES.map((status) => (
                <button
                  key={status}
                  onClick={() => toggleStatus(status)}
                  className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center justify-between ${
                    filters.selectedStatuses.includes(status)
                      ? 'bg-white/10 border border-white/20'
                      : 'bg-[#0B1220] border border-white/[0.04] hover:border-white/[0.08]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: STATUS_COLORS[status] }}
                    />
                    <span className="text-[13px] text-white">{status}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-[#64748B]">{statusCounts[status] || 0}</span>
                    {filters.selectedStatuses.includes(status) && (
                      <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Date Filter */}
          <div>
            <label className="block text-[12px] font-medium text-[#64748B] mb-3 uppercase tracking-wider">
              Contract Date
            </label>
            <div className="grid grid-cols-2 gap-2">
              {DATE_FILTERS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => updateFilter('dateFilter', option.value)}
                  className={`px-4 py-2.5 rounded-xl text-[12px] font-medium transition-all ${
                    filters.dateFilter === option.value
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      : 'bg-[#0B1220] text-[#8FA3BF] border border-white/[0.04] hover:border-white/[0.08] hover:text-white'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Budgeted Filter */}
          <div>
            <label className="block text-[12px] font-medium text-[#64748B] mb-3 uppercase tracking-wider">
              Budget Status
            </label>
            <div className="flex gap-2">
              {[
                { value: 'all', label: 'All' },
                { value: 'budgeted', label: 'Budgeted' },
                { value: 'not_budgeted', label: 'Not Budgeted' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => updateFilter('budgetedFilter', option.value as FilterState['budgetedFilter'])}
                  className={`flex-1 px-4 py-2.5 rounded-xl text-[12px] font-medium transition-all ${
                    filters.budgetedFilter === option.value
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      : 'bg-[#0B1220] text-[#8FA3BF] border border-white/[0.04] hover:border-white/[0.08] hover:text-white'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Completeness Filter */}
          <div>
            <label className="block text-[12px] font-medium text-[#64748B] mb-3 uppercase tracking-wider">
              Document Completeness
            </label>
            <div className="grid grid-cols-2 gap-2">
              {COMPLETENESS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => updateFilter('completenessFilter', option.value as FilterState['completenessFilter'])}
                  className={`px-4 py-2.5 rounded-xl text-[12px] font-medium transition-all ${
                    filters.completenessFilter === option.value
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      : 'bg-[#0B1220] text-[#8FA3BF] border border-white/[0.04] hover:border-white/[0.08] hover:text-white'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-[12px] font-medium text-[#64748B] mb-3 uppercase tracking-wider">
              Sort By
            </label>
            <div className="space-y-2">
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => updateFilter('sortBy', option.value as FilterState['sortBy'])}
                  className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center justify-between ${
                    filters.sortBy === option.value
                      ? 'bg-white/10 border border-white/20'
                      : 'bg-[#0B1220] border border-white/[0.04] hover:border-white/[0.08]'
                  }`}
                >
                  <span className="text-[13px] text-white">{option.label}</span>
                  {filters.sortBy === option.value && (
                    <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="w-full py-3 rounded-xl text-[13px] font-medium text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear All Filters
            </button>
          )}
        </div>

        {/* Apply Button */}
        <div className="sticky bottom-0 bg-[#0F1722] border-t border-white/[0.06] p-4">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-purple-500 hover:bg-purple-600 text-white text-[14px] font-medium transition-colors"
          >
            Apply Filters ({filteredCount} results)
          </button>
        </div>
      </motion.div>
    </>
  );
}
