'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Bundle info interface
interface BundleInfo {
  bundleId: string;
  bundleName: string;
  isPrimary: boolean;
  contractCount: number;
}

// Document type within a contract
export interface ContractDocument {
  id: string;
  document_type: string;
  subtitle?: string;
  file_name?: string;
  file_url?: string;
  file_size?: number;
  uploaded_at?: string;
  uploaded_by?: string;
  status: 'uploaded' | 'missing';
  is_required: boolean;
  version?: number;
}

// Contract with all its documents
export interface ContractItem {
  id: string;
  contract_name: string;
  account_name: string;
  opportunity_name?: string;
  contract_type?: string;
  salesforce_id?: string;
  // Filter fields
  status?: string;
  contract_date?: string | null;
  close_date?: string | null;
  budgeted?: boolean;
  value?: number;
  documents: ContractDocument[];
  completeness: {
    uploaded: number;
    required: number;
    total: number;
    percentage: number;
  };
  bundleInfo?: BundleInfo | null;
}

interface ContractDetailDrawerProps {
  contract: ContractItem | null;
  onClose: () => void;
  onUpload?: (file: File, documentType: string, contractId: string) => void;
  onDownload?: (doc: ContractDocument) => void;
  onShare?: (doc: ContractDocument) => void;
  onView?: (doc: ContractDocument) => void;
  onDelete?: (doc: ContractDocument) => void;
  openBundleModal?: (contract: ContractItem, mode: 'create' | 'add') => void;
}

// Required document types in order
const DOCUMENT_TYPES = [
  { type: 'Original Contract', required: true },
  { type: 'MARS Redlines', required: true },
  { type: 'Client Response - MARS STD WTC', required: false, subtitle: 'Client redlines to MARS STD WTC' },
  { type: 'Client Response - MARS MCC TC', required: false, subtitle: 'Client redlines to MARS MCC TC' },
  { type: 'Client Response - MARS EULA', required: false, subtitle: 'Client redlines to MARS EULA' },
  { type: 'Final Agreement', required: true },
  { type: 'Executed Contract', required: true },
  { type: 'Purchase Order', required: false },
  { type: 'Amendment', required: false },
  { type: 'Other', required: false, subtitle: 'Additional supporting documents' },
];

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes >= 1000000) return `${(bytes / 1000000).toFixed(1)} MB`;
  if (bytes >= 1000) return `${(bytes / 1000).toFixed(0)} KB`;
  return `${bytes} B`;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${month}/${day}/${year}`;
}

// Individual document row within the drawer
function DocumentRow({
  doc,
  onUpload,
  onDownload,
  onShare,
  onView,
  onDelete,
  contractId,
}: {
  doc: ContractDocument;
  onUpload?: (file: File, documentType: string, contractId: string) => void;
  onDownload?: (doc: ContractDocument) => void;
  onShare?: (doc: ContractDocument) => void;
  onView?: (doc: ContractDocument) => void;
  onDelete?: (doc: ContractDocument) => void;
  contractId: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const isMissing = doc.status === 'missing';

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUpload) {
      setIsUploading(true);
      try {
        await onUpload(file, doc.document_type, contractId);
      } finally {
        setIsUploading(false);
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={`p-4 rounded-xl border transition-all ${
      isMissing
        ? 'bg-[#0B1220] border-white/[0.04] hover:border-white/[0.08]'
        : 'bg-[#0F1722] border-white/[0.06] hover:border-white/[0.12]'
    }`}>
      <div className="flex items-start justify-between gap-3">
        {/* Left: Status + Document Info */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Status Icon */}
          <div className="flex-shrink-0 mt-0.5">
            {isMissing ? (
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                doc.is_required ? 'border-red-500/50' : 'border-[#475569]'
              }`}>
                <span className={`text-xs font-bold ${doc.is_required ? 'text-red-400' : 'text-[#64748B]'}`}>
                  {doc.is_required ? '!' : '?'}
                </span>
              </div>
            ) : (
              <div className="w-6 h-6 rounded-full bg-[#22C55E] flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </div>

          {/* Document Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[14px] font-medium text-white">
                {doc.document_type}
              </span>
              {doc.is_required && isMissing && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 font-medium uppercase">
                  Required
                </span>
              )}
              {doc.version && doc.version > 1 && !isMissing && (
                <span className="text-[10px] text-[#64748B]">v{doc.version}</span>
              )}
            </div>

            {doc.subtitle && (
              <p className="text-[11px] text-[#64748B] mb-1">
                {doc.subtitle}
              </p>
            )}

            {isMissing ? (
              <p className="text-[12px] text-[#64748B]">
                {doc.is_required ? 'Required document - not yet uploaded' : 'Optional - upload when available'}
              </p>
            ) : (
              <div className="flex items-center gap-2 text-[12px] text-[#8FA3BF]">
                <span className="truncate" title={doc.file_name}>{doc.file_name}</span>
                {doc.file_size && (
                  <>
                    <span className="text-[#475569]">•</span>
                    <span>{formatFileSize(doc.file_size)}</span>
                  </>
                )}
                {doc.uploaded_at && (
                  <>
                    <span className="text-[#475569]">•</span>
                    <span>{formatDate(doc.uploaded_at)}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Action Buttons */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {isMissing ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className={`px-3 py-1.5 text-white text-[12px] font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                isUploading ? 'bg-[#8B5CF6]/50 cursor-not-allowed' : 'bg-[#8B5CF6] hover:bg-[#8B5CF6]/90'
              }`}
            >
              {isUploading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Upload
                </>
              )}
            </button>
          ) : (
            <>
              {/* View Button */}
              <button
                onClick={() => onView?.(doc)}
                className="p-2 text-[#8FA3BF] hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                title="View"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </button>

              {/* Download Button */}
              <button
                onClick={() => onDownload?.(doc)}
                className="p-2 text-[#8FA3BF] hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                title="Download"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>

              {/* Share Button */}
              <button
                onClick={() => onShare?.(doc)}
                className="p-2 text-[#8FA3BF] hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                title="Share"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </button>

              {/* More Options */}
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to delete this document?')) {
                    onDelete?.(doc);
                  }
                }}
                className="p-2 text-[#64748B] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                title="Delete"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
        onChange={handleFileSelect}
      />
    </div>
  );
}

export default function ContractDetailDrawer({
  contract,
  onClose,
  onUpload,
  onDownload,
  onShare,
  onView,
  onDelete,
  openBundleModal,
}: ContractDetailDrawerProps) {
  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!contract) return null;

  // Get document for each type
  const getDocumentForType = (docType: string): ContractDocument => {
    const existing = contract.documents.find(d => d.document_type === docType);
    if (existing) return existing;

    // Return placeholder for missing document
    const typeInfo = DOCUMENT_TYPES.find(t => t.type === docType);
    return {
      id: `missing-${contract.id}-${docType}`,
      document_type: docType,
      subtitle: typeInfo?.subtitle,
      status: 'missing',
      is_required: typeInfo?.required ?? false,
    };
  };

  // Separate required and optional docs
  const requiredTypes = DOCUMENT_TYPES.filter(t => t.required);
  const optionalTypes = DOCUMENT_TYPES.filter(t => !t.required);

  return (
    <AnimatePresence>
      {contract && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-40"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-[520px] bg-[#151F2E] border-l border-white/[0.06] shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex-shrink-0 border-b border-white/[0.06]">
              <div className="flex items-start justify-between p-5">
                <div className="flex-1 min-w-0 pr-4">
                  {/* Contract Name */}
                  <h2 className="text-[18px] font-semibold text-white leading-tight mb-1">
                    {contract.contract_name}
                  </h2>

                  {/* Account Name */}
                  <div className="flex items-center gap-2 mb-3">
                    <p className="text-[14px] text-[#8FA3BF]">
                      {contract.account_name}
                    </p>
                    {contract.bundleInfo && (
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[#8B5CF6]/15 text-[#8B5CF6]">
                        Bundle
                      </span>
                    )}
                  </div>

                  {/* Bundle Info */}
                  {(contract.bundleInfo || openBundleModal) && (
                    <div className="mb-3 p-3 bg-[#0B1220] rounded-lg border border-white/[0.04]">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-[#64748B]">Bundle</span>
                        {contract.bundleInfo ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] text-[#8B5CF6]">
                              {contract.bundleInfo.bundleName.length > 25
                                ? `${contract.bundleInfo.bundleName.substring(0, 25)}...`
                                : contract.bundleInfo.bundleName}
                            </span>
                            <span className="text-[9px] text-[#64748B] bg-[#8B5CF6]/10 px-1.5 py-0.5 rounded">
                              {contract.bundleInfo.contractCount}
                            </span>
                            {contract.bundleInfo.isPrimary && (
                              <span className="text-[9px] text-[#8B5CF6]">Primary</span>
                            )}
                          </div>
                        ) : openBundleModal ? (
                          <button
                            onClick={() => openBundleModal(contract, 'create')}
                            className="text-[11px] text-[#8B5CF6] hover:text-[#A78BFA] transition-colors flex items-center gap-1"
                          >
                            Create Bundle
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          </button>
                        ) : null}
                      </div>
                    </div>
                  )}

                  {/* Progress Bar */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-[#0B1220] rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${contract.completeness.percentage}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                        className={`h-full rounded-full ${
                          contract.completeness.percentage >= 100
                            ? 'bg-[#22C55E]'
                            : contract.completeness.percentage >= 50
                            ? 'bg-[#3B82F6]'
                            : 'bg-[#F59E0B]'
                        }`}
                      />
                    </div>
                    <span className="text-[13px] text-[#8FA3BF] tabular-nums">
                      {contract.completeness.uploaded}/{contract.completeness.required} required
                    </span>
                  </div>
                </div>

                {/* Close Button */}
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-white/5 text-[#64748B] hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Documents List */}
            <div className="flex-1 overflow-y-auto">
              {/* Required Documents Section */}
              <div className="p-5">
                <h3 className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-3">
                  Required Documents
                </h3>
                <div className="space-y-2">
                  {requiredTypes.map(({ type }) => (
                    <DocumentRow
                      key={type}
                      doc={getDocumentForType(type)}
                      onUpload={onUpload}
                      onDownload={onDownload}
                      onShare={onShare}
                      onView={onView}
                      onDelete={onDelete}
                      contractId={contract.id}
                    />
                  ))}
                </div>
              </div>

              {/* Optional Documents Section */}
              <div className="px-5 pb-5">
                <h3 className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-3">
                  Optional Documents
                </h3>
                <div className="space-y-2">
                  {optionalTypes.map(({ type }) => (
                    <DocumentRow
                      key={type}
                      doc={getDocumentForType(type)}
                      onUpload={onUpload}
                      onDownload={onDownload}
                      onShare={onShare}
                      onView={onView}
                      onDelete={onDelete}
                      contractId={contract.id}
                    />
                  ))}
                </div>
              </div>

              {/* Additional Uploaded Documents (not in standard types) */}
              {contract.documents.filter(d =>
                !DOCUMENT_TYPES.some(t => t.type === d.document_type)
              ).length > 0 && (
                <div className="px-5 pb-5">
                  <h3 className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-3">
                    Other Documents
                  </h3>
                  <div className="space-y-2">
                    {contract.documents
                      .filter(d => !DOCUMENT_TYPES.some(t => t.type === d.document_type))
                      .map(doc => (
                        <DocumentRow
                          key={doc.id}
                          doc={doc}
                          onUpload={onUpload}
                          onDownload={onDownload}
                          onShare={onShare}
                          onView={onView}
                          onDelete={onDelete}
                          contractId={contract.id}
                        />
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="flex-shrink-0 border-t border-white/[0.06] bg-[#0F1722] px-5 py-4">
              <div className="flex items-center gap-3">
                {contract.salesforce_id && (
                  <a
                    href={`https://marscompany.lightning.force.com/lightning/r/Opportunity/${contract.salesforce_id}/view`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 text-white font-medium text-sm rounded-lg hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    View in Salesforce
                  </a>
                )}
                <button
                  onClick={onClose}
                  className="px-4 py-2.5 text-[#8FA3BF] hover:text-white font-medium text-sm rounded-lg hover:bg-white/5 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
