import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { deleteFileFromSalesforce } from '@/lib/salesforce';

// Document types matching the database enum
const DOCUMENT_TYPES = [
  // Required for completeness
  'Original Contract',
  'MARS Redlines',
  'Final Agreement',
  'Executed Contract',
  // Optional standard
  'Client Response - MARS STD WTC',
  'Client Response - MARS MCC TC',
  'Client Response - MARS EULA',
  'Purchase Order',
  'Amendment',
  // Analysis documents
  'Comparison Report',
  'AI Recommendations',
  // Flexible
  'Other',
] as const;

const DOCUMENT_STATUSES = [
  'draft',
  'under_review',
  'awaiting_signature',
  'executed',
  'expired',
  'superseded',
] as const;

// Required document types for completeness calculation
const REQUIRED_DOCUMENT_TYPES = [
  'Original Contract',
  'MARS Redlines',
  'Final Agreement',
  'Executed Contract',
];

const OPTIONAL_DOCUMENT_TYPES = [
  'Client Response - MARS STD WTC',
  'Client Response - MARS MCC TC',
  'Client Response - MARS EULA',
  'Purchase Order',
  'Amendment',
  'Other',
];

// Analysis document types (from Compare tab)
const ANALYSIS_DOCUMENT_TYPES = [
  'Comparison Report',
  'AI Recommendations',
];

export interface Document {
  id: string;
  contract_id: string | null;
  salesforce_id: string | null;
  account_name: string;
  opportunity_name: string | null;
  opportunity_year: number | null;
  document_type: typeof DOCUMENT_TYPES[number];
  status: typeof DOCUMENT_STATUSES[number];
  file_name: string;
  file_url: string;
  file_size: number | null;
  file_mime_type: string | null;
  version: number;
  previous_version_id: string | null;
  is_current_version: boolean;
  expiration_date: string | null;
  effective_date: string | null;
  uploaded_at: string;
  uploaded_by: string | null;
  uploaded_by_id: string | null;
  notes: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// Priority scoring algorithm
export interface PriorityScore {
  contractId: string;
  score: number;
  reasons: string[];
  category: 'critical' | 'high' | 'medium' | 'low';
}

function calculatePriorityScore(
  contract: any,
  documents: Document[],
  now: Date = new Date()
): PriorityScore {
  const reasons: string[] = [];
  let category: 'critical' | 'high' | 'medium' | 'low';
  let daysUntil: number | null = null;

  // Simple days-based priority logic
  if (contract.closeDate || contract.contractDate) {
    const targetDate = new Date(contract.contractDate || contract.closeDate);
    daysUntil = Math.floor((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntil < 0) {
      category = 'critical';
      reasons.push(`Overdue by ${Math.abs(daysUntil)} days`);
    } else if (daysUntil <= 90) {
      // Red: due within 90 days
      category = 'critical';
      reasons.push(`Due in ${daysUntil} days`);
    } else if (daysUntil <= 180) {
      // Yellow: 91-180 days
      category = 'high';
      reasons.push(`Due in ${daysUntil} days`);
    } else {
      // Blue: 181+ days
      category = 'medium';
      reasons.push(`Due in ${daysUntil} days`);
    }
  } else {
    // No due date
    category = 'low';
    reasons.push('No due date');
  }

  return {
    contractId: contract.id,
    score: daysUntil !== null ? Math.max(0, 365 - daysUntil) : 0,
    reasons,
    category,
  };
}

// Calculate completeness for a contract
function calculateCompleteness(contractDocs: Document[]): {
  total: number;
  required: number;
  optional: number;
  percentage: number;
  missingRequired: string[];
  missingOptional: string[];
} {
  const currentDocs = contractDocs.filter(d => d.is_current_version);

  const presentRequired = REQUIRED_DOCUMENT_TYPES.filter(type =>
    currentDocs.some(d => d.document_type === type)
  );
  const presentOptional = OPTIONAL_DOCUMENT_TYPES.filter(type =>
    currentDocs.some(d => d.document_type === type)
  );

  const missingRequired = REQUIRED_DOCUMENT_TYPES.filter(type =>
    !currentDocs.some(d => d.document_type === type)
  );
  const missingOptional = OPTIONAL_DOCUMENT_TYPES.filter(type =>
    !currentDocs.some(d => d.document_type === type)
  );

  // Percentage based on required docs (optional don't count toward percentage)
  const percentage = Math.round((presentRequired.length / REQUIRED_DOCUMENT_TYPES.length) * 100);

  return {
    total: currentDocs.length,
    required: presentRequired.length,
    optional: presentOptional.length,
    percentage,
    missingRequired,
    missingOptional,
  };
}

/**
 * GET /api/contracts/documents
 * Fetch all documents with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Filter parameters
    const contractId = searchParams.get('contractId');
    const salesforceId = searchParams.get('salesforceId');
    const accountName = searchParams.get('accountName');
    const documentType = searchParams.get('documentType');
    const status = searchParams.get('status');
    const view = searchParams.get('view'); // 'needs_attention', 'closing_soon', 'recent', 'all'
    const includeBundled = searchParams.get('includeBundled') === 'true';

    const admin = getSupabaseAdmin();

    // First, get contracts (always needed)
    // Include contracts where is_closed is false OR null (not explicitly closed)
    const { data: contracts, error: contractsError } = await admin
      .from('contracts')
      .select('*')
      .or('is_closed.eq.false,is_closed.is.null');

    if (contractsError) {
      console.error('Error fetching contracts:', contractsError);
      return NextResponse.json({ error: 'Failed to fetch contracts' }, { status: 500 });
    }

    // Try to get documents (table might not exist yet)
    let documents: Document[] = [];
    let documentsTableExists = true;
    let bundleInfo: {
      bundleId: string;
      bundleName: string;
      contracts: { id: string; name: string; isPrimary: boolean }[];
    } | null = null;

    // Check if contract is part of a bundle
    let bundledContractIds: string[] = [];
    const idForBundleLookup = contractId || salesforceId;
    if (idForBundleLookup && includeBundled) {
      try {
        // Find if this contract is in a bundle
        const { data: bundleContract } = await admin
          .from('bundle_contracts')
          .select(`
            bundle_id,
            is_primary,
            contract_bundles (
              id,
              name
            )
          `)
          .eq('contract_id', idForBundleLookup)
          .single();

        if (bundleContract?.bundle_id) {
          // Get all contracts in this bundle
          const { data: allBundleContracts } = await admin
            .from('bundle_contracts')
            .select(`
              contract_id,
              is_primary,
              contracts (
                id,
                name,
                account_name
              )
            `)
            .eq('bundle_id', bundleContract.bundle_id);

          if (allBundleContracts && allBundleContracts.length > 0) {
            bundledContractIds = allBundleContracts.map(bc => bc.contract_id);
            bundleInfo = {
              bundleId: bundleContract.bundle_id,
              bundleName: (bundleContract.contract_bundles as any)?.name || 'Bundle',
              contracts: allBundleContracts.map(bc => ({
                id: bc.contract_id,
                name: (bc.contracts as any)?.name || 'Unknown',
                isPrimary: bc.is_primary,
              })),
            };
          }
        }
      } catch (err) {
        console.log('Bundle lookup skipped (tables may not exist):', err);
      }
    }

    try {
      let query = admin
        .from('documents')
        .select('*')
        .eq('is_current_version', true)
        .order('uploaded_at', { ascending: false });

      // Apply filters
      if (contractId) {
        // If we have bundled contracts, fetch docs from all of them
        if (bundledContractIds.length > 0) {
          query = query.in('contract_id', bundledContractIds);
        } else {
          query = query.eq('contract_id', contractId);
        }
      } else if (salesforceId) {
        // Filter by salesforce_id OR contract_id matching the salesforceId
        // This handles cases where documents are stored with either identifier
        query = query.or(`contract_id.eq.${salesforceId},salesforce_id.eq.${salesforceId}`);
      }
      if (accountName) {
        query = query.eq('account_name', accountName);
      }
      if (documentType && DOCUMENT_TYPES.includes(documentType as any)) {
        query = query.eq('document_type', documentType);
      }
      if (status && DOCUMENT_STATUSES.includes(status as any)) {
        query = query.eq('status', status);
      }

      const { data: docsData, error: docsError } = await query;

      if (docsError) {
        // Table might not exist - log but continue with empty documents
        console.log('Documents query error (table may not exist):', docsError.message);
        documentsTableExists = false;
      } else {
        // Mark documents that are from bundled contracts (not the requested contract)
        const requestedId = contractId || salesforceId;
        documents = (docsData || []).map(doc => ({
          ...doc,
          fromBundledContract: requestedId && doc.contract_id !== requestedId && doc.salesforce_id !== requestedId ? doc.contract_id : null,
        }));
      }
    } catch (err) {
      console.log('Documents table not available:', err);
      documentsTableExists = false;
    }

    // Fetch ALL bundle memberships to consolidate bundled contracts
    // Map: contract_id -> { bundleId, bundleName, isPrimary }
    const contractBundleMap: Record<string, { bundleId: string; bundleName: string; isPrimary: boolean }> = {};
    // Map: bundle_id -> array of contract_ids in that bundle
    const bundleContractsMap: Record<string, string[]> = {};

    try {
      const { data: allBundleContracts } = await admin
        .from('bundle_contracts')
        .select(`
          contract_id,
          bundle_id,
          is_primary,
          contract_bundles (
            id,
            name
          )
        `);

      if (allBundleContracts) {
        allBundleContracts.forEach(bc => {
          const bundleName = (bc.contract_bundles as any)?.name || 'Bundle';
          contractBundleMap[bc.contract_id] = {
            bundleId: bc.bundle_id,
            bundleName,
            isPrimary: bc.is_primary,
          };

          if (!bundleContractsMap[bc.bundle_id]) {
            bundleContractsMap[bc.bundle_id] = [];
          }
          bundleContractsMap[bc.bundle_id].push(bc.contract_id);
        });
      }
    } catch (err) {
      console.log('Bundle lookup skipped for all contracts (tables may not exist):', err);
    }

    // Calculate priority scores for each contract
    const priorityScores: Record<string, PriorityScore> = {};
    const completenessScores: Record<string, ReturnType<typeof calculateCompleteness>> = {};

    (contracts || []).forEach(contract => {
      const contractDocs = (documents || []).filter(
        (d: Document) => d.contract_id === contract.id || d.salesforce_id === contract.salesforce_id
      );
      priorityScores[contract.id] = calculatePriorityScore(
        {
          id: contract.id,
          salesforceId: contract.salesforce_id,
          value: contract.value,
          closeDate: contract.close_date,
          contractDate: contract.contract_date,
          statusChangeDate: contract.updated_at,
        },
        documents || []
      );
      completenessScores[contract.id] = calculateCompleteness(contractDocs);
    });

    // Helper to get the canonical key for a contract (bundle_id if bundled, contract_id otherwise)
    const getContractKey = (contractId: string): string => {
      const bundleInfo = contractBundleMap[contractId];
      return bundleInfo ? `bundle:${bundleInfo.bundleId}` : contractId;
    };

    // Helper to get display name (bundle name if bundled, contract name otherwise)
    const getDisplayName = (contractId: string, fallbackName: string): string => {
      const bundleInfo = contractBundleMap[contractId];
      return bundleInfo ? bundleInfo.bundleName : fallbackName;
    };

    // Track which contracts have been added (to avoid duplicates within bundles)
    const processedContractIds = new Set<string>();

    // Group documents by account and contract/bundle
    const byAccount: Record<string, {
      accountName: string;
      contracts: Record<string, {
        contractId: string;
        contractName: string;
        opportunityYear: number | null;
        documents: Document[];
        completeness: ReturnType<typeof calculateCompleteness>;
        priority: PriorityScore;
        isBundle?: boolean;
        bundleContractCount?: number;
      }>;
    }> = {};

    (documents || []).forEach((doc: Document) => {
      const accountKey = doc.account_name || 'Unknown';
      const rawContractId = doc.contract_id || doc.salesforce_id || 'unknown';
      const contractKey = getContractKey(rawContractId);
      const bundleInfo = contractBundleMap[rawContractId];

      if (!byAccount[accountKey]) {
        byAccount[accountKey] = {
          accountName: accountKey,
          contracts: {},
        };
      }

      if (!byAccount[accountKey].contracts[contractKey]) {
        const contract = (contracts || []).find(
          c => c.id === doc.contract_id || c.salesforce_id === doc.salesforce_id
        );

        // For bundles, get combined completeness from all contracts in the bundle
        let combinedCompleteness = completenessScores[contract?.id] || calculateCompleteness([]);
        let combinedPriority = priorityScores[contract?.id] || {
          contractId: contractKey,
          score: 0,
          reasons: [],
          category: 'low' as const,
        };

        byAccount[accountKey].contracts[contractKey] = {
          contractId: contractKey,
          contractName: getDisplayName(rawContractId, doc.opportunity_name || contract?.name || 'Unknown Contract'),
          opportunityYear: doc.opportunity_year,
          documents: [],
          completeness: combinedCompleteness,
          priority: combinedPriority,
          isBundle: !!bundleInfo,
          bundleContractCount: bundleInfo ? bundleContractsMap[bundleInfo.bundleId]?.length : undefined,
        };
      }

      byAccount[accountKey].contracts[contractKey].documents.push(doc);
      processedContractIds.add(rawContractId);
    });

    // Also add contracts without documents (for completeness tracking)
    // But skip contracts that are part of a bundle if we've already added the bundle
    (contracts || []).forEach(contract => {
      const accountKey = contract.account_name || 'Unknown';
      const contractKey = getContractKey(contract.id);
      const bundleInfo = contractBundleMap[contract.id];

      // Skip if this contract is in a bundle and we've already processed another contract from that bundle
      if (bundleInfo) {
        const bundleContracts = bundleContractsMap[bundleInfo.bundleId] || [];
        const anyBundleContractProcessed = bundleContracts.some(id => processedContractIds.has(id));
        if (anyBundleContractProcessed) {
          return; // Skip - bundle already represented
        }
      }

      if (!byAccount[accountKey]) {
        byAccount[accountKey] = {
          accountName: accountKey,
          contracts: {},
        };
      }

      if (!byAccount[accountKey].contracts[contractKey]) {
        byAccount[accountKey].contracts[contractKey] = {
          contractId: contractKey,
          contractName: getDisplayName(contract.id, contract.name || contract.account_name),
          opportunityYear: null,
          documents: [],
          completeness: completenessScores[contract.id] || calculateCompleteness([]),
          priority: priorityScores[contract.id] || {
            contractId: contractKey,
            score: 0,
            reasons: [],
            category: 'low',
          },
          isBundle: !!bundleInfo,
          bundleContractCount: bundleInfo ? bundleContractsMap[bundleInfo.bundleId]?.length : undefined,
        };
      }

      processedContractIds.add(contract.id);
    });

    // Calculate summary stats
    const allPriorities = Object.values(priorityScores);
    const contractsList = contracts || [];
    const stats = {
      totalDocuments: documents.length,
      totalContracts: contractsList.length,
      needsAttention: allPriorities.filter(p => p.category === 'critical' || p.category === 'high').length,
      closingSoon: contractsList.filter(c => {
        if (!c.contract_date && !c.close_date) return false;
        const targetDate = new Date(c.contract_date || c.close_date);
        const daysUntil = Math.floor((targetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return daysUntil >= 0 && daysUntil <= 90;
      }).length,
      complete: allPriorities.filter(p => {
        const completeness = completenessScores[p.contractId];
        return completeness?.percentage === 100;
      }).length,
      averageCompleteness: Math.round(
        Object.values(completenessScores).reduce((sum, c) => sum + c.percentage, 0) /
        Math.max(Object.values(completenessScores).length, 1)
      ),
    };

    return NextResponse.json({
      documents,
      byAccount,
      priorityScores,
      completenessScores,
      stats,
      documentTypes: DOCUMENT_TYPES,
      requiredTypes: REQUIRED_DOCUMENT_TYPES,
      optionalTypes: OPTIONAL_DOCUMENT_TYPES,
      analysisTypes: ANALYSIS_DOCUMENT_TYPES,
      documentsTableExists,
      bundleInfo,
    });
  } catch (error) {
    console.error('Error in GET /api/contracts/documents:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/contracts/documents
 * Create a new document record
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      contractId,
      salesforceId,
      accountName,
      opportunityName,
      opportunityYear,
      documentType,
      status = 'draft',
      fileName,
      fileUrl,
      fileSize,
      fileMimeType,
      expirationDate,
      effectiveDate,
      uploadedBy,
      notes,
      metadata = {},
    } = body;

    // Validation
    if (!accountName) {
      return NextResponse.json({ error: 'accountName is required' }, { status: 400 });
    }
    if (!documentType || !DOCUMENT_TYPES.includes(documentType)) {
      return NextResponse.json({
        error: 'Invalid documentType',
        validTypes: DOCUMENT_TYPES
      }, { status: 400 });
    }
    if (!fileName || !fileUrl) {
      return NextResponse.json({ error: 'fileName and fileUrl are required' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Check if a document of this type already exists for this contract
    // If so, we'll create a new version
    let version = 1;
    let previousVersionId = null;

    // Retry logic to handle race conditions
    let retries = 3;
    let newDoc = null;
    let insertError = null;

    while (retries > 0) {
      if (contractId || salesforceId) {
        const existingQuery = admin
          .from('documents')
          .select('id, version')
          .eq('document_type', documentType)
          .eq('is_current_version', true);

        if (contractId) {
          existingQuery.eq('contract_id', contractId);
        } else {
          existingQuery.eq('salesforce_id', salesforceId);
        }

        const { data: existing } = await existingQuery.maybeSingle();

        if (existing) {
          // Mark old version as not current
          await admin
            .from('documents')
            .update({ is_current_version: false })
            .eq('id', existing.id);

          version = existing.version + 1;
          previousVersionId = existing.id;
        }
      }

      // Insert new document
      const { data, error } = await admin
        .from('documents')
        .insert({
          contract_id: contractId || null,
          salesforce_id: salesforceId || null,
          account_name: accountName,
          opportunity_name: opportunityName || null,
          opportunity_year: opportunityYear || null,
          document_type: documentType,
          status,
          file_name: fileName,
          file_url: fileUrl,
          file_size: fileSize || null,
          file_mime_type: fileMimeType || null,
          version,
          previous_version_id: previousVersionId,
          is_current_version: true,
          expiration_date: expirationDate || null,
          effective_date: effectiveDate || null,
          uploaded_by: uploadedBy || null,
          notes: notes || null,
          metadata,
        })
        .select()
        .single();

      // Check for unique constraint violation (23505 is PostgreSQL unique violation code)
      if (error && error.code === '23505') {
        // Another upload beat us to it - retry
        retries--;
        if (retries > 0) {
          // Wait a small random time before retrying to avoid thundering herd
          await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
          continue;
        }
        insertError = error;
      } else if (error) {
        insertError = error;
        break;
      } else {
        newDoc = data;
        break;
      }
    }

    if (insertError) {
      console.error('Error creating document:', insertError);
      return NextResponse.json({ error: 'Failed to create document', details: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      document: newDoc,
      isNewVersion: version > 1,
      version,
    });
  } catch (error) {
    console.error('Error in POST /api/contracts/documents:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/contracts/documents
 * Update a document's status or metadata
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { documentId, status, notes, metadata, expirationDate } = body;

    if (!documentId) {
      return NextResponse.json({ error: 'documentId is required' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (status && DOCUMENT_STATUSES.includes(status)) {
      updateData.status = status;
    }
    if (notes !== undefined) {
      updateData.notes = notes;
    }
    if (metadata !== undefined) {
      updateData.metadata = metadata;
    }
    if (expirationDate !== undefined) {
      updateData.expiration_date = expirationDate;
    }

    const { data, error } = await admin
      .from('documents')
      .update(updateData)
      .eq('id', documentId)
      .select()
      .single();

    if (error) {
      console.error('Error updating document:', error);
      return NextResponse.json({ error: 'Failed to update document' }, { status: 500 });
    }

    return NextResponse.json({ success: true, document: data });
  } catch (error) {
    console.error('Error in PATCH /api/contracts/documents:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/contracts/documents
 * Delete a document (soft delete - marks as superseded)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');
    const hardDelete = searchParams.get('hardDelete') === 'true';

    if (!documentId) {
      return NextResponse.json({ error: 'documentId is required' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // First, get the document to check if it's synced to Salesforce
    const { data: document } = await admin
      .from('documents')
      .select('sf_content_document_id')
      .eq('id', documentId)
      .single();

    // If document is synced to Salesforce, delete from SF first
    if (document?.sf_content_document_id) {
      const sfDeleteResult = await deleteFileFromSalesforce(document.sf_content_document_id);
      if (!sfDeleteResult.success) {
        console.warn('Failed to delete from Salesforce:', sfDeleteResult.errors);
        // Continue with local delete even if SF delete fails
      }
    }

    if (hardDelete) {
      // Actually delete the record
      const { error } = await admin
        .from('documents')
        .delete()
        .eq('id', documentId);

      if (error) {
        console.error('Error deleting document:', error);
        return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
      }
    } else {
      // Soft delete - mark as superseded
      const { error } = await admin
        .from('documents')
        .update({
          status: 'superseded',
          is_current_version: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', documentId);

      if (error) {
        console.error('Error soft-deleting document:', error);
        return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, documentId, hardDelete, deletedFromSalesforce: !!document?.sf_content_document_id });
  } catch (error) {
    console.error('Error in DELETE /api/contracts/documents:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
