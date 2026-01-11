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

type SmartView = 'list' | 'needs_attention' | 'closing_soon' | 'budgeted' | 'by_account' | 'recent' | 'all';

const SMART_VIEWS: { id: SmartView; label: string; icon: string; description: string }[] = [
  { id: 'list', label: 'All Documents', icon: 'list', description: 'Simple list with side drawer' },
  { id: 'needs_attention', label: 'Needs Attention', icon: '!', description: 'Missing docs, overdue, or stalled' },
  { id: 'closing_soon', label: 'Closing Soon', icon: 'calendar', description: 'Due in next 90 days' },
  { id: 'budgeted', label: 'Budgeted', icon: 'dollar', description: 'Budgeted/forecasted opportunities' },
  { id: 'by_account', label: 'By Account', icon: 'folder', description: 'Organized by account hierarchy' },
  { id: 'recent', label: 'Recently Updated', icon: 'clock', description: 'Last 7 days activity' },
];

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
  const [activeView, setActiveView] = useState<SmartView>('list');
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [sortField, setSortField] = useState<SortField>('priority');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [previewDoc, setPreviewDoc] = useState<DocumentData | null>(null);

  // Filters
  const [filters, setFilters] = useState<{
    documentType: string | null;
    status: string | null;
    accountName: string | null;
  }>({
    documentType: null,
    status: null,
    accountName: null,
  });

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

  // Load saved views from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('documentSavedViews');
    if (stored) {
      try {
        setSavedViews(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse saved views:', e);
      }
    }
  }, []);

  // Handle file upload
  const handleUpload = async (
    file: File,
    documentType: string,
    contractId: string,
    contractName: string,
    accountName: string
  ) => {
    const uploadKey = `${contractId}-${documentType}`;
    setUploadingKey(uploadKey);

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
    } finally {
      setUploadingKey(null);
    }
  };

  // Toggle account expansion
  const toggleAccount = (accountName: string) => {
    setExpandedAccounts(prev => {
      const next = new Set(prev);
      if (next.has(accountName)) {
        next.delete(accountName);
      } else {
        next.add(accountName);
      }
      return next;
    });
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({ documentType: null, status: null, accountName: null });
    setSearchQuery('');
  };

  // Save current view
  const saveCurrentView = () => {
    const name = prompt('Enter a name for this view:');
    if (!name) return;

    const newView: SavedView = {
      id: Date.now().toString(),
      name,
      filters: {
        view: activeView,
        documentType: filters.documentType || undefined,
        status: filters.status || undefined,
        accountName: filters.accountName || undefined,
      },
    };

    const updated = [...savedViews, newView];
    setSavedViews(updated);
    localStorage.setItem('documentSavedViews', JSON.stringify(updated));
  };

  // Sort contracts helper
  const sortContracts = useCallback((contractList: (ContractDocuments & { accountName: string })[]) => {
    return [...contractList].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.contractName.localeCompare(b.contractName);
          break;
        case 'priority':
          comparison = b.priority.score - a.priority.score;
          break;
        case 'completeness':
          comparison = b.completeness.percentage - a.completeness.percentage;
          break;
        case 'date':
          // Use contract close date or uploaded_at from latest document
          const dateA = a.documents[0]?.uploaded_at || '';
          const dateB = b.documents[0]?.uploaded_at || '';
          comparison = new Date(dateB).getTime() - new Date(dateA).getTime();
          break;
      }
      return sortDirection === 'asc' ? -comparison : comparison;
    });
  }, [sortField, sortDirection]);

  // Filter and sort data based on active view
  const filteredData = useMemo(() => {
    if (!data) return { accounts: [], priorityContracts: [], recentDocs: [] };

    const accounts = Object.entries(data.byAccount);

    // Apply search filter
    let filtered = accounts;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = accounts.filter(([name, account]) =>
        name.toLowerCase().includes(query) ||
        Object.values(account.contracts).some(c =>
          c.contractName.toLowerCase().includes(query) ||
          c.documents.some(d => d.file_name.toLowerCase().includes(query))
        )
      );
    }

    // Apply other filters
    if (filters.accountName) {
      filtered = filtered.filter(([name]) => name === filters.accountName);
    }

    // Sort accounts alphabetically
    filtered = [...filtered].sort(([nameA], [nameB]) => {
      const comparison = nameA.localeCompare(nameB);
      return sortField === 'name' ? (sortDirection === 'asc' ? comparison : -comparison) : comparison;
    });

    // Get priority contracts for needs attention view
    const allContracts = filtered.flatMap(([accountName, account]) =>
      Object.values(account.contracts).map(c => ({ ...c, accountName }))
    );

    const priorityContracts = sortContracts(
      allContracts.filter(c => c.priority.category === 'critical' || c.priority.category === 'high')
    );

    // Get contracts closing soon (any date within 90 days)
    const closingSoonContracts = allContracts
      .filter(c => {
        const contract = contracts.find(ct => ct.id === c.contractId || ct.salesforceId === c.contractId);
        if (!contract) return false;
        // Check any relevant date field
        const targetDateStr = contract.closeDate || contract.contractDate || contract.awardDate;
        if (!targetDateStr) return false;
        const targetDate = new Date(targetDateStr);
        const daysUntil = Math.floor((targetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return daysUntil >= 0 && daysUntil <= 90;
      })
      .sort((a, b) => {
        const contractA = contracts.find(c => c.id === a.contractId || c.salesforceId === a.contractId);
        const contractB = contracts.find(c => c.id === b.contractId || c.salesforceId === b.contractId);
        const dateA = new Date(contractA?.closeDate || contractA?.contractDate || contractA?.awardDate || 0);
        const dateB = new Date(contractB?.closeDate || contractB?.contractDate || contractB?.awardDate || 0);
        return dateA.getTime() - dateB.getTime();
      });

    // Get budgeted contracts
    const budgetedContracts = sortContracts(
      allContracts.filter(c => {
        const contract = contracts.find(ct => ct.id === c.contractId || ct.salesforceId === c.contractId);
        return contract?.budgeted === true;
      })
    );

    // Get recent documents
    const recentDocs = data.documents
      .filter(d => {
        const uploadedDate = new Date(d.uploaded_at);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return uploadedDate >= sevenDaysAgo;
      })
      .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());

    return {
      accounts: filtered,
      priorityContracts,
      closingSoonContracts,
      budgetedContracts,
      recentDocs,
    };
  }, [data, searchQuery, filters, contracts, sortContracts]);

  // Active filter chips
  const activeFilters = Object.entries(filters)
    .filter(([, value]) => value !== null)
    .map(([key, value]) => ({ key, value: value as string }));

  // Risk distribution for hero visual
  const riskDistribution = useMemo(() => {
    if (!data) return { critical: 0, high: 0, medium: 0, low: 0, total: 0 };

    const allContracts = Object.values(data.byAccount).flatMap(account =>
      Object.values(account.contracts)
    );

    return {
      critical: allContracts.filter(c => c.priority.category === 'critical').length,
      high: allContracts.filter(c => c.priority.category === 'high').length,
      medium: allContracts.filter(c => c.priority.category === 'medium').length,
      low: allContracts.filter(c => c.priority.category === 'low').length,
      total: allContracts.length,
    };
  }, [data]);

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

  // Expand/collapse all accounts
  const expandAll = () => {
    if (data) {
      setExpandedAccounts(new Set(Object.keys(data.byAccount)));
    }
  };

  const collapseAll = () => {
    setExpandedAccounts(new Set());
  };

  return (
    <div className={`${tokens.spacing.section}`}>
      {/* KPI Strip - 5 tiles, reduced saturation colors */}
      <div className="grid grid-cols-5 gap-4">
        <KPICard
          title="Total Documents"
          value={data?.stats.totalDocuments || 0}
          subtitle={`${data?.stats.totalContracts || 0} contracts`}
          icon={KPIIcons.document}
          color={colors.accent.blue}
          delay={0.1}
          isActive={activeView === 'all'}
          onClick={() => setActiveView('all')}
        />
        <KPICard
          title="Needs Attention"
          value={data?.stats.needsAttention || 0}
          subtitle="Missing docs or overdue"
          icon={KPIIcons.warning}
          color={colors.accent.red}
          delay={0.2}
          isActive={activeView === 'needs_attention'}
          onClick={() => setActiveView('needs_attention')}
          badge={data?.stats.needsAttention}
        />
        <KPICard
          title="Closing Soon"
          value={filteredData.closingSoonContracts?.length || 0}
          subtitle="Within 90 days"
          icon={KPIIcons.calendar}
          color={colors.accent.amber}
          delay={0.3}
          isActive={activeView === 'closing_soon'}
          onClick={() => setActiveView('closing_soon')}
        />
        <KPICard
          title="Budgeted"
          value={filteredData.budgetedContracts?.length || 0}
          subtitle="Forecasted deals"
          icon={KPIIcons.dollar}
          color={colors.accent.purple}
          delay={0.4}
          isActive={activeView === 'budgeted'}
          onClick={() => setActiveView('budgeted')}
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

      {/* Hero Visual: Risk Distribution */}
      <RiskDistributionBar
        critical={riskDistribution.critical}
        high={riskDistribution.high}
        medium={riskDistribution.medium}
        low={riskDistribution.low}
        total={riskDistribution.total}
      />

      {/* Segmented Control Tabs - sits on section layer */}
      <div className={`flex items-center p-1 ${tokens.bg.section} ${tokens.radius.control} border ${tokens.border.default}`}>
        {SMART_VIEWS.map((view, index) => (
          <button
            key={view.id}
            onClick={() => setActiveView(view.id)}
            className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
              index === 0 ? 'rounded-l-md' : index === SMART_VIEWS.length - 1 ? 'rounded-r-md' : ''
            } ${
              activeView === view.id
                ? `${tokens.bg.elevated} ${tokens.text.primary} shadow-sm`
                : `${tokens.text.muted} hover:${tokens.text.secondary}`
            }`}
          >
            {/* Active indicator bar - elevated from section */}
            {activeView === view.id && (
              <motion.div
                layoutId="activeTab"
                className={`absolute inset-0 ${tokens.bg.card} ${tokens.radius.control} -z-10 ${tokens.shadow.card}`}
                transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
              />
            )}
            {view.id === 'needs_attention' && (
              <span className={`min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center text-xs font-semibold ${
                activeView === view.id
                  ? 'bg-red-500 text-white'
                  : 'bg-red-500/20 text-red-400'
              }`}>
                {data?.stats.needsAttention || 0}
              </span>
            )}
            <span>{view.label}</span>
          </button>
        ))}
      </div>

      {/* Search and Filters Row */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="flex-1 relative">
          <svg
            className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${tokens.text.muted}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search accounts, contracts, or documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-10 pr-4 py-2.5 ${tokens.bg.input} border ${tokens.border.default} ${tokens.radius.control} ${tokens.text.primary} placeholder-[#64748B] text-sm focus:outline-none focus:${tokens.border.focus} transition-colors`}
          />
        </div>

        {/* Filter Controls Group */}
        <div className={`flex items-center gap-1 p-1 ${tokens.bg.card} ${tokens.radius.control} border ${tokens.border.subtle}`}>
          {/* Document Type Filter */}
          <select
            value={filters.documentType || ''}
            onChange={(e) => setFilters(f => ({ ...f, documentType: e.target.value || null }))}
            className={`px-3 py-2 ${tokens.bg.card} ${tokens.text.secondary} text-sm ${tokens.radius.control} border-0 focus:outline-none cursor-pointer hover:${tokens.text.primary} transition-colors`}
          >
            <option value="">All Types</option>
            {DOCUMENT_TYPES.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>

          <div className="w-px h-6 bg-[#262D3A]" />

          {/* Sort Dropdown */}
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value as SortField)}
            className={`px-3 py-2 ${tokens.bg.card} ${tokens.text.secondary} text-sm ${tokens.radius.control} border-0 focus:outline-none cursor-pointer hover:${tokens.text.primary} transition-colors`}
          >
            <option value="priority">Priority</option>
            <option value="name">Name</option>
            <option value="completeness">Completion</option>
            <option value="date">Date</option>
          </select>

          {/* Sort Direction Toggle */}
          <button
            onClick={() => setSortDirection(d => d === 'asc' ? 'desc' : 'asc')}
            className={`p-2 ${tokens.text.muted} hover:${tokens.text.primary} ${tokens.radius.control} hover:${tokens.bg.elevated} transition-colors`}
            title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
          >
            {sortDirection === 'asc' ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
              </svg>
            )}
          </button>
        </div>

        {/* Save View Button */}
        <button
          onClick={saveCurrentView}
          className={`px-3 py-2.5 ${tokens.bg.card} border ${tokens.border.subtle} ${tokens.radius.control} ${tokens.text.muted} hover:${tokens.text.primary} text-sm font-medium transition-colors flex items-center gap-2`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
          Save
        </button>
      </div>

      {/* Active Filter Chips */}
      {(activeFilters.length > 0 || searchQuery) && (
        <div className="flex items-center gap-2 flex-wrap">
          {searchQuery && (
            <FilterChip
              label="Search"
              value={searchQuery}
              onRemove={() => setSearchQuery('')}
            />
          )}
          {activeFilters.map(({ key, value }) => (
            <FilterChip
              key={key}
              label={key.replace(/([A-Z])/g, ' $1').trim()}
              value={value}
              onRemove={() => setFilters(f => ({ ...f, [key]: null }))}
            />
          ))}
          <button
            onClick={clearFilters}
            className={`${tokens.text.muted} hover:${tokens.text.primary} text-xs font-medium transition-colors`}
          >
            Clear all
          </button>
        </div>
      )}

      {/* Content based on active view */}
      <div className="space-y-4">
        {/* List View - Simple flat list with side drawer */}
        {activeView === 'list' && (
          <DocumentListView
            documents={documentItems}
            onUpload={(file, documentType, contractId) => {
              // Find the document item to get contract_name and account_name
              const docItem = documentItems.find(d => d.contract_id === contractId && d.document_type === documentType);
              handleUpload(file, documentType, contractId, docItem?.contract_name || '', docItem?.account_name || '');
            }}
            onDownload={(doc) => {
              if (doc.file_url && !doc.file_url.startsWith('#')) {
                window.open(doc.file_url, '_blank');
              }
            }}
            onDelete={async (doc) => {
              // TODO: Implement delete API call
              console.log('Delete document:', doc.id);
              await fetchDocuments();
            }}
          />
        )}

        {activeView === 'needs_attention' && (
          <>
            {filteredData.priorityContracts.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className={`text-center py-20 ${tokens.bg.card} ${tokens.radius.card} border ${tokens.border.subtle}`}
              >
                <div
                  className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center border border-white/10"
                  style={{
                    background: 'linear-gradient(135deg, rgba(48,164,108,0.2), rgba(48,164,108,0.05))',
                    boxShadow: '0 0 40px rgba(48,164,108,0.15)',
                  }}
                >
                  <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">All caught up!</h3>
                <p className="text-white/50 text-sm max-w-md mx-auto">
                  No contracts need immediate attention. Great work keeping everything on track.
                </p>
              </motion.div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {filteredData.priorityContracts.map((contract, index) => (
                  <PriorityCard
                    key={contract.contractId}
                    contract={contract}
                    accountName={contract.accountName}
                    onUpload={handleUpload}
                    uploadingKey={uploadingKey}
                    index={index}
                    documentTypes={data?.requiredTypes || []}
                    contracts={contracts}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {activeView === 'closing_soon' && (
          <>
            {filteredData.closingSoonContracts?.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className={`text-center py-20 ${tokens.bg.card} ${tokens.radius.card} border ${tokens.border.subtle}`}
              >
                <div
                  className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center border border-white/10"
                  style={{
                    background: 'linear-gradient(135deg, rgba(212,167,44,0.2), rgba(212,167,44,0.05))',
                    boxShadow: '0 0 40px rgba(212,167,44,0.15)',
                  }}
                >
                  <svg className="w-10 h-10 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">No upcoming deadlines</h3>
                <p className="text-white/50 text-sm max-w-md mx-auto">
                  No contracts closing in the next 90 days. Check back later for updates.
                </p>
              </motion.div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {filteredData.closingSoonContracts?.map((contract, index) => (
                  <PriorityCard
                    key={contract.contractId}
                    contract={contract}
                    accountName={contract.accountName}
                    onUpload={handleUpload}
                    uploadingKey={uploadingKey}
                    index={index}
                    documentTypes={data?.documentTypes || []}
                    contracts={contracts}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {activeView === 'budgeted' && (
          <>
            {filteredData.budgetedContracts?.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className={`text-center py-20 ${tokens.bg.card} ${tokens.radius.card} border ${tokens.border.subtle}`}
              >
                <div
                  className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center border border-white/10"
                  style={{
                    background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(139,92,246,0.05))',
                    boxShadow: '0 0 40px rgba(139,92,246,0.15)',
                  }}
                >
                  <svg className="w-10 h-10 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">No budgeted contracts</h3>
                <p className="text-white/50 text-sm max-w-md mx-auto">
                  No contracts are marked as budgeted or forecasted. Update contract status in Salesforce.
                </p>
              </motion.div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {filteredData.budgetedContracts?.map((contract, index) => (
                  <PriorityCard
                    key={contract.contractId}
                    contract={contract}
                    accountName={contract.accountName}
                    onUpload={handleUpload}
                    uploadingKey={uploadingKey}
                    index={index}
                    documentTypes={data?.documentTypes || []}
                    contracts={contracts}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {activeView === 'by_account' && (
          <div className="space-y-3">
            {/* Expand/Collapse All Buttons */}
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={expandAll}
                className={`px-3 py-1.5 text-sm ${tokens.text.secondary} hover:${tokens.text.primary} ${tokens.bg.card} hover:${tokens.bg.elevated} ${tokens.radius.control} transition-colors`}
              >
                Expand All
              </button>
              <button
                onClick={collapseAll}
                className={`px-3 py-1.5 text-sm ${tokens.text.secondary} hover:${tokens.text.primary} ${tokens.bg.card} hover:${tokens.bg.elevated} ${tokens.radius.control} transition-colors`}
              >
                Collapse All
              </button>
            </div>
            {filteredData.accounts.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className={`text-center py-20 ${tokens.bg.card} ${tokens.radius.card} border ${tokens.border.subtle}`}
              >
                <div
                  className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center border border-white/10"
                  style={{
                    background: 'linear-gradient(135deg, rgba(91,141,239,0.2), rgba(139,92,246,0.1))',
                    boxShadow: '0 0 40px rgba(91,141,239,0.12)',
                  }}
                >
                  <svg className="w-10 h-10 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">No accounts found</h3>
                <p className="text-white/50 text-sm max-w-md mx-auto">
                  Try adjusting your search or filters to find accounts.
                </p>
              </motion.div>
            ) : (
              filteredData.accounts.map(([accountName, account]) => (
                <AccountSection
                  key={accountName}
                  accountName={accountName}
                  contracts={account.contracts}
                  isExpanded={expandedAccounts.has(accountName)}
                  onToggle={() => toggleAccount(accountName)}
                  onUpload={handleUpload}
                  uploadingKey={uploadingKey}
                  documentTypes={data?.documentTypes || []}
                  allContracts={contracts}
                />
              ))
            )}
          </div>
        )}

        {activeView === 'recent' && (
          <div className={`${tokens.bg.card} ${tokens.radius.card} border ${tokens.border.subtle} overflow-hidden`}>
            {filteredData.recentDocs.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-center py-20"
              >
                <div
                  className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center border border-white/10"
                  style={{
                    background: 'linear-gradient(135deg, rgba(56,189,248,0.2), rgba(91,141,239,0.1))',
                    boxShadow: '0 0 40px rgba(56,189,248,0.12)',
                  }}
                >
                  <svg className="w-10 h-10 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">No recent activity</h3>
                <p className="text-white/50 text-sm max-w-md mx-auto">
                  No documents have been uploaded in the last 7 days.
                </p>
              </motion.div>
            ) : (
              <div className={`divide-y ${tokens.border.subtle}`}>
                {filteredData.recentDocs.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => setPreviewDoc({
                      id: doc.id,
                      document_type: doc.document_type,
                      file_name: doc.file_name,
                      file_url: doc.file_url,
                      file_size: doc.file_size || undefined,
                      uploaded_at: doc.uploaded_at,
                      uploaded_by: doc.uploaded_by || undefined,
                    })}
                    className={`w-full flex items-center justify-between p-4 hover:${tokens.bg.elevated} transition-colors text-left`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 ${tokens.status.info.bg} ${tokens.radius.control} flex items-center justify-center`}>
                        <svg className={`w-5 h-5 ${tokens.status.info.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className={`${tokens.text.primary} font-medium`}>{doc.file_name}</p>
                        <p className={`${tokens.text.muted} text-sm`}>
                          {doc.account_name} &bull; {doc.document_type}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className={`${tokens.text.muted} text-sm`}>{formatRelativeTime(doc.uploaded_at)}</p>
                        <p className={`${tokens.text.muted} text-xs`}>{formatFileSize(doc.file_size)}</p>
                      </div>
                      <span className={`px-3 py-1.5 text-xs font-medium ${tokens.text.accent} bg-[#3B82F6]/10 border border-[#3B82F6]/20 ${tokens.radius.control}`}>
                        View
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {activeView === 'all' && (
          <div className="space-y-3">
            {/* Expand/Collapse All Buttons */}
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={expandAll}
                className={`px-3 py-1.5 text-sm ${tokens.text.secondary} hover:${tokens.text.primary} ${tokens.bg.card} hover:${tokens.bg.elevated} ${tokens.radius.control} transition-colors`}
              >
                Expand All
              </button>
              <button
                onClick={collapseAll}
                className={`px-3 py-1.5 text-sm ${tokens.text.secondary} hover:${tokens.text.primary} ${tokens.bg.card} hover:${tokens.bg.elevated} ${tokens.radius.control} transition-colors`}
              >
                Collapse All
              </button>
            </div>
            {filteredData.accounts.map(([accountName, account]) => (
              <AccountSection
                key={accountName}
                accountName={accountName}
                contracts={account.contracts}
                isExpanded={expandedAccounts.has(accountName)}
                onToggle={() => toggleAccount(accountName)}
                onUpload={handleUpload}
                uploadingKey={uploadingKey}
                documentTypes={data?.documentTypes || []}
                allContracts={contracts}
              />
            ))}
          </div>
        )}
      </div>

      {/* Saved Views Sidebar (if any) */}
      {savedViews.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className={`${tokens.bg.card} ${tokens.radius.card} border ${tokens.border.subtle} p-3 ${tokens.shadow.elevated}`}>
            <p className={`${tokens.text.muted} text-xs font-medium mb-2`}>Saved Views</p>
            <div className="space-y-1">
              {savedViews.map((view) => (
                <button
                  key={view.id}
                  onClick={() => {
                    if (view.filters.view) setActiveView(view.filters.view as SmartView);
                    setFilters({
                      documentType: view.filters.documentType || null,
                      status: view.filters.status || null,
                      accountName: view.filters.accountName || null,
                    });
                  }}
                  className={`block w-full text-left px-2.5 py-1.5 text-sm ${tokens.text.primary} hover:${tokens.bg.elevated} ${tokens.radius.control} transition-colors`}
                >
                  {view.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Document Preview Panel */}
      <DocumentPreviewPanel
        document={previewDoc}
        isOpen={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        onDownload={(doc) => window.open(doc.file_url, '_blank')}
      />
    </div>
  );
}
