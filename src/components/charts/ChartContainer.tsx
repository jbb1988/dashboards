'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface ChartContainerProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
  index?: number;
  className?: string;
  height?: number;
}

export function ChartContainer({
  title,
  subtitle,
  icon,
  children,
  index = 0,
  className = '',
  height = 300,
}: ChartContainerProps) {
  return (
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
      </div>
      <div style={{ height }}>{children}</div>
    </motion.div>
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
