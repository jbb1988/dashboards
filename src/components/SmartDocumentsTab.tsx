'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DocumentsProgressView, DocumentData, DocumentPreviewPanel, DocumentListView, DocumentItem } from '@/components/documents';
import {
  tokens,
  colors,
  KPICard,
  KPIIcons,
  DistributionBar,
  ProgressBar,
  Badge,
  StatusDot,
} from '@/components/mars-ui';

// Priority accent colors for visual treatments
const PRIORITY_ACCENT = {
  critical: {
    color: colors.accent.red,
    gradient: 'from-[#1E2028] to-[#2D1F24]',
    borderColor: 'border-red-500/20',
    glowShadow: '0 20px 40px -10px rgba(229,72,77,0.3), 0 0 20px rgba(229,72,77,0.15)',
    hoverBg: 'hover:border-red-500/40',
  },
  high: {
    color: colors.accent.amber,
    gradient: 'from-[#1E2028] to-[#2D2A1F]',
    borderColor: 'border-amber-500/20',
    glowShadow: '0 20px 40px -10px rgba(212,167,44,0.25), 0 0 20px rgba(212,167,44,0.12)',
    hoverBg: 'hover:border-amber-500/40',
  },
  medium: {
    color: colors.accent.blue,
    gradient: 'from-[#1E2028] to-[#1F2432]',
    borderColor: 'border-blue-500/20',
    glowShadow: '0 20px 40px -10px rgba(91,141,239,0.2), 0 0 20px rgba(91,141,239,0.1)',
    hoverBg: 'hover:border-blue-500/40',
  },
  low: {
    color: colors.accent.green,
    gradient: 'from-[#1E2028] to-[#1F2824]',
    borderColor: 'border-emerald-500/20',
    glowShadow: '0 20px 40px -10px rgba(48,164,108,0.2), 0 0 20px rgba(48,164,108,0.1)',
    hoverBg: 'hover:border-emerald-500/40',
  },
} as const;

// Priority level metadata for tooltips
const PRIORITY_META = {
  critical: {
    label: 'Critical',
    description: 'Overdue or missing required documents',
    color: 'red' as const,
    bgClass: 'bg-[#E5484D]',
  },
  high: {
    label: 'High Priority',
    description: 'Due soon or needs attention',
    color: 'amber' as const,
    bgClass: 'bg-[#D4A72C]',
  },
  medium: {
    label: 'Medium Priority',
    description: 'On track, some items pending',
    color: 'blue' as const,
    bgClass: 'bg-[#5B8DEF]',
  },
  low: {
    label: 'Low Priority',
    description: 'Complete or not urgent',
    color: 'green' as const,
    bgClass: 'bg-[#30A46C]',
  },
};

// Priority Dot with Tooltip Component
function PriorityDot({ category }: { category: 'critical' | 'high' | 'medium' | 'low' }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const meta = PRIORITY_META[category];

  return (
    <div className="relative flex-shrink-0">
      <div
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="cursor-help"
      >
        <StatusDot color={meta.color} size="md" pulse={category === 'critical'} />
      </div>
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50"
          >
            <div className={`${tokens.bg.elevated} border ${tokens.border.default} ${tokens.radius.lg} px-3 py-2 ${tokens.shadow.card} whitespace-nowrap`}>
              <div className="flex items-center gap-2 mb-0.5">
                <StatusDot color={meta.color} size="sm" />
                <span className={`text-xs font-semibold ${tokens.text.primary}`}>{meta.label}</span>
              </div>
              <p className={`text-xs ${tokens.text.muted}`}>{meta.description}</p>
              {/* Tooltip arrow */}
              <div className={`absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 ${tokens.bg.elevated} border-r ${tokens.border.default} border-b rotate-45 -mt-1`} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Hero Visual: Risk Distribution Bar (using mars-ui DistributionBar)
function RiskDistributionBar({
  critical,
  high,
  medium,
  low,
  total,
}: {
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
}) {
  if (total === 0) return null;

  const segments = [
    { value: critical, color: colors.accent.red, label: 'Critical' },
    { value: high, color: colors.accent.amber, label: 'High' },
    { value: medium, color: colors.accent.blue, label: 'Medium' },
    { value: low, color: colors.accent.green, label: 'Low' },
  ];

  return (
    <div className={`${tokens.bg.card} ${tokens.radius.lg} border ${tokens.border.subtle} p-4 ${tokens.shadow.card}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={`text-sm font-semibold ${tokens.text.primary}`}>Contracts by Risk Level</h3>
        <span className={`text-xs ${tokens.text.muted}`}>{total} total</span>
      </div>

      <DistributionBar
        segments={segments}
        total={total}
        size="md"
        animated
        showLegend
      />
    </div>
  );
}

// Types
interface Document {
  id: string;
  contract_id: string | null;
  salesforce_id: string | null;
  account_name: string;
  opportunity_name: string | null;
  opportunity_year: number | null;
  document_type: string;
  status: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  version: number;
  is_current_version: boolean;
  expiration_date: string | null;
  uploaded_at: string;
  uploaded_by: string | null;
  notes: string | null;
  fromBundledContract?: string | null; // Contract ID if from a bundled contract
}

interface BundleInfo {
  bundleId: string;
  bundleName: string;
  contracts: { id: string; name: string; isPrimary: boolean }[];
}

interface PriorityScore {
  contractId: string;
  score: number;
  reasons: string[];
  category: 'critical' | 'high' | 'medium' | 'low';
}

interface CompletenessScore {
  total: number;
  required: number;
  optional: number;
  percentage: number;
  missingRequired: string[];
  missingOptional: string[];
}

interface ContractDocuments {
  contractId: string;
  contractName: string;
  opportunityYear: number | null;
  documents: Document[];
  completeness: CompletenessScore;
  priority: PriorityScore;
}

interface AccountGroup {
  accountName: string;
  contracts: Record<string, ContractDocuments>;
}

interface Contract {
  id: string;
  salesforceId?: string;
  name: string;
  opportunityName?: string;
  value: number;
  status: string;
  closeDate: string | null;
  contractDate: string | null;
  awardDate?: string | null;
  budgeted?: boolean;
  contractType?: string[];
}

interface DocumentsData {
  documents: Document[];
  byAccount: Record<string, AccountGroup>;
  priorityScores: Record<string, PriorityScore>;
  completenessScores: Record<string, CompletenessScore>;
  stats: {
    totalDocuments: number;
    totalContracts: number;
    needsAttention: number;
    closingSoon: number;
    complete: number;
    averageCompleteness: number;
  };
  documentTypes: string[];
  requiredTypes: string[];
  optionalTypes: string[];
  analysisTypes?: string[];
  bundleInfo?: BundleInfo | null;
}

interface SavedView {
  id: string;
  name: string;
  filters: {
    view?: string;
    documentType?: string;
    status?: string;
    accountName?: string;
  };
}


// Required documents for completeness
const REQUIRED_DOCUMENT_TYPES = [
  'Original Contract',
  'MARS Redlines',
  'Final Agreement',
  'Executed Contract',
];

// Optional standard documents
const OPTIONAL_DOCUMENT_TYPES = [
  'Client Response',
  'Purchase Order',
  'Amendment',
];

// Analysis documents (from Compare tab)
const ANALYSIS_DOCUMENT_TYPES = [
  'Comparison Report',
  'AI Recommendations',
];

// All document types combined
const DOCUMENT_TYPES = [
  ...REQUIRED_DOCUMENT_TYPES,
  ...OPTIONAL_DOCUMENT_TYPES,
  ...ANALYSIS_DOCUMENT_TYPES,
  'Other',
];

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  draft: { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/20' },
  under_review: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  awaiting_signature: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' },
  executed: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20' },
  expired: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
  superseded: { bg: 'bg-gray-500/10', text: 'text-gray-500', border: 'border-gray-500/20' },
};

const PRIORITY_COLORS: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  critical: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30', glow: 'shadow-red-500/20' },
  high: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30', glow: 'shadow-orange-500/20' },
  medium: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30', glow: 'shadow-cyan-500/20' },
  low: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30', glow: 'shadow-green-500/20' },
};

// Format file size
function formatFileSize(bytes: number | null): string {
  if (!bytes) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Format date
function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'No date';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Format relative time
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return formatDate(dateStr);
}

// Drag and Drop Upload Zone Component
function DropZone({
  documentType,
  contractId,
  contractName,
  accountName,
  onUpload,
  existingDoc,
  isUploading,
}: {
  documentType: string;
  contractId: string;
  contractName: string;
  accountName: string;
  onUpload: (file: File, type: string, contractId: string, contractName: string, accountName: string) => void;
  existingDoc?: Document;
  isUploading: boolean;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      onUpload(file, documentType, contractId, contractName, accountName);
    }
  };

  const handleClick = () => {
    if (existingDoc) {
      // Open existing document
      if (existingDoc.file_url && !existingDoc.file_url.startsWith('#')) {
        window.open(existingDoc.file_url, '_blank');
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file, documentType, contractId, contractName, accountName);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const hasDoc = !!existingDoc;
  const statusColor = existingDoc ? STATUS_COLORS[existingDoc.status] || STATUS_COLORS.draft : null;

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      className={`
        relative flex items-center gap-2 p-2 rounded-lg text-sm cursor-pointer transition-all duration-200
        ${isDragOver ? 'ring-2 ring-[#38BDF8] bg-[#38BDF8]/10 scale-[1.02]' : ''}
        ${hasDoc
          ? `${statusColor?.bg} ${statusColor?.text} hover:brightness-110 border ${statusColor?.border}`
          : 'bg-[#151F2E] text-[#64748B] hover:bg-[#1E293B] hover:text-white border border-transparent hover:border-white/10'
        }
        ${isUploading ? 'opacity-50 cursor-wait' : ''}
      `}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept=".pdf,.doc,.docx,.txt"
        className="hidden"
      />

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

      <span className="truncate flex-1">{documentType}</span>

      {hasDoc && existingDoc.version > 1 && (
        <span className="text-xs opacity-60">v{existingDoc.version}</span>
      )}

      {isDragOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#38BDF8]/20 rounded-lg">
          <span className="text-[#38BDF8] text-xs font-medium">Drop to upload</span>
        </div>
      )}
    </div>
  );
}

// Collapsible Account Section
function AccountSection({
  accountName,
  contracts,
  isExpanded,
  onToggle,
  onUpload,
  uploadingKey,
  documentTypes,
  bundleInfoMap,
  onManageBundle,
  allContracts,
}: {
  accountName: string;
  contracts: Record<string, ContractDocuments>;
  isExpanded: boolean;
  onToggle: () => void;
  onUpload: (file: File, type: string, contractId: string, contractName: string, accountName: string) => void;
  uploadingKey: string | null;
  documentTypes: string[];
  bundleInfoMap?: Record<string, BundleInfo>;
  onManageBundle?: (contractId: string) => void;
  allContracts?: Contract[];
}) {
  const contractList = Object.values(contracts);
  const totalDocs = contractList.reduce((sum, c) => sum + c.documents.length, 0);
  const avgCompleteness = Math.round(
    contractList.reduce((sum, c) => sum + c.completeness.percentage, 0) / Math.max(contractList.length, 1)
  );
  const highPriorityCount = contractList.filter(c => c.priority.category === 'critical' || c.priority.category === 'high').length;

  return (
    <div className={`${tokens.bg.card} ${tokens.radius.card} border ${tokens.border.default} ${tokens.shadow.card} overflow-hidden`}>
      {/* Account Header */}
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between p-4 hover:${tokens.bg.hover} transition-colors`}
      >
        <div className="flex items-center gap-3">
          <motion.div
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ duration: 0.2 }}
            className={tokens.text.muted}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </motion.div>
          <div className="text-left">
            <h3 className={`${tokens.text.primary} font-semibold`}>{accountName}</h3>
            <p className={`${tokens.text.muted} text-sm`}>
              {contractList.length} contract{contractList.length !== 1 ? 's' : ''} &bull; {totalDocs} documents
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {highPriorityCount > 0 && (
            <span className={`px-2.5 py-1 ${tokens.status.danger.bg} ${tokens.status.danger.text} text-xs font-medium rounded-md`}>
              {highPriorityCount} need attention
            </span>
          )}
          <div className="flex items-center gap-2">
            <div className={`w-24 h-1.5 ${tokens.bg.input} rounded-full overflow-hidden`}>
              <div
                className="h-full bg-[#3B82F6] transition-all rounded-full"
                style={{ width: `${avgCompleteness}%` }}
              />
            </div>
            <span className={`${tokens.text.muted} text-sm tabular-nums w-10`}>{avgCompleteness}%</span>
          </div>
        </div>
      </button>

      {/* Contracts List */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className={`border-t ${tokens.border.subtle}`}>
              {contractList
                .sort((a, b) => b.priority.score - a.priority.score)
                .map((contract) => (
                  <ContractCard
                    key={contract.contractId}
                    contract={contract}
                    onUpload={onUpload}
                    accountName={accountName}
                    uploadingKey={uploadingKey}
                    documentTypes={documentTypes}
                    bundleInfo={bundleInfoMap?.[contract.contractId]}
                    onManageBundle={onManageBundle ? () => onManageBundle(contract.contractId) : undefined}
                    allContracts={allContracts}
                  />
                ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Contract Card Component with Progress-First Document View
function ContractCard({
  contract,
  onUpload,
  accountName,
  uploadingKey,
  documentTypes,
  bundleInfo,
  onManageBundle,
  allContracts,
}: {
  contract: ContractDocuments;
  onUpload: (file: File, type: string, contractId: string, contractName: string, accountName: string) => void;
  accountName: string;
  uploadingKey: string | null;
  documentTypes: string[];
  bundleInfo?: BundleInfo | null;
  onManageBundle?: () => void;
  allContracts?: Contract[];
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Find the matching contract for contract type
  const matchingContract = allContracts?.find(c => c.id === contract.contractId || c.salesforceId === contract.contractId);
  const contractTypes = matchingContract?.contractType || [];

  // Convert documents to DocumentData format for DocumentsProgressView
  const documentData: DocumentData[] = useMemo(() => {
    return contract.documents
      .filter(d => d.is_current_version)
      .map(d => ({
        id: d.id,
        document_type: d.document_type,
        file_name: d.file_name,
        file_url: d.file_url,
        file_size: d.file_size || undefined,
        uploaded_at: d.uploaded_at,
        uploaded_by: d.uploaded_by || undefined,
        source_contract: d.fromBundledContract ? {
          id: d.fromBundledContract,
          name: d.opportunity_name || 'Bundled Contract',
        } : undefined,
      }));
  }, [contract.documents]);

  // Convert BundleInfo to format expected by DocumentsProgressView
  const bundleForView = bundleInfo ? {
    id: bundleInfo.bundleId,
    name: bundleInfo.bundleName,
    contracts: bundleInfo.contracts.map(c => ({
      id: c.id,
      name: c.name,
      is_primary: c.isPrimary,
    })),
  } : null;

  // Handle upload from DocumentsProgressView
  const handleProgressUpload = async (file: File, type: string) => {
    onUpload(file, type, contract.contractId, contract.contractName, accountName);
  };

  // Handle delete (placeholder - needs API implementation)
  const handleDelete = async (doc: DocumentData) => {
    console.log('Delete document:', doc.id);
    // TODO: Implement delete API call
  };

  return (
    <div className={`border-b ${tokens.border.subtle} last:border-0 group`}>
      {/* Contract Header - Slimmed down */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between py-3 px-4 pl-8 hover:${tokens.bg.elevated} transition-colors`}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <motion.div
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ duration: 0.2 }}
            className={`${tokens.text.muted} flex-shrink-0`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </motion.div>

          {/* Priority Dot with Tooltip */}
          <PriorityDot category={contract.priority.category} />

          {/* Contract info - single line dominant */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <h4 className={`${tokens.text.primary} font-medium truncate text-[15px]`}>{contract.contractName}</h4>
            {/* Tags inline, more subtle */}
            <div className="hidden sm:flex items-center gap-1.5">
              {contractTypes.slice(0, 2).map((type) => (
                <span
                  key={type}
                  className={`px-1.5 py-0.5 ${tokens.bg.elevated} ${tokens.text.muted} text-[11px] ${tokens.radius.control}`}
                >
                  {type}
                </span>
              ))}
              {bundleInfo && (
                <span className={`px-1.5 py-0.5 ${tokens.bg.elevated} ${tokens.text.muted} text-[11px] ${tokens.radius.control}`}>
                  Bundled
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right side: progress + due on same line */}
        <div className="flex items-center gap-4 flex-shrink-0 ml-4">
          {contract.priority.reasons.length > 0 && (
            <span className={`${tokens.text.muted} text-xs hidden md:block`}>
              {contract.priority.reasons[0]}
            </span>
          )}
          <div className="flex items-center gap-2">
            <span className={`${tokens.text.muted} text-xs tabular-nums`}>
              {contract.completeness.required}/4
            </span>
            <div className={`w-12 h-1 ${tokens.bg.input} rounded-full overflow-hidden`}>
              <div
                className="h-full bg-[#5B8DEF] rounded-full transition-all"
                style={{ width: `${contract.completeness.percentage}%` }}
              />
            </div>
          </div>
        </div>
      </button>

      {/* Progress-First Document View - Elevated for focus */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className={`px-4 py-4 pl-12 ${tokens.bg.elevated} border-t ${tokens.border.default} ${tokens.shadow.inner}`}>
              <DocumentsProgressView
                contractId={contract.contractId}
                contractName={contract.contractName}
                documents={documentData}
                bundle={bundleForView}
                onUpload={handleProgressUpload}
                onDelete={handleDelete}
                onManageBundle={onManageBundle}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Priority Contract Card (for Needs Attention view) - PREMIUM VISUAL DESIGN
function PriorityCard({
  contract,
  accountName,
  onUpload,
  uploadingKey,
  documentTypes,
  contracts,
  index = 0,
}: {
  contract: ContractDocuments & { accountName?: string };
  accountName: string;
  onUpload: (file: File, type: string, contractId: string, contractName: string, accountName: string) => void;
  uploadingKey: string | null;
  documentTypes: string[];
  contracts?: Contract[];
  index?: number;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Get priority visual config
  const priorityConfig = PRIORITY_ACCENT[contract.priority.category];
  const priorityColor = priorityConfig.color;

  // Find the matching contract for additional details
  const matchingContract = contracts?.find(c => c.id === contract.contractId || c.salesforceId === contract.contractId);
  const contractTypes = matchingContract?.contractType || [];
  const salesforceId = matchingContract?.salesforceId;

  // Convert documents to DocumentData format for DocumentsProgressView
  const documentData: DocumentData[] = useMemo(() => {
    return contract.documents
      .filter(d => d.is_current_version)
      .map(d => ({
        id: d.id,
        document_type: d.document_type,
        file_name: d.file_name,
        file_url: d.file_url,
        file_size: d.file_size || undefined,
        uploaded_at: d.uploaded_at,
        uploaded_by: d.uploaded_by || undefined,
        source_contract: d.fromBundledContract ? {
          id: d.fromBundledContract,
          name: d.opportunity_name || 'Bundled Contract',
        } : undefined,
      }));
  }, [contract.documents]);

  // Handle upload from DocumentsProgressView
  const handleProgressUpload = async (file: File, type: string) => {
    onUpload(file, type, contract.contractId, contract.contractName, accountName);
  };

  // Handle delete (placeholder - needs API implementation)
  const handleDelete = async (doc: DocumentData) => {
    console.log('Delete document:', doc.id);
  };

  // Progress bar color based on completion
  const progressColor = contract.completeness.percentage >= 100
    ? colors.accent.green
    : contract.completeness.percentage >= 50
    ? colors.accent.blue
    : priorityColor;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        delay: index * 0.05,
        duration: 0.4,
        ease: [0.25, 0.46, 0.45, 0.94]
      }}
      whileHover={{
        y: -4,
        scale: 1.01,
        boxShadow: priorityConfig.glowShadow,
        transition: { type: "spring", stiffness: 400, damping: 25 }
      }}
      whileTap={{ scale: 0.98 }}
      className={`
        relative overflow-hidden rounded-xl cursor-pointer
        bg-gradient-to-br ${priorityConfig.gradient}
        border ${priorityConfig.borderColor} ${priorityConfig.hoverBg}
        transition-all duration-200
        group
      `}
    >
      {/* LEFT ACCENT BAR WITH GLOW */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
        style={{
          background: priorityColor,
          boxShadow: `0 0 8px ${priorityColor}60, 0 0 20px ${priorityColor}30`,
        }}
      />

      {/* Card Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 pl-5 text-left hover:bg-white/[0.02] transition-all duration-200"
      >
        {/* Row 1: Priority icon + Contract name + Progress */}
        <div className="flex items-center gap-3">
          {/* Priority Icon Container with Gradient Background */}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: `linear-gradient(135deg, ${priorityColor}25, ${priorityColor}10)`,
              boxShadow: `0 0 20px ${priorityColor}15`,
            }}
          >
            <StatusDot
              color={PRIORITY_META[contract.priority.category].color}
              size="md"
              pulse={contract.priority.category === 'critical'}
            />
          </div>

          {/* Contract Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-white font-semibold truncate text-[15px]">
                {contract.contractName}
              </h3>
              {/* Tags with color coding */}
              {contractTypes.slice(0, 1).map((type) => (
                <span
                  key={type}
                  className="px-2 py-0.5 bg-white/10 text-white/60 text-[11px] rounded-md hidden sm:inline border border-white/5"
                >
                  {type}
                </span>
              ))}
            </div>
            <p className="text-white/50 text-sm truncate">{accountName}</p>
          </div>

          {/* Progress Bar with Animation */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-white/40 text-xs tabular-nums font-medium">
              {contract.completeness.required}/4
            </span>
            <div className="w-16 h-2 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${contract.completeness.percentage}%` }}
                transition={{ duration: 0.8, ease: "easeOut", delay: index * 0.05 + 0.2 }}
                className="h-full rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${progressColor}, ${progressColor}CC)`,
                  boxShadow: contract.completeness.percentage > 50
                    ? `0 0 12px ${progressColor}50`
                    : undefined,
                }}
              />
            </div>
          </div>
        </div>

        {/* Row 2: Status reason + Expand */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.06]">
          {/* Priority Badge */}
          <div className="flex items-center gap-2">
            <span
              className="px-2.5 py-1 rounded-full text-xs font-medium border"
              style={{
                background: `${priorityColor}15`,
                color: priorityColor,
                borderColor: `${priorityColor}30`,
              }}
            >
              {contract.priority.reasons[0] || 'On track'}
            </span>
          </div>

          {/* Expand Button */}
          <div className="flex items-center gap-1.5 text-white/40 text-xs group-hover:text-white/60 transition-colors">
            <motion.svg
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </motion.svg>
            <span className="hidden sm:inline font-medium">
              {isExpanded ? 'Hide' : 'Manage'}
            </span>
          </div>
        </div>
      </button>

      {/* Expanded Document View */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{
              height: 'auto',
              opacity: 1,
              transition: {
                height: { duration: 0.3 },
                opacity: { duration: 0.2, delay: 0.1 }
              }
            }}
            exit={{
              height: 0,
              opacity: 0,
              transition: {
                height: { duration: 0.2 },
                opacity: { duration: 0.1 }
              }
            }}
            className="overflow-hidden"
          >
            <div
              className="px-4 py-4 pl-5 border-t border-white/[0.08]"
              style={{ background: 'rgba(0,0,0,0.2)' }}
            >
              <DocumentsProgressView
                contractId={contract.contractId}
                contractName={contract.contractName}
                documents={documentData}
                onUpload={handleProgressUpload}
                onDelete={handleDelete}
              />
            </div>

            {/* Action Buttons with Premium Styling */}
            <div className="flex items-center gap-2 px-4 pb-4 pl-5">
              {/* Primary Button */}
              <button className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white/80 hover:text-white text-sm font-medium transition-all duration-200">
                View Contract
              </button>

              {/* Salesforce Link - Accent Style */}
              {salesforceId && (
                <a
                  href={`https://marscompany.lightning.force.com/lightning/r/Opportunity/${salesforceId}/view`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-xl text-cyan-400 text-sm font-medium transition-all duration-200 flex items-center gap-1.5"
                  title="Open in Salesforce"
                  onClick={(e) => e.stopPropagation()}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  SF
                </a>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Filter Chip Component
function FilterChip({
  label,
  value,
  onRemove,
}: {
  label: string;
  value: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#3B82F6]/10 text-[#3B82F6] text-xs font-medium rounded-md border border-[#3B82F6]/20">
      <span className="text-[#94A3B8]">{label}:</span>
      <span>{value}</span>
      <button onClick={onRemove} className="ml-0.5 p-0.5 hover:bg-[#3B82F6]/20 rounded transition-colors">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </span>
  );
}

// Sort options
type SortField = 'name' | 'date' | 'priority' | 'completeness';
type SortDirection = 'asc' | 'desc';

// Main Smart Documents Tab Component
export default function SmartDocumentsTab({ contracts }: { contracts: Contract[] }) {
  // State
  const [data, setData] = useState<DocumentsData | null>(null);
  const [loading, setLoading] = useState(true);


  // Fetch documents data
  const fetchDocuments = useCallback(async () => {
    try {
      const response = await fetch('/api/contracts/documents');
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Handle file upload
  const handleUpload = async (
    file: File,
    documentType: string,
    contractId: string,
    contractName: string,
    accountName: string
  ) => {
    try {
      // In production, upload to S3/Supabase storage first
      // For now, create document record with placeholder URL
      const response = await fetch('/api/contracts/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractId,
          accountName,
          opportunityName: contractName,
          documentType,
          fileName: file.name,
          fileUrl: `#local:${file.name}`, // Placeholder
          fileSize: file.size,
          fileMimeType: file.type,
          status: 'draft',
          notes: `Uploaded: ${file.name} (${formatFileSize(file.size)})`,
        }),
      });

      if (response.ok) {
        await fetchDocuments();
      }
    } catch (err) {
      console.error('Upload failed:', err);
    }
  };

  // Compute stats for KPI cards
  const stats = useMemo(() => {
    if (!data) return { closingSoon: 0, budgeted: 0 };

    const allContracts = Object.values(data.byAccount).flatMap(account =>
      Object.values(account.contracts)
    );

    // Count contracts closing soon (within 90 days)
    const closingSoon = allContracts.filter(c => {
      const contract = contracts.find(ct => ct.id === c.contractId || ct.salesforceId === c.contractId);
      if (!contract) return false;
      const targetDateStr = contract.closeDate || contract.contractDate || contract.awardDate;
      if (!targetDateStr) return false;
      const targetDate = new Date(targetDateStr);
      const daysUntil = Math.floor((targetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return daysUntil >= 0 && daysUntil <= 90;
    }).length;

    // Count budgeted contracts
    const budgeted = allContracts.filter(c => {
      const contract = contracts.find(ct => ct.id === c.contractId || ct.salesforceId === c.contractId);
      return contract?.budgeted === true;
    }).length;

    return { closingSoon, budgeted };
  }, [data, contracts]);

  // Transform documents to DocumentItem format for DocumentListView
  const documentItems: DocumentItem[] = useMemo(() => {
    if (!data) return [];

    const items: DocumentItem[] = [];

    // Add all existing documents
    data.documents.filter(d => d.is_current_version).forEach(doc => {
      items.push({
        id: doc.id,
        document_type: doc.document_type,
        file_name: doc.file_name,
        file_url: doc.file_url,
        file_size: doc.file_size || undefined,
        uploaded_at: doc.uploaded_at,
        uploaded_by: doc.uploaded_by || undefined,
        status: (doc.status as DocumentItem['status']) || 'draft',
        contract_id: doc.contract_id || '',
        contract_name: doc.opportunity_name || 'Unknown Contract',
        account_name: doc.account_name,
        is_required: REQUIRED_DOCUMENT_TYPES.includes(doc.document_type),
        version: doc.version,
      });
    });

    // Add missing required documents as placeholders
    Object.values(data.byAccount).forEach(account => {
      Object.values(account.contracts).forEach(contract => {
        contract.completeness.missingRequired.forEach(docType => {
          // Only add if not already in items
          const exists = items.some(
            item => item.contract_id === contract.contractId && item.document_type === docType
          );
          if (!exists) {
            items.push({
              id: `missing-${contract.contractId}-${docType}`,
              document_type: docType,
              file_name: '',
              file_url: '',
              status: 'missing',
              contract_id: contract.contractId,
              contract_name: contract.contractName,
              account_name: account.accountName,
              is_required: true,
            });
          }
        });
      });
    });

    return items;
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className={`w-8 h-8 border-2 ${tokens.border.focus} border-t-transparent rounded-full animate-spin`} />
      </div>
    );
  }

  return (
    <div className={`${tokens.spacing.section}`}>
      {/* KPI Strip - Stats only */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <KPICard
          title="Total Documents"
          value={data?.stats.totalDocuments || 0}
          subtitle={`${data?.stats.totalContracts || 0} contracts`}
          icon={KPIIcons.document}
          color={colors.accent.blue}
          delay={0.1}
        />
        <KPICard
          title="Needs Attention"
          value={data?.stats.needsAttention || 0}
          subtitle="Missing docs or overdue"
          icon={KPIIcons.warning}
          color={colors.accent.red}
          delay={0.2}
          badge={data?.stats.needsAttention}
        />
        <KPICard
          title="Closing Soon"
          value={stats.closingSoon}
          subtitle="Within 90 days"
          icon={KPIIcons.calendar}
          color={colors.accent.amber}
          delay={0.3}
        />
        <KPICard
          title="Budgeted"
          value={stats.budgeted}
          subtitle="Forecasted deals"
          icon={KPIIcons.dollar}
          color={colors.accent.purple}
          delay={0.4}
        />
        <KPICard
          title="Complete"
          value={data?.stats.complete || 0}
          subtitle={`${data?.stats.averageCompleteness || 0}% avg completion`}
          icon={KPIIcons.checkCircle}
          color={colors.accent.green}
          delay={0.5}
        />
      </div>

      {/* Single Column Document List with Side Drawer */}
      <DocumentListView
        documents={documentItems}
        onUpload={(file, documentType, contractId) => {
          const docItem = documentItems.find(d => d.contract_id === contractId && d.document_type === documentType);
          handleUpload(file, documentType, contractId, docItem?.contract_name || '', docItem?.account_name || '');
        }}
        onDownload={(doc) => {
          if (doc.file_url && !doc.file_url.startsWith('#')) {
            window.open(doc.file_url, '_blank');
          }
        }}
        onDelete={async (doc) => {
          console.log('Delete document:', doc.id);
          await fetchDocuments();
        }}
      />
    </div>
  );
}
