'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import ContractDetailDrawer, { ContractItem, ContractDocument } from './ContractDetailDrawer';

interface ContractListViewProps {
  contracts: ContractItem[];
  onUpload?: (file: File, documentType: string, contractId: string) => void;
  onDownload?: (doc: ContractDocument) => void;
  onShare?: (doc: ContractDocument) => void;
  onView?: (doc: ContractDocument) => void;
  onDelete?: (doc: ContractDocument) => void;
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
        </div>
        <div className="flex items-center gap-2 text-[13px] text-[#8FA3BF]">
          <span className="truncate">{contract.account_name}</span>
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
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'account' | 'progress'>('name');

  // Get unique accounts for filtering
  const accounts = useMemo(() =>
    [...new Set(contracts.map(c => c.account_name))].sort(),
    [contracts]
  );

  // Filter and sort contracts
  const filteredContracts = useMemo(() => {
    let result = [...contracts];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(c =>
        c.contract_name.toLowerCase().includes(query) ||
        c.account_name.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (filterStatus !== 'all') {
      switch (filterStatus) {
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
          // Sort by missing required docs first, then by percentage
          const aMissing = a.completeness.required - a.completeness.uploaded;
          const bMissing = b.completeness.required - b.completeness.uploaded;
          if (aMissing !== bMissing) return bMissing - aMissing;
          return a.completeness.percentage - b.completeness.percentage;
        default:
          return 0;
      }
    });

    return result;
  }, [contracts, searchQuery, filterStatus, sortBy]);

  // Stats
  const stats = useMemo(() => ({
    total: contracts.length,
    complete: contracts.filter(c => c.completeness.percentage >= 100).length,
    needsAttention: contracts.filter(c => c.completeness.uploaded < c.completeness.required).length,
    inProgress: contracts.filter(c => c.completeness.percentage > 0 && c.completeness.percentage < 100).length,
  }), [contracts]);

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="flex items-center gap-3">
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

        {/* Filter Controls */}
        <div className="flex items-center gap-1 p-1 bg-[#151F2E] rounded-lg border border-white/[0.06]">
          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-transparent text-[#8FA3BF] text-sm rounded-md border-0 focus:outline-none cursor-pointer hover:text-white transition-colors"
          >
            <option value="all">All Status</option>
            <option value="complete">Complete</option>
            <option value="in_progress">In Progress</option>
            <option value="needs_attention">Needs Attention</option>
          </select>

          <div className="w-px h-6 bg-white/[0.06]" />

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="px-3 py-2 bg-transparent text-[#8FA3BF] text-sm rounded-md border-0 focus:outline-none cursor-pointer hover:text-white transition-colors"
          >
            <option value="name">Sort: Name</option>
            <option value="account">Sort: Account</option>
            <option value="progress">Sort: Progress</option>
          </select>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="flex items-center gap-4 text-[11px]">
        <span className="text-[#64748B]">
          Showing <span className="text-white font-medium">{filteredContracts.length}</span> of {stats.total} contracts
        </span>
        {stats.needsAttention > 0 && (
          <span className="text-red-400">
            {stats.needsAttention} need attention
          </span>
        )}
        <span className="text-[#64748B]">
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
        onDelete={onDelete}
      />
    </div>
  );
}
