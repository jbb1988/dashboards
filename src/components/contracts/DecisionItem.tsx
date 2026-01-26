'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface DecisionItemData {
  id: string;
  title: string;
  summary: string;
  riskLevel: 'high' | 'medium' | 'low';
  changeCount: number;
  redlineHtml: string;
}

interface DecisionItemProps {
  item: DecisionItemData;
  onApplyChanges?: (itemId: string) => void;
  readOnly?: boolean;
}

const riskConfig = {
  high: {
    label: 'HIGH',
    labelColor: 'text-[#F85149]',
    borderColor: 'border-[#F85149]/20',
    bgHover: 'hover:bg-[#F85149]/5',
  },
  medium: {
    label: 'MEDIUM',
    labelColor: 'text-[#D29922]',
    borderColor: 'border-[#D29922]/20',
    bgHover: 'hover:bg-[#D29922]/5',
  },
  low: {
    label: 'LOW',
    labelColor: 'text-[#3FB950]',
    borderColor: 'border-[#3FB950]/20',
    bgHover: 'hover:bg-[#3FB950]/5',
  },
};

export default function DecisionItem({ item, onApplyChanges, readOnly }: DecisionItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = riskConfig[item.riskLevel];

  return (
    <div className={`border ${config.borderColor} rounded-lg bg-[#1E2328] transition-colors`}>
      {/* Collapsed Header - Always Visible */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full px-4 py-3 flex items-center gap-4 text-left ${config.bgHover} transition-colors rounded-lg`}
      >
        {/* Risk Label */}
        <span className={`text-xs font-semibold tracking-wide ${config.labelColor} w-16 flex-shrink-0`}>
          {config.label}
        </span>

        {/* Title & Summary */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-[#E6EDF3] truncate">
            {item.title}
          </h3>
          <p className="text-xs text-[#8B949E] truncate mt-0.5">
            {item.summary}
          </p>
        </div>

        {/* Change Count */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-[#8B949E]">
            {item.changeCount} {item.changeCount === 1 ? 'change' : 'changes'}
          </span>

          {/* Expand Chevron */}
          <motion.svg
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="w-4 h-4 text-[#8B949E]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </motion.svg>
        </div>
      </button>

      {/* Expanded Content - Redlines */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">
              {/* Redline Container */}
              <div className="bg-[#161B22] rounded-lg p-4 border border-white/5">
                {/* Redline Content */}
                <div
                  className="text-sm font-mono text-[#C9D1D9] leading-relaxed whitespace-pre-wrap redline-content"
                  dangerouslySetInnerHTML={{ __html: item.redlineHtml }}
                />
              </div>

              {/* Apply Changes Button */}
              {!readOnly && onApplyChanges && (
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => onApplyChanges(item.id)}
                    className="px-4 py-1.5 text-sm font-medium bg-[#238636] hover:bg-[#2ea043] text-white rounded transition-colors"
                  >
                    Apply Changes
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Inline styles for redline markup */}
      <style jsx global>{`
        .redline-content del,
        .redline-content span[data-ai-strike] {
          color: #F85149;
          text-decoration: line-through;
        }
        .redline-content ins,
        .redline-content span[data-ai-insert] {
          color: #3FB950;
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}
