'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Threshold {
  label: string;
  range: string;
  description: string;
}

interface MetricExplainerProps {
  title: string;
  description: string;
  calculation?: string;
  thresholds?: Threshold[];
  currentValue?: number | string;
  scoreBreakdown?: {
    component: string;
    weight: string;
    value: string | number;
  }[];
  size?: 'sm' | 'md';
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function MetricExplainer({
  title,
  description,
  calculation,
  thresholds,
  currentValue,
  scoreBreakdown,
  size = 'md',
  position = 'bottom',
}: MetricExplainerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const positionClasses = {
    top: 'bottom-full mb-2',
    bottom: 'top-full mt-2',
    left: 'right-full mr-2',
    right: 'left-full ml-2',
  };

  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';

  return (
    <div className="relative inline-flex">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        className={`${iconSize} text-[#64748B] hover:text-cyan-400 transition-colors focus:outline-none`}
        aria-label={`Learn more about ${title}`}
      >
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={popoverRef}
            initial={{ opacity: 0, scale: 0.95, y: position === 'top' ? 5 : -5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: position === 'top' ? 5 : -5 }}
            transition={{ duration: 0.15 }}
            className={`absolute z-50 ${positionClasses[position]} w-72 max-w-sm`}
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
          >
            <div className="bg-[#1B1F39] border border-white/10 rounded-xl shadow-xl overflow-hidden">
              {/* Header */}
              <div className="px-4 py-3 border-b border-white/[0.05] bg-white/[0.02]">
                <h4 className="text-white font-medium text-sm flex items-center gap-2">
                  <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {title}
                </h4>
              </div>

              {/* Content */}
              <div className="px-4 py-3 space-y-3">
                {/* Description */}
                <p className="text-[12px] text-[#94A3B8] leading-relaxed">{description}</p>

                {/* Current Value */}
                {currentValue !== undefined && (
                  <div className="bg-white/[0.03] rounded-lg px-3 py-2">
                    <span className="text-[10px] text-[#64748B] uppercase tracking-wide">Current Value: </span>
                    <span className="text-sm text-cyan-400 font-semibold">{currentValue}</span>
                  </div>
                )}

                {/* Score Breakdown */}
                {scoreBreakdown && scoreBreakdown.length > 0 && (
                  <div>
                    <h5 className="text-[10px] text-[#64748B] uppercase tracking-wide mb-2">Score Components</h5>
                    <div className="space-y-1.5">
                      {scoreBreakdown.map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-[11px]">
                          <span className="text-[#94A3B8]">
                            {item.component} <span className="text-[#64748B]">({item.weight})</span>
                          </span>
                          <span className="text-white font-medium">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Calculation */}
                {calculation && (
                  <div>
                    <h5 className="text-[10px] text-[#64748B] uppercase tracking-wide mb-1">How It's Calculated</h5>
                    <p className="text-[11px] text-[#94A3B8] bg-white/[0.02] rounded px-2 py-1.5 font-mono">
                      {calculation}
                    </p>
                  </div>
                )}

                {/* Thresholds */}
                {thresholds && thresholds.length > 0 && (
                  <div>
                    <h5 className="text-[10px] text-[#64748B] uppercase tracking-wide mb-2">Interpretation</h5>
                    <div className="space-y-1.5">
                      {thresholds.map((threshold, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-[11px] font-medium text-white min-w-[60px]">
                            {threshold.label}
                          </span>
                          <span className="text-[10px] text-[#64748B] min-w-[50px]">
                            {threshold.range}
                          </span>
                          <span className="text-[10px] text-[#94A3B8] flex-1">
                            {threshold.description}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Pre-configured explainers for common metrics
export const METRIC_CONFIGS = {
  attrition_score: {
    title: 'Attrition Score',
    description: 'How likely this customer is to stop buying. Score 0-100 where higher = more risk.',
    calculation: '(Recency × 35%) + (Frequency Change × 30%) + (Spend Change × 25%) + (Product Mix × 10%)',
    thresholds: [
      { label: 'Active', range: '0-40', description: 'Healthy, no immediate risk' },
      { label: 'Declining', range: '40-70', description: 'Negative trends, needs attention' },
      { label: 'At-Risk', range: '70+', description: 'High churn probability' },
      { label: 'Churned', range: 'N/A', description: 'No purchase in 12+ months' },
    ],
  },
  affinity_score: {
    title: 'Cross-Sell Affinity',
    description: 'Likelihood this customer would buy this product. Based on what similar customers purchase.',
    calculation: '% of similar customers who buy this product × confidence weighting',
    thresholds: [
      { label: 'Strong', range: '70-100', description: 'High confidence match' },
      { label: 'Moderate', range: '50-70', description: 'Good potential' },
      { label: 'Weak', range: '30-50', description: 'Worth exploring' },
    ],
  },
  hhi_index: {
    title: 'HHI Concentration',
    description: 'Measures how spread out revenue is across customers. Like a diversity score.',
    calculation: 'Sum of (Customer Revenue % × 100)² for all customers',
    thresholds: [
      { label: 'Diversified', range: '<1,500', description: 'Healthy distribution' },
      { label: 'Moderate', range: '1,500-2,500', description: 'Some concentration' },
      { label: 'Concentrated', range: '>2,500', description: 'Too dependent on few' },
    ],
  },
  yoy_change: {
    title: 'Year-over-Year Change',
    description: 'Percent change compared to the same period last year.',
    calculation: '((Current - Prior) / Prior) × 100',
    thresholds: [
      { label: 'Growing', range: '>5%', description: 'Positive trend' },
      { label: 'Stable', range: '-5% to 5%', description: 'Consistent' },
      { label: 'Declining', range: '<-5%', description: 'Needs investigation' },
    ],
  },
  customer_status: {
    title: 'Customer Status',
    description: 'Overall health classification based on purchase patterns and attrition score.',
    thresholds: [
      { label: 'Active', range: 'Score <40', description: 'Healthy engagement' },
      { label: 'Declining', range: 'Score 40-70', description: 'Negative trends present' },
      { label: 'At-Risk', range: 'Score >70', description: 'Immediate action needed' },
      { label: 'Churned', range: '365+ days', description: 'No recent purchases' },
    ],
  },
};

// Convenience component for pre-configured metrics
export function AttritionScoreExplainer({ currentValue, scoreBreakdown }: {
  currentValue?: number;
  scoreBreakdown?: { component: string; weight: string; value: string | number }[];
}) {
  return (
    <MetricExplainer
      {...METRIC_CONFIGS.attrition_score}
      currentValue={currentValue}
      scoreBreakdown={scoreBreakdown}
    />
  );
}

export function AffinityScoreExplainer({ currentValue }: { currentValue?: number }) {
  return <MetricExplainer {...METRIC_CONFIGS.affinity_score} currentValue={currentValue} />;
}

export function HHIExplainer({ currentValue }: { currentValue?: number }) {
  return <MetricExplainer {...METRIC_CONFIGS.hhi_index} currentValue={currentValue?.toLocaleString()} />;
}

export function YoYChangeExplainer({ currentValue }: { currentValue?: number }) {
  const formatted = currentValue !== undefined
    ? `${currentValue >= 0 ? '+' : ''}${currentValue.toFixed(1)}%`
    : undefined;
  return <MetricExplainer {...METRIC_CONFIGS.yoy_change} currentValue={formatted} />;
}
