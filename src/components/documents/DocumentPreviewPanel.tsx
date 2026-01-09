'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DocumentData } from './DocumentRow';

interface DocumentPreviewPanelProps {
  document: DocumentData | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload?: (doc: DocumentData) => void;
  onDelete?: (doc: DocumentData) => void;
}

export default function DocumentPreviewPanel({
  document,
  isOpen,
  onClose,
  onDownload,
  onDelete,
}: DocumentPreviewPanelProps) {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
    }
  }, [isOpen, document?.id]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Unknown';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown';
    if (bytes >= 1000000) return `${(bytes / 1000000).toFixed(1)} MB`;
    if (bytes >= 1000) return `${(bytes / 1000).toFixed(0)} KB`;
    return `${bytes} B`;
  };

  const isPDF = document?.file_name?.toLowerCase().endsWith('.pdf');

  return (
    <AnimatePresence>
      {isOpen && document && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full max-w-2xl bg-[#0F172A] border-l border-white/10 shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-white truncate">
                  {document.document_type}
                </h3>
                <p className="text-sm text-[#64748B] truncate mt-0.5">
                  {document.file_name}
                </p>
              </div>
              <button
                onClick={onClose}
                className="ml-4 p-2 text-[#64748B] hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Preview Area */}
            <div className="flex-1 overflow-hidden bg-[#1E293B]">
              {isPDF ? (
                <div className="w-full h-full relative">
                  {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#1E293B]">
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
                    title={document.file_name}
                  />
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-[#0B1220] flex items-center justify-center">
                      <svg className="w-10 h-10 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-[#8FA3BF] text-sm mb-1">Preview not available</p>
                    <p className="text-[#64748B] text-xs">Download the file to view it</p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-white/10 bg-[#0F172A]">
              {/* Metadata */}
              <div className="px-6 py-3 border-b border-white/5">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-[#64748B] block text-xs uppercase tracking-wider mb-1">Size</span>
                    <span className="text-[#8FA3BF]">{formatFileSize(document.file_size)}</span>
                  </div>
                  <div>
                    <span className="text-[#64748B] block text-xs uppercase tracking-wider mb-1">Uploaded</span>
                    <span className="text-[#8FA3BF]">{formatDate(document.uploaded_at)}</span>
                  </div>
                  {document.source_contract && (
                    <div>
                      <span className="text-[#64748B] block text-xs uppercase tracking-wider mb-1">Source</span>
                      <span className="text-[#8B5CF6]">{document.source_contract.name}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="px-6 py-4 flex items-center gap-3">
                <button
                  onClick={() => onDownload?.(document)}
                  className="flex-1 px-4 py-2.5 bg-[#8B5CF6] text-white font-medium text-sm rounded-lg hover:bg-[#8B5CF6]/90 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                </button>
                <button
                  onClick={() => window.open(document.file_url, '_blank')}
                  className="px-4 py-2.5 bg-white/10 text-white font-medium text-sm rounded-lg hover:bg-white/20 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Open
                </button>
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
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
