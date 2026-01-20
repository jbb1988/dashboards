'use client';

import { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DocumentDetailDrawer, { DocumentItem } from './DocumentDetailDrawer';

interface DocumentListViewProps {
  documents: DocumentItem[];
  onUpload?: (file: File, documentType: string, contractId: string) => void;
  onDownload?: (doc: DocumentItem) => void;
  onDelete?: (doc: DocumentItem) => void;
  onReplace?: (doc: DocumentItem, file: File) => void;
}

const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  draft: { label: 'Draft', color: '#64748B', bg: 'bg-gray-500/10', border: 'border-gray-500/20' },
  under_review: { label: 'Under Review', color: '#3B82F6', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  awaiting_signature: { label: 'Awaiting Signature', color: '#F59E0B', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  executed: { label: 'Executed', color: '#22C55E', bg: 'bg-green-500/10', border: 'border-green-500/20' },
  expired: { label: 'Expired', color: '#EF4444', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  superseded: { label: 'Superseded', color: '#6B7280', bg: 'bg-gray-500/10', border: 'border-gray-500/20' },
  missing: { label: 'Missing', color: '#EF4444', bg: 'bg-red-500/10', border: 'border-red-500/20' },
};

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes >= 1000000) return `${(bytes / 1000000).toFixed(1)} MB`;
  if (bytes >= 1000) return `${(bytes / 1000).toFixed(0)} KB`;
  return `${bytes} B`;
}

function formatRelativeDate(dateStr?: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Document Row Component
function DocumentRow({
  document,
  onClick,
  index,
}: {
  document: DocumentItem;
  onClick: () => void;
  index: number;
}) {
  const isMissing = document.status === 'missing';
  const statusMeta = STATUS_META[document.status] || STATUS_META.draft;

  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02, duration: 0.2 }}
      onClick={onClick}
      className={`w-full text-left px-4 py-3 flex items-center gap-4 hover:bg-white/[0.03] transition-colors border-b border-white/[0.04] group ${
        isMissing ? 'bg-red-500/[0.02]' : ''
      }`}
    >
      {/* Status Indicator */}
      <div className="flex-shrink-0">
        {isMissing ? (
          <div className="w-5 h-5 rounded-full border-2 border-red-500/50 flex items-center justify-center">
            <span className="text-red-400 text-xs font-bold">!</span>
          </div>
        ) : (
          <div className="w-5 h-5 rounded-full bg-[#22C55E] flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </div>

      {/* Document Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[14px] font-medium text-white truncate">
            {document.document_type}
          </span>
          {document.is_required && isMissing && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 font-medium uppercase flex-shrink-0">
              Required
            </span>
          )}
          {document.version && document.version > 1 && !isMissing && (
            <span className="text-[10px] text-[#64748B] flex-shrink-0">v{document.version}</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[12px] text-[#64748B]">
          <span className="truncate">{document.contract_name}</span>
          <span className="text-[#475569]">•</span>
          <span className="truncate text-[#8FA3BF]">{document.account_name}</span>
        </div>
      </div>

      {/* Status & Meta */}
      <div className="flex-shrink-0 flex items-center gap-3">
        {/* Status Badge */}
        <span
          className={`px-2 py-1 rounded text-[10px] font-medium ${statusMeta.bg} border ${statusMeta.border}`}
          style={{ color: statusMeta.color }}
        >
          {statusMeta.label}
        </span>

        {/* File Info or Upload Prompt */}
        <div className="w-24 text-right">
          {isMissing ? (
            <span className="text-[11px] text-[#64748B] group-hover:text-[#8B5CF6] transition-colors">
              Click to upload
            </span>
          ) : (
            <>
              <div className="text-[11px] text-[#8FA3BF]">{formatFileSize(document.file_size)}</div>
              <div className="text-[10px] text-[#64748B]">{formatRelativeDate(document.uploaded_at)}</div>
            </>
          )}
        </div>

        {/* Arrow */}
        <svg className="w-4 h-4 text-[#475569] group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </motion.button>
  );
}

export default function DocumentListView({
  documents,
  onUpload,
  onDownload,
  onDelete,
  onReplace,
}: DocumentListViewProps) {
  const [selectedDocument, setSelectedDocument] = useState<DocumentItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterContract, setFilterContract] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'type' | 'contract' | 'date' | 'status'>('type');

  // Get unique values for filters
  const documentTypes = useMemo(() =>
    [...new Set(documents.map(d => d.document_type))].sort(),
    [documents]
  );

  const contractNames = useMemo(() =>
    [...new Set(documents.map(d => d.contract_name))].sort(),
    [documents]
  );

  const statuses = useMemo(() =>
    [...new Set(documents.map(d => d.status))].sort(),
    [documents]
  );

  // Filter and sort documents
  const filteredDocuments = useMemo(() => {
    let result = [...documents];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(d =>
        d.document_type.toLowerCase().includes(query) ||
        d.contract_name.toLowerCase().includes(query) ||
        d.account_name.toLowerCase().includes(query) ||
        d.file_name?.toLowerCase().includes(query)
      );
    }

    // Apply type filter
    if (filterType !== 'all') {
      result = result.filter(d => d.document_type === filterType);
    }

    // Apply status filter
    if (filterStatus !== 'all') {
      result = result.filter(d => d.status === filterStatus);
    }

    // Apply contract filter
    if (filterContract !== 'all') {
      result = result.filter(d => d.contract_name === filterContract);
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'type':
          return a.document_type.localeCompare(b.document_type);
        case 'contract':
          return a.contract_name.localeCompare(b.contract_name);
        case 'status':
          // Missing first, then by status
          if (a.status === 'missing' && b.status !== 'missing') return -1;
          if (b.status === 'missing' && a.status !== 'missing') return 1;
          return a.status.localeCompare(b.status);
        case 'date':
          return new Date(b.uploaded_at || 0).getTime() - new Date(a.uploaded_at || 0).getTime();
        default:
          return 0;
      }
    });

    return result;
  }, [documents, searchQuery, filterType, filterStatus, filterContract, sortBy]);

  // Stats
  const stats = useMemo(() => ({
    total: documents.length,
    missing: documents.filter(d => d.status === 'missing').length,
    executed: documents.filter(d => d.status === 'executed').length,
    pending: documents.filter(d => ['draft', 'under_review', 'awaiting_signature'].includes(d.status)).length,
  }), [documents]);

  const handleUpload = (file: File, documentType: string, contractId: string) => {
    onUpload?.(file, documentType, contractId);
    setSelectedDocument(null);
  };

  const handleDelete = (doc: DocumentItem) => {
    onDelete?.(doc);
    setSelectedDocument(null);
  };

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
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 bg-[#0B1220] border border-white/[0.06] rounded-lg text-white placeholder-[#64748B] text-sm focus:outline-none focus:border-[#8B5CF6]/50 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#64748B] hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-1 p-1 bg-[#151F2E] rounded-lg border border-white/[0.06]">
          {/* Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 bg-transparent text-[#8FA3BF] text-sm rounded-md border-0 focus:outline-none cursor-pointer hover:text-white transition-colors"
          >
            <option value="all">All Types</option>
            {documentTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>

          <div className="w-px h-6 bg-white/[0.06]" />

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-transparent text-[#8FA3BF] text-sm rounded-md border-0 focus:outline-none cursor-pointer hover:text-white transition-colors"
          >
            <option value="all">All Status</option>
            {statuses.map(status => (
              <option key={status} value={status}>{STATUS_META[status]?.label || status}</option>
            ))}
          </select>

          <div className="w-px h-6 bg-white/[0.06]" />

          {/* Contract Filter */}
          <select
            value={filterContract}
            onChange={(e) => setFilterContract(e.target.value)}
            className="px-3 py-2 bg-transparent text-[#8FA3BF] text-sm rounded-md border-0 focus:outline-none cursor-pointer hover:text-white transition-colors max-w-[200px]"
          >
            <option value="all">All Contracts</option>
            {contractNames.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>

          <div className="w-px h-6 bg-white/[0.06]" />

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="px-3 py-2 bg-transparent text-[#8FA3BF] text-sm rounded-md border-0 focus:outline-none cursor-pointer hover:text-white transition-colors"
          >
            <option value="type">Sort: Type</option>
            <option value="contract">Sort: Contract</option>
            <option value="status">Sort: Status</option>
            <option value="date">Sort: Date</option>
          </select>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="flex items-center gap-4 text-[11px]">
        <span className="text-[#64748B]">
          Showing <span className="text-white font-medium">{filteredDocuments.length}</span> of {stats.total} documents
        </span>
        {stats.missing > 0 && (
          <span className="text-red-400">
            {stats.missing} missing
          </span>
        )}
        <span className="text-[#64748B]">
          {stats.executed} executed • {stats.pending} pending
        </span>
      </div>

      {/* Document List */}
      <div className="bg-[#151F2E] rounded-xl border border-white/[0.06] overflow-hidden">
        {filteredDocuments.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#0B1220] flex items-center justify-center border border-white/5">
              <svg className="w-8 h-8 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-[#8FA3BF] text-sm mb-1">No documents found</p>
            <p className="text-[#64748B] text-xs">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div>
            {filteredDocuments.map((doc, index) => (
              <DocumentRow
                key={doc.id}
                document={doc}
                onClick={() => setSelectedDocument(doc)}
                index={index}
              />
            ))}
          </div>
        )}
      </div>

      {/* Document Detail Drawer */}
      <DocumentDetailDrawer
        document={selectedDocument}
        onClose={() => setSelectedDocument(null)}
        onUpload={handleUpload}
        onDownload={onDownload}
        onDelete={handleDelete}
        onReplace={onReplace}
      />
    </div>
  );
}
