'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Signer {
  email: string;
  name: string;
  order: number;
}

interface CarbonCopy {
  email: string;
  name: string;
}

interface ESignModalProps {
  contractName: string;
  contractReviewId?: string;
  documentContent: string; // Base64 encoded document
  documentName?: string;
  onSend: (data: {
    signers: Signer[];
    carbonCopies: CarbonCopy[];
    emailSubject: string;
    emailBody: string;
  }) => Promise<void>;
  onClose: () => void;
}

export default function ESignModal({
  contractName,
  contractReviewId,
  documentContent,
  documentName,
  onSend,
  onClose,
}: ESignModalProps) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'signers' | 'options'>('signers');

  const [signers, setSigners] = useState<Signer[]>([
    { email: '', name: '', order: 1 },
  ]);
  const [carbonCopies, setCarbonCopies] = useState<CarbonCopy[]>([]);
  const [emailSubject, setEmailSubject] = useState(`Please sign: ${contractName}`);
  const [emailBody, setEmailBody] = useState(
    'Please review and sign the attached document at your earliest convenience.'
  );

  function addSigner() {
    setSigners(prev => [
      ...prev,
      { email: '', name: '', order: prev.length + 1 },
    ]);
  }

  function removeSigner(index: number) {
    if (signers.length > 1) {
      setSigners(prev => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i + 1 })));
    }
  }

  function updateSigner(index: number, field: keyof Signer, value: string | number) {
    setSigners(prev =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  }

  function addCarbonCopy() {
    setCarbonCopies(prev => [...prev, { email: '', name: '' }]);
  }

  function removeCarbonCopy(index: number) {
    setCarbonCopies(prev => prev.filter((_, i) => i !== index));
  }

  function updateCarbonCopy(index: number, field: keyof CarbonCopy, value: string) {
    setCarbonCopies(prev =>
      prev.map((cc, i) => (i === index ? { ...cc, [field]: value } : cc))
    );
  }

  function validateSigners(): boolean {
    for (const signer of signers) {
      if (!signer.email.trim() || !signer.name.trim()) {
        setError('All signers must have an email and name');
        return false;
      }
      // Basic email validation
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signer.email)) {
        setError(`Invalid email: ${signer.email}`);
        return false;
      }
    }
    return true;
  }

  async function handleSend() {
    if (!validateSigners()) return;

    setSending(true);
    setError(null);

    try {
      await onSend({
        signers: signers.filter(s => s.email && s.name),
        carbonCopies: carbonCopies.filter(cc => cc.email && cc.name),
        emailSubject,
        emailBody,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send for signature');
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[#151F2E] border border-white/10 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Send for Signature</h3>
              <p className="text-xs text-[#8FA3BF]">{contractName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={sending}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-[#8FA3BF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
              <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-red-400">{error}</span>
            </div>
          )}

          {/* Step Indicator */}
          <div className="flex items-center gap-2 mb-6">
            <button
              onClick={() => setStep('signers')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                step === 'signers' ? 'bg-purple-500 text-white' : 'bg-white/5 text-[#8FA3BF]'
              }`}
            >
              1. Signers
            </button>
            <button
              onClick={() => setStep('options')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                step === 'options' ? 'bg-purple-500 text-white' : 'bg-white/5 text-[#8FA3BF]'
              }`}
            >
              2. Email Options
            </button>
          </div>

          <AnimatePresence mode="wait">
            {step === 'signers' ? (
              <motion.div
                key="signers"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                {/* Signers */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-white">Signers</h4>
                    <button
                      onClick={addSigner}
                      className="text-xs text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Signer
                    </button>
                  </div>

                  <div className="space-y-3">
                    {signers.map((signer, index) => (
                      <div key={index} className="flex items-start gap-3 p-3 bg-[#0B1220] rounded-lg">
                        <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 text-sm font-bold flex-shrink-0">
                          {signer.order}
                        </div>
                        <div className="flex-1 grid grid-cols-2 gap-3">
                          <input
                            type="text"
                            value={signer.name}
                            onChange={(e) => updateSigner(index, 'name', e.target.value)}
                            placeholder="Full Name"
                            className="px-3 py-2 bg-[#151F2E] border border-white/10 rounded-lg text-white text-sm placeholder-[#64748B] focus:outline-none focus:border-purple-500"
                          />
                          <input
                            type="email"
                            value={signer.email}
                            onChange={(e) => updateSigner(index, 'email', e.target.value)}
                            placeholder="Email Address"
                            className="px-3 py-2 bg-[#151F2E] border border-white/10 rounded-lg text-white text-sm placeholder-[#64748B] focus:outline-none focus:border-purple-500"
                          />
                        </div>
                        {signers.length > 1 && (
                          <button
                            onClick={() => removeSigner(index)}
                            className="p-1 text-[#64748B] hover:text-red-400 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-[#64748B] mt-2">
                    Signers will receive the document in the order shown above.
                  </p>
                </div>

                {/* Carbon Copies */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-white">CC Recipients (Optional)</h4>
                    <button
                      onClick={addCarbonCopy}
                      className="text-xs text-[#8FA3BF] hover:text-white transition-colors flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add CC
                    </button>
                  </div>

                  {carbonCopies.length > 0 ? (
                    <div className="space-y-2">
                      {carbonCopies.map((cc, index) => (
                        <div key={index} className="flex items-center gap-3">
                          <input
                            type="text"
                            value={cc.name}
                            onChange={(e) => updateCarbonCopy(index, 'name', e.target.value)}
                            placeholder="Name"
                            className="flex-1 px-3 py-2 bg-[#0B1220] border border-white/10 rounded-lg text-white text-sm placeholder-[#64748B] focus:outline-none focus:border-purple-500"
                          />
                          <input
                            type="email"
                            value={cc.email}
                            onChange={(e) => updateCarbonCopy(index, 'email', e.target.value)}
                            placeholder="Email"
                            className="flex-1 px-3 py-2 bg-[#0B1220] border border-white/10 rounded-lg text-white text-sm placeholder-[#64748B] focus:outline-none focus:border-purple-500"
                          />
                          <button
                            onClick={() => removeCarbonCopy(index)}
                            className="p-1 text-[#64748B] hover:text-red-400 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[#64748B]">
                      CC recipients will receive a copy of the signed document.
                    </p>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="options"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Email Subject
                  </label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0B1220] border border-white/10 rounded-lg text-white text-sm placeholder-[#64748B] focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Email Message
                  </label>
                  <textarea
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 bg-[#0B1220] border border-white/10 rounded-lg text-white text-sm placeholder-[#64748B] focus:outline-none focus:border-purple-500 resize-none"
                  />
                </div>

                {/* Preview */}
                <div className="p-4 bg-[#0B1220] rounded-lg">
                  <h4 className="text-xs font-semibold text-[#8FA3BF] uppercase mb-2">Summary</h4>
                  <div className="space-y-1 text-sm">
                    <p className="text-white">
                      <span className="text-[#64748B]">Document:</span> {documentName || contractName}
                    </p>
                    <p className="text-white">
                      <span className="text-[#64748B]">Signers:</span> {signers.filter(s => s.email).length}
                    </p>
                    {carbonCopies.filter(cc => cc.email).length > 0 && (
                      <p className="text-white">
                        <span className="text-[#64748B]">CC:</span> {carbonCopies.filter(cc => cc.email).length}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex justify-between">
          <button
            onClick={onClose}
            disabled={sending}
            className="px-4 py-2 text-sm bg-white/5 text-[#8FA3BF] rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>

          <div className="flex gap-3">
            {step === 'options' && (
              <button
                onClick={() => setStep('signers')}
                disabled={sending}
                className="px-4 py-2 text-sm bg-white/5 text-[#8FA3BF] rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                Back
              </button>
            )}
            {step === 'signers' ? (
              <button
                onClick={() => {
                  if (validateSigners()) {
                    setStep('options');
                  }
                }}
                className="px-4 py-2 text-sm font-medium bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors flex items-center gap-2"
              >
                Next
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={sending}
                className="px-4 py-2 text-sm font-medium bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {sending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Send for Signature
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
