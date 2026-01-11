'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ContractDetailDrawer, { ContractItem, ContractDocument } from './ContractDetailDrawer';

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

interface ContractListViewProps {
  contracts: ContractItem[];
  onUpload?: (file: File, documentType: string, contractId: string) => void;
  onDownload?: (doc: ContractDocument) => void;
  onShare?: (doc: ContractDocument) => void;
  onView?: (doc: ContractDocument) => void;
  onDelete?: (doc: ContractDocument) => void;
}

// Filter Chip Component
function FilterChip({
  label,
  active,
  onClick,
  color,
  count,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  color?: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all flex items-center gap-1.5 ${
        active
          ? 'bg-white/10 text-white border border-white/20'
          : 'bg-transparent text-[#8FA3BF] border border-white/[0.06] hover:border-white/[0.12] hover:text-white'
      }`}
    >
      {color && (
        <span
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: color }}
        />
      )}
      {label}
      {count !== undefined && count > 0 && (
        <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] ${
          active ? 'bg-white/20' : 'bg-white/[0.06]'
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}

// Dropdown Filter Component
function FilterDropdown({
  label,
  value,
  options,
  onChange,
  icon,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  icon?: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium transition-all border ${
          value !== 'all' && value !== ''
            ? 'bg-white/10 text-white border-white/20'
            : 'bg-transparent text-[#8FA3BF] border-white/[0.06] hover:border-white/[0.12] hover:text-white'
        }`}
      >
        {icon}
        <span>{selectedOption?.label || label}</span>
        <svg
          className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 mt-1 w-48 bg-[#1A2535] border border-white/[0.08] rounded-xl shadow-xl z-50 overflow-hidden"
          >
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-2.5 text-left text-[12px] transition-colors ${
                  value === option.value
                    ? 'bg-[#8B5CF6]/20 text-white'
                    : 'text-[#8FA3BF] hover:bg-white/[0.04] hover:text-white'
                }`}
              >
                {option.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
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
            {contract.account_name}
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
          <span className="truncate">{contract.contract_type || contract.contract_name}</span>
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
}: ContractListViewProps) {
  const [selectedContract, setSelectedContract] = useState<ContractItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter states
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState('all');
  const [budgetedFilter, setBudgetedFilter] = useState<'all' | 'budgeted' | 'not_budgeted'>('all');
  const [completenessFilter, setCompletenessFilter] = useState<'all' | 'complete' | 'in_progress' | 'needs_attention'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'account' | 'progress' | 'date' | 'value'>('name');

  // Get unique contract types
  const contractTypes = useMemo(() => {
    const types = new Set<string>();
    contracts.forEach(c => {
      if (c.contract_type) {
        c.contract_type.split(', ').forEach(t => types.add(t.trim()));
      }
    });
    return Array.from(types).sort();
  }, [contracts]);

  // Count contracts per status
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    CONTRACT_STATUSES.forEach(status => {
      counts[status] = contracts.filter(c => c.status === status).length;
    });
    return counts;
  }, [contracts]);

  // Toggle status filter
  const toggleStatus = (status: string) => {
    setSelectedStatuses(prev =>
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  // Clear all filters
  const clearFilters = () => {
    setSelectedStatuses([]);
    setDateFilter('all');
    setBudgetedFilter('all');
    setCompletenessFilter('all');
    setSearchQuery('');
  };

  // Check if any filters are active
  const hasActiveFilters = selectedStatuses.length > 0 || dateFilter !== 'all' || budgetedFilter !== 'all' || completenessFilter !== 'all' || searchQuery !== '';

  // Filter and sort contracts
  const filteredContracts = useMemo(() => {
    let result = [...contracts];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(c =>
        c.contract_name.toLowerCase().includes(query) ||
        c.account_name.toLowerCase().includes(query) ||
        (c.contract_type?.toLowerCase().includes(query) ?? false)
      );
    }

    // Apply status filter
    if (selectedStatuses.length > 0) {
      result = result.filter(c => c.status && selectedStatuses.includes(c.status));
    }

    // Apply date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      result = result.filter(c => {
        const dateStr = c.contract_date || c.close_date;
        if (!dateStr) return false;
        const date = new Date(dateStr);
        const daysUntil = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (dateFilter === 'overdue') return daysUntil < 0;
        return daysUntil >= 0 && daysUntil <= parseInt(dateFilter);
      });
    }

    // Apply budgeted filter
    if (budgetedFilter !== 'all') {
      result = result.filter(c =>
        budgetedFilter === 'budgeted' ? c.budgeted === true : c.budgeted !== true
      );
    }

    // Apply completeness filter
    if (completenessFilter !== 'all') {
      switch (completenessFilter) {
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
      switch (sortBy) {
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
  }, [contracts, searchQuery, selectedStatuses, dateFilter, budgetedFilter, completenessFilter, sortBy]);

  // Stats
  const stats = useMemo(() => ({
    total: contracts.length,
    complete: contracts.filter(c => c.completeness.percentage >= 100).length,
    needsAttention: contracts.filter(c => c.completeness.uploaded < c.completeness.required).length,
    inProgress: contracts.filter(c => c.completeness.percentage > 0 && c.completeness.percentage < 100).length,
  }), [contracts]);

  return (
    <div className="space-y-4">
      {/* Sophisticated Filter Bar */}
      <div className="bg-[#151F2E] rounded-xl border border-white/[0.06] p-4 space-y-4">
        {/* Top Row: Search + Quick Filters */}
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="flex-1 relative">
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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#0B1220] border border-white/[0.06] rounded-lg text-white placeholder-[#64748B] text-sm focus:outline-none focus:border-[#8B5CF6]/50 transition-colors"
            />
          </div>

          {/* Date Filter */}
          <FilterDropdown
            label="Contract Date"
            value={dateFilter}
            options={DATE_FILTERS.map(f => ({ value: f.value, label: f.label }))}
            onChange={setDateFilter}
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }
          />

          {/* Budgeted Filter */}
          <FilterDropdown
            label="Budgeted"
            value={budgetedFilter}
            options={[
              { value: 'all', label: 'All' },
              { value: 'budgeted', label: 'Budgeted Only' },
              { value: 'not_budgeted', label: 'Not Budgeted' },
            ]}
            onChange={(v) => setBudgetedFilter(v as typeof budgetedFilter)}
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />

          {/* Completeness Filter */}
          <FilterDropdown
            label="Completeness"
            value={completenessFilter}
            options={[
              { value: 'all', label: 'All' },
              { value: 'complete', label: 'Complete' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'needs_attention', label: 'Needs Attention' },
            ]}
            onChange={(v) => setCompletenessFilter(v as typeof completenessFilter)}
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />

          {/* Sort */}
          <FilterDropdown
            label="Sort"
            value={sortBy}
            options={[
              { value: 'name', label: 'Contract Name' },
              { value: 'account', label: 'Account' },
              { value: 'progress', label: 'Progress' },
              { value: 'date', label: 'Contract Date' },
              { value: 'value', label: 'Value' },
            ]}
            onChange={(v) => setSortBy(v as typeof sortBy)}
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
              </svg>
            }
          />

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-3 py-2 text-[12px] text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear
            </button>
          )}
        </div>

        {/* Contract Status Chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-[#64748B] uppercase tracking-wider font-medium mr-2">
            Contract Status:
          </span>
          {CONTRACT_STATUSES.map((status) => (
            <FilterChip
              key={status}
              label={status}
              active={selectedStatuses.includes(status)}
              onClick={() => toggleStatus(status)}
              color={STATUS_COLORS[status]}
              count={statusCounts[status]}
            />
          ))}
        </div>
      </div>

      {/* Stats Summary */}
      <div className="flex items-center gap-4 text-[11px] px-1">
        <span className="text-[#64748B]">
          Showing <span className="text-white font-medium">{filteredContracts.length}</span> of {stats.total} contracts
        </span>
        {stats.needsAttention > 0 && (
          <span className="text-red-400 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {stats.needsAttention} need attention
          </span>
        )}
        <span className="text-green-400 flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {stats.complete} complete
        </span>
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
      />
    </div>
  );
}
