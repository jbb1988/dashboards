'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { trackFeedback } from '@/lib/help/analytics';

interface ArticleFeedbackProps {
  guideId?: string;
}

export default function ArticleFeedback({ guideId }: ArticleFeedbackProps) {
  const [feedback, setFeedback] = useState<'helpful' | 'not-helpful' | null>(null);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleFeedback = (isHelpful: boolean) => {
    const feedbackType = isHelpful ? 'helpful' : 'not-helpful';
    setFeedback(feedbackType);

    if (!isHelpful) {
      setShowComment(true);
    } else {
      trackFeedback(true, guideId);
      setSubmitted(true);
    }
  };

  const handleSubmitComment = () => {
    trackFeedback(false, guideId, comment);
    setSubmitted(true);
    setShowComment(false);
  };

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-3 rounded-lg bg-[#22C55E]/10 border border-[#22C55E]/20 text-center"
      >
        <p className="text-[#22C55E] text-sm font-medium">Thanks for your feedback!</p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-3">
      <AnimatePresence mode="wait">
        {!showComment ? (
          <motion.div
            key="buttons"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-3 rounded-lg bg-[#0B1220] border border-white/[0.04]"
          >
            <p className="text-[#8FA3BF] text-sm text-center mb-3">Was this helpful?</p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => handleFeedback(true)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                  feedback === 'helpful'
                    ? 'bg-[#22C55E]/20 border-[#22C55E]/30 text-[#22C55E]'
                    : 'bg-white/[0.02] border-white/[0.06] text-[#8FA3BF] hover:bg-white/[0.04] hover:text-white'
                }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                </svg>
                Yes
              </button>
              <button
                onClick={() => handleFeedback(false)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                  feedback === 'not-helpful'
                    ? 'bg-red-500/20 border-red-500/30 text-red-400'
                    : 'bg-white/[0.02] border-white/[0.06] text-[#8FA3BF] hover:bg-white/[0.04] hover:text-white'
                }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                </svg>
                No
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="comment"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-4 rounded-lg bg-[#0B1220] border border-white/[0.04]"
          >
            <p className="text-[#8FA3BF] text-sm mb-3">What could we improve?</p>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tell us what you were looking for..."
              className="w-full px-3 py-2 bg-[#111827] border border-white/[0.06] rounded-lg text-white placeholder-[#64748B] text-sm focus:outline-none focus:border-[#38BDF8]/50 resize-none"
              rows={3}
            />
            <div className="flex items-center justify-end gap-2 mt-3">
              <button
                onClick={() => {
                  setShowComment(false);
                  setFeedback(null);
                }}
                className="px-3 py-1.5 text-sm text-[#64748B] hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitComment}
                className="px-3 py-1.5 bg-[#38BDF8] hover:bg-[#0EA5E9] text-white text-sm font-medium rounded-lg transition-colors"
              >
                Submit
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
