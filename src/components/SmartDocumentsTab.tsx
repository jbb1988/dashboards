'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { ContractListView, ContractItem, ContractDocument, DocumentDetailDrawer, DocumentItem } from '@/components/documents';
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
  bundle_id?: string | null;
  bundle_name?: string | null;
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
  isBundle?: boolean;
  bundleContractCount?: number;
}

interface AccountGroup {
  accountName: string;
  contracts: Record<string, ContractDocuments>;
}

interface BundleInfo {
  bundleId: string;
  bundleName: string;
  isPrimary: boolean;
  contractCount: number;
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
  salesRep?: string;
  bundleInfo?: BundleInfo | null;
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
  'Client Response - MARS STD WTC',
  'Client Response - MARS MCC TC',
  'Client Response - MARS EULA',
  'Purchase Order',
  'Amendment',
  'Other',
];

// Format file size
function formatFileSize(bytes: number | null): string {
  if (!bytes) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface SmartDocumentsTabProps {
  contracts: Contract[];
  openBundleModal?: (contract: any, mode: 'create' | 'add') => void;
  focusMode?: boolean;
}

// Main Smart Documents Tab Component
export default function SmartDocumentsTab({ contracts, openBundleModal, focusMode = false }: SmartDocumentsTabProps) {
  // State
  const [data, setData] = useState<DocumentsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDocument, setSelectedDocument] = useState<DocumentItem | null>(null);
  const [filterPreset, setFilterPreset] = useState<'needsAttention' | 'closingSoon' | 'budgeted' | 'complete' | null>(null);

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

  // Clear filters when focus mode is activated
  useEffect(() => {
    if (focusMode) {
      setFilterPreset(null);
    }
  }, [focusMode]);

  // Handle file upload with Supabase storage and Salesforce sync
  const handleUpload = async (
    file: File,
    documentType: string,
    contractId: string,
    contractName: string,
    accountName: string,
    salesforceId?: string
  ) => {
    try {
      // Step 1: Get signed upload URL from Supabase
      const signedUrlResponse = await fetch(`/api/storage/upload?filename=${encodeURIComponent(file.name)}`);
      if (!signedUrlResponse.ok) {
        throw new Error('Failed to get upload URL');
      }
      const { signedUrl, storagePath } = await signedUrlResponse.json();

      // Step 2: Upload file directly to Supabase storage
      const uploadResponse = await fetch(signedUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
        },
      });
      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file to storage');
      }

      // Step 3: Get the public URL for the uploaded file
      // Use the Supabase URL from the environment variable or fallback to the one in .env.local
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://opgunonejficgxztqegf.supabase.co';
      const fileUrl = `${supabaseUrl}/storage/v1/object/public/data-files/${storagePath}`;

      // Step 4: Create document record in database
      const docResponse = await fetch('/api/contracts/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractId,
          salesforceId: salesforceId || null,
          accountName,
          opportunityName: contractName,
          documentType,
          fileName: file.name,
          fileUrl,
          fileSize: file.size,
          fileMimeType: file.type,
          status: 'draft',
          notes: `Uploaded: ${file.name} (${formatFileSize(file.size)})`,
        }),
      });

      if (!docResponse.ok) {
        throw new Error('Failed to create document record');
      }

      const docData = await docResponse.json();

      // Step 5: Auto-push to Salesforce if salesforceId is available
      if (salesforceId && docData.document?.id) {
        try {
          const sfResponse = await fetch('/api/contracts/documents/push-to-sf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ documentId: docData.document.id }),
          });
          if (!sfResponse.ok) {
            console.warn('Salesforce sync failed, document saved locally:', await sfResponse.json());
          }
        } catch (sfErr) {
          console.warn('Salesforce sync error:', sfErr);
        }
      }

      await fetchDocuments();
    } catch (err) {
      console.error('Upload failed:', err);
    }
  };

  // Compute stats for KPI cards - use contracts prop directly
  const stats = useMemo(() => {
    if (!contracts) return { closingSoon: 0, budgeted: 0 };

    // Count contracts closing soon (within 90 days)
    const closingSoon = contracts.filter(contract => {
      const targetDateStr = contract.closeDate || contract.contractDate || contract.awardDate;
      if (!targetDateStr) return false;
      const targetDate = new Date(targetDateStr);
      const daysUntil = Math.floor((targetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return daysUntil >= 0 && daysUntil <= 90;
    }).length;

    // Count budgeted contracts
    const budgeted = contracts.filter(contract => contract.budgeted === true).length;

    return { closingSoon, budgeted };
  }, [contracts]);

  // Transform contracts prop to contract-centric format for ContractListView
  // Uses same data source as Pipeline tab to avoid duplicates
  // BUNDLE CONSOLIDATION: Show one row per bundle with combined documents
  const contractItems: ContractItem[] = useMemo(() => {
    if (!contracts) return [];

    // Step 1: Group contracts by bundle (or keep as individual if not bundled)
    const bundleGroups = new Map<string, Contract[]>();
    const unbundledContracts: Contract[] = [];

    contracts.forEach(contract => {
      if (contract.bundleInfo?.bundleId) {
        const bundleId = contract.bundleInfo.bundleId;
        if (!bundleGroups.has(bundleId)) {
          bundleGroups.set(bundleId, []);
        }
        bundleGroups.get(bundleId)!.push(contract);
      } else {
        unbundledContracts.push(contract);
      }
    });

    // Helper to get documents for a contract
    const getDocsForContract = (contract: Contract): ContractDocument[] => {
      return (data?.documents || [])
        .filter(d =>
          d.contract_id === contract.id ||
          d.contract_id === contract.salesforceId ||
          d.salesforce_id === contract.salesforceId
        )
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
    };

    // Helper to create a ContractItem
    const createContractItem = (
      contract: Contract,
      docs: ContractDocument[],
      bundleInfo: BundleInfo | null
    ): ContractItem => {
      const presentRequired = REQUIRED_DOCUMENT_TYPES.filter(type =>
        docs.some(d => d.document_type === type)
      );

      return {
        id: contract.id,
        contract_name: contract.name,
        account_name: contract.name,
        opportunity_name: contract.opportunityName,
        contract_type: contract.contractType?.join(', ') || undefined,
        salesforce_id: contract.salesforceId,
        status: contract.status,
        contract_date: contract.contractDate,
        close_date: contract.closeDate,
        budgeted: contract.budgeted,
        value: contract.value,
        documents: docs,
        completeness: {
          uploaded: presentRequired.length,
          required: REQUIRED_DOCUMENT_TYPES.length,
          total: REQUIRED_DOCUMENT_TYPES.length + OPTIONAL_DOCUMENT_TYPES.length,
          percentage: Math.round((presentRequired.length / REQUIRED_DOCUMENT_TYPES.length) * 100),
        },
        bundleInfo,
      };
    };

    const items: ContractItem[] = [];

    // Step 2: Process bundled contracts - one row per bundle
    bundleGroups.forEach((bundleContracts, bundleId) => {
      // Find the primary contract, or use the first one
      const primaryContract = bundleContracts.find(c => c.bundleInfo?.isPrimary) || bundleContracts[0];

      // Combine documents from all contracts in the bundle
      const allBundleDocs: ContractDocument[] = [];
      const seenDocIds = new Set<string>();
      bundleContracts.forEach(contract => {
        getDocsForContract(contract).forEach(doc => {
          if (!seenDocIds.has(doc.id)) {
            seenDocIds.add(doc.id);
            allBundleDocs.push(doc);
          }
        });
      });

      // Calculate combined value for the bundle
      const totalValue = bundleContracts.reduce((sum, c) => sum + c.value, 0);

      // Create bundle info with contract count
      const bundleInfo: BundleInfo = {
        bundleId,
        bundleName: primaryContract.bundleInfo?.bundleName || primaryContract.name,
        isPrimary: true,
        contractCount: bundleContracts.length,
      };

      const item = createContractItem(primaryContract, allBundleDocs, bundleInfo);
      item.value = totalValue; // Use combined bundle value
      items.push(item);
    });

    // Step 3: Process unbundled contracts
    unbundledContracts.forEach(contract => {
      const docs = getDocsForContract(contract);
      items.push(createContractItem(contract, docs, null));
    });

    return items;
  }, [contracts, data?.documents]);

  // Derive stats from contractItems - same data source as Pipeline
  const derivedStats = useMemo(() => {
    const totalDocuments = contractItems.reduce((sum, c) => sum + c.documents.length, 0);
    const totalContracts = contractItems.length;
    const needsAttention = contractItems.filter(c => c.completeness.percentage < 100).length;
    const complete = contractItems.filter(c => c.completeness.percentage === 100).length;
    const averageCompleteness = totalContracts > 0
      ? Math.round(contractItems.reduce((sum, c) => sum + c.completeness.percentage, 0) / totalContracts)
      : 0;

    return { totalDocuments, totalContracts, needsAttention, complete, averageCompleteness };
  }, [contractItems]);

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
          value={derivedStats.totalDocuments}
          subtitle={`${derivedStats.totalContracts} contracts`}
          icon={KPIIcons.document}
          color={colors.accent.blue}
          delay={0.1}
          onClick={() => setFilterPreset(null)}
        />
        <KPICard
          title="Needs Attention"
          value={derivedStats.needsAttention}
          subtitle="Missing docs or overdue"
          icon={KPIIcons.warning}
          color={colors.accent.red}
          delay={0.2}
          badge={derivedStats.needsAttention}
          onClick={() => setFilterPreset('needsAttention')}
        />
        <KPICard
          title="Closing Soon"
          value={stats.closingSoon}
          subtitle="Within 90 days"
          icon={KPIIcons.calendar}
          color={colors.accent.amber}
          delay={0.3}
          onClick={() => setFilterPreset('closingSoon')}
        />
        <KPICard
          title="Budgeted"
          value={stats.budgeted}
          subtitle="Forecasted deals"
          icon={KPIIcons.dollar}
          color={colors.accent.purple}
          delay={0.4}
          onClick={() => setFilterPreset('budgeted')}
        />
        <KPICard
          title="Complete"
          value={derivedStats.complete}
          subtitle={`${derivedStats.averageCompleteness}% avg completion`}
          icon={KPIIcons.checkCircle}
          color={colors.accent.green}
          delay={0.5}
          onClick={() => setFilterPreset('complete')}
        />
      </div>

      {/* Contract List with Side Drawer for Document Management */}
      <ContractListView
        contracts={contractItems}
        openBundleModal={openBundleModal}
        filterPreset={filterPreset}
        focusMode={focusMode}
        onUpload={async (file, documentType, contractId) => {
          const contract = contractItems.find(c => c.id === contractId);
          await handleUpload(
            file,
            documentType,
            contractId,
            contract?.contract_name || '',
            contract?.account_name || '',
            contract?.salesforce_id
          );
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
          // Find the contract this document belongs to
          const contract = contractItems.find(c =>
            c.documents.some(d => d.id === doc.id)
          );

          if (contract) {
            // Convert ContractDocument to DocumentItem for the drawer
            const documentItem: DocumentItem = {
              id: doc.id,
              document_type: doc.document_type,
              file_name: doc.file_name || 'Unknown',
              file_url: doc.file_url || '',
              file_size: doc.file_size,
              uploaded_at: doc.uploaded_at,
              uploaded_by: doc.uploaded_by,
              status: doc.status === 'uploaded' ? 'draft' : 'missing',
              contract_id: contract.id,
              contract_name: contract.contract_name,
              account_name: contract.account_name,
              is_required: doc.is_required,
              version: doc.version,
              salesforce_id: contract.salesforce_id,
            };
            setSelectedDocument(documentItem);
          }
        }}
        onDelete={async (doc) => {
          try {
            const response = await fetch(`/api/contracts/documents?documentId=${doc.id}&hardDelete=true`, {
              method: 'DELETE',
            });
            if (response.ok) {
              await fetchDocuments();
            } else {
              console.error('Failed to delete document');
            }
          } catch (err) {
            console.error('Delete failed:', err);
          }
        }}
      />

      {/* Document Detail Drawer for Preview */}
      <DocumentDetailDrawer
        document={selectedDocument}
        onClose={() => setSelectedDocument(null)}
        onDownload={(doc) => {
          if (doc.file_url && !doc.file_url.startsWith('#')) {
            window.open(doc.file_url, '_blank');
          }
        }}
        onDelete={async (doc) => {
          try {
            const response = await fetch(`/api/contracts/documents?documentId=${doc.id}&hardDelete=true`, {
              method: 'DELETE',
            });
            if (response.ok) {
              setSelectedDocument(null);
              await fetchDocuments();
            } else {
              console.error('Failed to delete document');
            }
          } catch (err) {
            console.error('Delete failed:', err);
          }
        }}
        onSfSync={async () => {
          // Refresh document list after sync
          await fetchDocuments();
        }}
      />
    </div>
  );
}
