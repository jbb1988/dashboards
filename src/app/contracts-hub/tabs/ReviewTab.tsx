'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { createBrowserClient } from '@supabase/ssr';
import DOMPurify from 'dompurify';
import { tokens } from '@/components/mars-ui';
import ApprovalsQueue from '@/components/contracts/ApprovalsQueue';

interface ReviewHistory {
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

export default function ReviewTab() {
  const [activeSubTab, setActiveSubTab] = useState<'upload' | 'history' | 'approvals'>('upload');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [originalText, setOriginalText] = useState('');
  const [reviewResult, setReviewResult] = useState<{
    redlinedText: string;
    summary: string[];
  } | null>(null);
  const [reviewHistory, setReviewHistory] = useState<ReviewHistory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    if (activeSubTab === 'history') {
      loadReviewHistory();
    }
  }, [activeSubTab]);

  const loadReviewHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('contract_reviews')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setReviewHistory(data?.map(r => ({
        id: r.id,
        contractId: r.contract_id,
        contractName: r.contract_name,
        provisionName: r.provision_name,
        createdAt: r.created_at,
        status: r.status,
        originalText: r.original_text,
        redlinedText: r.redlined_text,
        modifiedText: r.modified_text,
        summary: r.summary,
      })) || []);
    } catch (err) {
      console.error('Failed to load review history:', err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const text = await file.text();
      setOriginalText(text);

      const response = await fetch('/api/contracts/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, contractName: file.name }),
      });

      if (!response.ok) throw new Error('Review failed');

      const result = await response.json();
      setReviewResult({
        redlinedText: result.redlinedText,
        summary: result.summary || [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze contract');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setOriginalText(text);
      }
    } catch (err) {
      setError('Failed to read from clipboard');
    }
  };

  const analyzeText = async () => {
    if (!originalText.trim()) {
      setError('Please enter or paste contract text');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await fetch('/api/contracts/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: originalText, contractName: 'Pasted Contract' }),
      });

      if (!response.ok) throw new Error('Review failed');

      const result = await response.json();
      setReviewResult({
        redlinedText: result.redlinedText,
        summary: result.summary || [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze contract');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex gap-2">
        {[
          { id: 'upload', label: 'New Review' },
          { id: 'history', label: 'History' },
          { id: 'approvals', label: 'Approvals' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as typeof activeSubTab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeSubTab === tab.id
                ? 'bg-[#1E3A5F] text-white'
                : 'bg-[#1E293B] text-[#64748B] hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Upload / Analyze Tab */}
      {activeSubTab === 'upload' && (
        <div className="grid grid-cols-2 gap-6">
          {/* Input Panel */}
          <div className={`rounded-xl ${tokens.bg.card} border ${tokens.border.subtle} p-6`}>
            <h3 className="text-lg font-semibold text-white mb-4">Contract Input</h3>

            {/* File Upload */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".txt,.doc,.docx,.pdf"
              className="hidden"
            />

            <div className="space-y-4">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-8 border-2 border-dashed border-[#2A3544] rounded-xl hover:border-[#38BDF8] transition-colors text-center"
              >
                <svg className="w-8 h-8 mx-auto mb-2 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-[#64748B] text-sm">Drop a file or click to upload</p>
              </button>

              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-[#2A3544]" />
                <span className="text-[#64748B] text-xs">OR</span>
                <div className="flex-1 h-px bg-[#2A3544]" />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handlePaste}
                  className="flex-1 px-4 py-2 bg-[#1E293B] text-[#64748B] rounded-lg hover:text-white transition-colors text-sm"
                >
                  Paste from Clipboard
                </button>
              </div>

              <textarea
                value={originalText}
                onChange={(e) => setOriginalText(e.target.value)}
                placeholder="Or paste contract text here..."
                className="w-full h-48 px-4 py-3 bg-[#0F172A] border border-[#2A3544] rounded-xl text-white text-sm resize-none focus:outline-none focus:border-[#38BDF8]"
              />

              {error && (
                <p className="text-red-400 text-sm">{error}</p>
              )}

              <button
                onClick={analyzeText}
                disabled={isAnalyzing || !originalText.trim()}
                className="w-full px-4 py-3 bg-[#38BDF8] text-white rounded-xl font-medium hover:bg-[#38BDF8]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isAnalyzing ? 'Analyzing...' : 'Analyze with AI'}
              </button>
            </div>
          </div>

          {/* Results Panel */}
          <div className={`rounded-xl ${tokens.bg.card} border ${tokens.border.subtle} p-6`}>
            <h3 className="text-lg font-semibold text-white mb-4">AI Review</h3>

            {isAnalyzing ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-[#38BDF8] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-[#64748B] text-sm">Analyzing contract...</p>
                </div>
              </div>
            ) : reviewResult ? (
              <div className="space-y-4">
                {/* Summary */}
                {reviewResult.summary.length > 0 && (
                  <div className="p-4 bg-[#0F172A] rounded-lg">
                    <h4 className="text-sm font-medium text-[#64748B] mb-2">Key Changes</h4>
                    <ul className="space-y-1">
                      {reviewResult.summary.map((item, idx) => (
                        <li key={idx} className="text-sm text-[#EAF2FF] flex items-start gap-2">
                          <span className="text-[#38BDF8]">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Redlined Text */}
                <div className="p-4 bg-[#0F172A] rounded-lg max-h-96 overflow-y-auto">
                  <h4 className="text-sm font-medium text-[#64748B] mb-2">Redlined Document</h4>
                  <div
                    className="text-sm text-[#EAF2FF] prose prose-invert prose-sm max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(reviewResult.redlinedText),
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-[#64748B] text-sm">
                Upload or paste a contract to begin AI review
              </div>
            )}
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeSubTab === 'history' && (
        <div className={`rounded-xl ${tokens.bg.card} border ${tokens.border.subtle} overflow-hidden`}>
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase">Contract</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase">Provision</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase">Status</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase">Date</th>
              </tr>
            </thead>
            <tbody>
              {reviewHistory.map((review) => (
                <tr key={review.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-[#EAF2FF] text-sm">{review.contractName}</td>
                  <td className="px-4 py-3 text-[#64748B] text-sm">{review.provisionName}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs ${
                      review.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                      review.status === 'sent_to_client' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {review.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#64748B] text-sm">
                    {new Date(review.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {reviewHistory.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-[#64748B] text-sm">
                    No review history yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Approvals Tab */}
      {activeSubTab === 'approvals' && <ApprovalsQueue />}
    </div>
  );
}
