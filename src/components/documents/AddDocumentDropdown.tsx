'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_TYPE_META,
  DocumentType,
  ALL_DOCUMENT_TYPES,
} from '@/lib/constants';

interface AddDocumentDropdownProps {
  onSelect: (file: File, type: DocumentType) => void;
  existingTypes?: string[];
}

export default function AddDocumentDropdown({
  onSelect,
  existingTypes = [],
}: AddDocumentDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<DocumentType | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTypeSelect = (type: DocumentType) => {
    setSelectedType(type);
    setIsOpen(false);
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && selectedType) {
      onSelect(file, selectedType);
      setSelectedType(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const categories = Object.entries(DOCUMENT_CATEGORIES);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-2 text-sm font-medium text-[#8B5CF6] bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 rounded-lg hover:bg-[#8B5CF6]/20 transition-colors flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Document
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 bottom-full mb-2 w-64 bg-[#1E293B] border border-white/10 rounded-lg shadow-2xl z-50 overflow-hidden"
          >
            <div className="py-2 max-h-80 overflow-y-auto">
              {categories.map(([key, category], categoryIndex) => (
                <div key={key}>
                  {categoryIndex > 0 && (
                    <div className="border-t border-white/10 my-1" />
                  )}
                  <div className="px-3 py-1.5 text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                    {category.label}
                  </div>
                  {category.types.map((type) => {
                    const meta = DOCUMENT_TYPE_META[type];
                    const hasExisting = existingTypes.includes(type);
                    return (
                      <button
                        key={type}
                        onClick={() => handleTypeSelect(type)}
                        disabled={hasExisting && type !== 'Other'}
                        className={`w-full px-3 py-2 text-left flex items-center gap-3 transition-colors ${
                          hasExisting && type !== 'Other'
                            ? 'opacity-50 cursor-not-allowed'
                            : 'hover:bg-white/5'
                        }`}
                      >
                        <span className="text-lg">{meta.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-white flex items-center gap-2">
                            {type}
                            {hasExisting && type !== 'Other' && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400">
                                Uploaded
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
