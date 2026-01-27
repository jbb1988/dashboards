'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import {
  Plus,
  FileText,
  Upload,
  GitCompare,
  ChevronDown,
  X,
  Loader2,
  AlertCircle,
  Sparkles,
  Clock,
  CheckCircle,
  FileCheck,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import { elevation, colors } from '@/components/mars-ui/tokens';

// Dynamically import RedlineEditor to avoid SSR issues with TipTap
const RedlineEditor = dynamic(
  () => import('@/components/contracts/RedlineEditor'),
  { ssr: false, loading: () => <div className="h-full bg-[rgba(20,30,50,0.5)] animate-pulse rounded-xl" /> }
);
import type {
  Contract,
  ReviewResult,
  ReviewHistory,
  Approval,
  PlaybookOption,
  CenterContentMode,
  SelectedItem,
} from './ContractCommandCenter';

// =============================================================================
// TYPES
// =============================================================================

interface SectionCompareResult {
  sections: Array<{
    sectionNumber: string;
    sectionTitle: string;
    status: 'unchanged' | 'changed' | 'added' | 'removed';
    originalContent: string;
    revisedContent: string;
    changes: Array<{
      type: 'equal' | 'insert' | 'delete';
      value: string;
    }>;
  }>;
  stats: {
    totalSections: number;
    unchangedSections: number;
    changedSections: number;
    addedSections: number;
    removedSections: number;
  };
}

interface ContractCenterContentProps {
  mode: CenterContentMode;
  selectedItem: SelectedItem | null;
  currentResult: ReviewResult | null;
  error: string | null;
  isAnalyzing: boolean;
  // Form state
  contracts: Contract[];
  selectedContract: string;
  onSelectContract: (id: string) => void;
  provisionName: string;
  onProvisionNameChange: (name: string) => void;
  inputText: string;
  onInputTextChange: (text: string) => void;
  uploadedFile: File | null;
  onUploadFile: (file: File | null) => void;
  extractedText: string | null;
  onExtractedTextChange: (text: string | null) => void;
  activeInputTab: 'paste' | 'upload' | 'compare';
  onInputTabChange: (tab: 'paste' | 'upload' | 'compare') => void;
  isExtracting: boolean;
  onSetExtracting: (extracting: boolean) => void;
  playbooks: PlaybookOption[];
  selectedPlaybook: string;
  onSelectPlaybook: (id: string) => void;
  playbookContent: string;
  onPlaybookContentChange: (content: string) => void;
  // Actions
  onAnalyze: () => void;
  onNewReview: () => void;
  // Stats for empty state
  pendingCount: number;
  inProgressCount: number;
  totalReviewsThisMonth: number;
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function EmptyState({
  pendingCount,
  inProgressCount,
  totalReviewsThisMonth,
  onNewReview,
}: {
  pendingCount: number;
  inProgressCount: number;
  totalReviewsThisMonth: number;
  onNewReview: () => void;
}) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div
          className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center"
          style={{
            background: elevation.L2.background,
            boxShadow: elevation.L2.shadow,
          }}
        >
          <FileText className="w-10 h-10 text-[rgba(90,130,255,0.95)]" />
        </div>

        <h2 className="text-[20px] font-semibold text-[rgba(235,240,255,0.92)] mb-2">
          Contract Workspace
        </h2>
        <p className="text-[14px] text-[rgba(200,210,235,0.60)] mb-6">
          Start a new review or select one from the sidebar to continue.
        </p>

        <button
          onClick={onNewReview}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-[14px] transition-all duration-[180ms]"
          style={{
            background: 'linear-gradient(180deg, rgba(90,130,255,0.30), rgba(90,130,255,0.20))',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 4px 20px rgba(90,130,255,0.30)',
            color: 'rgba(235,240,255,0.95)',
          }}
        >
          <Plus className="w-5 h-5" />
          New Review
        </button>

        <div className="mt-10 pt-8 border-t border-[rgba(255,255,255,0.06)]">
          <h3 className="text-[12px] font-semibold text-[rgba(200,210,235,0.50)] mb-4">
            Quick Stats
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div
              className="p-4 rounded-xl"
              style={{
                background: 'rgba(255,190,90,0.08)',
                border: '1px solid rgba(255,190,90,0.15)',
              }}
            >
              <div className="text-[24px] font-bold text-[rgba(255,190,90,0.95)]">
                {pendingCount}
              </div>
              <div className="text-[11px] text-[rgba(200,210,235,0.60)]">
                Pending approvals
              </div>
            </div>
            <div
              className="p-4 rounded-xl"
              style={{
                background: 'rgba(90,130,255,0.08)',
                border: '1px solid rgba(90,130,255,0.15)',
              }}
            >
              <div className="text-[24px] font-bold text-[rgba(90,130,255,0.95)]">
                {inProgressCount}
              </div>
              <div className="text-[11px] text-[rgba(200,210,235,0.60)]">
                Reviews in progress
              </div>
            </div>
            <div
              className="p-4 rounded-xl"
              style={{
                background: 'rgba(80,210,140,0.08)',
                border: '1px solid rgba(80,210,140,0.15)',
              }}
            >
              <div className="text-[24px] font-bold text-[rgba(80,210,140,0.95)]">
                {totalReviewsThisMonth}
              </div>
              <div className="text-[11px] text-[rgba(200,210,235,0.60)]">
                This month
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContractSelector({
  contracts,
  selectedContract,
  onSelect,
  searchQuery,
  onSearchChange,
  isOpen,
  onToggle,
}: {
  contracts: Contract[];
  selectedContract: string;
  onSelect: (id: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedContractData = contracts.find(c => c.id === selectedContract);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onToggle();
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onToggle]);

  const filteredContracts = contracts.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.contractType?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-all duration-[180ms]"
        style={{
          background: 'rgba(10,14,20,0.60)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <span className={selectedContractData ? 'text-[rgba(235,240,255,0.92)]' : 'text-[rgba(200,210,235,0.40)]'}>
          {selectedContractData?.name || 'Select a contract (optional)'}
        </span>
        <ChevronDown className={`w-4 h-4 text-[rgba(200,210,235,0.50)] transition-transform duration-[180ms] ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 w-full mt-2 rounded-xl overflow-hidden"
            style={{
              background: elevation.L2.background,
              boxShadow: '0 20px 60px rgba(0,0,0,0.50), inset 0 1px 0 rgba(255,255,255,0.10)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div className="p-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search contracts..."
                className="w-full px-3 py-2 text-[13px] rounded-lg bg-[rgba(10,14,20,0.60)] border border-[rgba(255,255,255,0.06)] text-[rgba(235,240,255,0.92)] placeholder-[rgba(200,210,235,0.40)] focus:outline-none focus:border-[rgba(90,130,255,0.50)]"
                autoFocus
              />
            </div>
            <div className="max-h-[240px] overflow-y-auto">
              {filteredContracts.slice(0, 10).map(contract => (
                <button
                  key={contract.id}
                  onClick={() => {
                    onSelect(contract.id);
                    onToggle();
                  }}
                  className={`w-full px-4 py-3 text-left transition-colors duration-[180ms] ${
                    selectedContract === contract.id
                      ? 'bg-[rgba(90,130,255,0.15)]'
                      : 'hover:bg-[rgba(255,255,255,0.04)]'
                  }`}
                >
                  <div className="text-[13px] font-medium text-[rgba(235,240,255,0.92)]">
                    {contract.name}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {contract.contractType?.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[rgba(139,92,246,0.15)] text-[rgba(139,92,246,0.95)]">
                        {contract.contractType.join(', ')}
                      </span>
                    )}
                    {contract.value && (
                      <span className="text-[10px] text-[rgba(200,210,235,0.50)]">
                        ${contract.value.toLocaleString()}
                      </span>
                    )}
                  </div>
                </button>
              ))}
              {filteredContracts.length === 0 && (
                <div className="px-4 py-6 text-center text-[13px] text-[rgba(200,210,235,0.40)]">
                  No contracts found
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InputTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: 'paste' | 'upload' | 'compare';
  onTabChange: (tab: 'paste' | 'upload' | 'compare') => void;
}) {
  const tabs = [
    { id: 'paste' as const, label: 'Paste', icon: FileText },
    { id: 'upload' as const, label: 'Upload', icon: Upload },
    { id: 'compare' as const, label: 'Compare', icon: GitCompare },
  ];

  return (
    <div className="flex gap-1 p-1 rounded-xl bg-[rgba(10,14,20,0.40)]">
      {tabs.map(tab => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-all duration-[180ms] ${
              isActive
                ? 'bg-[rgba(90,130,255,0.20)] text-[rgba(235,240,255,0.95)]'
                : 'text-[rgba(200,210,235,0.60)] hover:text-[rgba(235,240,255,0.92)] hover:bg-[rgba(255,255,255,0.04)]'
            }`}
            style={isActive ? { boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)' } : undefined}
          >
            <Icon className="w-4 h-4" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function ContractCenterContent({
  mode,
  selectedItem,
  currentResult,
  error,
  isAnalyzing,
  contracts,
  selectedContract,
  onSelectContract,
  provisionName,
  onProvisionNameChange,
  inputText,
  onInputTextChange,
  uploadedFile,
  onUploadFile,
  extractedText,
  onExtractedTextChange,
  activeInputTab,
  onInputTabChange,
  isExtracting,
  onSetExtracting,
  playbooks,
  selectedPlaybook,
  onSelectPlaybook,
  playbookContent,
  onPlaybookContentChange,
  onAnalyze,
  onNewReview,
  pendingCount,
  inProgressCount,
  totalReviewsThisMonth,
}: ContractCenterContentProps) {
  const [contractDropdownOpen, setContractDropdownOpen] = useState(false);
  const [contractSearch, setContractSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compare Documents state
  const [compareOriginalFile, setCompareOriginalFile] = useState<File | null>(null);
  const [compareRevisedFile, setCompareRevisedFile] = useState<File | null>(null);
  const [compareOriginalText, setCompareOriginalText] = useState<string | null>(null);
  const [compareRevisedText, setCompareRevisedText] = useState<string | null>(null);
  const [isExtractingOriginal, setIsExtractingOriginal] = useState(false);
  const [isExtractingRevised, setIsExtractingRevised] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [compareResult, setCompareResult] = useState<SectionCompareResult | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);
  const compareOriginalInputRef = useRef<HTMLInputElement>(null);
  const compareRevisedInputRef = useRef<HTMLInputElement>(null);

  // Handle file upload
  const handleFileUpload = useCallback(async (file: File) => {
    onUploadFile(file);
    onSetExtracting(true);
    onExtractedTextChange(null);

    try {
      // Get signed upload URL
      const signedUrlRes = await fetch(`/api/storage/upload?filename=${encodeURIComponent(file.name)}`);
      if (!signedUrlRes.ok) {
        const errData = await signedUrlRes.json();
        throw new Error(errData.error || 'Failed to get upload URL');
      }
      const { signedUrl, storagePath } = await signedUrlRes.json();

      // Upload to storage
      const uploadRes = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!uploadRes.ok) {
        throw new Error('Failed to upload file to storage');
      }

      // Process the file
      const response = await fetch('/api/contracts/review/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storagePath, originalFilename: file.name }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to extract text');
      }

      const data = await response.json();
      onExtractedTextChange(data.text);

      // Cleanup
      await fetch('/api/storage/upload', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storagePath }),
      });
    } catch (err) {
      console.error('File upload error:', err);
      onUploadFile(null);
    } finally {
      onSetExtracting(false);
    }
  }, [onUploadFile, onSetExtracting, onExtractedTextChange]);

  // Handle drag and drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.type === 'application/pdf' || file.name.endsWith('.docx') || file.name.endsWith('.doc'))) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  // Handle compare file upload
  const handleCompareFileUpload = useCallback(async (file: File, type: 'original' | 'revised') => {
    const setFile = type === 'original' ? setCompareOriginalFile : setCompareRevisedFile;
    const setText = type === 'original' ? setCompareOriginalText : setCompareRevisedText;
    const setExtracting = type === 'original' ? setIsExtractingOriginal : setIsExtractingRevised;

    setFile(file);
    setExtracting(true);
    setText(null);
    setCompareError(null);

    try {
      // Get signed upload URL
      const signedUrlRes = await fetch(`/api/storage/upload?filename=${encodeURIComponent(file.name)}`);
      if (!signedUrlRes.ok) {
        const errData = await signedUrlRes.json();
        throw new Error(errData.error || 'Failed to get upload URL');
      }
      const { signedUrl, storagePath } = await signedUrlRes.json();

      // Upload to storage
      const uploadRes = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!uploadRes.ok) {
        throw new Error('Failed to upload file to storage');
      }

      // Process the file
      const response = await fetch('/api/contracts/review/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storagePath, originalFilename: file.name }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to extract text');
      }

      const data = await response.json();
      setText(data.text);

      // Cleanup
      await fetch('/api/storage/upload', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storagePath }),
      });
    } catch (err) {
      console.error('Compare file upload error:', err);
      setFile(null);
      setCompareError(err instanceof Error ? err.message : 'Failed to extract text from file');
    } finally {
      setExtracting(false);
    }
  }, []);

  // Handle compare documents
  const handleCompareDocuments = useCallback(async () => {
    if (!compareOriginalText || !compareRevisedText) {
      setCompareError('Please upload both documents');
      return;
    }

    setIsComparing(true);
    setCompareError(null);
    setCompareResult(null);

    try {
      const response = await fetch('/api/contracts/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalText: compareOriginalText,
          revisedText: compareRevisedText,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Comparison failed');
      }

      const data = await response.json();
      setCompareResult(data.sectionResult);
    } catch (err) {
      setCompareError(err instanceof Error ? err.message : 'Comparison failed');
    } finally {
      setIsComparing(false);
    }
  }, [compareOriginalText, compareRevisedText]);

  // Reset compare state
  const handleResetCompare = useCallback(() => {
    setCompareOriginalFile(null);
    setCompareRevisedFile(null);
    setCompareOriginalText(null);
    setCompareRevisedText(null);
    setCompareResult(null);
    setCompareError(null);
  }, []);

  // ===========================================================================
  // RENDER
  // ===========================================================================

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Empty State */}
      {mode === 'empty' && (
        <EmptyState
          pendingCount={pendingCount}
          inProgressCount={inProgressCount}
          totalReviewsThisMonth={totalReviewsThisMonth}
          onNewReview={onNewReview}
        />
      )}

      {/* New Review Form */}
      {mode === 'new-review' && (
        <div className="flex-1 overflow-y-auto p-6">
          <div
            className="max-w-3xl mx-auto rounded-2xl p-6"
            style={{
              background: elevation.L1.background,
              boxShadow: elevation.L1.shadow,
            }}
          >
            <h2 className="text-[18px] font-semibold text-[rgba(235,240,255,0.92)] mb-6">
              New Contract Review
            </h2>

            {/* Error Display */}
            {error && (
              <div
                className="mb-4 p-4 rounded-xl flex items-start gap-3"
                style={{
                  background: 'rgba(255,95,95,0.10)',
                  border: '1px solid rgba(255,95,95,0.25)',
                }}
              >
                <AlertCircle className="w-5 h-5 text-[rgba(255,95,95,0.95)] flex-shrink-0 mt-0.5" />
                <p className="text-[13px] text-[rgba(255,95,95,0.95)]">{error}</p>
              </div>
            )}

            {/* Contract Selector */}
            <div className="mb-4">
              <label className="block text-[12px] font-medium text-[rgba(200,210,235,0.75)] mb-2">
                Contract
              </label>
              <ContractSelector
                contracts={contracts}
                selectedContract={selectedContract}
                onSelect={onSelectContract}
                searchQuery={contractSearch}
                onSearchChange={setContractSearch}
                isOpen={contractDropdownOpen}
                onToggle={() => setContractDropdownOpen(!contractDropdownOpen)}
              />
            </div>

            {/* Provision Name */}
            <div className="mb-4">
              <label className="block text-[12px] font-medium text-[rgba(200,210,235,0.75)] mb-2">
                Provision Name
              </label>
              <input
                type="text"
                value={provisionName}
                onChange={(e) => onProvisionNameChange(e.target.value)}
                placeholder="e.g., Standard Terms, NDA, MSA..."
                className="w-full px-4 py-3 text-[14px] rounded-xl bg-[rgba(10,14,20,0.60)] border border-[rgba(255,255,255,0.08)] text-[rgba(235,240,255,0.92)] placeholder-[rgba(200,210,235,0.40)] focus:outline-none focus:border-[rgba(90,130,255,0.50)] transition-colors duration-[180ms]"
              />
            </div>

            {/* Input Tabs */}
            <div className="mb-4">
              <InputTabs activeTab={activeInputTab} onTabChange={onInputTabChange} />
            </div>

            {/* Paste Tab */}
            {activeInputTab === 'paste' && (
              <div className="mb-6">
                <textarea
                  value={inputText}
                  onChange={(e) => onInputTextChange(e.target.value)}
                  placeholder="Paste contract text here..."
                  className="w-full h-[280px] px-4 py-3 text-[14px] rounded-xl bg-[rgba(10,14,20,0.60)] border border-[rgba(255,255,255,0.08)] text-[rgba(235,240,255,0.92)] placeholder-[rgba(200,210,235,0.40)] focus:outline-none focus:border-[rgba(90,130,255,0.50)] transition-colors duration-[180ms] resize-none"
                />
              </div>
            )}

            {/* Upload Tab */}
            {activeInputTab === 'upload' && (
              <div className="mb-6">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                  className="hidden"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  className="h-[200px] rounded-xl border-2 border-dashed border-[rgba(255,255,255,0.12)] hover:border-[rgba(90,130,255,0.40)] flex flex-col items-center justify-center cursor-pointer transition-colors duration-[180ms]"
                  style={{ background: 'rgba(10,14,20,0.30)' }}
                >
                  {isExtracting ? (
                    <>
                      <Loader2 className="w-10 h-10 text-[rgba(90,130,255,0.95)] animate-spin mb-3" />
                      <p className="text-[14px] text-[rgba(200,210,235,0.60)]">Extracting text...</p>
                    </>
                  ) : uploadedFile ? (
                    <>
                      <FileCheck className="w-10 h-10 text-[rgba(80,210,140,0.95)] mb-3" />
                      <p className="text-[14px] text-[rgba(235,240,255,0.92)] font-medium">{uploadedFile.name}</p>
                      <p className="text-[12px] text-[rgba(200,210,235,0.50)] mt-1">
                        {extractedText ? `${extractedText.length.toLocaleString()} characters extracted` : 'Processing...'}
                      </p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onUploadFile(null);
                          onExtractedTextChange(null);
                        }}
                        className="mt-3 px-3 py-1.5 text-[12px] rounded-lg text-[rgba(255,95,95,0.95)] hover:bg-[rgba(255,95,95,0.10)] transition-colors"
                      >
                        Remove
                      </button>
                    </>
                  ) : (
                    <>
                      <Upload className="w-10 h-10 text-[rgba(200,210,235,0.40)] mb-3" />
                      <p className="text-[14px] text-[rgba(235,240,255,0.92)]">
                        Drop a file here or click to upload
                      </p>
                      <p className="text-[12px] text-[rgba(200,210,235,0.50)] mt-1">
                        PDF, DOC, or DOCX
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Compare Tab */}
            {activeInputTab === 'compare' && !compareResult && (
              <div className="mb-6 space-y-4">
                {/* Two Upload Zones Side by Side */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Original Document Upload */}
                  <div
                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-[180ms] ${
                      compareOriginalFile
                        ? 'border-[rgba(255,190,90,0.50)] bg-[rgba(255,190,90,0.05)]'
                        : 'border-[rgba(255,255,255,0.12)] hover:border-[rgba(255,190,90,0.50)] hover:bg-[rgba(255,190,90,0.05)]'
                    }`}
                    onClick={() => compareOriginalInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files[0];
                      if (file) handleCompareFileUpload(file, 'original');
                    }}
                  >
                    <input
                      ref={compareOriginalInputRef}
                      type="file"
                      accept=".pdf,.docx,.doc,.txt"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleCompareFileUpload(file, 'original');
                      }}
                    />
                    {isExtractingOriginal ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-8 h-8 text-[rgba(255,190,90,0.95)] animate-spin" />
                        <p className="text-[12px] text-[rgba(200,210,235,0.60)]">Extracting...</p>
                      </div>
                    ) : compareOriginalFile ? (
                      <div className="flex flex-col items-center gap-1">
                        <CheckCircle className="w-8 h-8 text-[rgba(255,190,90,0.95)]" />
                        <p className="text-[13px] font-medium text-[rgba(235,240,255,0.92)] truncate max-w-full">
                          {compareOriginalFile.name}
                        </p>
                        {compareOriginalText && (
                          <p className="text-[11px] text-[rgba(200,210,235,0.50)]">
                            {compareOriginalText.length.toLocaleString()} chars
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <Upload className="w-8 h-8 text-[rgba(200,210,235,0.40)]" />
                        <p className="text-[13px] font-medium text-[rgba(235,240,255,0.92)]">Original Document</p>
                        <p className="text-[11px] text-[rgba(200,210,235,0.50)]">PDF, DOC, DOCX, TXT</p>
                      </div>
                    )}
                  </div>

                  {/* Revised Document Upload */}
                  <div
                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-[180ms] ${
                      compareRevisedFile
                        ? 'border-[rgba(80,210,140,0.50)] bg-[rgba(80,210,140,0.05)]'
                        : 'border-[rgba(255,255,255,0.12)] hover:border-[rgba(80,210,140,0.50)] hover:bg-[rgba(80,210,140,0.05)]'
                    }`}
                    onClick={() => compareRevisedInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files[0];
                      if (file) handleCompareFileUpload(file, 'revised');
                    }}
                  >
                    <input
                      ref={compareRevisedInputRef}
                      type="file"
                      accept=".pdf,.docx,.doc,.txt"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleCompareFileUpload(file, 'revised');
                      }}
                    />
                    {isExtractingRevised ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-8 h-8 text-[rgba(80,210,140,0.95)] animate-spin" />
                        <p className="text-[12px] text-[rgba(200,210,235,0.60)]">Extracting...</p>
                      </div>
                    ) : compareRevisedFile ? (
                      <div className="flex flex-col items-center gap-1">
                        <CheckCircle className="w-8 h-8 text-[rgba(80,210,140,0.95)]" />
                        <p className="text-[13px] font-medium text-[rgba(235,240,255,0.92)] truncate max-w-full">
                          {compareRevisedFile.name}
                        </p>
                        {compareRevisedText && (
                          <p className="text-[11px] text-[rgba(200,210,235,0.50)]">
                            {compareRevisedText.length.toLocaleString()} chars
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <Upload className="w-8 h-8 text-[rgba(200,210,235,0.40)]" />
                        <p className="text-[13px] font-medium text-[rgba(235,240,255,0.92)]">Revised Document</p>
                        <p className="text-[11px] text-[rgba(200,210,235,0.50)]">PDF, DOC, DOCX, TXT</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Compare Error */}
                {compareError && (
                  <div className="p-3 rounded-xl bg-[rgba(255,95,95,0.10)] border border-[rgba(255,95,95,0.25)]">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-[rgba(255,95,95,0.95)] flex-shrink-0 mt-0.5" />
                      <p className="text-[13px] text-[rgba(255,95,95,0.95)]">{compareError}</p>
                    </div>
                  </div>
                )}

                {/* Compare Button */}
                <div className="flex gap-3">
                  <button
                    onClick={handleCompareDocuments}
                    disabled={!compareOriginalText || !compareRevisedText || isComparing}
                    className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-[14px] transition-all duration-[180ms] disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: 'linear-gradient(180deg, rgba(139,92,246,0.40), rgba(139,92,246,0.25))',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15), 0 4px 20px rgba(139,92,246,0.35)',
                      color: 'rgba(235,240,255,0.98)',
                    }}
                  >
                    {isComparing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Comparing...
                      </>
                    ) : (
                      <>
                        <GitCompare className="w-5 h-5" />
                        Compare Documents
                      </>
                    )}
                  </button>
                  {(compareOriginalFile || compareRevisedFile) && (
                    <button
                      onClick={handleResetCompare}
                      className="px-4 py-3.5 rounded-xl font-medium text-[14px] text-[rgba(200,210,235,0.75)] hover:text-[rgba(235,240,255,0.92)] bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.08)] transition-all duration-[180ms]"
                    >
                      <RotateCcw className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Compare Results */}
            {activeInputTab === 'compare' && compareResult && (
              <div className="mb-6 space-y-4">
                {/* Results Header */}
                <div className="p-4 rounded-xl bg-[rgba(139,92,246,0.10)] border border-[rgba(139,92,246,0.25)]">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <GitCompare className="w-5 h-5 text-[rgba(139,92,246,0.95)]" />
                      <span className="text-[14px] font-semibold text-[rgba(235,240,255,0.92)]">Comparison Results</span>
                    </div>
                    <button
                      onClick={handleResetCompare}
                      className="text-[12px] text-[rgba(200,210,235,0.60)] hover:text-[rgba(235,240,255,0.92)] transition-colors"
                    >
                      New Comparison
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-4 text-[12px]">
                    <span className="text-[rgba(200,210,235,0.60)]">
                      <span className="font-semibold text-[rgba(235,240,255,0.92)]">{compareResult.stats.totalSections}</span> sections
                    </span>
                    <span className="text-[rgba(80,210,140,0.95)]">
                      <span className="font-semibold">{compareResult.stats.unchangedSections}</span> unchanged
                    </span>
                    <span className="text-[rgba(255,190,90,0.95)]">
                      <span className="font-semibold">{compareResult.stats.changedSections}</span> changed
                    </span>
                    <span className="text-[rgba(90,130,255,0.95)]">
                      <span className="font-semibold">{compareResult.stats.addedSections}</span> added
                    </span>
                    <span className="text-[rgba(255,95,95,0.95)]">
                      <span className="font-semibold">{compareResult.stats.removedSections}</span> removed
                    </span>
                  </div>
                </div>

                {/* Section List */}
                <div className="max-h-[400px] overflow-y-auto space-y-3">
                  {compareResult.sections.map((section, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-xl border ${
                        section.status === 'unchanged'
                          ? 'bg-[rgba(80,210,140,0.05)] border-[rgba(80,210,140,0.15)]'
                          : section.status === 'changed'
                          ? 'bg-[rgba(255,190,90,0.05)] border-[rgba(255,190,90,0.15)]'
                          : section.status === 'added'
                          ? 'bg-[rgba(90,130,255,0.05)] border-[rgba(90,130,255,0.15)]'
                          : 'bg-[rgba(255,95,95,0.05)] border-[rgba(255,95,95,0.15)]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[13px] font-semibold text-[rgba(235,240,255,0.92)]">
                          {section.sectionNumber}. {section.sectionTitle}
                        </span>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                          section.status === 'unchanged'
                            ? 'bg-[rgba(80,210,140,0.15)] text-[rgba(80,210,140,0.95)]'
                            : section.status === 'changed'
                            ? 'bg-[rgba(255,190,90,0.15)] text-[rgba(255,190,90,0.95)]'
                            : section.status === 'added'
                            ? 'bg-[rgba(90,130,255,0.15)] text-[rgba(90,130,255,0.95)]'
                            : 'bg-[rgba(255,95,95,0.15)] text-[rgba(255,95,95,0.95)]'
                        }`}>
                          {section.status}
                        </span>
                      </div>
                      {section.status !== 'unchanged' && section.changes.length > 0 && (
                        <div className="text-[12px] leading-relaxed text-[rgba(200,210,235,0.75)] font-mono bg-[rgba(10,14,20,0.40)] p-3 rounded-lg overflow-x-auto">
                          {section.changes.map((change, changeIdx) => (
                            <span
                              key={changeIdx}
                              className={
                                change.type === 'delete'
                                  ? 'bg-[rgba(255,95,95,0.20)] text-[rgba(255,95,95,0.95)] line-through'
                                  : change.type === 'insert'
                                  ? 'bg-[rgba(80,210,140,0.20)] text-[rgba(80,210,140,0.95)]'
                                  : ''
                              }
                            >
                              {change.value}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Playbook Selector - only for paste/upload tabs */}
            {activeInputTab !== 'compare' && playbooks.length > 0 && (
              <div className="mb-6">
                <label className="block text-[12px] font-medium text-[rgba(200,210,235,0.75)] mb-2">
                  Playbook (optional)
                </label>
                <select
                  value={selectedPlaybook}
                  onChange={(e) => onSelectPlaybook(e.target.value)}
                  className="w-full px-4 py-3 text-[14px] rounded-xl bg-[rgba(10,14,20,0.60)] border border-[rgba(255,255,255,0.08)] text-[rgba(235,240,255,0.92)] focus:outline-none focus:border-[rgba(90,130,255,0.50)] transition-colors duration-[180ms]"
                >
                  <option value="">No playbook</option>
                  {playbooks.map(pb => (
                    <option key={pb.id} value={pb.id}>{pb.name} (v{pb.current_version})</option>
                  ))}
                </select>
              </div>
            )}

            {/* Analyze Button - only for paste/upload tabs */}
            {activeInputTab !== 'compare' && (
            <button
              onClick={onAnalyze}
              disabled={isAnalyzing || (activeInputTab === 'paste' ? !inputText.trim() : !extractedText)}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-[14px] transition-all duration-[180ms] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(180deg, rgba(90,130,255,0.40), rgba(90,130,255,0.25))',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15), 0 4px 20px rgba(90,130,255,0.35)',
                color: 'rgba(235,240,255,0.98)',
              }}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Analyzing Contract...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Analyze Contract
                </>
              )}
            </button>
            )}
          </div>
        </div>
      )}

      {/* Viewing Review Results */}
      {(mode === 'viewing-review' || mode === 'viewing-history') && currentResult && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div
            className="flex-shrink-0 px-6 py-4 border-b border-[rgba(255,255,255,0.06)]"
            style={{ background: elevation.L2.background }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[16px] font-semibold text-[rgba(235,240,255,0.92)]">
                  {provisionName || 'Contract Review'}
                </h2>
                <p className="text-[12px] text-[rgba(200,210,235,0.50)] mt-0.5">
                  {contracts.find(c => c.id === selectedContract)?.name || 'Standalone Review'}
                </p>
              </div>
              <button
                onClick={onNewReview}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium text-[rgba(200,210,235,0.75)] hover:text-[rgba(235,240,255,0.92)] hover:bg-[rgba(255,255,255,0.06)] transition-all duration-[180ms]"
              >
                <Plus className="w-4 h-4" />
                New Review
              </button>
            </div>
          </div>

          {/* Document Content */}
          <div className="flex-1 overflow-auto">
            <div className="max-w-5xl mx-auto mt-10 mb-10 doc-surface min-h-[calc(100vh-200px)]">
              <RedlineEditor
                initialContent={currentResult.redlinedText}
                readOnly={true}
                contractName={contracts.find(c => c.id === selectedContract)?.name || provisionName || 'Contract Review'}
              />
            </div>
          </div>
        </div>
      )}

      {/* Viewing Approval */}
      {mode === 'viewing-approval' && selectedItem?.type === 'approval' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div
            className="flex-shrink-0 px-6 py-4 border-b border-[rgba(255,255,255,0.06)]"
            style={{ background: elevation.L2.background }}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-3 h-3 rounded-full ${
                  (selectedItem.data as Approval).approvalStatus === 'pending'
                    ? 'bg-[rgba(255,190,90,0.95)]'
                    : (selectedItem.data as Approval).approvalStatus === 'approved'
                    ? 'bg-[rgba(80,210,140,0.95)]'
                    : 'bg-[rgba(255,95,95,0.95)]'
                }`}
              />
              <div>
                <h2 className="text-[16px] font-semibold text-[rgba(235,240,255,0.92)]">
                  {(selectedItem.data as Approval).contractName}
                </h2>
                <p className="text-[12px] text-[rgba(200,210,235,0.50)] mt-0.5">
                  {(selectedItem.data as Approval).provisionName || 'Approval Request'} · Submitted {new Date((selectedItem.data as Approval).submittedAt).toLocaleDateString()} by {(selectedItem.data as Approval).submittedBy}
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {/* Show full redlined content using RedlineEditor if available */}
            {currentResult?.redlinedText ? (
              <div className="max-w-5xl mx-auto mt-10 mb-10 doc-surface min-h-[calc(100vh-200px)]">
                <RedlineEditor
                  initialContent={currentResult.redlinedText}
                  readOnly={true}
                  contractName={(selectedItem.data as Approval).contractName}
                />
              </div>
            ) : (
              /* Fallback to summary if full text not available */
              <div
                className="max-w-4xl mx-auto mt-10 mb-10 rounded-2xl p-8"
                style={{
                  background: elevation.L1.background,
                  boxShadow: elevation.L1.shadow,
                }}
              >
                <h3 className="text-[14px] font-semibold text-[rgba(200,210,235,0.75)] mb-4">
                  Summary
                </h3>
                <div className="space-y-2">
                  {(selectedItem.data as Approval).summary.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[rgba(90,130,255,0.95)] mt-2 flex-shrink-0" />
                      <p className="text-[13px] text-[rgba(235,240,255,0.85)]">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
