'use client';

import { useState, useRef } from 'react';
import { DOCUMENT_TYPE_META, DocumentType } from '@/lib/constants';

export interface DocumentData {
  id: string;
  document_type: string;
  file_name: string;
  file_url: string;
  file_size?: number;
  uploaded_at?: string;
  uploaded_by?: string;
  source_contract?: {
    id: string;
    name: string;
  };
}

interface DocumentRowProps {
  documentType: DocumentType;
  document?: DocumentData;
  isRequired?: boolean;
  onUpload?: (file: File, type: DocumentType) => void;
  onView?: (doc: DocumentData) => void;
  onDownload?: (doc: DocumentData) => void;
  onDelete?: (doc: DocumentData) => void;
  onReplace?: (doc: DocumentData, file: File) => void;
  isLast?: boolean;
}

export default function DocumentRow({
  documentType,
  document,
  isRequired = false,
  onUpload,
  onView,
  onDownload,
  onDelete,
  onReplace,
  isLast = false,
}: DocumentRowProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const meta = DOCUMENT_TYPE_META[documentType];
  const hasDocument = !!document;

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes >= 1000000) return `${(bytes / 1000000).toFixed(1)} MB`;
    if (bytes >= 1000) return `${(bytes / 1000).toFixed(0)} KB`;
    return `${bytes} B`;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (document && onReplace) {
        onReplace(document, file);
      } else if (onUpload) {
        onUpload(file, documentType);
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (document && onReplace) {
        onReplace(document, file);
      } else if (onUpload) {
        onUpload(file, documentType);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  return (
    <div
      className={`relative flex items-center gap-3 px-4 py-3 transition-colors ${
        isDragOver ? 'bg-[#8B5CF6]/10' : isHovered ? 'bg-white/5' : ''
      } ${!isLast ? 'border-b border-white/5' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setShowMenu(false);
      }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Status Indicator */}
      <div
        className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
          hasDocument
            ? 'bg-[#22C55E]'
            : 'border-2 border-[#475569]'
        }`}
      >
        {hasDocument && (
          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>

      {/* Document Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-white text-sm font-medium">{documentType}</span>
          {isRequired && !hasDocument && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 font-medium">
              Required
            </span>
          )}
        </div>
        {hasDocument ? (
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[#8FA3BF] text-xs truncate">
              {document.file_name}
            </span>
            {document.file_size && (
              <>
                <span className="text-[#475569] text-xs">•</span>
                <span className="text-[#64748B] text-xs">
                  {formatFileSize(document.file_size)}
                </span>
              </>
            )}
            {document.source_contract && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#8B5CF6]/10 text-[#8B5CF6] font-medium flex items-center gap-1">
                <span>from {document.source_contract.name}</span>
              </span>
            )}
          </div>
        ) : (
          <span className="text-[#475569] text-xs">No document uploaded</span>
        )}
      </div>

      {/* Actions */}
      <div className={`flex items-center gap-2 transition-opacity ${isHovered || showMenu ? 'opacity-100' : 'opacity-0'}`}>
        {hasDocument ? (
          <>
            <button
              onClick={() => onView?.(document!)}
              className="px-3 py-1.5 text-xs font-medium text-white bg-[#8B5CF6] rounded-lg hover:bg-[#8B5CF6]/80 transition-colors"
            >
              View
            </button>
            <button
              onClick={() => onDownload?.(document!)}
              className="p-1.5 text-[#64748B] hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="Download"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1.5 text-[#64748B] hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
              {showMenu && (
                <div className="absolute right-0 top-full mt-1 w-40 bg-[#1E293B] border border-white/10 rounded-lg shadow-xl z-50 py-1 overflow-hidden">
                  <button
                    onClick={() => {
                      onDownload?.(document!);
                      setShowMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-[#8FA3BF] hover:bg-white/5 hover:text-white transition-colors"
                  >
                    Download
                  </button>
                  <button
                    onClick={() => {
                      fileInputRef.current?.click();
                      setShowMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-[#8FA3BF] hover:bg-white/5 hover:text-white transition-colors"
                  >
                    Replace
                  </button>
                  <button
                    onClick={() => {
                      onDelete?.(document!);
                      setShowMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    Delete
                  </button>
                  <div className="border-t border-white/10 my-1" />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(document!.file_url);
                      setShowMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-[#8FA3BF] hover:bg-white/5 hover:text-white transition-colors"
                  >
                    Copy Link
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 text-xs font-medium text-[#8B5CF6] bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 rounded-lg hover:bg-[#8B5CF6]/20 transition-colors"
          >
            + Upload
          </button>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.xls,.xlsx"
        onChange={handleFileSelect}
      />
    </div>
  );
}
