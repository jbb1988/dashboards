'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DocumentPreviewPanel from './DocumentPreviewPanel';
import BundleBanner from './BundleBanner';
import { DocumentData } from './DocumentRow';
import {
  REQUIRED_DOCUMENT_TYPES,
  ANALYSIS_DOCUMENT_TYPES,
  SUPPORTING_DOCUMENT_TYPES,
  DOCUMENT_TYPE_META,
  DocumentType,
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

// Document Type Button Component - Inline clickable tile
function DocumentTypeButton({
  type,
  document,
  isUploading,
  onUpload,
  onView,
  index,
}: {
  type: DocumentType;
  document?: DocumentData;
  isUploading: boolean;
  onUpload: (file: File, type: DocumentType) => void;
  onView: (doc: DocumentData) => void;
  index: number;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const meta = DOCUMENT_TYPE_META[type];
  const hasDoc = !!document;

  const handleClick = () => {
    if (hasDoc && document) {
      onView(document);
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file, type);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.2 }}
      onClick={handleClick}
      disabled={isUploading}
      className={`
        relative flex items-center gap-3 p-3 rounded-lg text-left transition-all duration-200 group
        ${hasDoc
          ? 'bg-[#22C55E]/10 border border-[#22C55E]/30 hover:bg-[#22C55E]/15 hover:border-[#22C55E]/50'
          : 'bg-[#151F2E] border border-white/[0.06] hover:bg-[#1E293B] hover:border-white/[0.12]'
        }
        ${isUploading ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
      `}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.xls,.xlsx"
        onChange={handleFileSelect}
      />

      {/* Icon container */}
      <div
        className={`
          w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-lg
          ${hasDoc ? 'bg-[#22C55E]/20' : 'bg-white/[0.04]'}
        `}
      >
        {isUploading ? (
          <div className="w-4 h-4 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
        ) : (
          meta.icon
        )}
      </div>

      {/* Label */}
      <span className={`flex-1 text-sm font-medium truncate ${hasDoc ? 'text-[#22C55E]' : 'text-white/80 group-hover:text-white'}`}>
        {type}
      </span>

      {/* Status indicator */}
      {hasDoc ? (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
          className="w-5 h-5 rounded-full bg-[#22C55E] flex items-center justify-center flex-shrink-0"
        >
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </motion.div>
      ) : (
        <svg
          className="w-4 h-4 text-white/30 group-hover:text-white/60 transition-colors flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      )}
    </motion.button>
  );
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
      if (doc.document_type === 'Other') {
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
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="h-full bg-[#8B5CF6] rounded-full"
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

      {/* Required Documents Section */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Required</span>
          <span className="text-xs text-[#475569]">
            ({REQUIRED_DOCUMENT_TYPES.filter(t => documentsByType.has(t)).length}/{REQUIRED_DOCUMENT_TYPES.length})
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {REQUIRED_DOCUMENT_TYPES.map((type, index) => (
            <DocumentTypeButton
              key={type}
              type={type}
              document={documentsByType.get(type)}
              isUploading={uploadingType === type}
              onUpload={handleUpload}
              onView={setPreviewDoc}
              index={index}
            />
          ))}
        </div>
      </div>

      {/* Analysis & Reports Section */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-semibold text-[#8B5CF6] uppercase tracking-wider">Analysis & Reports</span>
          <span className="text-xs text-[#475569]">
            ({ANALYSIS_DOCUMENT_TYPES.filter(t => documentsByType.has(t)).length}/{ANALYSIS_DOCUMENT_TYPES.length})
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {ANALYSIS_DOCUMENT_TYPES.map((type, index) => (
            <DocumentTypeButton
              key={type}
              type={type}
              document={documentsByType.get(type)}
              isUploading={uploadingType === type}
              onUpload={handleUpload}
              onView={setPreviewDoc}
              index={index + REQUIRED_DOCUMENT_TYPES.length}
            />
          ))}
        </div>
      </div>

      {/* Drag & Drop Hint */}
      <p className="text-[#475569] text-xs text-center pt-2">
        or drag files anywhere on this page
      </p>

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
