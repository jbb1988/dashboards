'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ReactNode, useState, useEffect, cloneElement, isValidElement } from 'react';

interface ChartContainerProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
  index?: number;
  className?: string;
  height?: number;
  expandable?: boolean;
}

export function ChartContainer({
  title,
  subtitle,
  icon,
  children,
  index = 0,
  className = '',
  height = 300,
  expandable = true,
}: ChartContainerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExpanded) {
        setIsExpanded(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isExpanded) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isExpanded]);

  const expandedHeight = 'calc(80vh - 120px)';

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: index * 0.1 }}
        className={`bg-[#0F1123]/80 rounded-2xl p-6 border border-white/[0.08] shadow-lg shadow-cyan-500/5 backdrop-blur-sm ${className}`}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-white font-semibold flex items-center gap-2">
              {icon && <span className="text-cyan-400">{icon}</span>}
              {title}
            </h3>
            {subtitle && (
              <p className="text-[#64748B] text-[12px] mt-0.5">{subtitle}</p>
            )}
          </div>
          {expandable && (
            <button
              onClick={() => setIsExpanded(true)}
              className="p-2 rounded-lg text-[#64748B] hover:text-white hover:bg-white/[0.05] transition-all"
              title="Expand chart"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
          )}
        </div>
        {/* Only render chart here when not expanded */}
        <div style={{ height, opacity: isExpanded ? 0 : 1, pointerEvents: isExpanded ? 'none' : 'auto' }}>
          {!isExpanded && children}
        </div>
      </motion.div>

      {/* Expanded Modal */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-8"
            onClick={() => setIsExpanded(false)}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

            {/* Modal Content */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-6xl max-h-[90vh] bg-[#0F1123] rounded-2xl p-8 border border-white/[0.08] shadow-2xl shadow-cyan-500/10"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-white text-xl font-semibold flex items-center gap-3">
                    {icon && <span className="text-cyan-400">{icon}</span>}
                    {title}
                  </h3>
                  {subtitle && (
                    <p className="text-[#64748B] text-[13px] mt-1">{subtitle}</p>
                  )}
                </div>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="p-2 rounded-lg text-[#64748B] hover:text-white hover:bg-white/[0.05] transition-all"
                  title="Close (Esc)"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Chart at larger size - only rendered when expanded */}
              <div style={{ height: expandedHeight }}>
                {children}
              </div>

              {/* Footer hint */}
              <div className="mt-4 text-center">
                <span className="text-[11px] text-[#475569]">Press Esc or click outside to close</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// Chart color palette matching MARS-UI
export const CHART_COLORS = {
  // Primary chart colors
  cyan: '#38BDF8',
  emerald: '#22C55E',
  orange: '#F97316',
  purple: '#8B5CF6',
  amber: '#F59E0B',
  red: '#EF4444',
  blue: '#3B82F6',
  pink: '#EC4899',
  teal: '#14B8A6',
  indigo: '#6366F1',

  // Class-specific colors
  veroflow: '#06b6d4',
  spools: '#a855f7',
  strainers: '#f97316',
  valveKeys: '#10b981',
  rcm: '#3b82f6',
  other: '#64748b',

  // Semantic colors
  revenue: '#38BDF8',
  cost: '#F59E0B',
  profit: '#22C55E',
  budget: '#8B5CF6',
  actual: '#38BDF8',
  positive: '#22C55E',
  negative: '#EF4444',
};

// Class color mapping
export function getClassColor(className: string): string {
  const colorMap: Record<string, string> = {
    'VEROflow': '#06b6d4',
    'Veroflow': '#06b6d4',
    'Spools': '#a855f7',
    'Strainers': '#f97316',
    'Valve Keys': '#10b981',
    'RCM': '#3b82f6',
    'Meter Testing': '#ec4899',
    'Calibrations': '#14b8a6',
    'Drill Taps': '#f59e0b',
    'Zinc Caps': '#6366f1',
    'Resale Other': '#64748b',
  };
  return colorMap[className] || CHART_COLORS.other;
}

// Color array for charts
export const CLASS_COLOR_ARRAY = [
  '#06b6d4', // cyan
  '#a855f7', // purple
  '#f97316', // orange
  '#10b981', // emerald
  '#3b82f6', // blue
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f59e0b', // amber
  '#6366f1', // indigo
  '#64748b', // slate
];

// Tooltip styling for Recharts
export const tooltipStyle = {
  contentStyle: {
    backgroundColor: '#1B1F39',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
    padding: '12px 16px',
  },
  labelStyle: {
    color: '#fff',
    fontWeight: 600,
    marginBottom: 4,
  },
  itemStyle: {
    color: '#94A3B8',
    fontSize: 13,
  },
};

// Format currency for charts
export function formatChartCurrency(value: number): string {
  if (Math.abs(value) >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${Math.round(value).toLocaleString()}`;
}

// Format percent for charts
export function formatChartPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}
