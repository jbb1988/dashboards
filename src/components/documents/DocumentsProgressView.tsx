'use client';

import { useState, useMemo, useCallback } from 'react';
import DocumentSection from './DocumentSection';
import DocumentRow, { DocumentData } from './DocumentRow';
import DocumentPreviewPanel from './DocumentPreviewPanel';
import AddDocumentDropdown from './AddDocumentDropdown';
import BundleBanner from './BundleBanner';
import {
  REQUIRED_DOCUMENT_TYPES,
  ANALYSIS_DOCUMENT_TYPES,
  SUPPORTING_DOCUMENT_TYPES,
  DOCUMENT_CATEGORIES,
  DocumentType,
  isRequiredDocType,
  isAnalysisDocType,
} from '@/lib/constants';

interface BundleInfo {
  id: string;
  name: string;
  contracts: {
    id: string;
    name: string;
    is_primary: boolean;
  }[];
}

interface DocumentsProgressViewProps {
  contractId: string;
  contractName: string;
  documents: DocumentData[];
  bundle?: BundleInfo | null;
  onUpload: (file: File, type: DocumentType) => Promise<void>;
  onDelete: (doc: DocumentData) => Promise<void>;
  onManageBundle?: () => void;
  isLoading?: boolean;
}

export default function DocumentsProgressView({
  contractId,
  contractName,
  documents,
  bundle,
  onUpload,
  onDelete,
  onManageBundle,
  isLoading = false,
}: DocumentsProgressViewProps) {
  const [previewDoc, setPreviewDoc] = useState<DocumentData | null>(null);
  const [uploadingType, setUploadingType] = useState<string | null>(null);

  // Group documents by type
  const documentsByType = useMemo(() => {
    const map = new Map<string, DocumentData>();
    documents.forEach(doc => {
      // For non-unique types like "Other", collect all
      if (doc.document_type === 'Other') {
        // Handle multiple "Other" documents - use ID as key
        map.set(`Other-${doc.id}`, doc);
      } else {
        map.set(doc.document_type, doc);
      }
    });
    return map;
  }, [documents]);

  // Calculate progress
  const requiredDocsUploaded = useMemo(() => {
    return REQUIRED_DOCUMENT_TYPES.filter(type => documentsByType.has(type)).length;
  }, [documentsByType]);

  const progressPercent = (requiredDocsUploaded / REQUIRED_DOCUMENT_TYPES.length) * 100;

  // Get documents needing attention (required but not uploaded)
  const needsAttention = useMemo(() => {
    return REQUIRED_DOCUMENT_TYPES.filter(type => !documentsByType.has(type));
  }, [documentsByType]);

  // Get completed required documents
  const completedDocs = useMemo(() => {
    return REQUIRED_DOCUMENT_TYPES
      .filter(type => documentsByType.has(type))
      .map(type => ({ type, doc: documentsByType.get(type)! }));
  }, [documentsByType]);

  // Get analysis documents
  const analysisDocs = useMemo(() => {
    return ANALYSIS_DOCUMENT_TYPES
      .filter(type => documentsByType.has(type))
      .map(type => ({ type, doc: documentsByType.get(type)! }));
  }, [documentsByType]);

  // Get supporting documents
  const supportingDocs = useMemo(() => {
    const result: { type: DocumentType; doc: DocumentData }[] = [];

    // Regular supporting types
    SUPPORTING_DOCUMENT_TYPES.filter(t => t !== 'Other').forEach(type => {
      if (documentsByType.has(type)) {
        result.push({ type, doc: documentsByType.get(type)! });
      }
    });

    // All "Other" documents
    documentsByType.forEach((doc, key) => {
      if (key.startsWith('Other-')) {
        result.push({ type: 'Other', doc });
      }
    });

    return result;
  }, [documentsByType]);

  // Handle upload
  const handleUpload = useCallback(async (file: File, type: DocumentType) => {
    setUploadingType(type);
    try {
      await onUpload(file, type);
    } finally {
      setUploadingType(null);
    }
  }, [onUpload]);

  // Handle download
  const handleDownload = useCallback((doc: DocumentData) => {
    window.open(doc.file_url, '_blank');
  }, []);

  // Get existing types for dropdown
  const existingTypes = useMemo(() => {
    return documents.map(d => d.document_type);
  }, [documents]);

  // Empty state
  if (!isLoading && documents.length === 0 && needsAttention.length === REQUIRED_DOCUMENT_TYPES.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-20 h-20 mb-6 rounded-2xl bg-[#0B1220] flex items-center justify-center">
          <svg className="w-10 h-10 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">No documents yet</h3>
        <p className="text-[#64748B] text-sm text-center max-w-sm mb-6">
          Upload your first document to get started. Required documents include Original Contract, MARS Redlines, Final Agreement, and Executed Contract.
        </p>
        <AddDocumentDropdown onSelect={handleUpload} existingTypes={existingTypes} />
        <p className="text-[#475569] text-xs mt-4">or drag files anywhere on this page</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress Header */}
      <div className="bg-[#0B1220] border border-white/5 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-[#64748B]">Progress</span>
          {onManageBundle && (
            <button
              onClick={onManageBundle}
              className="text-xs font-medium text-[#8B5CF6] hover:text-[#8B5CF6]/80 transition-colors"
            >
              {bundle ? 'Manage Bundle' : 'Create Bundle'}
            </button>
          )}
        </div>

        {/* Progress Bar */}
        <div className="h-2 bg-[#1E293B] rounded-full overflow-hidden mb-2">
          <div
            className="h-full bg-[#8B5CF6] transition-all duration-500 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Progress Stats */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-[#8FA3BF]">
            <span className="text-white font-medium">{requiredDocsUploaded}</span> of {REQUIRED_DOCUMENT_TYPES.length} required
          </span>
          <span className="text-[#64748B]">
            {documents.length} total documents
          </span>
        </div>
      </div>

      {/* Bundle Banner */}
      {bundle && (
        <BundleBanner
          bundle={bundle}
          currentContractId={contractId}
          onManageBundle={onManageBundle}
        />
      )}

      {/* Needs Attention Section */}
      {needsAttention.length > 0 && (
        <DocumentSection
          title="Needs Attention"
          count={needsAttention.length}
          defaultExpanded={true}
          emptyMessage="All required documents uploaded!"
        >
          {needsAttention.map((type, index) => (
            <DocumentRow
              key={type}
              documentType={type}
              isRequired={true}
              onUpload={handleUpload}
              isLast={index === needsAttention.length - 1}
            />
          ))}
        </DocumentSection>
      )}

      {/* Completed Section */}
      {completedDocs.length > 0 && (
        <DocumentSection
          title="Completed"
          count={completedDocs.length}
          defaultExpanded={true}
        >
          {completedDocs.map(({ type, doc }, index) => (
            <DocumentRow
              key={doc.id}
              documentType={type}
              document={doc}
              isRequired={true}
              onView={setPreviewDoc}
              onDownload={handleDownload}
              onDelete={onDelete}
              onReplace={(_, file) => handleUpload(file, type)}
              isLast={index === completedDocs.length - 1}
            />
          ))}
        </DocumentSection>
      )}

      {/* Analysis & Reports Section */}
      <DocumentSection
        title="Analysis & Reports"
        count={analysisDocs.length}
        defaultExpanded={false}
        accentColor="#8B5CF6"
        emptyMessage="No analysis documents yet. Run a comparison to generate reports."
      >
        {analysisDocs.map(({ type, doc }, index) => (
          <DocumentRow
            key={doc.id}
            documentType={type}
            document={doc}
            onView={setPreviewDoc}
            onDownload={handleDownload}
            onDelete={onDelete}
            onReplace={(_, file) => handleUpload(file, type)}
            isLast={index === analysisDocs.length - 1}
          />
        ))}
      </DocumentSection>

      {/* Supporting Documents Section */}
      <DocumentSection
        title="Supporting Documents"
        count={supportingDocs.length}
        defaultExpanded={false}
        emptyMessage="No supporting documents uploaded."
      >
        {supportingDocs.map(({ type, doc }, index) => (
          <DocumentRow
            key={doc.id}
            documentType={type}
            document={doc}
            onView={setPreviewDoc}
            onDownload={handleDownload}
            onDelete={onDelete}
            onReplace={(_, file) => handleUpload(file, type)}
            isLast={index === supportingDocs.length - 1}
          />
        ))}
      </DocumentSection>

      {/* Add Document Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-white/5">
        <AddDocumentDropdown onSelect={handleUpload} existingTypes={existingTypes} />
        <span className="text-[#475569] text-xs">Drag files anywhere to add</span>
      </div>

      {/* Preview Panel */}
      <DocumentPreviewPanel
        document={previewDoc}
        isOpen={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        onDownload={handleDownload}
        onDelete={onDelete}
      />
    </div>
  );
}
