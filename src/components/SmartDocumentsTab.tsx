'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { ContractListView, ContractItem, ContractDocument } from '@/components/documents';
import {
  tokens,
  colors,
  KPICard,
  KPIIcons,
} from '@/components/mars-ui';

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
}

interface CompletenessScore {
  total: number;
  required: number;
  optional: number;
  percentage: number;
  missingRequired: string[];
  missingOptional: string[];
}

interface PriorityScore {
  contractId: string;
  score: number;
  reasons: string[];
  category: 'critical' | 'high' | 'medium' | 'low';
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
  stats: {
    totalDocuments: number;
    totalContracts: number;
    needsAttention: number;
    closingSoon: number;
    complete: number;
    averageCompleteness: number;
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

// Format file size
function formatFileSize(bytes: number | null): string {
  if (!bytes) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
      const response = await fetch('/api/contracts/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractId,
          accountName,
          opportunityName: contractName,
          documentType,
          fileName: file.name,
          fileUrl: `#local:${file.name}`,
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

  // Transform data to contract-centric format for ContractListView
  const contractItems: ContractItem[] = useMemo(() => {
    if (!data) return [];

    const items: ContractItem[] = [];

    // Iterate through all accounts and contracts
    Object.values(data.byAccount).forEach(account => {
      Object.values(account.contracts).forEach(contract => {
        // Get all uploaded documents for this contract
        const uploadedDocs: ContractDocument[] = contract.documents
          .filter(d => d.is_current_version)
          .map(doc => ({
            id: doc.id,
            document_type: doc.document_type,
            file_name: doc.file_name,
            file_url: doc.file_url,
            file_size: doc.file_size || undefined,
            uploaded_at: doc.uploaded_at,
            uploaded_by: doc.uploaded_by || undefined,
            status: 'uploaded' as const,
            is_required: REQUIRED_DOCUMENT_TYPES.includes(doc.document_type),
            version: doc.version,
          }));

        // Find matching contract for salesforce_id
        const matchingContract = contracts.find(
          c => c.id === contract.contractId || c.salesforceId === contract.contractId
        );

        items.push({
          id: contract.contractId,
          contract_name: contract.contractName,
          account_name: account.accountName,
          salesforce_id: matchingContract?.salesforceId,
          documents: uploadedDocs,
          completeness: {
            uploaded: contract.completeness.required,
            required: REQUIRED_DOCUMENT_TYPES.length,
            total: REQUIRED_DOCUMENT_TYPES.length + OPTIONAL_DOCUMENT_TYPES.length,
            percentage: contract.completeness.percentage,
          },
        });
      });
    });

    return items;
  }, [data, contracts]);

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

      {/* Contract List with Side Drawer for Document Management */}
      <ContractListView
        contracts={contractItems}
        onUpload={(file, documentType, contractId) => {
          const contract = contractItems.find(c => c.id === contractId);
          handleUpload(file, documentType, contractId, contract?.contract_name || '', contract?.account_name || '');
        }}
        onDownload={(doc) => {
          if (doc.file_url && !doc.file_url.startsWith('#')) {
            window.open(doc.file_url, '_blank');
          }
        }}
        onShare={(doc) => {
          if (doc.file_url && !doc.file_url.startsWith('#')) {
            navigator.clipboard.writeText(doc.file_url);
            alert('Link copied to clipboard!');
          }
        }}
        onView={(doc) => {
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
