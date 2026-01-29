'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Clock,
  Paperclip,
  Zap,
  ChevronRight,
  Download,
  Send,
  CheckCircle,
  XCircle,
  Copy,
  AlertTriangle,
  MessageCircle,
  ExternalLink,
  Pencil,
  Check,
  X,
  Plus,
  Trash2,
} from 'lucide-react';
import { elevation, colors } from '@/components/mars-ui/tokens';
import type {
  ReviewResult,
  RiskScores,
  Approval,
  ReviewHistory,
  SelectedItem,
  ContextPanelTab,
} from './ContractCommandCenter';

// =============================================================================
// TYPES
// =============================================================================

interface ContractContextPanelProps {
  activeTab: ContextPanelTab;
  onTabChange: (tab: ContextPanelTab) => void;
  selectedItem: SelectedItem | null;
  currentResult: ReviewResult | null;
  // Approval workflow
  reviewerNotes: string;
  onReviewerNotesChange: (notes: string) => void;
  ccEmails: string;
  onCcEmailsChange: (emails: string) => void;
  onSendForApproval: () => void;
  onPreviewApproval?: () => void;
  isSendingApproval: boolean;
  canSendApproval: boolean;
  // Custom contract name (when no contract is linked)
  customContractName?: string;
  onCustomContractNameChange?: (name: string) => void;
  // Edit summary
  onUpdateSummary?: (summary: string[]) => void;
  // Download actions
  onDownloadOriginal: () => void;
  onDownloadRevised: () => void;
  onCopyText: () => void;
  isGeneratingDocx: boolean;
  hasModifiedText: boolean;
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function TabButton({
  id,
  icon: Icon,
  label,
  isActive,
  badge,
  onClick,
}: {
  id: ContextPanelTab;
  icon: React.ElementType;
  label: string;
  isActive: boolean;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        relative w-full h-12 flex items-center justify-center transition-all duration-[180ms]
        ${isActive
          ? 'text-[rgba(90,130,255,0.95)]'
          : 'text-[rgba(200,210,235,0.50)] hover:text-[rgba(200,210,235,0.75)]'
        }
      `}
      title={label}
    >
      {/* Active indicator */}
      {isActive && (
        <motion.div
          layoutId="contextActiveTab"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-7 bg-[rgba(90,130,255,0.95)] rounded-r"
          transition={{ duration: 0.18 }}
        />
      )}
      {/* Active backplate */}
      {isActive && (
        <div className="absolute inset-x-2 inset-y-1 rounded-lg bg-[rgba(90,130,255,0.12)]" />
      )}
      <Icon className="w-5 h-5 relative z-10" />
      {/* Badge */}
      {badge !== undefined && badge > 0 && (
        <span className="absolute top-1.5 right-2 w-4 h-4 flex items-center justify-center text-[9px] font-bold bg-[rgba(90,130,255,0.95)] text-white rounded-full">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  );
}

function RiskCard({
  riskScores,
}: {
  riskScores: RiskScores;
}) {
  const { high, medium, low } = riskScores.summary;
  const total = high + medium + low;

  if (total === 0) return null;

  return (
    <div className="mb-4">
      <h4 className="text-[12px] font-semibold text-[rgba(200,210,235,0.75)] mb-3">
        Risk Assessment
      </h4>
      <div className="flex gap-2">
        {high > 0 && (
          <div
            className="flex-1 p-3 rounded-xl text-center"
            style={{
              background: 'rgba(255,95,95,0.10)',
              border: '1px solid rgba(255,95,95,0.20)',
            }}
          >
            <div className="text-[20px] font-bold text-[rgba(255,95,95,0.95)]">{high}</div>
            <div className="text-[10px] text-[rgba(255,95,95,0.70)]">High</div>
          </div>
        )}
        {medium > 0 && (
          <div
            className="flex-1 p-3 rounded-xl text-center"
            style={{
              background: 'rgba(255,190,90,0.10)',
              border: '1px solid rgba(255,190,90,0.20)',
            }}
          >
            <div className="text-[20px] font-bold text-[rgba(255,190,90,0.95)]">{medium}</div>
            <div className="text-[10px] text-[rgba(255,190,90,0.70)]">Medium</div>
          </div>
        )}
        {low > 0 && (
          <div
            className="flex-1 p-3 rounded-xl text-center"
            style={{
              background: 'rgba(80,210,140,0.10)',
              border: '1px solid rgba(80,210,140,0.20)',
            }}
          >
            <div className="text-[20px] font-bold text-[rgba(80,210,140,0.95)]">{low}</div>
            <div className="text-[10px] text-[rgba(80,210,140,0.70)]">Low</div>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryItem({
  text,
  riskLevel,
}: {
  text: string;
  riskLevel?: 'high' | 'medium' | 'low';
}) {
  const riskColors = {
    high: 'bg-[rgba(255,95,95,0.95)]',
    medium: 'bg-[rgba(255,190,90,0.95)]',
    low: 'bg-[rgba(80,210,140,0.95)]',
  };

  // Parse provision from text like "[Provision] Description"
  const match = text.match(/^\[([^\]]+)\]\s*(.*)/);
  const provision = match ? match[1] : null;
  const description = match ? match[2] : text;

  return (
    <div
      className="p-3 rounded-xl transition-colors duration-[180ms] hover:bg-[rgba(255,255,255,0.04)]"
      style={{
        background: 'rgba(10,14,20,0.40)',
        borderLeft: riskLevel ? `3px solid ${riskLevel === 'high' ? 'rgba(255,95,95,0.80)' : riskLevel === 'medium' ? 'rgba(255,190,90,0.80)' : 'rgba(80,210,140,0.80)'}` : undefined,
      }}
    >
      <div className="flex items-start gap-2">
        {riskLevel ? (
          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${riskColors[riskLevel]}`} />
        ) : (
          <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0 bg-[rgba(90,130,255,0.95)]" />
        )}
        <div className="flex-1 min-w-0">
          {provision && (
            <span className="text-[11px] font-semibold text-[rgba(255,190,90,0.95)] block mb-0.5">
              [{provision}]
            </span>
          )}
          <p className="text-[13px] text-[rgba(235,240,255,0.85)] leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function ContractContextPanel({
  activeTab,
  onTabChange,
  selectedItem,
  currentResult,
  reviewerNotes,
  onReviewerNotesChange,
  ccEmails,
  onCcEmailsChange,
  onSendForApproval,
  onPreviewApproval,
  isSendingApproval,
  canSendApproval,
  customContractName = '',
  onCustomContractNameChange,
  onUpdateSummary,
  onDownloadOriginal,
  onDownloadRevised,
  onCopyText,
  isGeneratingDocx,
  hasModifiedText,
}: ContractContextPanelProps) {
  const isOpen = activeTab !== null;
  const panelWidth = isOpen ? 380 : 56;

  // Summary editing state
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [editedSummary, setEditedSummary] = useState<string[]>([]);
  const [newSummaryItem, setNewSummaryItem] = useState('');

  const tabs: { id: ContextPanelTab; icon: React.ElementType; label: string; badge?: number }[] = [
    { id: 'summary', icon: FileText, label: 'Summary', badge: currentResult?.summary?.length },
    { id: 'activity', icon: Clock, label: 'Activity' },
    { id: 'documents', icon: Paperclip, label: 'Documents' },
    { id: 'actions', icon: Zap, label: 'Actions' },
  ];

  const handleTabClick = (tab: ContextPanelTab) => {
    if (activeTab === tab) {
      onTabChange(null);
    } else {
      onTabChange(tab);
    }
  };

  // Get risk level for a summary item based on provision name
  const getRiskLevel = (text: string): 'high' | 'medium' | 'low' | undefined => {
    if (!currentResult?.riskScores?.sections) return undefined;

    const match = text.match(/^\[([^\]]+)\]/);
    if (!match) return undefined;

    const provision = match[1].toLowerCase();
    const section = currentResult.riskScores.sections.find(
      s => s.sectionTitle.toLowerCase().includes(provision) ||
           provision.includes(s.sectionTitle.toLowerCase())
    );
    return section?.riskLevel;
  };

  return (
    <motion.aside
      animate={{ width: panelWidth }}
      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
      className="flex-shrink-0 h-full flex border-l border-[rgba(255,255,255,0.06)]"
      style={{
        background: elevation.L1.background,
        boxShadow: elevation.L1.shadow,
      }}
    >
      {/* Icon Rail */}
      <div
        className="w-14 flex flex-col py-4 border-r border-[rgba(255,255,255,0.06)]"
        style={{
          background: 'linear-gradient(180deg, rgba(16, 22, 34, 0.6), rgba(10, 16, 26, 0.8))',
        }}
      >
        {tabs.map((tab) => (
          <TabButton
            key={tab.id}
            id={tab.id}
            icon={tab.icon}
            label={tab.label}
            isActive={activeTab === tab.id}
            badge={tab.badge}
            onClick={() => handleTabClick(tab.id)}
          />
        ))}
      </div>

      {/* Panel Content */}
      <AnimatePresence mode="wait">
        {isOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 380 - 56, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="h-full flex flex-col overflow-hidden"
          >
            {/* Panel Header */}
            <div className="flex-shrink-0 h-14 px-5 flex items-center justify-between border-b border-[rgba(255,255,255,0.06)]">
              <h2 className="text-[14px] font-semibold text-[rgba(235,240,255,0.92)]">
                {tabs.find(t => t.id === activeTab)?.label}
              </h2>
              <button
                onClick={() => onTabChange(null)}
                className="p-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.06)] text-[rgba(200,210,235,0.50)] hover:text-[rgba(235,240,255,0.92)] transition-colors duration-[180ms]"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Panel Body */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Summary Tab */}
              {activeTab === 'summary' && (
                <div className="space-y-4">
                  {currentResult ? (
                    <>
                      {/* Risk Assessment */}
                      {currentResult.riskScores && (
                        <RiskCard riskScores={currentResult.riskScores} />
                      )}

                      {/* Changes Count with Edit Button */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[13px] text-[rgba(200,210,235,0.60)]">
                          <span className="font-semibold text-[rgba(235,240,255,0.92)]">
                            {isEditingSummary ? editedSummary.length : currentResult.summary.length}
                          </span>
                          <span>changes identified</span>
                        </div>
                        {onUpdateSummary && selectedItem?.type === 'history' && (
                          <button
                            onClick={() => {
                              if (isEditingSummary) {
                                onUpdateSummary(editedSummary);
                                setIsEditingSummary(false);
                              } else {
                                setEditedSummary([...currentResult.summary]);
                                setIsEditingSummary(true);
                              }
                            }}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors"
                            style={{
                              background: isEditingSummary ? 'rgba(80,210,140,0.20)' : 'rgba(255,255,255,0.06)',
                              color: isEditingSummary ? 'rgba(80,210,140,0.95)' : 'rgba(200,210,235,0.60)',
                            }}
                          >
                            {isEditingSummary ? (
                              <>
                                <Check className="w-3 h-3" />
                                Save
                              </>
                            ) : (
                              <>
                                <Pencil className="w-3 h-3" />
                                Edit
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {/* Summary Items - Editable or Read-only */}
                      {isEditingSummary ? (
                        <div className="space-y-2">
                          {editedSummary.map((item, idx) => (
                            <div key={idx} className="flex items-start gap-2 group">
                              <textarea
                                value={item}
                                onChange={(e) => {
                                  const newSummary = [...editedSummary];
                                  newSummary[idx] = e.target.value;
                                  setEditedSummary(newSummary);
                                }}
                                className="flex-1 px-3 py-2 text-[12px] rounded-lg bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.08)] text-[rgba(235,240,255,0.92)] focus:outline-none focus:border-[rgba(90,130,255,0.50)] resize-none"
                                rows={2}
                              />
                              <button
                                onClick={() => {
                                  setEditedSummary(editedSummary.filter((_, i) => i !== idx));
                                }}
                                className="p-1.5 rounded-lg text-[rgba(255,100,100,0.60)] hover:bg-[rgba(255,100,100,0.10)] hover:text-[rgba(255,100,100,0.90)] transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                          {/* Add new item */}
                          <div className="flex items-start gap-2 mt-3">
                            <input
                              type="text"
                              value={newSummaryItem}
                              onChange={(e) => setNewSummaryItem(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && newSummaryItem.trim()) {
                                  setEditedSummary([...editedSummary, newSummaryItem.trim()]);
                                  setNewSummaryItem('');
                                }
                              }}
                              placeholder="Add new item..."
                              className="flex-1 px-3 py-2 text-[12px] rounded-lg bg-[rgba(255,255,255,0.04)] border border-dashed border-[rgba(255,255,255,0.15)] text-[rgba(235,240,255,0.92)] placeholder-[rgba(200,210,235,0.40)] focus:outline-none focus:border-[rgba(90,130,255,0.50)]"
                            />
                            <button
                              onClick={() => {
                                if (newSummaryItem.trim()) {
                                  setEditedSummary([...editedSummary, newSummaryItem.trim()]);
                                  setNewSummaryItem('');
                                }
                              }}
                              disabled={!newSummaryItem.trim()}
                              className="p-2 rounded-lg bg-[rgba(90,130,255,0.15)] text-[rgba(90,130,255,0.90)] hover:bg-[rgba(90,130,255,0.25)] transition-colors disabled:opacity-40"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                          {/* Cancel button */}
                          <button
                            onClick={() => {
                              setIsEditingSummary(false);
                              setEditedSummary([]);
                              setNewSummaryItem('');
                            }}
                            className="w-full mt-2 py-2 text-[12px] text-[rgba(200,210,235,0.60)] hover:text-[rgba(235,240,255,0.90)] transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {currentResult.summary.map((item, idx) => (
                            <SummaryItem
                              key={idx}
                              text={item}
                              riskLevel={getRiskLevel(item)}
                            />
                          ))}
                        </div>
                      )}

                      {currentResult.summary.length === 0 && !isEditingSummary && (
                        <div className="text-center py-8">
                          <CheckCircle className="w-10 h-10 text-[rgba(80,210,140,0.60)] mx-auto mb-3" />
                          <p className="text-[13px] text-[rgba(200,210,235,0.60)]">
                            No changes detected
                          </p>
                        </div>
                      )}
                    </>
                  ) : selectedItem?.type === 'approval' ? (
                    <div className="space-y-2">
                      {(selectedItem.data as Approval).summary.map((item, idx) => (
                        <SummaryItem key={idx} text={item} />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <FileText className="w-10 h-10 text-[rgba(200,210,235,0.30)] mx-auto mb-3" />
                      <p className="text-[13px] text-[rgba(200,210,235,0.50)]">
                        No summary available
                      </p>
                      <p className="text-[11px] text-[rgba(200,210,235,0.40)] mt-1">
                        Run an analysis to see changes
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Activity Tab */}
              {activeTab === 'activity' && (
                <div className="space-y-4">
                  {selectedItem?.type === 'approval' ? (
                    <>
                      <div className="flex gap-3 relative">
                        <div className="absolute left-[11px] top-6 bottom-0 w-[2px] bg-gradient-to-b from-[rgba(90,130,255,0.40)] via-[rgba(255,255,255,0.06)] to-transparent" />

                        {/* Submitted Event */}
                        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 z-10 bg-[rgba(90,130,255,0.15)] border border-[rgba(90,130,255,0.30)]">
                          <Send className="w-3 h-3 text-[rgba(90,130,255,0.95)]" />
                        </div>
                        <div className="flex-1 pb-4">
                          <p className="text-[13px] font-medium text-[rgba(235,240,255,0.92)]">
                            Submitted for approval
                          </p>
                          <p className="text-[11px] text-[rgba(200,210,235,0.50)] mt-0.5">
                            {(selectedItem.data as Approval).submittedBy} · {formatRelativeTime((selectedItem.data as Approval).submittedAt)}
                          </p>
                        </div>
                      </div>

                      {(selectedItem.data as Approval).approvalStatus !== 'pending' && (
                        <div className="flex gap-3">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                              (selectedItem.data as Approval).approvalStatus === 'approved'
                                ? 'bg-[rgba(80,210,140,0.15)] border border-[rgba(80,210,140,0.30)]'
                                : 'bg-[rgba(255,95,95,0.15)] border border-[rgba(255,95,95,0.30)]'
                            }`}
                          >
                            {(selectedItem.data as Approval).approvalStatus === 'approved' ? (
                              <CheckCircle className="w-3 h-3 text-[rgba(80,210,140,0.95)]" />
                            ) : (
                              <XCircle className="w-3 h-3 text-[rgba(255,95,95,0.95)]" />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="text-[13px] font-medium text-[rgba(235,240,255,0.92)]">
                              {(selectedItem.data as Approval).approvalStatus === 'approved' ? 'Approved' : 'Rejected'}
                            </p>
                            <p className="text-[11px] text-[rgba(200,210,235,0.50)] mt-0.5">
                              {(selectedItem.data as Approval).approver} · {(selectedItem.data as Approval).approvedAt ? formatRelativeTime((selectedItem.data as Approval).approvedAt!) : ''}
                            </p>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <Clock className="w-10 h-10 text-[rgba(200,210,235,0.30)] mx-auto mb-3" />
                      <p className="text-[13px] text-[rgba(200,210,235,0.50)]">
                        No activity yet
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Documents Tab */}
              {activeTab === 'documents' && (
                <div className="space-y-6">
                  {/* Related Documents Section */}
                  <div>
                    <h4 className="text-[12px] font-semibold text-[rgba(200,210,235,0.75)] mb-3">
                      Related Documents
                    </h4>
                    <div
                      className="p-4 rounded-xl text-center"
                      style={{
                        background: 'rgba(10,14,20,0.40)',
                        border: '1px dashed rgba(255,255,255,0.10)',
                      }}
                    >
                      <Paperclip className="w-8 h-8 text-[rgba(200,210,235,0.30)] mx-auto mb-2" />
                      <p className="text-[12px] text-[rgba(200,210,235,0.50)]">
                        No documents attached
                      </p>
                      <p className="text-[10px] text-[rgba(200,210,235,0.40)] mt-1">
                        Upload documents in the contract review
                      </p>
                    </div>
                  </div>

                  {/* Generated Documents Section */}
                  {hasModifiedText && (
                    <div>
                      <h4 className="text-[12px] font-semibold text-[rgba(200,210,235,0.75)] mb-3">
                        Generated Documents
                      </h4>
                      <div className="space-y-2">
                        <button
                          onClick={onDownloadRevised}
                          disabled={isGeneratingDocx}
                          className="w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-[180ms] hover:bg-[rgba(255,255,255,0.04)]"
                          style={{
                            background: 'rgba(80,210,140,0.08)',
                            border: '1px solid rgba(80,210,140,0.20)',
                          }}
                        >
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center"
                            style={{ background: 'rgba(80,210,140,0.15)' }}
                          >
                            <Download className="w-4 h-4 text-[rgba(80,210,140,0.95)]" />
                          </div>
                          <div className="flex-1 text-left">
                            <p className="text-[13px] font-medium text-[rgba(235,240,255,0.92)]">
                              Revised Document
                            </p>
                            <p className="text-[11px] text-[rgba(200,210,235,0.50)]">
                              DOCX with suggested changes
                            </p>
                          </div>
                        </button>

                        <button
                          onClick={onDownloadOriginal}
                          disabled={isGeneratingDocx}
                          className="w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-[180ms] hover:bg-[rgba(255,255,255,0.04)]"
                          style={{
                            background: 'rgba(255,190,90,0.08)',
                            border: '1px solid rgba(255,190,90,0.20)',
                          }}
                        >
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center"
                            style={{ background: 'rgba(255,190,90,0.15)' }}
                          >
                            <Download className="w-4 h-4 text-[rgba(255,190,90,0.95)]" />
                          </div>
                          <div className="flex-1 text-left">
                            <p className="text-[13px] font-medium text-[rgba(235,240,255,0.92)]">
                              Original Document
                            </p>
                            <p className="text-[11px] text-[rgba(200,210,235,0.50)]">
                              Plain DOCX for comparison
                            </p>
                          </div>
                        </button>

                        <button
                          onClick={onCopyText}
                          className="w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-[180ms] hover:bg-[rgba(255,255,255,0.04)]"
                          style={{
                            background: 'rgba(90,130,255,0.08)',
                            border: '1px solid rgba(90,130,255,0.20)',
                          }}
                        >
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center"
                            style={{ background: 'rgba(90,130,255,0.15)' }}
                          >
                            <Copy className="w-4 h-4 text-[rgba(90,130,255,0.95)]" />
                          </div>
                          <div className="flex-1 text-left">
                            <p className="text-[13px] font-medium text-[rgba(235,240,255,0.92)]">
                              Copy Redlined Text
                            </p>
                            <p className="text-[11px] text-[rgba(200,210,235,0.50)]">
                              Copy to clipboard
                            </p>
                          </div>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Empty state when no documents at all */}
                  {!hasModifiedText && (
                    <p className="text-[11px] text-[rgba(200,210,235,0.40)] text-center">
                      Complete an analysis to generate documents
                    </p>
                  )}
                </div>
              )}

              {/* Actions Tab */}
              {activeTab === 'actions' && (
                <div className="space-y-6">
                  {/* Send for Approval Section - Only show for new reviews, not for items already sent */}
                  {currentResult && selectedItem?.type !== 'approval' && (
                    <>
                      {/* Contract Name - Always editable */}
                      {onCustomContractNameChange && (
                        <div>
                          <label className="flex items-center gap-2 text-[rgba(80,210,140,0.95)] text-[12px] font-semibold mb-2">
                            <FileText className="w-4 h-4" />
                            Contract Name
                          </label>
                          <input
                            type="text"
                            value={customContractName}
                            onChange={(e) => onCustomContractNameChange(e.target.value)}
                            placeholder="Enter contract name..."
                            className="w-full px-3 py-2.5 text-[13px] rounded-xl bg-[rgba(10,14,20,0.60)] border border-[rgba(255,255,255,0.08)] text-[rgba(235,240,255,0.92)] placeholder-[rgba(200,210,235,0.40)] focus:outline-none focus:border-[rgba(80,210,140,0.50)] transition-colors duration-[180ms]"
                          />
                          <p className="text-[10px] text-[rgba(200,210,235,0.40)] mt-1">
                            Edit the contract name for this review
                          </p>
                        </div>
                      )}

                      <div>
                        <label className="flex items-center gap-2 text-[rgba(90,130,255,0.95)] text-[12px] font-semibold mb-2">
                          <MessageCircle className="w-4 h-4" />
                          Reviewer Notes
                        </label>
                        <textarea
                          value={reviewerNotes}
                          onChange={(e) => onReviewerNotesChange(e.target.value)}
                          placeholder="Add notes for the approver..."
                          className="w-full h-24 px-3 py-2 text-[13px] rounded-xl bg-[rgba(10,14,20,0.60)] border border-[rgba(255,255,255,0.08)] text-[rgba(235,240,255,0.92)] placeholder-[rgba(200,210,235,0.40)] focus:outline-none focus:border-[rgba(90,130,255,0.50)] transition-colors duration-[180ms] resize-none"
                        />
                        <p className="text-[10px] text-[rgba(200,210,235,0.40)] mt-1">
                          Visible to the approver in the Summary section
                        </p>
                      </div>

                      <div>
                        <label className="flex items-center gap-2 text-[rgba(139,92,246,0.95)] text-[12px] font-semibold mb-2">
                          <Send className="w-4 h-4" />
                          CC Others (Optional)
                        </label>
                        <input
                          type="text"
                          value={ccEmails}
                          onChange={(e) => onCcEmailsChange(e.target.value)}
                          placeholder="email1@example.com, email2@example.com"
                          className="w-full px-3 py-2.5 text-[13px] rounded-xl bg-[rgba(10,14,20,0.60)] border border-[rgba(255,255,255,0.08)] text-[rgba(235,240,255,0.92)] placeholder-[rgba(200,210,235,0.40)] focus:outline-none focus:border-[rgba(139,92,246,0.50)] transition-colors duration-[180ms]"
                        />
                        <p className="text-[10px] text-[rgba(200,210,235,0.40)] mt-1">
                          CC'd parties receive notification but cannot approve/reject
                        </p>
                      </div>

                      {/* Preview and Send buttons */}
                      <div className="flex gap-2">
                        {/* Preview Button */}
                        {onPreviewApproval && (
                          <button
                            onClick={onPreviewApproval}
                            disabled={isSendingApproval || !canSendApproval}
                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-[13px] transition-all duration-[180ms] disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{
                              background: 'linear-gradient(180deg, rgba(90,130,255,0.25), rgba(90,130,255,0.12))',
                              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
                              color: 'rgba(235,240,255,0.90)',
                              border: '1px solid rgba(90,130,255,0.30)',
                            }}
                          >
                            <ExternalLink className="w-4 h-4" />
                            Preview
                          </button>
                        )}

                        {/* Send for Approval Button */}
                        <button
                          onClick={onSendForApproval}
                          disabled={isSendingApproval || !canSendApproval}
                          className={`${onPreviewApproval ? 'flex-1' : 'w-full'} flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-[13px] transition-all duration-[180ms] disabled:opacity-50 disabled:cursor-not-allowed`}
                          style={{
                            background: 'linear-gradient(180deg, rgba(80,210,140,0.35), rgba(80,210,140,0.20))',
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 4px 20px rgba(80,210,140,0.25)',
                            color: 'rgba(235,240,255,0.98)',
                          }}
                        >
                          {isSendingApproval ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              Sending...
                            </>
                          ) : (
                            <>
                              <Send className="w-4 h-4" />
                              Send
                            </>
                          )}
                        </button>
                      </div>

                      {!canSendApproval && (
                        <div
                          className="flex items-start gap-2 p-3 rounded-xl"
                          style={{
                            background: 'rgba(255,190,90,0.08)',
                            border: '1px solid rgba(255,190,90,0.20)',
                          }}
                        >
                          <AlertTriangle className="w-4 h-4 text-[rgba(255,190,90,0.95)] flex-shrink-0 mt-0.5" />
                          <p className="text-[12px] text-[rgba(255,190,90,0.95)]">
                            Enter a contract name and provision name to enable approval workflow
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {/* Approval Actions for Approval Items */}
                  {selectedItem?.type === 'approval' && (selectedItem.data as Approval).approvalStatus === 'pending' && (
                    <>
                      {(selectedItem.data as Approval).approvalToken && (
                        <a
                          href={`/contracts/review/approve/${(selectedItem.data as Approval).approvalToken}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-[13px] transition-all duration-[180ms]"
                          style={{
                            background: 'linear-gradient(180deg, rgba(90,130,255,0.35), rgba(90,130,255,0.20))',
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 4px 20px rgba(90,130,255,0.25)',
                            color: 'rgba(235,240,255,0.98)',
                          }}
                        >
                          <ExternalLink className="w-4 h-4" />
                          Open Approval Page
                        </a>
                      )}

                      <button
                        onClick={() => {
                          const token = (selectedItem.data as Approval).approvalToken;
                          if (token) {
                            const link = `${window.location.origin}/contracts/review/approve/${token}`;
                            navigator.clipboard.writeText(link);
                            alert('Approval link copied to clipboard!');
                          }
                        }}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-[13px] transition-all duration-[180ms]"
                        style={{
                          background: 'rgba(139,92,246,0.12)',
                          border: '1px solid rgba(139,92,246,0.25)',
                          color: 'rgba(139,92,246,0.95)',
                        }}
                      >
                        <Copy className="w-4 h-4" />
                        Copy Approval Link
                      </button>
                    </>
                  )}

                  {/* Empty State */}
                  {!currentResult && selectedItem?.type !== 'approval' && (
                    <div className="text-center py-8">
                      <Zap className="w-10 h-10 text-[rgba(200,210,235,0.30)] mx-auto mb-3" />
                      <p className="text-[13px] text-[rgba(200,210,235,0.50)]">
                        No actions available
                      </p>
                      <p className="text-[11px] text-[rgba(200,210,235,0.40)] mt-1">
                        Complete an analysis to see actions
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  );
}

// Helper function
function formatRelativeTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
