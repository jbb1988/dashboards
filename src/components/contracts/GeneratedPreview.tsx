'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

interface RiskFactor {
  factor: string;
  impact: number;
  description: string;
}

interface GeneratedContract {
  id: string;
  content: string;
  risk_score: number;
  risk_factors: RiskFactor[];
  approval_status: 'pending' | 'approved' | 'rejected' | 'auto_approved';
  approval_required: boolean;
  approvers: string[];
}

interface GeneratedPreviewProps {
  generation: GeneratedContract;
  templateName: string;
  onEdit: () => void;
  onSubmitForApproval: () => Promise<void>;
  onDownload: () => void;
  onStartOver: () => void;
}

export default function GeneratedPreview({
  generation,
  templateName,
  onEdit,
  onSubmitForApproval,
  onDownload,
  onStartOver,
}: GeneratedPreviewProps) {
  const [submitting, setSubmitting] = useState(false);
  const [showRiskDetails, setShowRiskDetails] = useState(false);

  const riskLevel = generation.risk_score < 40 ? 'low' : generation.risk_score < 70 ? 'medium' : 'high';
  const riskColors = {
    low: { bg: 'bg-green-500/10', text: 'text-green-400', bar: 'bg-green-500', border: 'border-green-500/20' },
    medium: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', bar: 'bg-yellow-500', border: 'border-yellow-500/20' },
    high: { bg: 'bg-red-500/10', text: 'text-red-400', bar: 'bg-red-500', border: 'border-red-500/20' },
  };
  const colors = riskColors[riskLevel];

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await onSubmitForApproval();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#151F2E] border border-white/10 rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">{templateName}</h2>
            <p className="text-sm text-[#8FA3BF] mt-1">
              {generation.approval_status === 'auto_approved'
                ? 'Contract generated and auto-approved'
                : 'Review the generated contract before submission'}
            </p>
          </div>
          <div className={`px-3 py-1.5 rounded-full ${colors.bg} ${colors.text} border ${colors.border} text-sm font-medium`}>
            {generation.approval_status === 'auto_approved' ? 'Auto-Approved' : `Risk: ${Math.round(generation.risk_score)}%`}
          </div>
        </div>

        {/* Risk Bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-[#8FA3BF] mb-1">
            <span>Risk Assessment</span>
            <span>{Math.round(generation.risk_score)}%</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${generation.risk_score}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className={`h-full ${colors.bar}`}
            />
          </div>
        </div>

        {/* Risk Factors Toggle */}
        {generation.risk_factors.length > 0 && (
          <button
            onClick={() => setShowRiskDetails(!showRiskDetails)}
            className="mt-3 text-xs text-[#8FA3BF] hover:text-white transition-colors flex items-center gap-1"
          >
            {showRiskDetails ? 'Hide' : 'Show'} risk factors ({generation.risk_factors.length})
            <svg
              className={`w-4 h-4 transition-transform ${showRiskDetails ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}

        {/* Risk Factors Details */}
        {showRiskDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="mt-3 space-y-2"
          >
            {generation.risk_factors.map((factor, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-3 bg-[#0B1220] rounded-lg"
              >
                <div className={`w-8 h-8 rounded-lg ${colors.bg} flex items-center justify-center flex-shrink-0`}>
                  <span className={`text-sm font-bold ${colors.text}`}>+{factor.impact}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{factor.factor}</p>
                  <p className="text-xs text-[#8FA3BF]">{factor.description}</p>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {/* Approval Info */}
        {generation.approval_required && generation.approvers.length > 0 && (
          <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm text-blue-400 font-medium">Approval Required</p>
                <p className="text-xs text-[#8FA3BF] mt-1">
                  This contract will be sent to: {generation.approvers.join(', ')}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Contract Preview */}
      <div className="bg-[#151F2E] border border-white/10 rounded-xl overflow-hidden">
        <div className="px-6 py-3 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Contract Preview</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              className="px-3 py-1.5 text-xs bg-white/5 text-[#8FA3BF] rounded-lg hover:bg-white/10 hover:text-white transition-colors flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </button>
            <button
              onClick={onDownload}
              className="px-3 py-1.5 text-xs bg-white/5 text-[#8FA3BF] rounded-lg hover:bg-white/10 hover:text-white transition-colors flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </button>
          </div>
        </div>
        <div className="p-6 max-h-[500px] overflow-y-auto">
          <div className="prose prose-invert prose-sm max-w-none">
            <pre className="whitespace-pre-wrap font-sans text-sm text-white/90 leading-relaxed">
              {generation.content}
            </pre>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <button
          onClick={onStartOver}
          className="px-4 py-2 text-sm text-[#8FA3BF] hover:text-white transition-colors"
        >
          Start Over
        </button>

        <div className="flex gap-3">
          {generation.approval_status === 'auto_approved' ? (
            <button
              onClick={onDownload}
              className="px-6 py-2.5 text-sm font-medium bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Download Approved Contract
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-6 py-2.5 text-sm font-medium bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Submit for Approval
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
