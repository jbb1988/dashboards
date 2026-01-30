'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createBrowserClient } from '@supabase/ssr';
import ContractLeftPanel from './ContractLeftPanel';
import ContractCenterContent from './ContractCenterContent';
import ContractContextPanel from './ContractContextPanel';
import { elevation, colors, radius } from '@/components/mars-ui/tokens';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface Contract {
  id: string;
  salesforceId: string;
  name: string;
  status: string;
  value: number;
  contractType: string[];
}

export interface RiskScores {
  summary: {
    high: number;
    medium: number;
    low: number;
  };
  sections: Array<{
    sectionTitle: string;
    riskLevel: 'high' | 'medium' | 'low';
  }>;
}

export interface ReviewResult {
  redlinedText: string;
  originalText: string;
  modifiedText: string;
  summary: string[];
  timestamp: string;
  riskScores?: RiskScores;
}

export interface ReviewHistory {
  id: string;
  contractId: string;
  contractName: string;
  provisionName: string;
  createdAt: string;
  status: 'draft' | 'sent_to_boss' | 'sent_to_client' | 'approved';
  originalText?: string;
  redlinedText?: string;
  modifiedText?: string;
  summary?: string[];
  // OneDrive integration
  onedriveWebUrl?: string | null;
  onedriveEmbedUrl?: string | null;
  // Activity log
  activityLog?: Array<{
    action: 'submitted' | 'viewed' | 'edited' | 'approved' | 'rejected' | 'resubmitted';
    by: string;
    at: string;
    note?: string;
    feedback?: string;
  }>;
}

export interface Approval {
  reviewId: string;
  contractId?: string;
  contractName: string;
  provisionName?: string;
  submittedBy: string;
  submittedAt: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  approver?: string;
  approvedAt?: string;
  feedback?: string;
  daysInQueue: number;
  summary: string[];
  urgency: 'critical' | 'high' | 'normal';
  approvalToken?: string;
  activityLog?: Array<{
    action: 'submitted' | 'viewed' | 'edited' | 'approved' | 'rejected' | 'resubmitted';
    by: string;
    at: string;
    note?: string;
    feedback?: string;
  }>;
}

export interface PlaybookOption {
  id: string;
  name: string;
  current_version: number;
}

export type CenterContentMode =
  | 'empty'
  | 'new-review'
  | 'viewing-review'
  | 'viewing-approval'
  | 'viewing-history';

export type ContextPanelTab = 'summary' | 'activity' | 'documents' | 'actions' | null;

export interface SelectedItem {
  type: 'review' | 'approval' | 'history';
  id: string;
  data: ReviewResult | Approval | ReviewHistory;
}

// =============================================================================
// COMMAND CENTER COMPONENT
// =============================================================================

export default function ContractCommandCenter() {
  // ----- User Session -----
  const [userEmail, setUserEmail] = useState<string>('');

  // ----- Data State -----
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [history, setHistory] = useState<ReviewHistory[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [approvalCounts, setApprovalCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [playbooks, setPlaybooks] = useState<PlaybookOption[]>([]);

  // ----- UI State -----
  const [contentMode, setContentMode] = useState<CenterContentMode>('empty');
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const [contextPanelTab, setContextPanelTab] = useState<ContextPanelTab>('summary');
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // ----- Review Form State -----
  const [selectedContract, setSelectedContract] = useState<string>('');
  const [customContractName, setCustomContractName] = useState<string>('');
  const [provisionName, setProvisionName] = useState('');
  const [inputText, setInputText] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [activeInputTab, setActiveInputTab] = useState<'paste' | 'upload' | 'compare'>('paste');
  const [selectedPlaybook, setSelectedPlaybook] = useState<string>('');
  const [playbookContent, setPlaybookContent] = useState<string>('');

  // ----- Analysis State -----
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentResult, setCurrentResult] = useState<ReviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastReviewId, setLastReviewId] = useState<string | null>(null);

  // ----- Approval Workflow State -----
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [ccEmails, setCcEmails] = useState('');
  const [isSendingApproval, setIsSendingApproval] = useState(false);

  // ----- Loading States -----
  const [isExtracting, setIsExtracting] = useState(false);
  const [isGeneratingDocx, setIsGeneratingDocx] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isLoadingApprovals, setIsLoadingApprovals] = useState(true);

  // ===========================================================================
  // DATA FETCHING
  // ===========================================================================

  // Fetch user session
  useEffect(() => {
    const getUser = async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data: { user } } = await supabase.auth.getUser();
      setUserEmail(user?.email || '');
    };
    getUser();
  }, []);

  // Fetch contracts
  const fetchContracts = useCallback(async () => {
    try {
      const response = await fetch('/api/contracts');
      if (response.ok) {
        const data = await response.json();
        setContracts(data.contracts || []);
      }
    } catch (err) {
      console.error('Failed to fetch contracts:', err);
    }
  }, []);

  // Fetch review history
  const fetchHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const response = await fetch('/api/contracts/review/history?limit=50');
      if (response.ok) {
        const data = await response.json();
        setHistory(data.history || []);
      }
    } catch (err) {
      console.error('Failed to fetch review history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  // Fetch approvals
  const fetchApprovals = useCallback(async () => {
    setIsLoadingApprovals(true);
    try {
      const response = await fetch('/api/contracts/review/approvals/queue?status=all');
      if (response.ok) {
        const data = await response.json();
        setApprovals(data.approvals || []);
        setApprovalCounts({
          pending: data.pending || 0,
          approved: data.approved || 0,
          rejected: data.rejected || 0,
        });
      }
    } catch (err) {
      console.error('Failed to fetch approvals:', err);
    } finally {
      setIsLoadingApprovals(false);
    }
  }, []);

  // Fetch playbooks
  const fetchPlaybooks = useCallback(async () => {
    try {
      const response = await fetch('/api/playbooks');
      if (response.ok) {
        const data = await response.json();
        setPlaybooks(data.playbooks || []);
      }
    } catch (err) {
      console.error('Failed to fetch playbooks:', err);
    }
  }, []);

  // Initial data load
  useEffect(() => {
    fetchContracts();
    fetchHistory();
    fetchApprovals();
    fetchPlaybooks();
  }, [fetchContracts, fetchHistory, fetchApprovals, fetchPlaybooks]);

  // Auto-refresh approvals every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchApprovals, 30000);
    return () => clearInterval(interval);
  }, [fetchApprovals]);

  // ===========================================================================
  // EVENT HANDLERS
  // ===========================================================================

  const handleNewReview = useCallback(() => {
    setContentMode('new-review');
    setSelectedItem(null);
    setCurrentResult(null);
    setInputText('');
    setExtractedText(null);
    setUploadedFile(null);
    setProvisionName('');
    setSelectedContract('');
    setActiveInputTab('paste');
    setError(null);
    setContextPanelTab(null);
  }, []);

  const handleSelectApproval = useCallback(async (approval: Approval) => {
    setSelectedItem({ type: 'approval', id: approval.reviewId, data: approval });
    setContentMode('viewing-approval');
    setContextPanelTab('summary');
    setCurrentResult(null); // Clear while loading

    // Fetch from the by-token endpoint which properly regenerates redline HTML
    if (approval.approvalToken) {
      try {
        const response = await fetch(`/api/contracts/review/by-token/${approval.approvalToken}`);
        if (response.ok) {
          const data = await response.json();
          if (data.id) {
            setCurrentResult({
              redlinedText: data.redlinedText || '',
              originalText: data.originalText || '',
              modifiedText: data.modifiedText || '',
              summary: data.summary || approval.summary,
              timestamp: data.submittedAt || approval.submittedAt,
              riskScores: data.riskScores,
            });
            setProvisionName(data.provisionName || approval.provisionName || '');
            if (data.contractId) {
              setSelectedContract(data.contractId);
            }
            setLastReviewId(data.id);
            return;
          }
        }
      } catch (err) {
        console.error('Failed to fetch review by token:', err);
      }
    }

    // Fallback: Try to find from history if token fetch failed
    const historyItem = history.find(h => h.id === approval.reviewId);
    if (historyItem?.originalText && historyItem?.redlinedText) {
      setCurrentResult({
        redlinedText: historyItem.redlinedText,
        originalText: historyItem.originalText,
        modifiedText: historyItem.modifiedText || '',
        summary: historyItem.summary || approval.summary,
        timestamp: historyItem.createdAt,
      });
      setProvisionName(historyItem.provisionName || approval.provisionName || '');
      if (historyItem.contractId) {
        setSelectedContract(historyItem.contractId);
      }
      setLastReviewId(historyItem.id);
    }
  }, [history]);

  const handleSelectHistory = useCallback((item: ReviewHistory) => {
    setSelectedItem({ type: 'history', id: item.id, data: item });
    setContentMode('viewing-history');
    setContextPanelTab('summary');

    // Load the review data
    if (item.originalText && item.redlinedText) {
      setCurrentResult({
        redlinedText: item.redlinedText,
        originalText: item.originalText,
        modifiedText: item.modifiedText || '',
        summary: item.summary || [],
        timestamp: item.createdAt,
      });
      setInputText(item.originalText);
      setProvisionName(item.provisionName);
      if (item.contractId) {
        setSelectedContract(item.contractId);
        setCustomContractName(''); // Clear custom name when linked contract exists
      } else if (item.contractName) {
        // Use contract name as custom name when no contract is linked
        setCustomContractName(item.contractName);
        setSelectedContract('');
      } else {
        setSelectedContract('');
        setCustomContractName('');
      }
      setLastReviewId(item.id);
    }
  }, []);

  const handleAnalyze = useCallback(async () => {
    const textToAnalyze = activeInputTab === 'paste' ? inputText : extractedText;

    if (!textToAnalyze?.trim()) {
      setError('Please enter or upload contract text to analyze');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setCurrentResult(null);

    try {
      const response = await fetch('/api/contracts/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToAnalyze,
          contractId: selectedContract || undefined,
          provisionName: provisionName || undefined,
          model: 'anthropic/claude-sonnet-4',
          playbookContent: playbookContent || undefined,
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Analysis failed. Please try again.';
        try {
          const errorData = await response.json();
          errorMessage = typeof errorData.error === 'string'
            ? errorData.error
            : errorData.error?.message || errorMessage;
        } catch {
          const errorText = await response.text().catch(() => '');
          if (errorText) {
            errorMessage = errorText.substring(0, 200);
          }
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      const newResult: ReviewResult = {
        redlinedText: data.redlinedText,
        originalText: data.originalText,
        modifiedText: data.modifiedText,
        summary: data.summary,
        timestamp: new Date().toISOString(),
        riskScores: data.riskScores,
      };
      setCurrentResult(newResult);
      setContentMode('viewing-review');
      setContextPanelTab('summary');

      // Save to database
      const selectedContractObj = contracts.find(c => c.id === selectedContract);
      try {
        const saveResponse = await fetch('/api/contracts/review/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contractId: selectedContractObj?.salesforceId || selectedContract || null,
            contractName: selectedContractObj?.name || null,
            provisionName: provisionName || selectedContractObj?.name || 'Contract Analysis',
            originalText: textToAnalyze,
            redlinedText: data.redlinedText,
            modifiedText: data.modifiedText,
            summary: data.summary,
            status: 'draft',
          }),
        });
        if (saveResponse.ok) {
          const saveData = await saveResponse.json();
          setLastReviewId(saveData.id);
        }
        fetchHistory();
      } catch (saveErr) {
        console.error('Failed to save review to history:', saveErr);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  }, [activeInputTab, inputText, extractedText, selectedContract, provisionName, playbookContent, contracts, fetchHistory]);

  const handleSendForApproval = useCallback(async () => {
    const hasContractIdentifier = selectedContract || customContractName.trim();
    if (!currentResult || !hasContractIdentifier || !provisionName.trim()) {
      alert('Please select a contract (or enter a custom name), enter a provision name, and complete analysis first');
      return;
    }

    setIsSendingApproval(true);
    try {
      let reviewId = lastReviewId;

      // Get contract info - either from selected contract or custom name
      const contractData = selectedContract ? contracts.find(c => c.id === selectedContract) : null;
      const effectiveContractName = contractData?.name || customContractName.trim() || 'Contract';

      if (!reviewId) {
        const createResponse = await fetch('/api/contracts/review/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contract_id: selectedContract || null,
            contract_name: effectiveContractName,
            provision_name: provisionName,
            original_text: currentResult.originalText,
            redlined_text: currentResult.redlinedText,
            modified_text: currentResult.modifiedText || '',
            summary: currentResult.summary,
            risk_scores: currentResult.riskScores || null,
            status: 'draft',
          }),
        });

        if (!createResponse.ok) {
          throw new Error('Failed to save review');
        }

        const createData = await createResponse.json();
        reviewId = createData.id;
        setLastReviewId(reviewId);
      }

      const response = await fetch('/api/contracts/review/request-approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewId,
          contractName: effectiveContractName,
          submittedBy: userEmail,
          summaryPreview: currentResult.summary.slice(0, 5),
          reviewerNotes: reviewerNotes.trim() || null,
          ccEmails: ccEmails.trim() || null,
        }),
      });

      const data = await response.json();

      if (data.success) {
        const ccMsg = data.ccEmailsSent > 0 ? ` and CC'd ${data.ccEmailsSent} recipient(s)` : '';
        alert(`Approval request sent to ${data.emailsSent} admin(s)${ccMsg}!`);
        await fetchApprovals();
        await fetchHistory();
      } else {
        alert(data.error || 'Failed to send approval request');
      }
    } catch (err) {
      console.error('Error sending approval request:', err);
      alert('Failed to send approval request');
    } finally {
      setIsSendingApproval(false);
    }
  }, [currentResult, selectedContract, customContractName, provisionName, lastReviewId, contracts, userEmail, reviewerNotes, ccEmails, fetchApprovals, fetchHistory]);

  const handlePreviewApproval = useCallback(async () => {
    const hasContractIdentifier = selectedContract || customContractName.trim();
    if (!currentResult || !hasContractIdentifier || !provisionName.trim()) {
      alert('Please select a contract (or enter a custom name), enter a provision name, and complete analysis first');
      return;
    }

    setIsSendingApproval(true); // Reuse the loading state
    try {
      let reviewId = lastReviewId;

      // Get contract info - either from selected contract or custom name
      const contractData = selectedContract ? contracts.find(c => c.id === selectedContract) : null;
      const effectiveContractName = contractData?.name || customContractName.trim() || 'Contract';

      // Create the review if it doesn't exist
      if (!reviewId) {
        const createResponse = await fetch('/api/contracts/review/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contract_id: selectedContract || null,
            contract_name: effectiveContractName,
            provision_name: provisionName,
            original_text: currentResult.originalText,
            redlined_text: currentResult.redlinedText,
            modified_text: currentResult.modifiedText || '',
            summary: currentResult.summary,
            risk_scores: currentResult.riskScores || null,
            status: 'draft',
          }),
        });

        if (!createResponse.ok) {
          throw new Error('Failed to save review');
        }

        const createData = await createResponse.json();
        reviewId = createData.id;
        setLastReviewId(reviewId);
      }

      // Create preview token (without sending emails)
      const response = await fetch('/api/contracts/review/preview-approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewId,
          contractName: effectiveContractName,
          submittedBy: userEmail,
          reviewerNotes: reviewerNotes.trim() || null,
        }),
      });

      const data = await response.json();

      if (data.success && data.previewToken) {
        // Open preview in new tab
        window.open(`/contracts/review/approve/${data.previewToken}?preview=true`, '_blank');
      } else {
        alert(data.error || 'Failed to create preview');
      }
    } catch (err) {
      console.error('Error creating preview:', err);
      alert('Failed to create preview');
    } finally {
      setIsSendingApproval(false);
    }
  }, [currentResult, selectedContract, customContractName, provisionName, lastReviewId, contracts, userEmail, reviewerNotes]);

  const handleDeleteHistoryItem = useCallback(async (reviewId: string) => {
    if (!confirm('Are you sure you want to delete this review from history?')) {
      return;
    }

    try {
      const response = await fetch(`/api/contracts/review/history?id=${reviewId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setHistory(prev => prev.filter(item => item.id !== reviewId));
        if (selectedItem?.id === reviewId) {
          setSelectedItem(null);
          setContentMode('empty');
        }
      }
    } catch (err) {
      console.error('Error deleting history item:', err);
    }
  }, [selectedItem]);

  const handleUpdateHistoryItem = useCallback(async (
    reviewId: string,
    updates: { provisionName?: string; contractName?: string; summary?: string[] }
  ) => {
    try {
      const response = await fetch('/api/contracts/review/history/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId, ...updates }),
      });

      if (response.ok) {
        // Update local state
        setHistory(prev => prev.map(item =>
          item.id === reviewId
            ? {
                ...item,
                provisionName: updates.provisionName ?? item.provisionName,
                contractName: updates.contractName ?? item.contractName,
                summary: updates.summary ?? item.summary,
              }
            : item
        ));

        // Also update approvals if this review is a pending approval
        setApprovals(prev => prev.map(item =>
          item.reviewId === reviewId
            ? {
                ...item,
                provisionName: updates.provisionName ?? item.provisionName,
                contractName: updates.contractName ?? item.contractName,
                summary: updates.summary ?? item.summary,
              }
            : item
        ));

        // Update current result if viewing this item
        if (selectedItem?.id === reviewId && updates.summary) {
          setCurrentResult(prev => prev ? { ...prev, summary: updates.summary! } : prev);
        }
      }
    } catch (err) {
      console.error('Error updating history item:', err);
    }
  }, [selectedItem]);

  const handleDeleteApproval = useCallback(async (reviewId: string) => {
    if (!confirm('Are you sure you want to cancel this approval request? The review will be returned to draft status.')) {
      return;
    }

    try {
      const response = await fetch(`/api/contracts/review/approvals/queue?reviewId=${reviewId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Remove from approvals list
        setApprovals(prev => prev.filter(a => a.reviewId !== reviewId));
        // Refresh history to show the item back as draft
        fetchHistory();
        // Clear selection if this was selected
        if (selectedItem?.id === reviewId) {
          setSelectedItem(null);
          setContentMode('empty');
        }
      }
    } catch (err) {
      console.error('Error deleting approval:', err);
    }
  }, [selectedItem, fetchHistory]);

  // ===========================================================================
  // COMPUTED VALUES
  // ===========================================================================

  // Get review IDs that are pending approval to exclude from other sections
  const pendingApprovalReviewIds = new Set(
    approvals.filter(a => a.approvalStatus === 'pending').map(a => a.reviewId)
  );

  const pendingApprovals = approvals.filter(a => a.approvalStatus === 'pending');

  // In Progress: Only drafts that haven't been sent for approval yet
  const inProgressReviews = history.filter(h =>
    h.status === 'draft' && !pendingApprovalReviewIds.has(h.id)
  );

  // Recent: Completed/approved items only (not drafts or pending approval)
  const recentHistory = history
    .filter(h => (h.status === 'approved' || h.status === 'sent_to_client') && !pendingApprovalReviewIds.has(h.id))
    .slice(0, 5);

  // Filter based on search
  const filteredApprovals = searchQuery
    ? pendingApprovals.filter(a =>
        a.contractName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.submittedBy?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.provisionName?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : pendingApprovals;

  const filteredHistory = searchQuery
    ? history.filter(h =>
        h.contractName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.provisionName?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : history;

  // ===========================================================================
  // RENDER
  // ===========================================================================

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: elevation.L0.background }}
    >
      {/* Left Panel - Navigation & Queue */}
      <ContractLeftPanel
        collapsed={leftPanelCollapsed}
        onToggleCollapse={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        pendingApprovals={filteredApprovals}
        pendingCount={approvalCounts.pending}
        inProgressReviews={inProgressReviews}
        recentHistory={recentHistory}
        allHistory={filteredHistory}
        isLoadingApprovals={isLoadingApprovals}
        isLoadingHistory={isLoadingHistory}
        selectedItemId={selectedItem?.id || null}
        onNewReview={handleNewReview}
        onSelectApproval={handleSelectApproval}
        onSelectHistory={handleSelectHistory}
        onDeleteHistory={handleDeleteHistoryItem}
        onDeleteApproval={handleDeleteApproval}
      />

      {/* Center Content */}
      <ContractCenterContent
        mode={contentMode}
        selectedItem={selectedItem}
        currentResult={currentResult}
        error={error}
        isAnalyzing={isAnalyzing}
        // Form state
        contracts={contracts}
        selectedContract={selectedContract}
        onSelectContract={setSelectedContract}
        provisionName={provisionName}
        onProvisionNameChange={setProvisionName}
        inputText={inputText}
        onInputTextChange={setInputText}
        uploadedFile={uploadedFile}
        onUploadFile={setUploadedFile}
        extractedText={extractedText}
        onExtractedTextChange={setExtractedText}
        activeInputTab={activeInputTab}
        onInputTabChange={setActiveInputTab}
        isExtracting={isExtracting}
        onSetExtracting={setIsExtracting}
        playbooks={playbooks}
        selectedPlaybook={selectedPlaybook}
        onSelectPlaybook={setSelectedPlaybook}
        playbookContent={playbookContent}
        onPlaybookContentChange={setPlaybookContent}
        // Actions
        onAnalyze={handleAnalyze}
        onNewReview={handleNewReview}
        onUpdateHistoryItem={handleUpdateHistoryItem}
        // Stats for empty state
        pendingCount={approvalCounts.pending}
        inProgressCount={inProgressReviews.length}
        totalReviewsThisMonth={history.filter(h => {
          const date = new Date(h.createdAt);
          const now = new Date();
          return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        }).length}
      />

      {/* Right Context Panel */}
      <ContractContextPanel
        activeTab={contextPanelTab}
        onTabChange={setContextPanelTab}
        selectedItem={selectedItem}
        currentResult={currentResult}
        // Approval workflow props
        reviewerNotes={reviewerNotes}
        onReviewerNotesChange={setReviewerNotes}
        ccEmails={ccEmails}
        onCcEmailsChange={setCcEmails}
        onSendForApproval={handleSendForApproval}
        onPreviewApproval={handlePreviewApproval}
        isSendingApproval={isSendingApproval}
        canSendApproval={!!(currentResult && (selectedContract || customContractName.trim()) && provisionName.trim())}
        customContractName={customContractName}
        onCustomContractNameChange={setCustomContractName}
        onUpdateSummary={selectedItem?.type === 'history' ? (summary) => handleUpdateHistoryItem(selectedItem.id, { summary }) : undefined}
        // Download props
        onDownloadOriginal={() => {/* TODO */}}
        onDownloadRevised={() => {/* TODO */}}
        onCopyText={() => {
          if (currentResult?.redlinedText) {
            navigator.clipboard.writeText(currentResult.redlinedText);
            alert('Redlines copied to clipboard');
          }
        }}
        isGeneratingDocx={isGeneratingDocx}
        hasModifiedText={!!currentResult?.modifiedText}
      />
    </div>
  );
}
