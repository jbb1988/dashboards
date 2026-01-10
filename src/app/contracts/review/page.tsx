'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DOMPurify from 'dompurify';
import Sidebar, { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from '@/components/Sidebar';
import { DashboardBackground, backgroundPresets, KPICard, KPIIcons } from '@/components/mars-ui';

interface Contract {
  id: string;
  name: string;
  status: string;
  value: number;
  contractType: string[];
}

interface ReviewResult {
  redlinedText: string;
  originalText: string;
  modifiedText: string;
  summary: string[];
  timestamp: string;
}

interface ReviewHistory {
  id: string;
  contractId: string;
  contractName: string;
  provisionName: string;
  createdAt: string;
  status: 'draft' | 'sent_to_boss' | 'sent_to_client' | 'approved';
}

// Types for document comparison (legacy diff mode)
interface CompareChange {
  id: number;
  type: 'equal' | 'delete' | 'insert';
  text: string;
}

interface CompareStats {
  totalChanges: number;
  deletions: number;
  insertions: number;
  originalLength: number;
  revisedLength: number;
  characterChanges: number;
}

interface CompareSection {
  section: string;
  changes: CompareChange[];
}

interface CompareResult {
  mode?: 'ai' | 'diff';
  changes: CompareChange[];
  stats: CompareStats;
  sections: CompareSection[];
  normalizedOriginal: string;
  normalizedRevised: string;
}

interface CategorizedChange extends CompareChange {
  category?: 'substantive' | 'formatting' | 'minor';
  explanation?: string;
}

// Types for section-by-section comparison
interface SectionChange {
  description: string;
  original: string;
  revised: string;
  impact: string;
}

interface SectionComparison {
  sectionNumber: string;
  sectionTitle: string;
  status: 'unchanged' | 'changed' | 'added' | 'removed';
  significance: 'high' | 'medium' | 'low' | 'none';
  changes: SectionChange[];
}

interface SectionCompareResult {
  mode: 'section-by-section';
  documentInfo: {
    originalTitle: string;
    revisedTitle: string;
    originalDate: string;
    revisedDate: string;
  };
  summary: {
    totalSections: number;
    sectionsChanged: number;
    sectionsAdded: number;
    sectionsRemoved: number;
    sectionsUnchanged: number;
    keyTakeaways: string[];
  };
  sections: SectionComparison[];
  addedSections: string[];
  removedSections: string[];
}

// Types for AI recommendations
interface ComparisonRecommendation {
  sectionNumber: string;
  sectionTitle: string;
  verdict: 'accept' | 'negotiate' | 'push_back';
  reasoning: string;
  suggestedLanguage?: string;
  riskLevel: 'low' | 'medium' | 'high';
}

interface ComparisonAnalysisResult {
  recommendations: ComparisonRecommendation[];
  overallAssessment: string;
  criticalIssues: string[];
}

// Models for contract review via OpenRouter - legal-grade only
// Using Claude Sonnet 4 for all AI operations (hardcoded for best quality)
const AI_MODEL = 'anthropic/claude-sonnet-4';

export default function ContractReviewPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selectedContract, setSelectedContract] = useState<string>('');
  const [contractSearch, setContractSearch] = useState('');
  const [showContractDropdown, setShowContractDropdown] = useState(false);
  const [provisionName, setProvisionName] = useState('');
  const [inputText, setInputText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<ReviewHistory[]>([]);
  const [activeTab, setActiveTab] = useState<'paste' | 'upload' | 'compare'>('paste');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [originalDocxBuffer, setOriginalDocxBuffer] = useState<string | null>(null);
  const [isGeneratingDocx, setIsGeneratingDocx] = useState(false);
  const [isGeneratingOriginal, setIsGeneratingOriginal] = useState(false);
  // Model is hardcoded - no user selection needed
  const selectedModel = AI_MODEL;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const contractDropdownRef = useRef<HTMLDivElement>(null);

  // Compare Documents state
  const [compareOriginalFile, setCompareOriginalFile] = useState<File | null>(null);
  const [compareRevisedFile, setCompareRevisedFile] = useState<File | null>(null);
  const [compareOriginalText, setCompareOriginalText] = useState<string | null>(null);
  const [compareRevisedText, setCompareRevisedText] = useState<string | null>(null);
  const [isExtractingOriginal, setIsExtractingOriginal] = useState(false);
  const [isExtractingRevised, setIsExtractingRevised] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [sectionCompareResult, setSectionCompareResult] = useState<SectionCompareResult | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [showSectionGrouping, setShowSectionGrouping] = useState(true);
  const [isCategorizing, setIsCategorizing] = useState(false);
  const [categorizedChanges, setCategorizedChanges] = useState<CategorizedChange[] | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'substantive' | 'formatting' | 'minor'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'changed' | 'added' | 'removed' | 'unchanged'>('all');
  const [significanceFilter, setSignificanceFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  // Analysis comparison state (for showing diff after AI analysis)
  const [showAnalysisComparison, setShowAnalysisComparison] = useState(false);
  const [analysisCompareResult, setAnalysisCompareResult] = useState<CompareResult | null>(null);
  const [isComparingAnalysis, setIsComparingAnalysis] = useState(false);

  // AI Recommendations state (for Compare tab)
  const [comparisonAnalysis, setComparisonAnalysis] = useState<ComparisonAnalysisResult | null>(null);
  const [isAnalyzingComparison, setIsAnalyzingComparison] = useState(false);
  const [compareViewMode, setCompareViewMode] = useState<'comparison' | 'recommendations'>('comparison');

  // Save to Contract modal state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveModalContract, setSaveModalContract] = useState<string>('');
  const [saveModalSearch, setSaveModalSearch] = useState('');
  const [isSavingComparison, setIsSavingComparison] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (contractDropdownRef.current && !contractDropdownRef.current.contains(event.target as Node)) {
        setShowContractDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch contracts on mount
  useEffect(() => {
    fetchContracts();
  }, []);

  async function fetchContracts() {
    try {
      const response = await fetch('/api/contracts');
      if (response.ok) {
        const data = await response.json();
        setContracts(data.contracts || []);
      }
    } catch (err) {
      console.error('Failed to fetch contracts:', err);
    }
  }

  async function handleAnalyze() {
    const textToAnalyze = activeTab === 'paste' ? inputText : extractedText;

    if (!textToAnalyze?.trim()) {
      setError('Please enter or upload contract text to analyze');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/contracts/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToAnalyze,
          contractId: selectedContract || undefined,
          provisionName: provisionName || undefined,
          model: selectedModel,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Analysis failed');
      }

      const data = await response.json();
      setResult({
        redlinedText: data.redlinedText,
        originalText: data.originalText,
        modifiedText: data.modifiedText,
        summary: data.summary,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleFileUpload(file: File) {
    setUploadedFile(file);
    setIsExtracting(true);
    setError(null);
    setExtractedText(null);
    setOriginalDocxBuffer(null);

    try {
      // If it's a DOCX file, store the base64 buffer for later Track Changes generation
      if (file.name.toLowerCase().endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
        setOriginalDocxBuffer(base64);
      }

      // Step 1: Get signed upload URL from our API (bypasses RLS)
      const signedUrlRes = await fetch(`/api/storage/upload?filename=${encodeURIComponent(file.name)}`);
      if (!signedUrlRes.ok) {
        const errData = await signedUrlRes.json();
        throw new Error(errData.error || 'Failed to get upload URL');
      }
      const { signedUrl, storagePath } = await signedUrlRes.json();

      // Step 2: Upload directly to Supabase using signed URL (bypasses Vercel limit)
      const uploadRes = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!uploadRes.ok) {
        throw new Error('Failed to upload file to storage');
      }

      // Step 3: Process the file via our API
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
      setExtractedText(data.text);

      // Step 4: Clean up uploaded file from storage
      await fetch('/api/storage/upload', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storagePath }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract text from file');
      setUploadedFile(null);
      setOriginalDocxBuffer(null);
    } finally {
      setIsExtracting(false);
    }
  }

  async function handleSaveToContract() {
    if (!result || !selectedContract) {
      setError('Please select a contract and complete an analysis first');
      return;
    }

    try {
      const response = await fetch('/api/contracts/review/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractId: selectedContract,
          provisionName: provisionName || 'Unnamed Provision',
          originalText: activeTab === 'paste' ? inputText : extractedText,
          redlinedText: result.redlinedText,
          summary: result.summary,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save review');
      }

      setError(null);
      alert('Review saved to contract successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save review');
    }
  }

  function handleCopyRedlines() {
    if (result?.redlinedText) {
      navigator.clipboard.writeText(result.redlinedText);
      alert('Redlines copied to clipboard');
    }
  }

  function handleNewAnalysis() {
    setResult(null);
    setInputText('');
    setExtractedText(null);
    setUploadedFile(null);
    setProvisionName('');
    setOriginalDocxBuffer(null);
  }

  async function handleDownloadRevised() {
    if (!result || !result.modifiedText) {
      setError('No revised text available');
      return;
    }

    setIsGeneratingDocx(true);
    setError(null);

    try {
      const response = await fetch('/api/contracts/review/generate-docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modifiedText: result.modifiedText,
          filename: uploadedFile?.name || 'contract',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate document');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = uploadedFile?.name?.replace(/\.docx$/i, '-REVISED.docx') || 'contract-REVISED.docx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate document');
    } finally {
      setIsGeneratingDocx(false);
    }
  }

  async function handleDownloadOriginalPlain() {
    if (!result || !result.originalText) {
      setError('No original text available');
      return;
    }

    setIsGeneratingOriginal(true);
    setError(null);

    try {
      const response = await fetch('/api/contracts/review/generate-original-docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalText: result.originalText,
          filename: uploadedFile?.name || 'contract',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate document');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = uploadedFile?.name?.replace(/\.docx$/i, '-ORIGINAL-PLAIN.docx') || 'contract-ORIGINAL-PLAIN.docx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate document');
    } finally {
      setIsGeneratingOriginal(false);
    }
  }

  async function handleDownloadBothForCompare() {
    // Download both documents with a delay to prevent browser blocking second download
    await handleDownloadOriginalPlain();
    // Wait 1 second before second download to avoid browser blocking
    await new Promise(resolve => setTimeout(resolve, 1000));
    await handleDownloadRevised();
  }

  // ===== COMPARE DOCUMENTS FUNCTIONS =====

  async function handleCompareFileUpload(file: File, side: 'original' | 'revised') {
    const setFile = side === 'original' ? setCompareOriginalFile : setCompareRevisedFile;
    const setText = side === 'original' ? setCompareOriginalText : setCompareRevisedText;
    const setExtracting = side === 'original' ? setIsExtractingOriginal : setIsExtractingRevised;

    setFile(file);
    setExtracting(true);
    setCompareError(null);
    setCompareResult(null);

    try {
      // Step 1: Get signed upload URL from our API (bypasses RLS)
      const signedUrlRes = await fetch(`/api/storage/upload?filename=${encodeURIComponent(file.name)}`);
      if (!signedUrlRes.ok) {
        const errData = await signedUrlRes.json();
        throw new Error(errData.error || 'Failed to get upload URL');
      }
      const { signedUrl, storagePath } = await signedUrlRes.json();

      // Step 2: Upload directly to Supabase using signed URL (bypasses Vercel limit)
      const uploadRes = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!uploadRes.ok) {
        throw new Error('Failed to upload file to storage');
      }

      // Step 3: Process the file via our API
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

      // Step 4: Clean up uploaded file from storage
      await fetch('/api/storage/upload', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storagePath }),
      });
    } catch (err) {
      setCompareError(err instanceof Error ? err.message : 'Failed to extract text from file');
      setFile(null);
    } finally {
      setExtracting(false);
    }
  }

  async function handleCompareDocuments() {
    if (!compareOriginalText || !compareRevisedText) {
      setCompareError('Please upload both documents');
      return;
    }

    setIsComparing(true);
    setCompareError(null);
    setCompareResult(null);
    setSectionCompareResult(null);

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

      const result = await response.json();

      // Check for error in response
      if (result.error) {
        throw new Error(result.error);
      }

      // Handle section-by-section mode
      if (result.mode === 'section-by-section') {
        setSectionCompareResult(result as SectionCompareResult);
      } else {
        setCompareResult(result as CompareResult);
      }
    } catch (err) {
      console.error('Compare error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Comparison failed';
      setCompareError(`${errorMsg}. Please try again.`);
    } finally {
      setIsComparing(false);
    }
  }

  function handleResetCompare() {
    setCompareOriginalFile(null);
    setCompareRevisedFile(null);
    setCompareOriginalText(null);
    setCompareRevisedText(null);
    setCompareResult(null);
    setSectionCompareResult(null);
    setCompareError(null);
    setCategorizedChanges(null);
    setCategoryFilter('all');
    setStatusFilter('all');
    setSignificanceFilter('all');
    // Reset AI recommendations state
    setComparisonAnalysis(null);
    setCompareViewMode('comparison');
    setSaveSuccess(null);
  }

  // Get AI Recommendations for comparison
  async function handleGetAIRecommendations() {
    if (!sectionCompareResult) return;

    setIsAnalyzingComparison(true);
    setCompareError(null);

    try {
      const response = await fetch('/api/contracts/compare/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comparisonResult: sectionCompareResult,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Analysis failed');
      }

      const result = await response.json() as ComparisonAnalysisResult;
      setComparisonAnalysis(result);
      setCompareViewMode('recommendations');
    } catch (err) {
      console.error('AI Analysis error:', err);
      setCompareError(err instanceof Error ? err.message : 'AI Analysis failed');
    } finally {
      setIsAnalyzingComparison(false);
    }
  }

  // Save comparison to contract
  async function handleSaveComparison(contractId: string) {
    if (!sectionCompareResult) return;

    setIsSavingComparison(true);
    setCompareError(null);

    try {
      const response = await fetch('/api/contracts/compare/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractId,
          comparisonResult: sectionCompareResult,
          analysisResult: comparisonAnalysis,
          originalFileName: compareOriginalFile?.name || 'original.pdf',
          revisedFileName: compareRevisedFile?.name || 'revised.pdf',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Save failed');
      }

      const result = await response.json();
      setSaveSuccess(`Saved to ${result.contractName}`);
      setShowSaveModal(false);
      setSaveModalContract('');
      setSaveModalSearch('');

      // Clear success message after 5 seconds
      setTimeout(() => setSaveSuccess(null), 5000);
    } catch (err) {
      console.error('Save error:', err);
      setCompareError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setIsSavingComparison(false);
    }
  }

  // Handle save button click
  function handleSaveClick() {
    // If contract already selected, save directly
    if (selectedContract) {
      handleSaveComparison(selectedContract);
    } else {
      // Show modal to select contract
      setShowSaveModal(true);
    }
  }

  // Download comparison as PDF
  async function handleDownloadComparisonPDF() {
    if (!sectionCompareResult) return;

    try {
      const response = await fetch('/api/contracts/compare/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'comparison',
          comparisonResult: sectionCompareResult,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      const result = await response.json();

      // Convert base64 to blob and download
      const byteCharacters = atob(result.pdf);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF export error:', err);
      setCompareError(err instanceof Error ? err.message : 'PDF export failed');
    }
  }

  // Download AI recommendations as PDF
  async function handleDownloadRecommendationsPDF() {
    if (!sectionCompareResult || !comparisonAnalysis) return;

    try {
      const response = await fetch('/api/contracts/compare/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'recommendations',
          comparisonResult: sectionCompareResult,
          analysisResult: comparisonAnalysis,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      const result = await response.json();

      // Convert base64 to blob and download
      const byteCharacters = atob(result.pdf);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF export error:', err);
      setCompareError(err instanceof Error ? err.message : 'PDF export failed');
    }
  }

  async function handleCategorizeChanges() {
    if (!compareResult) return;

    setIsCategorizing(true);
    setCompareError(null);

    try {
      const response = await fetch('/api/contracts/compare/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changes: compareResult.changes,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Categorization failed');
      }

      const result = await response.json();
      setCategorizedChanges(result.categorizedChanges);
    } catch (err) {
      setCompareError(err instanceof Error ? err.message : 'Categorization failed');
    } finally {
      setIsCategorizing(false);
    }
  }

  async function handleExportCompareToWord() {
    if (!compareResult) return;

    setIsGeneratingDocx(true);
    setCompareError(null);

    try {
      const response = await fetch('/api/contracts/compare/export-docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changes: compareResult.changes,
          originalFilename: compareOriginalFile?.name || 'document',
          revisedFilename: compareRevisedFile?.name || 'document',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate document');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'comparison-results.docx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setCompareError(err instanceof Error ? err.message : 'Failed to export');
    } finally {
      setIsGeneratingDocx(false);
    }
  }

  // ===== ANALYSIS COMPARISON (View Comparison button after AI analysis) =====

  async function handleViewAnalysisComparison() {
    if (!result) return;

    setIsComparingAnalysis(true);
    setShowAnalysisComparison(false);

    try {
      const response = await fetch('/api/contracts/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalText: result.originalText,
          revisedText: result.modifiedText,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Comparison failed');
      }

      const compareData = await response.json();
      setAnalysisCompareResult(compareData);
      setShowAnalysisComparison(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Comparison failed');
    } finally {
      setIsComparingAnalysis(false);
    }
  }

  function handleBackToSummary() {
    setShowAnalysisComparison(false);
    setAnalysisCompareResult(null);
  }

  return (
    <div className="min-h-screen bg-[#0B1220] relative overflow-hidden">
      <DashboardBackground {...backgroundPresets.contracts} />
      <Sidebar isCollapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />

      <motion.main
        className="p-8"
        animate={{ marginLeft: sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-white">Contract Review</h1>
            <p className="text-[#64748B] text-sm mt-1">Contract provision analysis</p>
          </div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="px-4 py-2 rounded-lg bg-[#151F2E] text-[#8FA3BF] hover:text-white hover:bg-[#1E293B] transition-colors text-sm font-medium"
          >
            {showHistory ? 'Hide History' : 'View History'}
          </button>
        </div>

        {/* KPI Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <KPICard
            title="Contracts Available"
            value={contracts.length}
            subtitle="In Salesforce"
            icon={KPIIcons.document}
            color="#38BDF8"
            delay={0.1}
          />
          <KPICard
            title="Analysis Tool"
            value="AI"
            subtitle="Claude-powered review"
            icon={KPIIcons.trending}
            color="#8B5CF6"
            delay={0.2}
          />
          <KPICard
            title="Quick Review"
            value="Paste"
            subtitle="Or upload documents"
            icon={KPIIcons.clipboard}
            color="#22C55E"
            delay={0.3}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Panel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#111827] rounded-xl border border-white/[0.04] p-6"
          >
            <h2 className="text-lg font-semibold text-white mb-4">Input</h2>

            {/* Contract & Provision Selection */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="relative" ref={contractDropdownRef}>
                <label className="block text-[#8FA3BF] text-sm mb-2">Contract (Optional)</label>
                <div className="relative">
                  <input
                    type="text"
                    value={contractSearch}
                    onChange={(e) => {
                      setContractSearch(e.target.value);
                      setShowContractDropdown(true);
                    }}
                    onFocus={() => setShowContractDropdown(true)}
                    placeholder="Search contracts..."
                    className="w-full bg-[#0B1220] border border-white/[0.08] rounded-lg px-3 py-2.5 text-white text-sm placeholder-[#475569] focus:outline-none focus:ring-2 focus:ring-[#38BDF8]/50"
                  />
                  {selectedContract && (
                    <button
                      onClick={() => {
                        setSelectedContract('');
                        setContractSearch('');
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-white"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                {/* Searchable Dropdown */}
                {showContractDropdown && (
                  <div className="absolute z-50 w-full mt-1 bg-[#1E293B] border border-white/[0.08] rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    {contracts
                      .filter(c =>
                        c.name.toLowerCase().includes(contractSearch.toLowerCase()) ||
                        c.contractType?.some(t => t.toLowerCase().includes(contractSearch.toLowerCase()))
                      )
                      .map((contract) => (
                        <button
                          key={contract.id}
                          onClick={() => {
                            setSelectedContract(contract.id);
                            setContractSearch(contract.name);
                            setShowContractDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-2.5 hover:bg-[#38BDF8]/10 transition-colors border-b border-white/[0.04] last:border-b-0 ${
                            selectedContract === contract.id ? 'bg-[#38BDF8]/10' : ''
                          }`}
                        >
                          <div className="text-white text-sm font-medium truncate">{contract.name}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs px-1.5 py-0.5 rounded bg-[#8B5CF6]/20 text-[#8B5CF6]">
                              {contract.contractType?.length > 0 ? contract.contractType.join(', ') : 'No Type'}
                            </span>
                            {contract.value > 0 && (
                              <span className="text-[#64748B] text-xs">
                                ${contract.value.toLocaleString()}
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    {contracts.filter(c =>
                      c.name.toLowerCase().includes(contractSearch.toLowerCase()) ||
                      c.contractType?.some(t => t.toLowerCase().includes(contractSearch.toLowerCase()))
                    ).length === 0 && (
                      <div className="px-3 py-4 text-[#64748B] text-sm text-center">
                        No contracts found
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-[#8FA3BF] text-sm mb-2">Provision Name</label>
                <input
                  type="text"
                  value={provisionName}
                  onChange={(e) => setProvisionName(e.target.value)}
                  placeholder="e.g., Indemnification Clause"
                  className="w-full bg-[#0B1220] border border-white/[0.08] rounded-lg px-3 py-2.5 text-white text-sm placeholder-[#475569] focus:outline-none focus:ring-2 focus:ring-[#38BDF8]/50"
                />
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setActiveTab('paste')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'paste'
                    ? 'bg-[#38BDF8]/10 text-[#38BDF8]'
                    : 'text-[#8FA3BF] hover:bg-[#151F2E]'
                }`}
              >
                Paste Text
              </button>
              <button
                onClick={() => setActiveTab('upload')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'upload'
                    ? 'bg-[#38BDF8]/10 text-[#38BDF8]'
                    : 'text-[#8FA3BF] hover:bg-[#151F2E]'
                }`}
              >
                Upload Document
              </button>
              <button
                onClick={() => setActiveTab('compare')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'compare'
                    ? 'bg-[#A855F7]/10 text-[#A855F7]'
                    : 'text-[#8FA3BF] hover:bg-[#151F2E]'
                }`}
              >
                Compare Documents
              </button>
            </div>

            {/* Input Area */}
            <AnimatePresence mode="wait">
              {activeTab === 'paste' ? (
                <motion.div
                  key="paste"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Paste contract provision text here..."
                    className="w-full h-64 bg-[#0B1220] border border-white/[0.08] rounded-lg px-4 py-3 text-white text-sm placeholder-[#475569] focus:outline-none focus:ring-2 focus:ring-[#38BDF8]/50 resize-none font-mono"
                  />
                </motion.div>
              ) : activeTab === 'upload' ? (
                <motion.div
                  key="upload"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  {/* File Upload Zone */}
                  <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                      uploadedFile
                        ? 'border-[#22C55E]/50 bg-[#22C55E]/5'
                        : 'border-white/[0.08] hover:border-[#38BDF8]/50 hover:bg-[#38BDF8]/5'
                    }`}
                    onClick={() => document.getElementById('file-upload')?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files[0];
                      if (file) handleFileUpload(file);
                    }}
                  >
                    <input
                      id="file-upload"
                      type="file"
                      accept=".pdf,.docx,.doc,.txt"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                      }}
                    />
                    {isExtracting ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-2 border-[#38BDF8] border-t-transparent rounded-full animate-spin" />
                        <p className="text-[#8FA3BF] text-sm">Extracting text...</p>
                      </div>
                    ) : uploadedFile ? (
                      <div className="flex flex-col items-center gap-2">
                        <svg className="w-10 h-10 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-white font-medium">{uploadedFile.name}</p>
                        <p className="text-[#22C55E] text-sm">Text extracted successfully</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <svg className="w-10 h-10 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p className="text-white">Drop file here or click to upload</p>
                        <p className="text-[#64748B] text-sm">Supports PDF, DOCX, DOC, TXT</p>
                      </div>
                    )}
                  </div>

                  {/* Extracted Text Preview */}
                  {extractedText && (
                    <div>
                      <label className="block text-[#8FA3BF] text-sm mb-2">Extracted Text (Review & Edit)</label>
                      <textarea
                        value={extractedText}
                        onChange={(e) => setExtractedText(e.target.value)}
                        className="w-full h-40 bg-[#0B1220] border border-white/[0.08] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#38BDF8]/50 resize-none font-mono"
                      />
                    </div>
                  )}
                </motion.div>
              ) : activeTab === 'compare' ? (
                <motion.div
                  key="compare"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  {/* Two Upload Zones Side by Side */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Original Document Upload */}
                    <div
                      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                        compareOriginalFile
                          ? 'border-[#F59E0B]/50 bg-[#F59E0B]/5'
                          : 'border-white/[0.08] hover:border-[#F59E0B]/50 hover:bg-[#F59E0B]/5'
                      }`}
                      onClick={() => document.getElementById('compare-original-upload')?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const file = e.dataTransfer.files[0];
                        if (file) handleCompareFileUpload(file, 'original');
                      }}
                    >
                      <input
                        id="compare-original-upload"
                        type="file"
                        accept=".pdf,.docx,.doc,.txt"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleCompareFileUpload(file, 'original');
                        }}
                      />
                      <h3 className="text-[#F59E0B] font-medium mb-2">Original Document</h3>
                      {isExtractingOriginal ? (
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-6 h-6 border-2 border-[#F59E0B] border-t-transparent rounded-full animate-spin" />
                          <p className="text-[#8FA3BF] text-xs">Extracting...</p>
                        </div>
                      ) : compareOriginalFile ? (
                        <div className="flex flex-col items-center gap-1">
                          <svg className="w-8 h-8 text-[#F59E0B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="text-white text-sm font-medium truncate max-w-full">{compareOriginalFile.name}</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <svg className="w-8 h-8 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          <p className="text-[#8FA3BF] text-xs">Drop or click to upload</p>
                        </div>
                      )}
                    </div>

                    {/* Revised Document Upload */}
                    <div
                      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                        compareRevisedFile
                          ? 'border-[#22C55E]/50 bg-[#22C55E]/5'
                          : 'border-white/[0.08] hover:border-[#22C55E]/50 hover:bg-[#22C55E]/5'
                      }`}
                      onClick={() => document.getElementById('compare-revised-upload')?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const file = e.dataTransfer.files[0];
                        if (file) handleCompareFileUpload(file, 'revised');
                      }}
                    >
                      <input
                        id="compare-revised-upload"
                        type="file"
                        accept=".pdf,.docx,.doc,.txt"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleCompareFileUpload(file, 'revised');
                        }}
                      />
                      <h3 className="text-[#22C55E] font-medium mb-2">Revised Document</h3>
                      {isExtractingRevised ? (
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-6 h-6 border-2 border-[#22C55E] border-t-transparent rounded-full animate-spin" />
                          <p className="text-[#8FA3BF] text-xs">Extracting...</p>
                        </div>
                      ) : compareRevisedFile ? (
                        <div className="flex flex-col items-center gap-1">
                          <svg className="w-8 h-8 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="text-white text-sm font-medium truncate max-w-full">{compareRevisedFile.name}</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <svg className="w-8 h-8 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          <p className="text-[#8FA3BF] text-xs">Drop or click to upload</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Compare Error */}
                  {compareError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                      {compareError}
                    </div>
                  )}

                  {/* Compare Button */}
                  <div className="flex gap-2">
                    <button
                      onClick={handleCompareDocuments}
                      disabled={!compareOriginalText || !compareRevisedText || isComparing}
                      className="flex-1 py-3 bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isComparing ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Comparing...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          Compare Documents
                        </>
                      )}
                    </button>
                    {(compareOriginalFile || compareRevisedFile) && (
                      <button
                        onClick={handleResetCompare}
                        className="px-4 py-3 bg-[#151F2E] text-[#8FA3BF] font-medium rounded-lg hover:bg-[#1E293B] hover:text-white transition-colors"
                      >
                        Reset
                      </button>
                    )}
                  </div>

                  {/* Algorithm Notice */}
                  <div className="p-3 bg-[#A855F7]/10 border border-[#A855F7]/20 rounded-lg">
                    <p className="text-[#A855F7] text-xs">
                      <span className="font-medium">Deterministic Comparison</span> - Uses Google's diff-match-patch algorithm.
                      Character-level accuracy with zero AI assumptions or hallucinations.
                    </p>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {/* Error Display - only show for paste/upload tabs */}
            {error && activeTab !== 'compare' && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Analyze Button - only show for paste/upload tabs */}
            {activeTab !== 'compare' && (
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="mt-4 w-full py-3 bg-gradient-to-r from-[#D97706] to-[#F59E0B] text-white font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    Analyze Contract
                  </>
                )}
              </button>
            )}
          </motion.div>

          {/* Results Panel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-[#111827] rounded-xl border border-white/[0.04] p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">
                {showAnalysisComparison ? 'Comparison Results' :
                 activeTab === 'compare' && compareResult ? 'Comparison Results' :
                 'Analysis Results'}
              </h2>
              {showAnalysisComparison && (
                <button
                  onClick={handleBackToSummary}
                  className="px-3 py-1.5 text-sm text-[#8FA3BF] hover:text-white bg-[#151F2E] hover:bg-[#1E293B] rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to Summary
                </button>
              )}
            </div>

            {/* Analysis Comparison View (triggered from View Comparison button) */}
            {showAnalysisComparison && analysisCompareResult ? (
              <div className="space-y-4">
                {/* Statistics Bar */}
                <div className="flex flex-wrap gap-4 p-4 bg-[#0B1220] rounded-lg">
                  <div className="text-[#8FA3BF]">
                    <span className="text-white font-bold text-lg">{analysisCompareResult.stats.totalChanges}</span>
                    <span className="text-sm ml-1">changes</span>
                  </div>
                  <div className="text-red-400">
                    <span className="font-bold text-lg">{analysisCompareResult.stats.deletions}</span>
                    <span className="text-sm ml-1">deletions</span>
                  </div>
                  <div className="text-green-400">
                    <span className="font-bold text-lg">{analysisCompareResult.stats.insertions}</span>
                    <span className="text-sm ml-1">insertions</span>
                  </div>
                  <div className="text-[#64748B] text-sm flex items-center">
                    <span>{analysisCompareResult.stats.characterChanges.toLocaleString()} chars changed</span>
                  </div>
                </div>

                {/* Diff Display */}
                <div>
                  <label className="block text-[#8FA3BF] text-sm mb-2">Character-Level Diff</label>
                  <div className="bg-[#0B1220] border border-white/[0.08] rounded-lg p-4 max-h-[500px] overflow-y-auto">
                    <div className="text-sm font-mono whitespace-pre-wrap leading-relaxed">
                      {analysisCompareResult.changes.map((change) => (
                        <span
                          key={change.id}
                          className={
                            change.type === 'delete' ? 'bg-red-500/20 text-red-400 line-through' :
                            change.type === 'insert' ? 'bg-green-500/20 text-green-400 underline' :
                            'text-white'
                          }
                        >
                          {change.text}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Zero Changes Notice */}
                {analysisCompareResult.stats.totalChanges === 0 && (
                  <div className="p-4 bg-[#22C55E]/10 border border-[#22C55E]/30 rounded-lg text-[#22C55E] text-center">
                    <svg className="w-8 h-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="font-medium">No changes detected</p>
                    <p className="text-sm opacity-75">The AI analysis didn&apos;t modify the original text</p>
                  </div>
                )}

                {/* Algorithm Notice */}
                <div className="p-3 bg-[#A855F7]/10 border border-[#A855F7]/20 rounded-lg">
                  <p className="text-[#A855F7] text-xs">
                    <span className="font-medium">Deterministic Comparison</span> - Uses Google&apos;s diff-match-patch algorithm.
                    Shows exact character-level changes between original and AI-revised text.
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={handleBackToSummary}
                    className="flex-1 py-2.5 bg-[#151F2E] text-[#8FA3BF] font-medium rounded-lg hover:bg-[#1E293B] hover:text-white transition-colors"
                  >
                    Back to Summary
                  </button>
                  <button
                    onClick={handleDownloadBothForCompare}
                    disabled={isGeneratingDocx || isGeneratingOriginal}
                    className="flex-1 py-2.5 bg-[#22C55E]/10 text-[#22C55E] font-medium rounded-lg hover:bg-[#22C55E]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download for Word
                  </button>
                </div>
              </div>
            ) : result ? (
              <div className="space-y-4">
                {/* Analysis Complete Banner */}
                <div className="p-3 rounded-lg text-sm font-medium bg-[#22C55E]/10 border border-[#22C55E]/30 text-[#22C55E]">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Analysis complete - {result.summary.length} changes identified</span>
                  </div>
                </div>

                {/* View Comparison Button - PRIMARY ACTION */}
                <button
                  onClick={handleViewAnalysisComparison}
                  disabled={isComparingAnalysis}
                  className="w-full py-3 bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isComparingAnalysis ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Comparing...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      View Exact Changes (Diff)
                    </>
                  )}
                </button>

                {/* Redlined Text */}
                <div>
                  <label className="block text-[#8FA3BF] text-sm mb-2">Redlined Text</label>
                  <div className="bg-[#0B1220] border border-white/[0.08] rounded-lg p-4 max-h-64 overflow-y-auto">
                    <div
                      className="text-white text-sm font-mono whitespace-pre-wrap contract-redlines"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(formatRedlines(result.redlinedText), { ALLOWED_TAGS: ['del', 'ins', 'span', 'br'] }) }}
                    />
                  </div>
                </div>

                {/* Summary */}
                <div>
                  <label className="block text-[#8FA3BF] text-sm mb-2">Summary of Changes</label>
                  <div className="bg-[#0B1220] border border-white/[0.08] rounded-lg p-4">
                    <ul className="space-y-2">
                      {result.summary.map((item, idx) => {
                        // Parse provision label if present: "[Provision] Description"
                        const match = item.match(/^\[([^\]]+)\]\s*(.*)/);
                        const provision = match ? match[1] : null;
                        const text = match ? match[2] : item;

                        return (
                          <li key={idx} className="flex items-start gap-2 text-sm text-[#CBD5E1]">
                            <span className="text-[#38BDF8] mt-1">•</span>
                            <span>
                              {provision && (
                                <span className="text-[#F59E0B] font-medium">[{provision}]</span>
                              )}{provision ? ' ' : ''}{text}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>

                {/* Word Compare Workflow */}
                {result.modifiedText && (
                  <div className="p-4 bg-[#0B1220] border border-[#38BDF8]/30 rounded-lg">
                    <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                      <svg className="w-5 h-5 text-[#38BDF8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Word Track Changes Workflow
                    </h4>

                    {/* Download Both Documents Button - PRIMARY */}
                    <button
                      onClick={handleDownloadBothForCompare}
                      disabled={isGeneratingDocx || isGeneratingOriginal}
                      className="w-full py-3 bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-2"
                    >
                      {(isGeneratingDocx || isGeneratingOriginal) ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Generating Documents...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Download Both for Word Compare
                        </>
                      )}
                    </button>

                    {/* Individual download buttons as fallback */}
                    <div className="flex gap-2 mb-3">
                      <button
                        onClick={handleDownloadOriginalPlain}
                        disabled={isGeneratingOriginal}
                        className="flex-1 py-2 bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-[#F59E0B] text-sm font-medium rounded-lg hover:bg-[#F59E0B]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Original
                      </button>
                      <button
                        onClick={handleDownloadRevised}
                        disabled={isGeneratingDocx}
                        className="flex-1 py-2 bg-[#22C55E]/10 border border-[#22C55E]/30 text-[#22C55E] text-sm font-medium rounded-lg hover:bg-[#22C55E]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Revised
                      </button>
                    </div>

                    {/* Instructions - UPDATED */}
                    <div className="text-sm text-[#8FA3BF] space-y-1.5">
                      <p className="font-medium text-white">To get Track Changes in Word:</p>
                      <ol className="list-decimal list-inside space-y-1.5 ml-2">
                        <li><span className="text-white">Review</span> → <span className="text-white">Compare</span> → <span className="text-white">Compare Documents</span></li>
                        <li>Original document: <span className="text-[#F59E0B]">*-ORIGINAL-PLAIN.docx</span></li>
                        <li>Revised document: <span className="text-[#22C55E]">*-REVISED.docx</span></li>
                        <li>Click <span className="text-white">More ▾</span> → <span className="text-[#38BDF8]">UNCHECK "Formatting"</span></li>
                        <li>Click OK</li>
                      </ol>

                      {/* Important callout - encoding consistency */}
                      <div className="mt-3 p-2.5 bg-[#38BDF8]/10 border border-[#38BDF8]/30 rounded-lg">
                        <p className="text-[#38BDF8] font-medium text-xs">
                          Compare the two downloaded files together - do NOT use your original upload.
                          This ensures encoding consistency for clean track changes.
                        </p>
                      </div>

                    </div>
                  </div>
                )}

                {/* Other Action Buttons */}
                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    onClick={handleSaveToContract}
                    disabled={!selectedContract}
                    className="flex-1 min-w-[120px] py-2.5 bg-[#22C55E]/10 text-[#22C55E] font-medium rounded-lg hover:bg-[#22C55E]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Save to Notion
                  </button>
                  <button
                    onClick={handleCopyRedlines}
                    className="flex-1 min-w-[100px] py-2.5 bg-[#38BDF8]/10 text-[#38BDF8] font-medium rounded-lg hover:bg-[#38BDF8]/20 transition-colors"
                  >
                    Copy Text
                  </button>
                  <button
                    onClick={handleNewAnalysis}
                    className="flex-1 min-w-[100px] py-2.5 bg-[#151F2E] text-[#8FA3BF] font-medium rounded-lg hover:bg-[#1E293B] hover:text-white transition-colors"
                  >
                    New Analysis
                  </button>
                </div>
              </div>
            ) : activeTab === 'compare' && sectionCompareResult ? (
              /* Section-by-Section Compare Results */
              <div className="space-y-4">
                {/* Document Info Header */}
                <div className="p-4 bg-gradient-to-r from-[#7C3AED]/10 to-[#A855F7]/10 border border-[#A855F7]/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5 text-[#A855F7]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-[#A855F7] font-medium">Section-by-Section Contract Comparison</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-[#64748B]">Original:</span>
                      <span className="text-white ml-2">{sectionCompareResult.documentInfo.originalTitle}</span>
                      {sectionCompareResult.documentInfo.originalDate && (
                        <span className="text-[#F59E0B] ml-2">({sectionCompareResult.documentInfo.originalDate})</span>
                      )}
                    </div>
                    <div>
                      <span className="text-[#64748B]">Revised:</span>
                      <span className="text-white ml-2">{sectionCompareResult.documentInfo.revisedTitle}</span>
                      {sectionCompareResult.documentInfo.revisedDate && (
                        <span className="text-[#22C55E] ml-2">({sectionCompareResult.documentInfo.revisedDate})</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Summary Stats */}
                <div className="flex flex-wrap gap-3 p-4 bg-[#0B1220] rounded-lg">
                  <div className="text-[#8FA3BF]">
                    <span className="text-white font-bold text-lg">{sectionCompareResult.summary.totalSections}</span>
                    <span className="text-sm ml-1">sections</span>
                  </div>
                  <div className="text-[#F59E0B]">
                    <span className="font-bold text-lg">{sectionCompareResult.summary.sectionsChanged}</span>
                    <span className="text-sm ml-1">changed</span>
                  </div>
                  <div className="text-green-400">
                    <span className="font-bold text-lg">{sectionCompareResult.summary.sectionsAdded}</span>
                    <span className="text-sm ml-1">added</span>
                  </div>
                  <div className="text-red-400">
                    <span className="font-bold text-lg">{sectionCompareResult.summary.sectionsRemoved}</span>
                    <span className="text-sm ml-1">removed</span>
                  </div>
                  <div className="text-[#64748B]">
                    <span className="font-bold text-lg">{sectionCompareResult.summary.sectionsUnchanged}</span>
                    <span className="text-sm ml-1">unchanged</span>
                  </div>
                </div>

                {/* Key Takeaways */}
                {sectionCompareResult.summary.keyTakeaways && sectionCompareResult.summary.keyTakeaways.length > 0 && (
                  <div className="p-4 bg-[#0B1220] border border-white/[0.08] rounded-lg">
                    <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4 text-[#38BDF8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Key Takeaways
                    </h4>
                    <ul className="space-y-2">
                      {sectionCompareResult.summary.keyTakeaways.map((takeaway, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-[#CBD5E1]">
                          <span className="text-[#38BDF8] mt-0.5">•</span>
                          <span>{takeaway}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* AI Recommendations Section */}
                <div className="flex flex-wrap items-center gap-3">
                  {/* Get AI Recommendations Button */}
                  {!comparisonAnalysis && (
                    <button
                      onClick={handleGetAIRecommendations}
                      disabled={isAnalyzingComparison}
                      className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#A855F7] to-[#6366F1] hover:from-[#9333EA] hover:to-[#4F46E5] text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isAnalyzingComparison ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>Analyzing...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                          <span>Get AI Recommendations</span>
                        </>
                      )}
                    </button>
                  )}

                  {/* View Toggle (when AI recommendations exist) */}
                  {comparisonAnalysis && (
                    <div className="flex items-center bg-[#0B1220] rounded-lg p-1">
                      <button
                        onClick={() => setCompareViewMode('comparison')}
                        className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                          compareViewMode === 'comparison'
                            ? 'bg-[#38BDF8]/20 text-[#38BDF8]'
                            : 'text-[#8FA3BF] hover:text-white'
                        }`}
                      >
                        Comparison
                      </button>
                      <button
                        onClick={() => setCompareViewMode('recommendations')}
                        className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                          compareViewMode === 'recommendations'
                            ? 'bg-[#A855F7]/20 text-[#A855F7]'
                            : 'text-[#8FA3BF] hover:text-white'
                        }`}
                      >
                        AI Recommendations
                      </button>
                    </div>
                  )}

                  {/* Overall Assessment (when viewing recommendations) */}
                  {comparisonAnalysis && compareViewMode === 'recommendations' && (
                    <div className="w-full mt-2 p-3 bg-[#A855F7]/10 border border-[#A855F7]/30 rounded-lg">
                      <p className="text-sm text-[#CBD5E1]">{comparisonAnalysis.overallAssessment}</p>
                      {comparisonAnalysis.criticalIssues.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-[#A855F7]/20">
                          <span className="text-red-400 text-xs font-medium">Critical Issues: </span>
                          <span className="text-xs text-[#8FA3BF]">{comparisonAnalysis.criticalIssues.length} sections require attention</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Filters Row */}
                <div className="flex flex-wrap items-center gap-4 p-3 bg-[#0B1220] rounded-lg">
                  {/* Status Filter */}
                  <div className="flex items-center gap-2">
                    <span className="text-[#8FA3BF] text-xs font-medium">Status:</span>
                    <button
                      onClick={() => setStatusFilter('all')}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                        statusFilter === 'all' ? 'bg-white/10 text-white' : 'text-[#8FA3BF] hover:bg-white/5'
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setStatusFilter('changed')}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                        statusFilter === 'changed' ? 'bg-[#F59E0B]/20 text-[#F59E0B]' : 'text-[#8FA3BF] hover:bg-white/5'
                      }`}
                    >
                      Changed ({sectionCompareResult.sections.filter(s => s.status === 'changed').length})
                    </button>
                    <button
                      onClick={() => setStatusFilter('added')}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                        statusFilter === 'added' ? 'bg-green-500/20 text-green-400' : 'text-[#8FA3BF] hover:bg-white/5'
                      }`}
                    >
                      Added ({sectionCompareResult.sections.filter(s => s.status === 'added').length})
                    </button>
                    <button
                      onClick={() => setStatusFilter('removed')}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                        statusFilter === 'removed' ? 'bg-red-500/20 text-red-400' : 'text-[#8FA3BF] hover:bg-white/5'
                      }`}
                    >
                      Removed ({sectionCompareResult.sections.filter(s => s.status === 'removed').length})
                    </button>
                  </div>

                  {/* Significance Filter */}
                  <div className="flex items-center gap-2">
                    <span className="text-[#8FA3BF] text-xs font-medium">Significance:</span>
                    <button
                      onClick={() => setSignificanceFilter('all')}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                        significanceFilter === 'all' ? 'bg-white/10 text-white' : 'text-[#8FA3BF] hover:bg-white/5'
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setSignificanceFilter('high')}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                        significanceFilter === 'high' ? 'bg-red-500/20 text-red-400' : 'text-[#8FA3BF] hover:bg-white/5'
                      }`}
                    >
                      High ({sectionCompareResult.sections.filter(s => s.significance === 'high').length})
                    </button>
                    <button
                      onClick={() => setSignificanceFilter('medium')}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                        significanceFilter === 'medium' ? 'bg-[#F59E0B]/20 text-[#F59E0B]' : 'text-[#8FA3BF] hover:bg-white/5'
                      }`}
                    >
                      Medium ({sectionCompareResult.sections.filter(s => s.significance === 'medium').length})
                    </button>
                    <button
                      onClick={() => setSignificanceFilter('low')}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                        significanceFilter === 'low' ? 'bg-[#64748B]/20 text-[#64748B]' : 'text-[#8FA3BF] hover:bg-white/5'
                      }`}
                    >
                      Low ({sectionCompareResult.sections.filter(s => s.significance === 'low').length})
                    </button>
                  </div>
                </div>

                {/* Sections List */}
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {(() => {
                    const filteredSections = sectionCompareResult.sections.filter(section => {
                      const statusMatch = statusFilter === 'all' || section.status === statusFilter;
                      const sigMatch = significanceFilter === 'all' || section.significance === significanceFilter;
                      return statusMatch && sigMatch;
                    });

                    if (filteredSections.length === 0) {
                      return (
                        <div className="text-center py-8 text-[#64748B]">
                          <p className="text-sm">No sections match the current filters.</p>
                          <button
                            onClick={() => { setStatusFilter('all'); setSignificanceFilter('all'); }}
                            className="mt-2 text-[#38BDF8] text-sm hover:underline"
                          >
                            Reset filters
                          </button>
                        </div>
                      );
                    }

                    return filteredSections.map((section, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-lg border ${
                        section.status === 'added' ? 'bg-green-500/5 border-green-500/30' :
                        section.status === 'removed' ? 'bg-red-500/5 border-red-500/30' :
                        section.status === 'changed' ? (
                          section.significance === 'high' ? 'bg-red-500/5 border-red-500/30' :
                          section.significance === 'medium' ? 'bg-[#F59E0B]/5 border-[#F59E0B]/30' :
                          'bg-[#0B1220] border-white/[0.08]'
                        ) :
                        'bg-[#0B1220] border-white/[0.04]'
                      }`}
                    >
                      {/* Section Header */}
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[#A855F7] font-mono text-sm">
                          {section.sectionNumber ? `SECTION ${section.sectionNumber}` : 'SECTION'}
                        </span>
                        <span className="text-white font-medium">{section.sectionTitle}</span>
                        <span className={`ml-auto px-2 py-0.5 rounded text-xs font-medium ${
                          section.status === 'added' ? 'bg-green-500/20 text-green-400' :
                          section.status === 'removed' ? 'bg-red-500/20 text-red-400' :
                          section.status === 'changed' ? 'bg-[#F59E0B]/20 text-[#F59E0B]' :
                          'bg-[#64748B]/20 text-[#64748B]'
                        }`}>
                          {section.status.toUpperCase()}
                        </span>
                        {section.status !== 'unchanged' && (
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            section.significance === 'high' ? 'bg-red-500/20 text-red-400' :
                            section.significance === 'medium' ? 'bg-[#F59E0B]/20 text-[#F59E0B]' :
                            'bg-[#64748B]/20 text-[#64748B]'
                          }`}>
                            {section.significance.toUpperCase()}
                          </span>
                        )}
                      </div>

                      {/* Changes in this section */}
                      {section.changes && section.changes.length > 0 && (
                        <div className="space-y-3">
                          {section.changes.map((change, changeIdx) => (
                            <div key={changeIdx} className="pl-3 border-l-2 border-[#A855F7]/30">
                              {/* Change description */}
                              <p className="text-white text-sm mb-2">{change.description}</p>

                              {/* Original vs Revised */}
                              <div className="grid grid-cols-2 gap-3 text-xs">
                                <div className="p-2 bg-red-500/10 border border-red-500/20 rounded">
                                  <span className="text-red-400 font-medium block mb-1">Original:</span>
                                  <span className="text-[#CBD5E1]">{change.original || '(Not present)'}</span>
                                </div>
                                <div className="p-2 bg-green-500/10 border border-green-500/20 rounded">
                                  <span className="text-green-400 font-medium block mb-1">Revised:</span>
                                  <span className="text-[#CBD5E1]">{change.revised || '(Not present)'}</span>
                                </div>
                              </div>

                              {/* Impact */}
                              {change.impact && (
                                <div className="mt-2 pt-2 border-t border-white/[0.08]">
                                  <span className="text-[#64748B] text-xs">Impact: </span>
                                  <span className="text-[#8FA3BF] text-xs">{change.impact}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* AI Recommendation (when available and viewing recommendations) */}
                      {comparisonAnalysis && compareViewMode === 'recommendations' && (() => {
                        const recommendation = comparisonAnalysis.recommendations.find(
                          r => r.sectionNumber === section.sectionNumber && r.sectionTitle === section.sectionTitle
                        );
                        if (!recommendation || recommendation.verdict === 'accept') return null;

                        const verdictColors = {
                          accept: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400', icon: '✓' },
                          negotiate: { bg: 'bg-[#F59E0B]/10', border: 'border-[#F59E0B]/30', text: 'text-[#F59E0B]', icon: '⚠' },
                          push_back: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', icon: '✗' },
                        };
                        const colors = verdictColors[recommendation.verdict];

                        return (
                          <div className={`mt-4 p-3 ${colors.bg} border ${colors.border} rounded-lg`}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`${colors.text} font-medium text-sm`}>
                                {colors.icon} AI Recommendation: {recommendation.verdict.replace('_', ' ').toUpperCase()}
                              </span>
                              <span className={`ml-auto px-2 py-0.5 rounded text-xs ${
                                recommendation.riskLevel === 'high' ? 'bg-red-500/20 text-red-400' :
                                recommendation.riskLevel === 'medium' ? 'bg-[#F59E0B]/20 text-[#F59E0B]' :
                                'bg-[#64748B]/20 text-[#64748B]'
                              }`}>
                                {recommendation.riskLevel.toUpperCase()} RISK
                              </span>
                            </div>
                            <p className="text-[#CBD5E1] text-sm">{recommendation.reasoning}</p>
                            {recommendation.suggestedLanguage && (
                              <div className="mt-3 pt-3 border-t border-white/[0.08]">
                                <span className="text-[#A855F7] text-xs font-medium block mb-1">Suggested Counter-Language:</span>
                                <div className="p-2 bg-[#0B1220] border border-[#A855F7]/20 rounded text-sm text-[#CBD5E1] whitespace-pre-wrap">
                                  {recommendation.suggestedLanguage}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* No changes message for unchanged sections */}
                      {section.status === 'unchanged' && (
                        <p className="text-[#64748B] text-sm italic">No significant changes in this section.</p>
                      )}
                    </div>
                  ));
                  })()}
                </div>

                {/* Added/Removed Sections Summary */}
                {(sectionCompareResult.addedSections?.length > 0 || sectionCompareResult.removedSections?.length > 0) && (
                  <div className="grid grid-cols-2 gap-4">
                    {sectionCompareResult.addedSections?.length > 0 && (
                      <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                        <h4 className="text-green-400 font-medium text-sm mb-2">New Sections Added</h4>
                        <ul className="text-xs text-[#CBD5E1] space-y-1">
                          {sectionCompareResult.addedSections.map((section, idx) => (
                            <li key={idx}>+ {section}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {sectionCompareResult.removedSections?.length > 0 && (
                      <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <h4 className="text-red-400 font-medium text-sm mb-2">Sections Removed</h4>
                        <ul className="text-xs text-[#CBD5E1] space-y-1">
                          {sectionCompareResult.removedSections.map((section, idx) => (
                            <li key={idx}>- {section}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2">
                  {/* Save Success Toast */}
                  {saveSuccess && (
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-green-500/20 text-green-400 rounded-lg text-sm">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {saveSuccess}
                    </div>
                  )}

                  {/* Download Comparison PDF Button */}
                  <button
                    onClick={handleDownloadComparisonPDF}
                    className="flex items-center gap-2 px-3 py-2.5 bg-[#8B5CF6]/20 hover:bg-[#8B5CF6]/30 text-[#A855F7] font-medium rounded-lg transition-colors"
                    title="Download Comparison PDF"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="hidden sm:inline">Comparison PDF</span>
                  </button>

                  {/* Download AI Recommendations PDF Button - only show if AI analysis was run */}
                  {comparisonAnalysis && (
                    <button
                      onClick={handleDownloadRecommendationsPDF}
                      className="flex items-center gap-2 px-3 py-2.5 bg-[#38BDF8]/20 hover:bg-[#38BDF8]/30 text-[#38BDF8] font-medium rounded-lg transition-colors"
                      title="Download AI Recommendations PDF"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="hidden sm:inline">AI Recommendations PDF</span>
                    </button>
                  )}

                  {/* Save to Contract Button */}
                  <button
                    onClick={handleSaveClick}
                    disabled={isSavingComparison}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#22C55E] hover:bg-[#16A34A] text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isSavingComparison ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                        </svg>
                        <span>Save to Contract</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleResetCompare}
                    className="flex-1 py-2.5 bg-[#151F2E] text-[#8FA3BF] font-medium rounded-lg hover:bg-[#1E293B] hover:text-white transition-colors"
                  >
                    New Comparison
                  </button>
                </div>
              </div>
            ) : activeTab === 'compare' && compareResult ? (
              /* Legacy Diff Compare Results (fallback) */
              <div className="space-y-4">
                {/* Statistics Bar */}
                <div className="flex flex-wrap gap-4 p-4 bg-[#0B1220] rounded-lg">
                  <div className="text-[#8FA3BF]">
                    <span className="text-white font-bold text-lg">{compareResult.stats.totalChanges}</span>
                    <span className="text-sm ml-1">changes</span>
                  </div>
                  <div className="text-red-400">
                    <span className="font-bold text-lg">{compareResult.stats.deletions}</span>
                    <span className="text-sm ml-1">deletions</span>
                  </div>
                  <div className="text-green-400">
                    <span className="font-bold text-lg">{compareResult.stats.insertions}</span>
                    <span className="text-sm ml-1">insertions</span>
                  </div>
                  <div className="text-[#64748B] text-sm flex items-center">
                    <span>{compareResult.stats.characterChanges.toLocaleString()} chars changed</span>
                  </div>

                  {/* Categorize Button */}
                  {!categorizedChanges && (
                    <button
                      onClick={handleCategorizeChanges}
                      disabled={isCategorizing}
                      className="ml-auto px-3 py-1 bg-[#7C3AED]/20 text-[#A855F7] text-xs font-medium rounded hover:bg-[#7C3AED]/30 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {isCategorizing ? (
                        <>
                          <div className="w-3 h-3 border-2 border-[#A855F7] border-t-transparent rounded-full animate-spin" />
                          Categorizing...
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                          </svg>
                          Categorize with AI
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Category Filter (shown after categorization) */}
                {categorizedChanges && (
                  <div className="flex flex-wrap items-center gap-2 p-3 bg-[#0B1220] rounded-lg">
                    <span className="text-[#8FA3BF] text-xs font-medium">Filter by:</span>
                    <button
                      onClick={() => setCategoryFilter('all')}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                        categoryFilter === 'all'
                          ? 'bg-white/10 text-white'
                          : 'text-[#8FA3BF] hover:bg-white/5'
                      }`}
                    >
                      All ({compareResult.stats.totalChanges})
                    </button>
                    <button
                      onClick={() => setCategoryFilter('substantive')}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                        categoryFilter === 'substantive'
                          ? 'bg-[#DC2626]/20 text-[#DC2626]'
                          : 'text-[#8FA3BF] hover:bg-white/5'
                      }`}
                    >
                      Substantive ({categorizedChanges.filter(c => c.category === 'substantive').length})
                    </button>
                    <button
                      onClick={() => setCategoryFilter('formatting')}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                        categoryFilter === 'formatting'
                          ? 'bg-[#64748B]/20 text-[#64748B]'
                          : 'text-[#8FA3BF] hover:bg-white/5'
                      }`}
                    >
                      Formatting ({categorizedChanges.filter(c => c.category === 'formatting').length})
                    </button>
                    <button
                      onClick={() => setCategoryFilter('minor')}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                        categoryFilter === 'minor'
                          ? 'bg-[#F59E0B]/20 text-[#F59E0B]'
                          : 'text-[#8FA3BF] hover:bg-white/5'
                      }`}
                    >
                      Minor ({categorizedChanges.filter(c => c.category === 'minor').length})
                    </button>
                  </div>
                )}

                {/* View Toggle */}
                <div className="flex items-center justify-between">
                  <label className="block text-[#8FA3BF] text-sm">Document Comparison</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowSectionGrouping(!showSectionGrouping)}
                      className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                        showSectionGrouping
                          ? 'bg-[#A855F7]/20 text-[#A855F7]'
                          : 'bg-[#151F2E] text-[#8FA3BF] hover:text-white'
                      }`}
                    >
                      {showSectionGrouping ? 'Grouped by Section' : 'Inline View'}
                    </button>
                  </div>
                </div>

                {/* Diff Display */}
                <div className="bg-[#0B1220] border border-white/[0.08] rounded-lg p-4 max-h-[500px] overflow-y-auto">
                  {showSectionGrouping && compareResult.sections.length > 0 ? (
                    <div className="space-y-4">
                      {compareResult.sections.map((section, idx) => {
                        const filteredChanges = section.changes.filter(change => {
                          if (categoryFilter === 'all') return true;
                          if (change.type === 'equal') return true;
                          const catChange = categorizedChanges?.find(c => c.id === change.id);
                          return catChange?.category === categoryFilter;
                        });

                        if (categoryFilter !== 'all' && !filteredChanges.some(c => c.type !== 'equal')) {
                          return null;
                        }

                        return (
                          <div key={idx} className="border-l-2 border-[#A855F7]/30 pl-3">
                            <h4 className="text-[#A855F7] font-medium text-sm mb-2">{section.section}</h4>
                            <div className="text-sm font-mono whitespace-pre-wrap">
                              {filteredChanges.map((change) => {
                                const catChange = categorizedChanges?.find(c => c.id === change.id);
                                const categoryColor = catChange?.category === 'substantive' ? 'border-b border-[#DC2626]/50' :
                                                     catChange?.category === 'formatting' ? 'opacity-60' :
                                                     catChange?.category === 'minor' ? 'border-b border-[#F59E0B]/30' : '';

                                return (
                                  <span
                                    key={change.id}
                                    className={`${
                                      change.type === 'delete' ? 'bg-red-500/20 text-red-400 line-through' :
                                      change.type === 'insert' ? 'bg-green-500/20 text-green-400 underline' :
                                      'text-white'
                                    } ${change.type !== 'equal' ? categoryColor : ''}`}
                                    title={catChange?.explanation || undefined}
                                  >
                                    {change.text}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-sm font-mono whitespace-pre-wrap">
                      {(categorizedChanges || compareResult.changes)
                        .filter(change => {
                          if (categoryFilter === 'all') return true;
                          if (change.type === 'equal') return true;
                          const catChange = categorizedChanges?.find(c => c.id === change.id) as CategorizedChange | undefined;
                          return catChange?.category === categoryFilter;
                        })
                        .map((change) => {
                          const catChange = categorizedChanges?.find(c => c.id === change.id) as CategorizedChange | undefined;
                          const categoryColor = catChange?.category === 'substantive' ? 'border-b border-[#DC2626]/50' :
                                               catChange?.category === 'formatting' ? 'opacity-60' :
                                               catChange?.category === 'minor' ? 'border-b border-[#F59E0B]/30' : '';

                          return (
                            <span
                              key={change.id}
                              className={`${
                                change.type === 'delete' ? 'bg-red-500/20 text-red-400 line-through' :
                                change.type === 'insert' ? 'bg-green-500/20 text-green-400 underline' :
                                'text-white'
                              } ${change.type !== 'equal' ? categoryColor : ''}`}
                              title={catChange?.explanation || undefined}
                            >
                              {change.text}
                            </span>
                          );
                        })}
                    </div>
                  )}
                </div>

                {/* Zero Changes Notice */}
                {compareResult.stats.totalChanges === 0 && (
                  <div className="p-4 bg-[#22C55E]/10 border border-[#22C55E]/30 rounded-lg text-[#22C55E] text-center">
                    <svg className="w-8 h-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="font-medium">Documents are identical</p>
                    <p className="text-sm opacity-75">No differences found after normalization</p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={handleExportCompareToWord}
                    disabled={isGeneratingDocx}
                    className="flex-1 py-2.5 bg-[#38BDF8]/10 text-[#38BDF8] font-medium rounded-lg hover:bg-[#38BDF8]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isGeneratingDocx ? (
                      <>
                        <div className="w-4 h-4 border-2 border-[#38BDF8] border-t-transparent rounded-full animate-spin" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Export to Word
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleResetCompare}
                    className="flex-1 py-2.5 bg-[#151F2E] text-[#8FA3BF] font-medium rounded-lg hover:bg-[#1E293B] hover:text-white transition-colors"
                  >
                    New Comparison
                  </button>
                </div>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-[#475569]">
                <div className="text-center">
                  <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p>{activeTab === 'compare' ? 'Comparison results will appear here' : 'Analysis results will appear here'}</p>
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* History Panel */}
        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-6 bg-[#111827] rounded-xl border border-white/[0.04] p-6"
            >
              <h2 className="text-lg font-semibold text-white mb-4">Review History</h2>

              {history.length > 0 ? (
                <div className="space-y-2">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 bg-[#0B1220] rounded-lg hover:bg-[#151F2E] transition-colors cursor-pointer"
                    >
                      <div>
                        <p className="text-white font-medium">{item.provisionName}</p>
                        <p className="text-[#64748B] text-sm">{item.contractName}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs px-2 py-1 rounded ${
                          item.status === 'approved' ? 'bg-[#22C55E]/10 text-[#22C55E]' :
                          item.status === 'sent_to_client' ? 'bg-[#38BDF8]/10 text-[#38BDF8]' :
                          item.status === 'sent_to_boss' ? 'bg-[#F59E0B]/10 text-[#F59E0B]' :
                          'bg-white/5 text-[#8FA3BF]'
                        }`}>
                          {item.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                        <p className="text-[#64748B] text-xs mt-1">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[#475569] text-center py-8">No review history yet</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.main>
      <style dangerouslySetInnerHTML={{ __html: `.contract-redlines del { background-color: rgba(239, 68, 68, 0.2); color: #f87171; text-decoration: line-through; } .contract-redlines ins { background-color: rgba(34, 197, 94, 0.2); color: #4ade80; text-decoration: underline; }` }} />

      {/* Contract Selector Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[#0F172A] border border-white/[0.08] rounded-xl w-full max-w-lg mx-4 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/[0.08]">
              <h3 className="text-white font-semibold">Save Comparison to Contract</h3>
              <button
                onClick={() => setShowSaveModal(false)}
                className="text-[#8FA3BF] hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-4">
              <p className="text-[#8FA3BF] text-sm">
                No contract was selected. Please select a contract to save this comparison to:
              </p>

              {/* Search Input */}
              <div className="relative">
                <input
                  type="text"
                  value={saveModalSearch}
                  onChange={(e) => setSaveModalSearch(e.target.value)}
                  placeholder="Search contracts..."
                  className="w-full bg-[#151F2E] border border-white/[0.08] rounded-lg px-4 py-2.5 pl-10 text-white text-sm placeholder-[#475569] focus:outline-none focus:ring-2 focus:ring-[#38BDF8]/50"
                />
                <svg className="w-4 h-4 text-[#475569] absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              {/* Contract List */}
              <div className="max-h-64 overflow-y-auto space-y-2">
                {contracts
                  .filter(c =>
                    c.name.toLowerCase().includes(saveModalSearch.toLowerCase()) ||
                    c.contractType?.some(t => t.toLowerCase().includes(saveModalSearch.toLowerCase()))
                  )
                  .slice(0, 10)
                  .map(contract => (
                    <div
                      key={contract.id}
                      onClick={() => setSaveModalContract(contract.id)}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        saveModalContract === contract.id
                          ? 'bg-[#38BDF8]/20 border border-[#38BDF8]/50'
                          : 'bg-[#151F2E] hover:bg-[#1E293B] border border-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-white text-sm font-medium">{contract.name}</span>
                        {saveModalContract === contract.id && (
                          <svg className="w-5 h-5 text-[#38BDF8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs px-2 py-0.5 rounded bg-[#8B5CF6]/20 text-[#8B5CF6]">
                          {contract.contractType?.length > 0 ? contract.contractType.join(', ') : 'No Type'}
                        </span>
                        {contract.value && (
                          <span className="text-xs text-[#8FA3BF]">
                            ${contract.value.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                }
                {contracts.filter(c =>
                  c.name.toLowerCase().includes(saveModalSearch.toLowerCase()) ||
                  c.contractType?.some(t => t.toLowerCase().includes(saveModalSearch.toLowerCase()))
                ).length === 0 && (
                  <p className="text-[#475569] text-sm text-center py-4">No contracts found</p>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-2 p-4 border-t border-white/[0.08]">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 text-[#8FA3BF] hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => saveModalContract && handleSaveComparison(saveModalContract)}
                disabled={!saveModalContract || isSavingComparison}
                className="flex items-center gap-2 px-4 py-2 bg-[#22C55E] hover:bg-[#16A34A] text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingComparison ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save to Selected Contract</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper to format redlines with HTML
function formatRedlines(text: string): string {
  return text
    .replace(/\[strikethrough\](.*?)\[\/strikethrough\]/g, '<del>$1</del>')
    .replace(/\[underline\](.*?)\[\/underline\]/g, '<ins>$1</ins>')
    .replace(/~~(.*?)~~/g, '<del>$1</del>')
    .replace(/\+\+(.*?)\+\+/g, '<ins>$1</ins>');
}
