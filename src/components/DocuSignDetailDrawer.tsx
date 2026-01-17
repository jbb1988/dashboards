'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

interface DocuSignEnvelope {
  envelopeId: string;
  status: string;
  emailSubject: string;
  sentDateTime?: string;
  completedDateTime?: string;
  declinedDateTime?: string;
  statusChangedDateTime?: string;
  sender?: { userName: string; email: string };
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed': case 'signed': return '#22C55E';
    case 'sent': case 'delivered': return '#F59E0B';
    case 'created': return '#8B5CF6';
    case 'declined': case 'voided': return '#EF4444';
    default: return '#64748B';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'completed': return 'Signed';
    case 'sent': return 'Awaiting Signature';
    case 'delivered': return 'Opened by Recipient';
    case 'created': return 'Draft';
    case 'declined': return 'Declined';
    case 'voided': return 'Voided';
    default: return status;
  }
};

interface DocuSignDetailDrawerProps {
  envelope: DocuSignEnvelope;
  onClose: () => void;
}

export default function DocuSignDetailDrawer({
  envelope,
  onClose,
}: DocuSignDetailDrawerProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(true);

  const statusColor = getStatusColor(envelope.status);
  const statusLabel = getStatusLabel(envelope.status);
  const isCompleted = ['completed', 'signed'].includes(envelope.status);
  const isPending = ['sent', 'delivered'].includes(envelope.status);

  // Calculate days since sent
  const daysSinceSent = envelope.sentDateTime
    ? Math.floor((Date.now() - new Date(envelope.sentDateTime).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  // Calculate time to sign
  const daysToSign = envelope.sentDateTime && envelope.completedDateTime
    ? Math.floor((new Date(envelope.completedDateTime).getTime() - new Date(envelope.sentDateTime).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const handleViewInDocuSign = async () => {
    try {
      setIsPreviewing(true);
      setPreviewError(null);
      const res = await fetch(`/api/docusign?action=viewUrl&envelopeId=${envelope.envelopeId}`);
      const data = await res.json();
      if (data.viewUrl) {
        window.open(data.viewUrl, '_blank');
      } else if (data.error) {
        setPreviewError(data.error);
      }
    } catch (error) {
      setPreviewError('Failed to open DocuSign');
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      window.open(`/api/docusign?action=download&envelopeId=${envelope.envelopeId}`, '_blank');
    } finally {
      setTimeout(() => setIsDownloading(false), 1000);
    }
  };

  const handleSendReminder = async () => {
    // Could implement reminder functionality here
    alert('Reminder functionality coming soon');
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 z-50"
      />

      {/* Drawer */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 bottom-0 w-full max-w-5xl bg-[#151F2E] border-l border-white/[0.06] shadow-2xl z-50 flex flex-col"
      >
        {/* Header */}
        <div className="sticky top-0 bg-[#0F1722] border-b border-white/[0.06] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#FFD700]/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-[#FFD700]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-[16px] font-semibold text-white">Document Details</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 text-[#8FA3BF] hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content - Two Column Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column - Details */}
          <div className="w-96 border-r border-white/[0.06] overflow-y-auto p-6 space-y-6">
          {/* Title & Status */}
          <div>
            <h3 className="text-[18px] font-semibold text-white mb-3">{envelope.emailSubject}</h3>
            <div className="flex flex-wrap gap-2">
              <span
                className="text-[11px] px-3 py-1.5 rounded-full font-medium"
                style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
              >
                {statusLabel}
              </span>
              {isPending && daysSinceSent !== null && daysSinceSent > 3 && (
                <span className="text-[11px] px-3 py-1.5 rounded-full font-medium bg-[#F59E0B]/20 text-[#F59E0B]">
                  Awaiting {daysSinceSent} days
                </span>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-[#0F1722] rounded-xl p-4 space-y-4">
            <h4 className="text-[12px] font-medium text-[#64748B] uppercase tracking-wider">Timeline</h4>

            {/* Sent */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-[#38BDF8]/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-[#38BDF8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-[13px] text-white font-medium">Sent</div>
                <div className="text-[11px] text-[#8FA3BF]">
                  {formatDate(envelope.sentDateTime)} {formatTime(envelope.sentDateTime)}
                </div>
                {envelope.sender && (
                  <div className="text-[11px] text-[#64748B]">by {envelope.sender.userName}</div>
                )}
              </div>
            </div>

            {/* Delivered/Opened */}
            {['delivered', 'completed', 'signed'].includes(envelope.status) && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-[#8B5CF6]/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-[#8B5CF6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="text-[13px] text-white font-medium">Opened</div>
                  <div className="text-[11px] text-[#8FA3BF]">Document viewed by recipient</div>
                </div>
              </div>
            )}

            {/* Completed */}
            {isCompleted && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-[#22C55E]/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="text-[13px] text-white font-medium">Signed</div>
                  <div className="text-[11px] text-[#8FA3BF]">
                    {formatDate(envelope.completedDateTime)} {formatTime(envelope.completedDateTime)}
                  </div>
                  {daysToSign !== null && (
                    <div className="text-[11px] text-[#64748B]">
                      Completed in {daysToSign === 0 ? 'same day' : `${daysToSign} day${daysToSign === 1 ? '' : 's'}`}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Declined */}
            {envelope.status === 'declined' && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-[#EF4444]/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-[#EF4444]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="text-[13px] text-white font-medium">Declined</div>
                  <div className="text-[11px] text-[#8FA3BF]">
                    {formatDate(envelope.declinedDateTime)} {formatTime(envelope.declinedDateTime)}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Details */}
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-white/[0.06]">
              <span className="text-[12px] text-[#64748B]">Envelope ID</span>
              <span className="text-[11px] text-[#8FA3BF] font-mono">{envelope.envelopeId.slice(0, 8)}...</span>
            </div>
            {envelope.sender && (
              <>
                <div className="flex items-center justify-between py-3 border-b border-white/[0.06]">
                  <span className="text-[12px] text-[#64748B]">Sent By</span>
                  <span className="text-[13px] text-white">{envelope.sender.userName}</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-white/[0.06]">
                  <span className="text-[12px] text-[#64748B]">Sender Email</span>
                  <span className="text-[13px] text-[#8FA3BF]">{envelope.sender.email}</span>
                </div>
              </>
            )}
          </div>

          {/* Preview Error */}
          {previewError && (
            <div className="bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-xl p-4 text-[13px] text-[#EF4444]">
              {previewError}
            </div>
          )}

          {/* Actions */}
          <div className="pt-4 border-t border-white/[0.06] space-y-3">
            {/* View in DocuSign */}
            <button
              onClick={handleViewInDocuSign}
              disabled={isPreviewing}
              className="w-full py-3 px-4 rounded-xl font-medium text-[14px] flex items-center justify-center gap-2 transition-all bg-[#38BDF8] text-white hover:bg-[#38BDF8]/90 disabled:opacity-50"
            >
              {isPreviewing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Opening...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  View in DocuSign
                </>
              )}
            </button>

            {/* Download PDF - only for completed documents */}
            {isCompleted && (
              <button
                onClick={handleDownload}
                disabled={isDownloading}
                className="w-full py-3 px-4 rounded-xl font-medium text-[14px] flex items-center justify-center gap-2 transition-all bg-[#22C55E] text-white hover:bg-[#22C55E]/90 disabled:opacity-50"
              >
                {isDownloading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download Signed PDF
                  </>
                )}
              </button>
            )}

            {/* Send Reminder - only for pending documents */}
            {isPending && (
              <button
                onClick={handleSendReminder}
                className="w-full py-3 px-4 rounded-xl font-medium text-[14px] flex items-center justify-center gap-2 transition-all bg-[#F59E0B]/20 text-[#F59E0B] hover:bg-[#F59E0B]/30 border border-[#F59E0B]/30"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                Send Reminder
              </button>
            )}
          </div>
          </div>

          {/* Right Column - Document Preview */}
          <div className="flex-1 flex flex-col bg-[#0F1722]">
            {/* Preview Header */}
            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-[#8FA3BF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <h4 className="text-[14px] font-medium text-white">Document Preview</h4>
              </div>
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="p-1.5 rounded-lg hover:bg-white/5 text-[#8FA3BF] hover:text-white transition-colors"
              >
                {showPreview ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>

            {/* Preview Area */}
            <div className="flex-1 overflow-hidden relative">
              {showPreview ? (
                <>
                  {previewLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#0F1722]">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-2 border-[#FFD700] border-t-transparent rounded-full animate-spin" />
                        <span className="text-[#64748B] text-sm">Loading document preview...</span>
                      </div>
                    </div>
                  )}
                  {previewError ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-center px-6">
                        <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-[#0B1220] flex items-center justify-center">
                          <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <p className="text-[#8FA3BF] text-sm mb-1">Preview failed to load</p>
                        <p className="text-[#64748B] text-xs max-w-xs mx-auto">{previewError}</p>
                      </div>
                    </div>
                  ) : (
                    <iframe
                      src={`/api/docusign?action=preview&envelopeId=${envelope.envelopeId}`}
                      className="w-full h-full border-0"
                      onLoad={() => setPreviewLoading(false)}
                      onError={() => {
                        setPreviewLoading(false);
                        setPreviewError('Failed to load document preview. The document may not be available yet.');
                      }}
                      title={envelope.emailSubject}
                    />
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center px-6">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-[#0B1220] flex items-center justify-center">
                      <svg className="w-10 h-10 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    </div>
                    <p className="text-[#8FA3BF] text-sm mb-1">Preview hidden</p>
                    <p className="text-[#64748B] text-xs max-w-xs mx-auto">Click the eye icon to show the document preview</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}
