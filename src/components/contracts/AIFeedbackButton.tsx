'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AIFeedbackButtonProps {
  aiSuggestion: string;
  originalText?: string;
  clauseType?: string;
  sectionTitle?: string;
  reviewId?: string;
  contractName?: string;
  onFeedbackSubmitted?: (rating: 'positive' | 'negative' | 'neutral') => void;
}

export default function AIFeedbackButton({
  aiSuggestion,
  originalText,
  clauseType,
  sectionTitle,
  reviewId,
  contractName,
  onFeedbackSubmitted,
}: AIFeedbackButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [rating, setRating] = useState<'positive' | 'negative' | 'neutral' | null>(null);
  const [ratingReason, setRatingReason] = useState('');
  const [correctedText, setCorrectedText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit() {
    if (!rating) return;

    setSubmitting(true);
    try {
      const response = await fetch('/api/ai/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          review_id: reviewId,
          contract_name: contractName,
          clause_type: clauseType,
          section_title: sectionTitle,
          ai_suggestion: aiSuggestion,
          original_text: originalText,
          rating,
          rating_reason: ratingReason,
          corrected_text: rating === 'negative' ? correctedText : null,
        }),
      });

      if (response.ok) {
        setSubmitted(true);
        onFeedbackSubmitted?.(rating);
        setTimeout(() => {
          setShowModal(false);
          setSubmitted(false);
        }, 1500);
      }
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Thanks!
      </motion.div>
    );
  }

  return (
    <>
      {/* Inline Feedback Buttons */}
      <div className="inline-flex items-center gap-1">
        <button
          onClick={() => {
            setRating('positive');
            setShowModal(true);
          }}
          className="p-1 hover:bg-green-500/20 rounded transition-colors group"
          title="Good suggestion"
        >
          <svg className="w-4 h-4 text-[#64748B] group-hover:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
          </svg>
        </button>
        <button
          onClick={() => {
            setRating('negative');
            setShowModal(true);
          }}
          className="p-1 hover:bg-red-500/20 rounded transition-colors group"
          title="Poor suggestion"
        >
          <svg className="w-4 h-4 text-[#64748B] group-hover:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018c.163 0 .326.02.485.06L17 4m-7 10v5a2 2 0 002 2h.095c.5 0 .905-.405.905-.905 0-.714.211-1.412.608-2.006L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
          </svg>
        </button>
      </div>

      {/* Feedback Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#151F2E] border border-white/10 rounded-xl w-full max-w-lg"
            >
              <div className="px-6 py-4 border-b border-white/10">
                <h3 className="text-lg font-semibold text-white">AI Feedback</h3>
                <p className="text-xs text-[#8FA3BF]">Help improve our AI suggestions</p>
              </div>

              <div className="p-6 space-y-4">
                {/* Rating Selection */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    How was this suggestion?
                  </label>
                  <div className="flex gap-2">
                    {(['positive', 'neutral', 'negative'] as const).map(r => (
                      <button
                        key={r}
                        onClick={() => setRating(r)}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          rating === r
                            ? r === 'positive' ? 'bg-green-500/20 text-green-400 border border-green-500/40'
                              : r === 'neutral' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40'
                              : 'bg-red-500/20 text-red-400 border border-red-500/40'
                            : 'bg-white/5 text-[#8FA3BF] border border-white/10 hover:border-white/20'
                        }`}
                      >
                        {r === 'positive' ? 'Good' : r === 'neutral' ? 'Okay' : 'Poor'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* AI Suggestion Preview */}
                <div>
                  <label className="block text-xs text-[#64748B] uppercase mb-1">AI Suggestion</label>
                  <div className="p-3 bg-[#0B1220] rounded-lg text-sm text-white/80 max-h-32 overflow-y-auto">
                    {aiSuggestion.substring(0, 300)}
                    {aiSuggestion.length > 300 && '...'}
                  </div>
                </div>

                {/* Reason (optional) */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Why? <span className="text-[#64748B] font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={ratingReason}
                    onChange={(e) => setRatingReason(e.target.value)}
                    placeholder={rating === 'positive' ? 'What made it helpful?' : 'What was wrong?'}
                    className="w-full px-3 py-2 bg-[#0B1220] border border-white/10 rounded-lg text-white text-sm placeholder-[#64748B] focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Corrected Text (for negative feedback) */}
                {rating === 'negative' && (
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Better alternative <span className="text-[#64748B] font-normal">(helps train the AI)</span>
                    </label>
                    <textarea
                      value={correctedText}
                      onChange={(e) => setCorrectedText(e.target.value)}
                      placeholder="What should the AI have suggested instead?"
                      rows={3}
                      className="w-full px-3 py-2 bg-[#0B1220] border border-white/10 rounded-lg text-white text-sm placeholder-[#64748B] focus:outline-none focus:border-purple-500 resize-none"
                    />
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowModal(false);
                    setRating(null);
                    setRatingReason('');
                    setCorrectedText('');
                  }}
                  className="px-4 py-2 text-sm bg-white/5 text-[#8FA3BF] rounded-lg hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!rating || submitting}
                  className="px-4 py-2 text-sm font-medium bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Submitting...' : 'Submit Feedback'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
