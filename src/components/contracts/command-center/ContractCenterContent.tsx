'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
} from 'lucide-react';
import DOMPurify from 'dompurify';
import { elevation, colors } from '@/components/mars-ui/tokens';
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

  // Format redlines for display
  const formatRedlines = (text: string): string => {
    return text
      .replace(/\[strikethrough\](.*?)\[\/strikethrough\]/g, '<del class="text-red-400 bg-red-500/20 line-through">$1</del>')
      .replace(/\[underline\](.*?)\[\/underline\]/g, '<ins class="text-green-400 bg-green-500/20 underline no-underline">$1</ins>')
      .replace(/~~(.*?)~~/g, '<del class="text-red-400 bg-red-500/20 line-through">$1</del>')
      .replace(/\+\+(.*?)\+\+/g, '<ins class="text-green-400 bg-green-500/20 underline">$1</ins>');
  };

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
            {activeInputTab === 'compare' && (
              <div className="mb-6 p-6 rounded-xl bg-[rgba(10,14,20,0.30)] border border-[rgba(255,255,255,0.06)]">
                <div className="text-center">
                  <GitCompare className="w-10 h-10 text-[rgba(200,210,235,0.40)] mx-auto mb-3" />
                  <p className="text-[14px] text-[rgba(235,240,255,0.92)]">Document Comparison</p>
                  <p className="text-[12px] text-[rgba(200,210,235,0.50)] mt-1">
                    Upload two documents to compare changes
                  </p>
                  <p className="text-[11px] text-[rgba(200,210,235,0.40)] mt-3">
                    Coming soon in this view
                  </p>
                </div>
              </div>
            )}

            {/* Playbook Selector */}
            {playbooks.length > 0 && (
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

            {/* Analyze Button */}
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
          <div className="flex-1 overflow-y-auto p-6">
            <div
              className="max-w-4xl mx-auto rounded-2xl p-8"
              style={{
                background: elevation.L1.background,
                boxShadow: elevation.L1.shadow,
              }}
            >
              <div
                className="prose prose-invert max-w-none text-[14px] leading-relaxed"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(formatRedlines(currentResult.redlinedText || ''))
                }}
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
            <div className="flex items-center justify-between">
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
                    {(selectedItem.data as Approval).provisionName || 'Approval Request'}
                  </p>
                </div>
              </div>
              {(selectedItem.data as Approval).approvalToken && (
                <a
                  href={`/contracts/review/approve/${(selectedItem.data as Approval).approvalToken}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium transition-all duration-[180ms]"
                  style={{
                    background: 'rgba(90,130,255,0.15)',
                    color: 'rgba(90,130,255,0.95)',
                  }}
                >
                  Open Full Review
                </a>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <div
              className="max-w-4xl mx-auto rounded-2xl p-8"
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

              <div className="mt-6 pt-6 border-t border-[rgba(255,255,255,0.06)]">
                <div className="grid grid-cols-2 gap-4 text-[12px]">
                  <div>
                    <span className="text-[rgba(200,210,235,0.50)]">Submitted by</span>
                    <p className="text-[rgba(235,240,255,0.92)] mt-0.5">{(selectedItem.data as Approval).submittedBy}</p>
                  </div>
                  <div>
                    <span className="text-[rgba(200,210,235,0.50)]">Submitted</span>
                    <p className="text-[rgba(235,240,255,0.92)] mt-0.5">
                      {new Date((selectedItem.data as Approval).submittedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
