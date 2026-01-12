'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Types
interface BundleInfo {
  bundleId: string;
  bundleName: string;
  isPrimary: boolean;
  contractCount: number;
}

interface NotionTask {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  priority: string | null;
  assignee: string | null;
}

interface ContractDocument {
  id: string;
  document_type: string;
  status: string;
  file_name: string | null;
  file_url: string | null;
  file_size: number | null;
  version: number;
  uploaded_at: string | null;
  uploaded_by: string | null;
}

interface ContractReviewItem {
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
}

const DOCUMENT_TYPES = [
  { type: 'Original Contract', required: true },
  { type: 'MARS Redlines', required: true },
  { type: 'Client Response', required: false },
  { type: 'Final Agreement', required: true },
  { type: 'Executed Contract', required: true },
  { type: 'Purchase Order', required: false },
  { type: 'Amendment', required: false },
];

export interface Contract {
  id: string;
  salesforceId?: string;
  name: string;
  opportunityName?: string;
  value: number;
  status: string;
  statusGroup: string;
  salesStage?: string;
  contractType: string[];
  daysInStage: number;
  daysUntilDeadline: number;
  closeDate: string | null;
  awardDate: string | null;
  contractDate: string | null;
  deliverDate: string | null;
  installDate: string | null;
  cashDate: string | null;
  statusChangeDate: string | null;
  progress: number;
  isOverdue: boolean;
  nextTask: string;
  salesRep?: string;
  probability?: number;
  salesforceUrl?: string;
  notInNotion?: boolean;
  isRenewal?: boolean;
  notionName?: string;
  notionPageId?: string;
  matchType?: string;
  budgeted?: boolean;
  manualCloseProbability?: number | null;
  redlines?: string;
  lastRedlineDate?: string | null;
  bundleInfo?: BundleInfo | null;
}

interface ContractDetailDrawerProps {
  contract: Contract | null;
  onClose: () => void;
  onUpdate?: () => void;
  openBundleModal?: (contract: Contract, mode: 'create' | 'add') => void;
}

// Stage colors
const STAGE_COLORS: Record<string, string> = {
  '1': '#38BDF8',
  '2': '#F59E0B',
  '3': '#A78BFA',
  '4': '#EC4899',
  '5': '#22C55E',
};

const statusColors: Record<string, string> = {
  'Discussions Not Started': '#64748B',
  'Initial Agreement Development': STAGE_COLORS['1'],
  'Review & Redlines': STAGE_COLORS['2'],
  'Agreement Submission': STAGE_COLORS['3'],
  'Approval & Signature': STAGE_COLORS['4'],
  'PO Received': STAGE_COLORS['5'],
};

const getStatusColor = (status: string): string => {
  return statusColors[status] || '#64748B';
};

// Date colors for timeline
const DATE_COLORS = {
  award: '#8B5CF6',
  contract: '#0189CB',
  delivery: '#F59E0B',
  install: '#22C55E',
  cash: '#EC4899',
};

// Parse latest review summary from redlines field
function parseLatestSummary(redlines: string): string[] {
  if (!redlines) return [];
  const lastEntry = redlines.split('---').pop()?.trim() || redlines;
  const match = lastEntry.match(/\[\d{4}-\d{2}-\d{2}\]\s*[^:]+:\s*(.+)/);
  if (match) {
    return match[1].split(' | ').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

// Format currency
function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toLocaleString()}`;
}

export default function ContractDetailDrawer({
  contract,
  onClose,
  onUpdate,
  openBundleModal,
}: ContractDetailDrawerProps) {
  // Edit dates state
  const [isEditingDates, setIsEditingDates] = useState(false);
  const [isSavingDates, setIsSavingDates] = useState(false);
  const [editedAwardDate, setEditedAwardDate] = useState('');
  const [editedContractDate, setEditedContractDate] = useState('');
  const [editedDeliverDate, setEditedDeliverDate] = useState('');
  const [editedInstallDate, setEditedInstallDate] = useState('');
  const [editedCashDate, setEditedCashDate] = useState('');
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Tasks state
  const [tasks, setTasks] = useState<NotionTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksFetched, setTasksFetched] = useState(false);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  // Documents state
  const [documents, setDocuments] = useState<ContractDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsFetched, setDocsFetched] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);

  // Reviews state
  const [reviews, setReviews] = useState<ContractReviewItem[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsFetched, setReviewsFetched] = useState(false);
  const [expandedReviewId, setExpandedReviewId] = useState<string | null>(null);

  // Reset state when contract changes
  useEffect(() => {
    if (contract) {
      setIsEditingDates(false);
      setSaveMessage(null);
      setEditedAwardDate(formatDateForInput(contract.awardDate));
      setEditedContractDate(formatDateForInput(contract.contractDate));
      setEditedDeliverDate(formatDateForInput(contract.deliverDate));
      setEditedInstallDate(formatDateForInput(contract.installDate));
      setEditedCashDate(formatDateForInput(contract.cashDate));
      setTasksFetched(false);
      setTasks([]);
      setDocsFetched(false);
      setDocuments([]);
      setReviewsFetched(false);
      setReviews([]);
      setExpandedReviewId(null);
    }
  }, [contract?.id]);

  // Fetch tasks when drawer opens
  useEffect(() => {
    if (contract && !tasksFetched) {
      setTasksLoading(true);
      fetch(`/api/contracts/tasks?contractName=${encodeURIComponent(contract.name)}`)
        .then(res => res.json())
        .then(data => {
          setTasks(data.tasks || []);
          setTasksFetched(true);
        })
        .catch(err => console.error('Error fetching tasks:', err))
        .finally(() => setTasksLoading(false));
    }
  }, [contract, tasksFetched]);

  // Fetch documents when drawer opens
  useEffect(() => {
    if (contract && !docsFetched) {
      setDocsLoading(true);
      const id = contract.salesforceId || contract.id;
      fetch(`/api/contracts/documents?salesforceId=${encodeURIComponent(id)}`)
        .then(res => res.json())
        .then(data => {
          setDocuments(data.documents || []);
          setDocsFetched(true);
        })
        .catch(err => console.error('Error fetching documents:', err))
        .finally(() => setDocsLoading(false));
    }
  }, [contract, docsFetched]);

  // Fetch reviews when drawer opens
  useEffect(() => {
    if (contract && !reviewsFetched) {
      setReviewsLoading(true);
      const contractId = contract.salesforceId || contract.id;
      fetch(`/api/contracts/review/history?contractId=${encodeURIComponent(contractId)}`)
        .then(res => res.json())
        .then(data => {
          setReviews(data.history || []);
          setReviewsFetched(true);
        })
        .catch(err => console.error('Error fetching reviews:', err))
        .finally(() => setReviewsLoading(false));
    }
  }, [contract, reviewsFetched]);

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

  if (!contract) return null;

  const statusColor = getStatusColor(contract.status);
  const salesforceUrl = contract.salesforceUrl || `https://marscompany.lightning.force.com/lightning/r/Opportunity/${contract.salesforceId}/view`;

  // Date formatting helpers
  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatDateCompact(dateStr: string | null): string {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);
    return `${month}/${day}/${year}`;
  }

  function formatDateForInput(dateStr: string | null): string {
    if (!dateStr) return '';
    return dateStr.split('T')[0];
  }

  // Save dates handler
  const handleSaveDates = async () => {
    setIsSavingDates(true);
    setSaveMessage(null);

    try {
      const updates: Record<string, any> = {};
      if (editedAwardDate !== formatDateForInput(contract.awardDate)) updates.awardDate = editedAwardDate || null;
      if (editedContractDate !== formatDateForInput(contract.contractDate)) updates.contractDate = editedContractDate || null;
      if (editedDeliverDate !== formatDateForInput(contract.deliverDate)) updates.deliverDate = editedDeliverDate || null;
      if (editedInstallDate !== formatDateForInput(contract.installDate)) updates.installDate = editedInstallDate || null;
      if (editedCashDate !== formatDateForInput(contract.cashDate)) updates.cashDate = editedCashDate || null;

      if (Object.keys(updates).length === 0) {
        setIsEditingDates(false);
        return;
      }

      const response = await fetch('/api/contracts/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salesforceId: contract.salesforceId || contract.id,
          contractName: contract.notionName || contract.name,
          updates,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setSaveMessage({ type: 'success', text: 'Synced to Notion!' });
        setTimeout(() => {
          setIsEditingDates(false);
          setSaveMessage(null);
          onUpdate?.();
        }, 1500);
      } else {
        setSaveMessage({ type: 'error', text: result.error || 'Failed to update' });
      }
    } catch (err) {
      setSaveMessage({ type: 'error', text: 'Network error' });
    } finally {
      setIsSavingDates(false);
    }
  };

  // Task handlers
  const handleToggleTaskStatus = async (task: NotionTask) => {
    const isComplete = task.status.toLowerCase().includes('done') || task.status.toLowerCase().includes('complete');
    const newStatus = isComplete ? 'To Do' : 'Done';

    // Optimistic update
    setTasks(prev => prev.map(t =>
      t.id === task.id ? { ...t, status: newStatus } : t
    ));

    try {
      const response = await fetch('/api/contracts/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: task.id,
          updates: { status: newStatus }
        }),
      });

      if (!response.ok) {
        // Revert on failure
        setTasks(prev => prev.map(t =>
          t.id === task.id ? { ...t, status: task.status } : t
        ));
      }
    } catch (err) {
      // Revert on error
      setTasks(prev => prev.map(t =>
        t.id === task.id ? { ...t, status: task.status } : t
      ));
    }
  };

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) return;

    setIsCreatingTask(true);
    try {
      const response = await fetch('/api/contracts/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractName: contract.name,
          title: newTaskTitle.trim(),
          dueDate: newTaskDueDate || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setTasks(prev => [{
          id: data.taskId,
          title: newTaskTitle.trim(),
          status: 'To Do',
          dueDate: newTaskDueDate || null,
          priority: null,
          assignee: null,
        }, ...prev]);
        setNewTaskTitle('');
        setNewTaskDueDate('');
        setIsAddingTask(false);
      }
    } catch (err) {
      console.error('Error creating task:', err);
    } finally {
      setIsCreatingTask(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Delete this task?')) return;

    try {
      const response = await fetch(`/api/contracts/tasks?taskId=${taskId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setTasks(prev => prev.filter(t => t.id !== taskId));
      }
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  // Review handlers
  const handleDeleteReview = async (reviewId: string) => {
    if (!confirm('Delete this analysis? This cannot be undone.')) return;

    try {
      const response = await fetch(`/api/contracts/review/history?id=${reviewId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setReviews(prev => prev.filter(r => r.id !== reviewId));
        if (expandedReviewId === reviewId) {
          setExpandedReviewId(null);
        }
      }
    } catch (err) {
      console.error('Error deleting review:', err);
    }
  };

  // Document handlers - uploads to Supabase storage and syncs to Salesforce
  const handleDocumentUpload = async (file: File, documentType: string) => {
    setUploadingDocType(documentType);

    try {
      // Step 1: Get signed upload URL from Supabase
      const signedUrlResponse = await fetch(`/api/storage/upload?filename=${encodeURIComponent(file.name)}`);
      if (!signedUrlResponse.ok) {
        throw new Error('Failed to get upload URL');
      }
      const { signedUrl, storagePath } = await signedUrlResponse.json();

      // Step 2: Upload file directly to Supabase storage
      const uploadResponse = await fetch(signedUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
        },
      });
      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file to storage');
      }

      // Step 3: Get the public URL for the uploaded file
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const fileUrl = `${supabaseUrl}/storage/v1/object/public/data-files/${storagePath}`;

      // Step 4: Create document record in database
      const docResponse = await fetch('/api/contracts/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractId: contract.id,
          salesforceId: contract.salesforceId || null,
          accountName: contract.opportunityName || contract.name,
          opportunityName: contract.notionName || contract.name,
          documentType,
          fileName: file.name,
          fileUrl,
          fileSize: file.size,
          fileMimeType: file.type,
          status: 'draft',
        }),
      });

      if (!docResponse.ok) {
        throw new Error('Failed to create document record');
      }

      const docData = await docResponse.json();

      // Step 5: Auto-push to Salesforce if salesforceId is available
      if (contract.salesforceId && docData.document?.id) {
        try {
          const sfResponse = await fetch('/api/contracts/documents/push-to-sf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ documentId: docData.document.id }),
          });
          if (!sfResponse.ok) {
            console.warn('Salesforce sync failed:', await sfResponse.json());
          }
        } catch (sfErr) {
          console.warn('Salesforce sync error:', sfErr);
        }
      }

      // Refresh documents
      setDocsFetched(false);
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploadingDocType(null);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, documentType: string) => {
    const file = e.target.files?.[0];
    if (file) {
      handleDocumentUpload(file, documentType);
    }
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDownload = (doc: ContractDocument) => {
    if (doc.file_url) {
      window.open(doc.file_url, '_blank');
    }
  };

  const handleView = (doc: ContractDocument) => {
    if (doc.file_url) {
      window.open(doc.file_url, '_blank');
    }
  };

  const handleDeleteDocument = async (doc: ContractDocument) => {
    if (!confirm(`Delete ${doc.document_type}? This will also remove it from Salesforce.`)) return;

    try {
      const response = await fetch(`/api/contracts/documents?documentId=${doc.id}&hardDelete=true`, {
        method: 'DELETE',
      });
      if (response.ok) {
        // Refresh documents
        setDocsFetched(false);
      } else {
        alert('Failed to delete document');
      }
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Error deleting document');
    }
  };

  // Document calculations
  const getDocumentByType = (type: string) => documents.find(d => d.document_type === type);
  const requiredDocs = DOCUMENT_TYPES.filter(d => d.required);
  const optionalDocs = DOCUMENT_TYPES.filter(d => !d.required);
  const uploadedRequiredCount = requiredDocs.filter(d => getDocumentByType(d.type)?.file_url).length;
  const completionPercentage = (uploadedRequiredCount / requiredDocs.length) * 100;

  const reviewSummary = parseLatestSummary(contract.redlines || '');
  const pendingTasksCount = tasks.filter(t => !t.status.toLowerCase().includes('done') && !t.status.toLowerCase().includes('complete')).length;

  return (
    <AnimatePresence>
      {contract && (
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
            className="fixed right-0 top-0 bottom-0 w-[520px] bg-[#151F2E] border-l border-white/[0.06] shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex-shrink-0 sticky top-0 bg-[#151F2E] border-b border-white/[0.06] z-10">
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0 pr-4">
                    {/* Status & Badges Row */}
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ background: contract.isOverdue ? '#EF4444' : statusColor }}
                      />
                      <span
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
                      >
                        {contract.status}
                      </span>
                      {contract.isRenewal && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[#A78BFA]/15 text-[#A78BFA]">
                          Renewal
                        </span>
                      )}
                      {contract.budgeted && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[#22C55E]/15 text-[#22C55E]">
                          Budgeted
                        </span>
                      )}
                      {contract.bundleInfo && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[#8B5CF6]/15 text-[#8B5CF6]">
                          Bundle
                        </span>
                      )}
                    </div>

                    {/* Contract Name */}
                    <h2 className="text-[18px] font-semibold text-white leading-tight mb-1">
                      {contract.name}
                    </h2>

                    {/* Account/Opportunity Name */}
                    {contract.opportunityName && contract.opportunityName !== contract.name && (
                      <p className="text-[13px] text-[#8FA3BF] mb-2">
                        {contract.opportunityName}
                      </p>
                    )}

                    {/* Value & Sales Stage */}
                    <div className="flex items-center gap-3">
                      <span className="text-[16px] font-bold text-[#38BDF8]">
                        {formatCurrency(contract.value)}
                      </span>
                      {contract.salesStage && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-white/10 text-[#94A3B8]">
                          {contract.salesStage}
                        </span>
                      )}
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
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-5 space-y-5">

                {/* Key Dates Timeline */}
                <div className="bg-[#0F1722] rounded-xl border border-white/[0.04] overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/[0.04] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-[#0189CB]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Key Dates</span>
                    </div>
                    {!isEditingDates && (
                      <button
                        onClick={() => setIsEditingDates(true)}
                        className="text-[10px] text-[#38BDF8] hover:text-[#7dd3fc] transition-colors flex items-center gap-1 px-2 py-1 rounded hover:bg-[#38BDF8]/10"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        Edit
                      </button>
                    )}
                  </div>

                  {isEditingDates ? (
                    /* Edit Mode */
                    <div className="p-4 space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] text-[#64748B] uppercase tracking-wider mb-1.5">Award</label>
                          <input
                            type="date"
                            value={editedAwardDate}
                            onChange={e => setEditedAwardDate(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-[#151F2E] border border-white/10 text-[#EAF2FF] text-xs focus:outline-none focus:border-[#38BDF8] cursor-pointer"
                            style={{ colorScheme: 'dark' }}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-[#64748B] uppercase tracking-wider mb-1.5">Contract</label>
                          <input
                            type="date"
                            value={editedContractDate}
                            onChange={e => setEditedContractDate(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-[#151F2E] border border-white/10 text-[#EAF2FF] text-xs focus:outline-none focus:border-[#38BDF8] cursor-pointer"
                            style={{ colorScheme: 'dark' }}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-[#64748B] uppercase tracking-wider mb-1.5">Delivery</label>
                          <input
                            type="date"
                            value={editedDeliverDate}
                            onChange={e => setEditedDeliverDate(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-[#151F2E] border border-white/10 text-[#EAF2FF] text-xs focus:outline-none focus:border-[#38BDF8] cursor-pointer"
                            style={{ colorScheme: 'dark' }}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-[#64748B] uppercase tracking-wider mb-1.5">Install</label>
                          <input
                            type="date"
                            value={editedInstallDate}
                            onChange={e => setEditedInstallDate(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-[#151F2E] border border-white/10 text-[#EAF2FF] text-xs focus:outline-none focus:border-[#38BDF8] cursor-pointer"
                            style={{ colorScheme: 'dark' }}
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-[10px] text-[#64748B] uppercase tracking-wider mb-1.5">Cash</label>
                          <input
                            type="date"
                            value={editedCashDate}
                            onChange={e => setEditedCashDate(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-[#151F2E] border border-white/10 text-[#EAF2FF] text-xs focus:outline-none focus:border-[#38BDF8] cursor-pointer"
                            style={{ colorScheme: 'dark' }}
                          />
                        </div>
                      </div>

                      {saveMessage && (
                        <div className={`text-xs ${saveMessage.type === 'success' ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                          {saveMessage.text}
                        </div>
                      )}

                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => {
                            setIsEditingDates(false);
                            setSaveMessage(null);
                            setEditedAwardDate(formatDateForInput(contract.awardDate));
                            setEditedContractDate(formatDateForInput(contract.contractDate));
                            setEditedDeliverDate(formatDateForInput(contract.deliverDate));
                            setEditedInstallDate(formatDateForInput(contract.installDate));
                            setEditedCashDate(formatDateForInput(contract.cashDate));
                          }}
                          className="flex-1 px-3 py-2 text-xs text-[#8FA3BF] hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveDates}
                          disabled={isSavingDates}
                          className="flex-1 px-3 py-2 text-xs bg-[#22C55E] text-white rounded-lg hover:bg-[#16A34A] transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                          {isSavingDates ? (
                            <>
                              <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                              Saving...
                            </>
                          ) : (
                            'Save Changes'
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* View Mode - Visual Timeline */
                    <div className="p-4 space-y-2">
                      {[
                        { label: 'Award', date: contract.awardDate, color: DATE_COLORS.award },
                        { label: 'Contract', date: contract.contractDate, color: DATE_COLORS.contract },
                        { label: 'Delivery', date: contract.deliverDate, color: DATE_COLORS.delivery },
                        { label: 'Install', date: contract.installDate, color: DATE_COLORS.install },
                        { label: 'Cash', date: contract.cashDate, color: DATE_COLORS.cash },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center gap-3 py-1.5">
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: item.color, boxShadow: `0 0 8px ${item.color}50` }}
                          />
                          <span className="text-[12px] text-[#64748B] w-16">{item.label}</span>
                          <span className={`text-[13px] font-medium tabular-nums ${item.date ? 'text-[#E2E8F0]' : 'text-[#475569]'}`}>
                            {formatDateCompact(item.date)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Contract Details */}
                <div className="bg-[#0F1722] rounded-xl border border-white/[0.04] overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/[0.04]">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-[#A78BFA]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Contract Details</span>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    {/* Contract Type */}
                    <div className="flex items-start justify-between">
                      <span className="text-[12px] text-[#64748B]">Contract Type</span>
                      <div className="flex flex-wrap gap-1 justify-end">
                        {contract.contractType.length > 0 ? (
                          contract.contractType.map(type => (
                            <span key={type} className="px-2 py-0.5 rounded text-[11px] bg-[#1E293B] text-[#CBD5E1] border-l-2 border-[#0189CB]">
                              {type}
                            </span>
                          ))
                        ) : (
                          <span className="text-[12px] text-[#475569]">-</span>
                        )}
                      </div>
                    </div>

                    {/* Sales Rep */}
                    <div className="flex items-center justify-between py-2 border-t border-white/[0.04]">
                      <span className="text-[12px] text-[#64748B]">Sales Rep</span>
                      <span className="text-[13px] text-white">{contract.salesRep || '-'}</span>
                    </div>

                    {/* Probability */}
                    <div className="flex items-center justify-between py-2 border-t border-white/[0.04]">
                      <span className="text-[12px] text-[#64748B]">Probability</span>
                      <span className="text-[15px] font-semibold text-white">
                        {contract.probability || 0}%
                      </span>
                    </div>

                    {/* Bundle */}
                    <div className="flex items-center justify-between py-2 border-t border-white/[0.04]">
                      <span className="text-[12px] text-[#64748B]">Bundle</span>
                      {contract.bundleInfo ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] text-[#8B5CF6]">
                            {contract.bundleInfo.bundleName.length > 20
                              ? `${contract.bundleInfo.bundleName.substring(0, 20)}...`
                              : contract.bundleInfo.bundleName}
                          </span>
                          <span className="text-[9px] text-[#64748B] bg-[#8B5CF6]/10 px-1.5 py-0.5 rounded">
                            {contract.bundleInfo.contractCount}
                          </span>
                          {contract.bundleInfo.isPrimary && (
                            <span className="text-[9px] text-[#8B5CF6]">Primary</span>
                          )}
                        </div>
                      ) : openBundleModal ? (
                        <button
                          onClick={() => openBundleModal(contract, 'create')}
                          className="text-[12px] text-[#8B5CF6] hover:text-[#A78BFA] transition-colors flex items-center gap-1"
                        >
                          Create Bundle
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </button>
                      ) : (
                        <span className="text-[12px] text-[#475569]">-</span>
                      )}
                    </div>

                    {/* Days in Stage */}
                    {contract.daysInStage > 0 && (
                      <div className="flex items-center justify-between py-2 border-t border-white/[0.04]">
                        <span className="text-[12px] text-[#64748B]">Days in Stage</span>
                        <span className={`text-[13px] font-medium ${contract.daysInStage > 30 ? 'text-[#F59E0B]' : 'text-white'}`}>
                          {contract.daysInStage} days
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Latest AI Review */}
                {reviewSummary.length > 0 && (
                  <div className="bg-[#0F1722] rounded-xl border border-white/[0.04] overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/[0.04]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Latest AI Review</span>
                        </div>
                        {contract.lastRedlineDate && (
                          <span className="text-[10px] text-[#64748B] bg-[#1E293B] px-2 py-0.5 rounded-full">
                            {new Date(contract.lastRedlineDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="p-4">
                      <ul className="space-y-2">
                        {reviewSummary.map((item, i) => (
                          <li key={i} className="text-[13px] text-[#CBD5E1] flex items-start gap-2">
                            <span className="text-[#22C55E] mt-0.5">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Documents Section */}
                <div className="bg-[#0F1722] rounded-xl border border-white/[0.04] overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/[0.04]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-[#A78BFA]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Documents</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                          completionPercentage === 100 ? 'bg-[#22C55E]/15 text-[#22C55E]' :
                          completionPercentage >= 50 ? 'bg-[#38BDF8]/15 text-[#38BDF8]' :
                          completionPercentage > 0 ? 'bg-[#F59E0B]/15 text-[#F59E0B]' :
                          'bg-[#64748B]/15 text-[#64748B]'
                        }`}>
                          {uploadedRequiredCount}/{requiredDocs.length} required
                        </span>
                      </div>
                    </div>
                    {/* Progress Bar */}
                    <div className="mt-2 h-1.5 bg-[#1E293B] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          completionPercentage === 100 ? 'bg-[#22C55E]' :
                          completionPercentage >= 50 ? 'bg-[#38BDF8]' :
                          completionPercentage > 0 ? 'bg-[#F59E0B]' :
                          'bg-[#64748B]'
                        }`}
                        style={{ width: `${completionPercentage}%` }}
                      />
                    </div>
                  </div>

                  <div className="p-4">
                    {docsLoading ? (
                      <div className="flex items-center justify-center py-6">
                        <div className="w-5 h-5 border-2 border-[#A78BFA]/20 border-t-[#A78BFA] rounded-full animate-spin" />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Required Documents */}
                        <div>
                          <h4 className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider mb-2">Required</h4>
                          <div className="space-y-2">
                            {requiredDocs.map(({ type }) => {
                              const doc = getDocumentByType(type);
                              const hasFile = doc?.file_url;

                              return (
                                <div
                                  key={type}
                                  className={`flex items-center justify-between p-2.5 rounded-lg ${
                                    hasFile ? 'bg-[#22C55E]/5' : 'bg-[#EF4444]/5'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                    {hasFile ? (
                                      <div className="w-5 h-5 rounded flex items-center justify-center bg-[#22C55E]/20 text-[#22C55E]">
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                      </div>
                                    ) : (
                                      <div className="w-5 h-5 rounded flex items-center justify-center bg-[#EF4444]/20 text-[#EF4444]">
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                      </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <span className="text-[12px] text-white font-medium">{type}</span>
                                      {hasFile && doc.file_name && (
                                        <p className="text-[10px] text-[#64748B] truncate">{doc.file_name}</p>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    {hasFile ? (
                                      <>
                                        {doc.uploaded_at && (
                                          <span className="text-[10px] text-[#64748B]">
                                            {new Date(doc.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                          </span>
                                        )}
                                        {doc.version > 1 && (
                                          <span className="text-[9px] text-[#64748B] bg-[#1E293B] px-1.5 py-0.5 rounded">
                                            v{doc.version}
                                          </span>
                                        )}
                                        <button
                                          onClick={() => handleDownload(doc)}
                                          className="p-1.5 text-[#64748B] hover:text-[#38BDF8] hover:bg-[#38BDF8]/10 rounded transition-colors"
                                          title="Download"
                                        >
                                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                          </svg>
                                        </button>
                                        <button
                                          onClick={() => handleView(doc)}
                                          className="p-1.5 text-[#64748B] hover:text-[#38BDF8] hover:bg-[#38BDF8]/10 rounded transition-colors"
                                          title="View"
                                        >
                                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                          </svg>
                                        </button>
                                        <button
                                          onClick={() => handleDeleteDocument(doc)}
                                          className="p-1.5 text-[#64748B] hover:text-[#EF4444] hover:bg-[#EF4444]/10 rounded transition-colors"
                                          title="Delete"
                                        >
                                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                          </svg>
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <span className="text-[10px] text-[#EF4444] mr-1">Missing</span>
                                        <label className="cursor-pointer">
                                          <input
                                            type="file"
                                            className="hidden"
                                            onChange={(e) => handleFileSelect(e, type)}
                                            disabled={uploadingDocType === type}
                                          />
                                          <span className={`px-2.5 py-1.5 text-[10px] font-medium rounded-lg transition-colors inline-flex items-center gap-1 ${
                                            uploadingDocType === type
                                              ? 'bg-[#A78BFA]/20 text-[#A78BFA] cursor-wait'
                                              : 'bg-[#A78BFA] text-white hover:bg-[#A78BFA]/80'
                                          }`}>
                                            {uploadingDocType === type ? (
                                              <>
                                                <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                                                Uploading...
                                              </>
                                            ) : (
                                              <>
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                                </svg>
                                                Upload
                                              </>
                                            )}
                                          </span>
                                        </label>
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Optional Documents */}
                        <div>
                          <h4 className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider mb-2">Optional</h4>
                          <div className="space-y-2">
                            {optionalDocs.map(({ type }) => {
                              const doc = getDocumentByType(type);
                              const hasFile = doc?.file_url;

                              return (
                                <div
                                  key={type}
                                  className={`flex items-center justify-between p-2.5 rounded-lg ${
                                    hasFile ? 'bg-[#22C55E]/5' : 'bg-[#151F2E]'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                    {hasFile ? (
                                      <div className="w-5 h-5 rounded flex items-center justify-center bg-[#22C55E]/20 text-[#22C55E]">
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                      </div>
                                    ) : (
                                      <div className="w-5 h-5 rounded flex items-center justify-center bg-[#64748B]/20 text-[#64748B]">
                                        <div className="w-2 h-2 rounded-full bg-current" />
                                      </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <span className={`text-[12px] ${hasFile ? 'text-white font-medium' : 'text-[#8FA3BF]'}`}>{type}</span>
                                      {hasFile && doc.file_name && (
                                        <p className="text-[10px] text-[#64748B] truncate">{doc.file_name}</p>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    {hasFile ? (
                                      <>
                                        {doc.uploaded_at && (
                                          <span className="text-[10px] text-[#64748B]">
                                            {new Date(doc.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                          </span>
                                        )}
                                        {doc.version > 1 && (
                                          <span className="text-[9px] text-[#64748B] bg-[#1E293B] px-1.5 py-0.5 rounded">
                                            v{doc.version}
                                          </span>
                                        )}
                                        <button
                                          onClick={() => handleDownload(doc)}
                                          className="p-1.5 text-[#64748B] hover:text-[#38BDF8] hover:bg-[#38BDF8]/10 rounded transition-colors"
                                          title="Download"
                                        >
                                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                          </svg>
                                        </button>
                                        <button
                                          onClick={() => handleView(doc)}
                                          className="p-1.5 text-[#64748B] hover:text-[#38BDF8] hover:bg-[#38BDF8]/10 rounded transition-colors"
                                          title="View"
                                        >
                                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                          </svg>
                                        </button>
                                        <button
                                          onClick={() => handleDeleteDocument(doc)}
                                          className="p-1.5 text-[#64748B] hover:text-[#EF4444] hover:bg-[#EF4444]/10 rounded transition-colors"
                                          title="Delete"
                                        >
                                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                          </svg>
                                        </button>
                                      </>
                                    ) : (
                                      <span className="text-[10px] text-[#64748B]">Not uploaded</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tasks Section */}
                <div className="bg-[#0F1722] rounded-xl border border-white/[0.04] overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/[0.04]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-[#38BDF8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                        <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Tasks</span>
                        {tasks.length > 0 && (
                          <span className="text-[10px] text-[#64748B] bg-[#1E293B] px-2 py-0.5 rounded-full">
                            {pendingTasksCount} pending
                          </span>
                        )}
                      </div>
                      {!isAddingTask && (
                        <button
                          onClick={() => setIsAddingTask(true)}
                          className="text-[10px] text-[#38BDF8] hover:text-[#7dd3fc] transition-colors flex items-center gap-1 px-2 py-1 rounded hover:bg-[#38BDF8]/10"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Add Task
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="p-4">
                    {/* Add Task Form */}
                    {isAddingTask && (
                      <div className="mb-4 p-3 rounded-lg bg-[#151F2E] border border-[#38BDF8]/20">
                        <div className="space-y-3">
                          <div>
                            <label className="text-[9px] text-[#64748B] uppercase tracking-wider mb-1 block">Task Title</label>
                            <input
                              type="text"
                              value={newTaskTitle}
                              onChange={e => setNewTaskTitle(e.target.value)}
                              placeholder="Enter task title..."
                              className="w-full px-3 py-2 rounded-lg bg-[#0F1722] border border-white/10 text-[#EAF2FF] text-xs focus:outline-none focus:border-[#38BDF8] placeholder:text-[#475569]"
                              autoFocus
                              onKeyDown={e => {
                                if (e.key === 'Enter' && newTaskTitle.trim()) {
                                  handleCreateTask();
                                } else if (e.key === 'Escape') {
                                  setIsAddingTask(false);
                                  setNewTaskTitle('');
                                  setNewTaskDueDate('');
                                }
                              }}
                            />
                          </div>
                          <div>
                            <label className="text-[9px] text-[#64748B] uppercase tracking-wider mb-1 block">Due Date</label>
                            <input
                              type="date"
                              value={newTaskDueDate}
                              onChange={e => setNewTaskDueDate(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg bg-[#0F1722] border border-white/10 text-[#EAF2FF] text-xs focus:outline-none focus:border-[#38BDF8] cursor-pointer"
                              style={{ colorScheme: 'dark' }}
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setIsAddingTask(false);
                                setNewTaskTitle('');
                                setNewTaskDueDate('');
                              }}
                              className="flex-1 px-3 py-2 text-xs text-[#8FA3BF] hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleCreateTask}
                              disabled={!newTaskTitle.trim() || isCreatingTask}
                              className="flex-1 px-3 py-2 rounded-lg bg-[#38BDF8] text-white text-xs font-medium hover:bg-[#38BDF8]/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isCreatingTask ? '...' : 'Add Task'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Tasks List */}
                    {tasksLoading ? (
                      <div className="flex items-center justify-center py-6">
                        <div className="w-5 h-5 border-2 border-[#38BDF8]/20 border-t-[#38BDF8] rounded-full animate-spin" />
                      </div>
                    ) : tasks.length > 0 ? (
                      <div className="space-y-2">
                        {tasks.map(task => {
                          const isComplete = task.status.toLowerCase().includes('done') || task.status.toLowerCase().includes('complete');
                          const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !isComplete;

                          return (
                            <div
                              key={task.id}
                              className={`
                                group flex items-center justify-between p-3 rounded-lg
                                ${isComplete ? 'bg-[#22C55E]/5' : isOverdue ? 'bg-[#EF4444]/5' : 'bg-[#151F2E]'}
                              `}
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                {/* Status Toggle */}
                                <button
                                  onClick={() => handleToggleTaskStatus(task)}
                                  className={`
                                    w-5 h-5 rounded flex items-center justify-center flex-shrink-0
                                    transition-all duration-200 hover:scale-110 cursor-pointer
                                    ${isComplete
                                      ? 'bg-[#22C55E]/20 text-[#22C55E] hover:bg-[#22C55E]/30'
                                      : isOverdue
                                        ? 'bg-[#EF4444]/20 text-[#EF4444] hover:bg-[#EF4444]/30'
                                        : 'bg-[#38BDF8]/20 text-[#38BDF8] hover:bg-[#38BDF8]/30'
                                    }
                                  `}
                                  title={isComplete ? 'Mark as To Do' : 'Mark as Done'}
                                >
                                  {isComplete ? (
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  ) : (
                                    <div className="w-2 h-2 rounded-full bg-current" />
                                  )}
                                </button>

                                {/* Task title */}
                                <span className={`text-[12px] truncate ${isComplete ? 'text-[#64748B] line-through' : 'text-[#EAF2FF]'}`}>
                                  {task.title}
                                </span>

                                {/* Priority badge */}
                                {task.priority && !isComplete && (
                                  <span className={`
                                    text-[9px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0
                                    ${task.priority.toLowerCase() === 'high'
                                      ? 'bg-[#EF4444]/15 text-[#EF4444]'
                                      : task.priority.toLowerCase() === 'medium'
                                        ? 'bg-[#F59E0B]/15 text-[#F59E0B]'
                                        : 'bg-[#64748B]/15 text-[#64748B]'
                                    }
                                  `}>
                                    {task.priority}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                {/* Due date */}
                                {task.dueDate && (
                                  <span className={`text-[10px] tabular-nums ${
                                    isComplete
                                      ? 'text-[#64748B]'
                                      : isOverdue
                                        ? 'text-[#EF4444]'
                                        : 'text-[#64748B]'
                                  }`}>
                                    {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </span>
                                )}

                                {/* Delete button */}
                                <button
                                  onClick={() => handleDeleteTask(task.id)}
                                  className="p-1.5 text-[#64748B] hover:text-[#EF4444] hover:bg-[#EF4444]/10 rounded transition-all opacity-0 group-hover:opacity-100"
                                  title="Delete task"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <svg className="w-8 h-8 text-[#475569] mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <p className="text-[12px] text-[#64748B]">No tasks linked to this contract</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Contract Analysis Section */}
                <div className="bg-[#0F1722] rounded-xl border border-white/[0.04] overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/[0.04]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                        <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Contract Analysis</span>
                        {reviews.length > 0 && (
                          <span className="text-[10px] text-[#64748B] bg-[#1E293B] px-2 py-0.5 rounded-full">
                            {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
                          </span>
                        )}
                      </div>
                      <a
                        href={`/contracts/review?contractId=${contract.salesforceId || contract.id}&contractName=${encodeURIComponent(contract.name)}`}
                        className="text-[10px] text-[#22C55E] hover:text-[#4ADE80] transition-colors flex items-center gap-1 px-2 py-1 rounded hover:bg-[#22C55E]/10"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        New Review
                      </a>
                    </div>
                  </div>

                  <div className="p-4">
                    {reviewsLoading ? (
                      <div className="flex items-center justify-center py-6">
                        <div className="w-5 h-5 border-2 border-[#22C55E]/20 border-t-[#22C55E] rounded-full animate-spin" />
                      </div>
                    ) : reviews.length > 0 ? (
                      <div className="space-y-3">
                        {reviews.map(review => {
                          const isExpanded = expandedReviewId === review.id;
                          const statusColors: Record<string, { bg: string; text: string }> = {
                            draft: { bg: 'bg-[#64748B]/15', text: 'text-[#64748B]' },
                            sent_to_boss: { bg: 'bg-[#F59E0B]/15', text: 'text-[#F59E0B]' },
                            sent_to_client: { bg: 'bg-[#38BDF8]/15', text: 'text-[#38BDF8]' },
                            approved: { bg: 'bg-[#22C55E]/15', text: 'text-[#22C55E]' },
                          };
                          const statusStyle = statusColors[review.status] || statusColors.draft;

                          return (
                            <div
                              key={review.id}
                              className="rounded-lg bg-[#151F2E] border border-white/[0.04] overflow-hidden"
                            >
                              {/* Review Header */}
                              <div
                                className="flex items-center justify-between p-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
                                onClick={() => setExpandedReviewId(isExpanded ? null : review.id)}
                              >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  <div className={`w-6 h-6 rounded flex items-center justify-center ${statusStyle.bg}`}>
                                    <svg className={`w-3.5 h-3.5 ${statusStyle.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <span className="text-[12px] text-white font-medium block truncate">
                                      {review.provisionName}
                                    </span>
                                    <span className="text-[10px] text-[#64748B]">
                                      {new Date(review.createdAt).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                        hour: 'numeric',
                                        minute: '2-digit',
                                      })}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${statusStyle.bg} ${statusStyle.text}`}>
                                    {review.status.replace(/_/g, ' ')}
                                  </span>
                                  <svg
                                    className={`w-4 h-4 text-[#64748B] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </div>
                              </div>

                              {/* Expanded Content */}
                              {isExpanded && (
                                <div className="border-t border-white/[0.04]">
                                  {/* Summary */}
                                  {review.summary && review.summary.length > 0 && (
                                    <div className="p-3 bg-[#22C55E]/5 border-b border-white/[0.04]">
                                      <h5 className="text-[10px] font-semibold text-[#22C55E] uppercase tracking-wider mb-2">
                                        Key Changes
                                      </h5>
                                      <ul className="space-y-1.5">
                                        {review.summary.map((item, i) => (
                                          <li key={i} className="text-[11px] text-[#CBD5E1] flex items-start gap-2">
                                            <span className="text-[#22C55E] mt-0.5 flex-shrink-0">•</span>
                                            <span>{item}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  {/* Actions */}
                                  <div className="p-3 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <a
                                        href={`/contracts/review?viewId=${review.id}`}
                                        className="px-3 py-1.5 text-[10px] font-medium rounded-lg bg-[#22C55E]/10 text-[#22C55E] hover:bg-[#22C55E]/20 transition-colors flex items-center gap-1"
                                      >
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                        View Full Analysis
                                      </a>
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteReview(review.id);
                                      }}
                                      className="p-1.5 text-[#64748B] hover:text-[#EF4444] hover:bg-[#EF4444]/10 rounded transition-all"
                                      title="Delete review"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <svg className="w-8 h-8 text-[#475569] mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                        <p className="text-[12px] text-[#64748B] mb-2">No analyses yet</p>
                        <a
                          href={`/contracts/review?contractId=${contract.salesforceId || contract.id}&contractName=${encodeURIComponent(contract.name)}`}
                          className="text-[11px] text-[#22C55E] hover:text-[#4ADE80] transition-colors"
                        >
                          Run contract analysis →
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex-shrink-0 border-t border-white/[0.06] bg-[#0F1722] px-5 py-4">
              <div className="flex items-center gap-3">
                <a
                  href={salesforceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 px-4 py-2.5 bg-[#00A1E0] text-white font-medium text-sm rounded-lg hover:bg-[#00A1E0]/90 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Open in Salesforce
                </a>
                <button
                  onClick={onClose}
                  className="px-4 py-2.5 bg-white/10 text-white font-medium text-sm rounded-lg hover:bg-white/20 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
