'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface DocumentItem {
  id: string;
  document_type: string;
  file_name: string;
  file_url: string;
  file_size?: number;
  uploaded_at?: string;
  uploaded_by?: string;
  status: 'draft' | 'under_review' | 'awaiting_signature' | 'executed' | 'expired' | 'superseded' | 'missing';
  contract_id: string;
  contract_name: string;
  account_name: string;
  is_required: boolean;
  version?: number;
  // Bundle fields (NEW)
  bundle_id?: string | null;
  bundle_name?: string | null;
  // Salesforce sync fields
  salesforce_id?: string;
  sf_content_document_id?: string;
  sf_synced_at?: string;
  sf_sync_error?: string;
}

interface DocumentDetailDrawerProps {
  document: DocumentItem | null;
  onClose: () => void;
  onUpload?: (file: File, documentType: string, contractId: string) => void;
  onDownload?: (doc: DocumentItem) => void;
  onDelete?: (doc: DocumentItem) => void;
  onReplace?: (doc: DocumentItem, file: File) => void;
  onSfSync?: (doc: DocumentItem) => void;
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: '#64748B', bg: 'bg-gray-500/10' },
  under_review: { label: 'Under Review', color: '#3B82F6', bg: 'bg-blue-500/10' },
  awaiting_signature: { label: 'Awaiting Signature', color: '#F59E0B', bg: 'bg-amber-500/10' },
  executed: { label: 'Executed', color: '#22C55E', bg: 'bg-green-500/10' },
  expired: { label: 'Expired', color: '#EF4444', bg: 'bg-red-500/10' },
  superseded: { label: 'Superseded', color: '#6B7280', bg: 'bg-gray-500/10' },
  missing: { label: 'Missing', color: '#EF4444', bg: 'bg-red-500/10' },
};

function formatFileSize(bytes?: number): string {
  if (!bytes) return 'Unknown';
  if (bytes >= 1000000) return `${(bytes / 1000000).toFixed(1)} MB`;
  if (bytes >= 1000) return `${(bytes / 1000).toFixed(0)} KB`;
  return `${bytes} B`;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return 'Unknown';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function DocumentDetailDrawer({
  document,
  onClose,
  onUpload,
  onDownload,
  onDelete,
  onReplace,
  onSfSync,
}: DocumentDetailDrawerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [previewError, setPreviewError] = useState(false);
  const [isSyncingToSf, setIsSyncingToSf] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (document) {
      setIsLoading(true);
      setPreviewError(false);
      setSyncResult(null);
    }
  }, [document?.id]);

  // Push document to Salesforce
  const handlePushToSalesforce = async () => {
    if (!document || isSyncingToSf) return;

    setIsSyncingToSf(true);
    setSyncResult(null);

    try {
      const response = await fetch('/api/contracts/documents/push-to-sf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: document.id }),
      });

      const data = await response.json();

      if (response.ok) {
        setSyncResult({ success: true, message: 'Document pushed to Salesforce successfully!' });
        // Notify parent to refresh document data
        onSfSync?.(document);
      } else {
        setSyncResult({ success: false, message: data.error || 'Failed to sync to Salesforce' });
      }
    } catch (error) {
      setSyncResult({ success: false, message: 'Network error. Please try again.' });
    } finally {
      setIsSyncingToSf(false);
    }
  };

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

  if (!document) return null;

  const isMissing = document.status === 'missing';
  const isPDF = document.file_name?.toLowerCase().endsWith('.pdf');
  const isValidUrl = document.file_url &&
    !document.file_url.startsWith('#local:') &&
    (document.file_url.startsWith('http') || document.file_url.startsWith('/'));
  const canPreview = isPDF && isValidUrl && !previewError && !isMissing;

  const statusMeta = STATUS_META[document.status] || STATUS_META.draft;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (isMissing && onUpload) {
        onUpload(file, document.document_type, document.contract_id);
      } else if (onReplace) {
        onReplace(document, file);
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getPreviewMessage = () => {
    if (isMissing) {
      return {
        title: 'Document Not Uploaded',
        subtitle: document.is_required ? 'This is a required document. Click below to upload.' : 'Upload this document when ready.',
        icon: (
          <svg className="w-10 h-10 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        ),
      };
    }
    if (!isValidUrl) {
      return {
        title: 'File not yet synced',
        subtitle: 'This document was uploaded locally and needs to be synced to cloud storage for preview.',
        icon: (
          <svg className="w-10 h-10 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        ),
      };
    }
    if (previewError) {
      return {
        title: 'Preview failed to load',
        subtitle: 'Click "Open in New Tab" to view the document directly.',
        icon: (
          <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      };
    }
    return {
      title: 'Preview not available',
      subtitle: `${document.file_name?.split('.').pop()?.toUpperCase() || 'This file type'} files cannot be previewed. Click "Open" to view.`,
      icon: (
        <svg className="w-10 h-10 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    };
  };

  const previewMessage = getPreviewMessage();

  return (
    <AnimatePresence>
      {document && (
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
            className="fixed right-0 top-0 bottom-0 w-[480px] bg-[#151F2E] border-l border-white/[0.06] shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex-shrink-0 sticky top-0 bg-[#151F2E] border-b border-white/[0.06] z-10">
              <div className="flex items-start justify-between p-5">
                <div className="flex-1 min-w-0 pr-4">
                  {/* Document Type */}
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-2.5 h-2.5 rounded-full ${isMissing ? 'border-2 border-[#EF4444]' : 'bg-[#22C55E]'}`} />
                    <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                      {document.document_type}
                    </span>
                    {document.is_required && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 font-medium uppercase">
                        Required
                      </span>
                    )}
                  </div>

                  {/* Bundle Badge (if applicable) */}
                  {document.bundle_id && document.bundle_name && (
                    <div className="mb-2 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-purple-500/20 text-purple-400">
                        <span>📦</span>
                        <span>{document.bundle_name}</span>
                      </span>
                      <span className="text-[10px] text-[#64748B]">Bundle Document</span>
                    </div>
                  )}

                  {/* Contract Name */}
                  <h2 className="text-[17px] font-semibold text-white leading-tight mb-1">
                    {document.contract_name}
                  </h2>

                  {/* Account Name */}
                  <p className="text-[13px] text-[#8FA3BF]">
                    {document.account_name}
                  </p>

                  {/* Status Badge */}
                  <div className="mt-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${statusMeta.bg}`}
                      style={{ color: statusMeta.color }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusMeta.color }} />
                      {statusMeta.label}
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

            {/* Preview Area */}
            <div className="flex-1 overflow-hidden bg-[#0B1220]">
              {canPreview ? (
                <div className="w-full h-full relative">
                  {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#0B1220]">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-2 border-[#8B5CF6] border-t-transparent rounded-full animate-spin" />
                        <span className="text-[#64748B] text-sm">Loading preview...</span>
                      </div>
                    </div>
                  )}
                  <iframe
                    src={`${document.file_url}#toolbar=0&navpanes=0`}
                    className="w-full h-full border-0"
                    onLoad={() => setIsLoading(false)}
                    onError={() => {
                      setIsLoading(false);
                      setPreviewError(true);
                    }}
                    title={document.file_name}
                  />
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center px-6">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-[#151F2E] flex items-center justify-center border border-white/5">
                      {previewMessage.icon}
                    </div>
                    <p className="text-[#8FA3BF] text-sm mb-1">{previewMessage.title}</p>
                    <p className="text-[#64748B] text-xs max-w-xs mx-auto">{previewMessage.subtitle}</p>

                    {/* Upload Button for Missing Documents */}
                    {isMissing && onUpload && (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-4 px-5 py-2.5 bg-[#8B5CF6] text-white text-sm font-medium rounded-lg hover:bg-[#8B5CF6]/90 transition-colors inline-flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        Upload Document
                      </button>
                    )}

                    {/* Open in New Tab Button */}
                    {!isMissing && isValidUrl && (
                      <button
                        onClick={() => window.open(document.file_url, '_blank')}
                        className="mt-4 px-4 py-2 bg-[#8B5CF6] text-white text-sm font-medium rounded-lg hover:bg-[#8B5CF6]/90 transition-colors inline-flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        Open in New Tab
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Metadata Section */}
            {!isMissing && (
              <div className="flex-shrink-0 border-t border-white/[0.06] bg-[#151F2E]">
                <div className="px-5 py-4">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-[#64748B] block text-[10px] uppercase tracking-wider font-medium mb-1">File Name</span>
                      <span className="text-[#8FA3BF] text-[13px] truncate block" title={document.file_name}>
                        {document.file_name}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#64748B] block text-[10px] uppercase tracking-wider font-medium mb-1">Size</span>
                      <span className="text-[#8FA3BF] text-[13px]">{formatFileSize(document.file_size)}</span>
                    </div>
                    {document.version && document.version > 1 && (
                      <div>
                        <span className="text-[#64748B] block text-[10px] uppercase tracking-wider font-medium mb-1">Version</span>
                        <span className="text-[#8FA3BF] text-[13px]">v{document.version}</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-white/[0.04]">
                    <div>
                      <span className="text-[#64748B] block text-[10px] uppercase tracking-wider font-medium mb-1">Uploaded</span>
                      <span className="text-[#8FA3BF] text-[13px]">{formatDate(document.uploaded_at)}</span>
                    </div>
                    {document.uploaded_by && (
                      <div>
                        <span className="text-[#64748B] block text-[10px] uppercase tracking-wider font-medium mb-1">By</span>
                        <span className="text-[#8FA3BF] text-[13px]">{document.uploaded_by}</span>
                      </div>
                    )}
                  </div>

                  {/* Salesforce Sync Status */}
                  {document.salesforce_id && (
                    <div className="mt-3 pt-3 border-t border-white/[0.04]">
                      <span className="text-[#64748B] block text-[10px] uppercase tracking-wider font-medium mb-2">Salesforce</span>
                      {document.sf_content_document_id ? (
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-green-400 text-xs">Synced to Account Files</span>
                          {document.sf_synced_at && (
                            <span className="text-[#64748B] text-[10px]">
                              ({formatDate(document.sf_synced_at)})
                            </span>
                          )}
                        </div>
                      ) : document.sf_sync_error ? (
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-red-400 text-xs" title={document.sf_sync_error}>Sync failed</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          <span className="text-[#64748B] text-xs">Not synced to Salesforce</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Sync Result Message */}
                  {syncResult && (
                    <div className={`mt-3 p-2 rounded-lg text-xs ${
                      syncResult.success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                    }`}>
                      {syncResult.message}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex-shrink-0 border-t border-white/[0.06] bg-[#0F1722] px-5 py-4">
              {isMissing ? (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full px-4 py-3 bg-[#8B5CF6] text-white font-medium text-sm rounded-lg hover:bg-[#8B5CF6]/90 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Upload {document.document_type}
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  {/* Download Button */}
                  <button
                    onClick={() => onDownload?.(document)}
                    className="flex-1 px-4 py-2.5 bg-[#8B5CF6] text-white font-medium text-sm rounded-lg hover:bg-[#8B5CF6]/90 transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download
                  </button>

                  {/* Open Button */}
                  {isValidUrl && (
                    <button
                      onClick={() => window.open(document.file_url, '_blank')}
                      className="px-4 py-2.5 bg-white/10 text-white font-medium text-sm rounded-lg hover:bg-white/20 transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Open
                    </button>
                  )}

                  {/* Replace Button */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2.5 text-[#64748B] hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    title="Replace"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>

                  {/* Push to Salesforce Button */}
                  {document.salesforce_id && !document.sf_content_document_id && (
                    <button
                      onClick={handlePushToSalesforce}
                      disabled={isSyncingToSf}
                      className={`p-2.5 rounded-lg transition-colors ${
                        isSyncingToSf
                          ? 'text-[#64748B] cursor-not-allowed'
                          : 'text-[#00A1E0] hover:bg-[#00A1E0]/10'
                      }`}
                      title="Push to Salesforce"
                    >
                      {isSyncingToSf ? (
                        <div className="w-5 h-5 border-2 border-[#00A1E0] border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12.5 2c1.9 0 3.5 1.1 4.3 2.7.8-.4 1.6-.7 2.5-.7 2.9 0 5.2 2.3 5.2 5.2 0 1.1-.3 2.1-.9 3-.1.1-.1.2-.1.3 0 .2.1.4.3.5.3.2.5.5.7.8.2.4.3.9.3 1.4 0 1.8-1.5 3.3-3.3 3.3h-4.7c-.3 0-.5-.2-.5-.5v-6.2l1.6 1.6c.2.2.5.2.7 0 .2-.2.2-.5 0-.7l-2.5-2.5c-.1-.1-.2-.1-.4-.1s-.3 0-.4.1l-2.5 2.5c-.2.2-.2.5 0 .7.2.2.5.2.7 0l1.6-1.6v6.2c0 .3-.2.5-.5.5H8.8c-3.5 0-6.3-2.8-6.3-6.3 0-3.1 2.3-5.7 5.3-6.2.6-2.4 2.8-4.1 5.2-4.1l-.5-.1z"/>
                        </svg>
                      )}
                    </button>
                  )}

                  {/* Delete Button */}
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this document?')) {
                        onDelete?.(document);
                        onClose();
                      }
                    }}
                    className="p-2.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
              onChange={handleFileSelect}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
