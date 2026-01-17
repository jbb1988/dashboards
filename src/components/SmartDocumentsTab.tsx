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
  salesRep?: string;
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
  const [bundleInfoMap, setBundleInfoMap] = useState<Record<string, any>>({});
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

  // Fetch bundle info for all contracts
  const fetchBundleInfo = useCallback(async () => {
    if (!contracts || contracts.length === 0) return;

    try {
      const bundleMap: Record<string, any> = {};

      // Fetch bundle info for each contract
      await Promise.all(
        contracts.map(async (contract) => {
          try {
            const response = await fetch(`/api/bundles?contractId=${contract.id}`);
            if (response.ok) {
              const data = await response.json();
              if (data.bundle) {
                bundleMap[contract.id] = {
                  bundleId: data.bundle.id,
                  bundleName: data.bundle.name,
                  isPrimary: data.is_primary,
                  contractCount: data.contracts?.length || 0,
                };
              }
            }
          } catch (err) {
            // Silently fail for individual contracts
            console.log(`Failed to fetch bundle for contract ${contract.id}`);
          }
        })
      );

      setBundleInfoMap(bundleMap);
    } catch (err) {
      console.error('Failed to fetch bundle info:', err);
    }
  }, [contracts]);

  useEffect(() => {
    fetchDocuments();
    fetchBundleInfo();
  }, [fetchDocuments, fetchBundleInfo]);

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
          opportunity_name: matchingContract?.opportunityName || contract.contractName,
          contract_type: matchingContract?.contractType?.join(', ') || undefined,
          salesforce_id: matchingContract?.salesforceId,
          // Filter fields
          status: matchingContract?.status,
          contract_date: matchingContract?.contractDate,
          close_date: matchingContract?.closeDate,
          budgeted: matchingContract?.budgeted,
          value: matchingContract?.value,
          documents: uploadedDocs,
          completeness: {
            uploaded: contract.completeness.required,
            required: REQUIRED_DOCUMENT_TYPES.length,
            total: REQUIRED_DOCUMENT_TYPES.length + OPTIONAL_DOCUMENT_TYPES.length,
            percentage: contract.completeness.percentage,
          },
          bundleInfo: bundleInfoMap[contract.contractId] || null,
        });
      });
    });

    return items;
  }, [data, contracts, bundleInfoMap]);

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
          onClick={() => setFilterPreset(null)}
        />
        <KPICard
          title="Needs Attention"
          value={data?.stats.needsAttention || 0}
          subtitle="Missing docs or overdue"
          icon={KPIIcons.warning}
          color={colors.accent.red}
          delay={0.2}
          badge={data?.stats.needsAttention}
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
          value={data?.stats.complete || 0}
          subtitle={`${data?.stats.averageCompleteness || 0}% avg completion`}
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
