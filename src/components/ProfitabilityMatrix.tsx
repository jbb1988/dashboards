'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';

interface Project {
  customer_name: string;
  project_type: string;
  total_revenue: number;
  total_cogs: number;
  gross_profit: number;
  gross_profit_pct: number;
  transaction_count: number;
}

interface ProfitabilityMatrixProps {
  projects: Project[];
  height?: number;
  onProjectSelect?: (project: Project | null) => void;
}

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

function formatYAxis(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(0)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
  return value.toString();
}

// Get color based on GPM
function getColor(gpm: number): string {
  if (gpm >= 60) return '#22C55E'; // Green - healthy
  if (gpm >= 50) return '#F59E0B'; // Amber - warning
  return '#EF4444'; // Red - at risk
}

// Get quadrant label
function getQuadrant(revenue: number, gpm: number, medianRevenue: number): string {
  if (revenue >= medianRevenue && gpm >= 60) return 'star'; // Stars
  if (revenue < medianRevenue && gpm >= 60) return 'gem'; // Hidden Gems
  if (revenue >= medianRevenue && gpm < 50) return 'risk'; // At Risk
  return 'review'; // Review
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0]?.payload;
    const gpmColor = getColor(data?.gross_profit_pct || 0);

    return (
      <div className="bg-[#1E2028] border border-white/10 rounded-lg p-3 shadow-xl min-w-[200px]">
        <p className="text-white text-sm font-medium mb-2 truncate">{data?.customer_name}</p>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-4">
            <span className="text-[#94A3B8] text-xs">Revenue</span>
            <span className="text-[#38BDF8] text-xs font-semibold">{formatCurrency(data?.total_revenue || 0)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-[#94A3B8] text-xs">Gross Profit</span>
            <span className="text-[#22C55E] text-xs font-semibold">{formatCurrency(data?.gross_profit || 0)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-[#94A3B8] text-xs">GPM</span>
            <span className="text-xs font-semibold" style={{ color: gpmColor }}>
              {(data?.gross_profit_pct || 0).toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-[#94A3B8] text-xs">Type</span>
            <span className="text-white text-xs">{data?.project_type || 'Unknown'}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-[#94A3B8] text-xs">Transactions</span>
            <span className="text-white text-xs">{data?.transaction_count || 0}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export default function ProfitabilityMatrix({ projects, height = 300, onProjectSelect }: ProfitabilityMatrixProps) {
  const [selectedQuadrant, setSelectedQuadrant] = useState<string | null>(null);

  // Calculate median revenue for quadrant lines
  const medianRevenue = useMemo(() => {
    if (!projects || projects.length === 0) return 0;
    const sorted = [...projects].sort((a, b) => a.total_revenue - b.total_revenue);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
      ? sorted[mid].total_revenue
      : (sorted[mid - 1].total_revenue + sorted[mid].total_revenue) / 2;
  }, [projects]);

  // Prepare chart data with bubble sizes
  const chartData = useMemo(() => {
    if (!projects || projects.length === 0) return [];

    const maxTransactions = Math.max(...projects.map(p => p.transaction_count));

    return projects.map(p => ({
      ...p,
      x: p.total_revenue,
      y: p.gross_profit_pct,
      z: Math.max(50, (p.transaction_count / maxTransactions) * 200 + 50), // Min size 50, max 250
      quadrant: getQuadrant(p.total_revenue, p.gross_profit_pct, medianRevenue),
    }));
  }, [projects, medianRevenue]);

  // Filter by quadrant if selected
  const filteredData = useMemo(() => {
    if (!selectedQuadrant) return chartData;
    return chartData.filter(d => d.quadrant === selectedQuadrant);
  }, [chartData, selectedQuadrant]);

  if (!projects || projects.length === 0) {
    return (
      <div className="rounded-xl bg-[#111827] border border-white/[0.04] shadow-[0_4px_16px_rgba(0,0,0,0.2)] p-4">
        <h3 className="text-[10px] font-semibold text-[#475569] uppercase tracking-[0.08em] mb-4">
          Profitability Matrix
        </h3>
        <div className="flex items-center justify-center h-[200px] text-[#64748B] text-sm">
          No project data available
        </div>
      </div>
    );
  }

  const quadrantCounts = {
    star: chartData.filter(d => d.quadrant === 'star').length,
    gem: chartData.filter(d => d.quadrant === 'gem').length,
    risk: chartData.filter(d => d.quadrant === 'risk').length,
    review: chartData.filter(d => d.quadrant === 'review').length,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl bg-[#111827] border border-white/[0.04] shadow-[0_4px_16px_rgba(0,0,0,0.2)] p-4"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[10px] font-semibold text-[#475569] uppercase tracking-[0.08em]">
          Profitability Matrix
        </h3>
        <div className="flex items-center gap-1">
          {[
            { key: null, label: 'All', color: '#94A3B8' },
            { key: 'star', label: 'Stars', color: '#22C55E' },
            { key: 'gem', label: 'Gems', color: '#38BDF8' },
            { key: 'risk', label: 'Risk', color: '#EF4444' },
          ].map(({ key, label, color }) => (
            <button
              key={label}
              onClick={() => setSelectedQuadrant(key)}
              className={`px-2 py-0.5 text-[9px] rounded transition-colors ${
                selectedQuadrant === key
                  ? 'bg-white/10 text-white'
                  : 'text-[#64748B] hover:text-white'
              }`}
              style={selectedQuadrant === key ? { borderColor: color } : {}}
            >
              {label} {key && `(${quadrantCounts[key as keyof typeof quadrantCounts]})`}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            type="number"
            dataKey="x"
            name="Revenue"
            tick={{ fill: '#64748B', fontSize: 9 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            tickLine={false}
            tickFormatter={formatYAxis}
            label={{ value: 'Revenue', position: 'bottom', fill: '#64748B', fontSize: 10, offset: 0 }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="GPM %"
            domain={[0, 100]}
            tick={{ fill: '#64748B', fontSize: 9 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
            label={{ value: 'GPM %', angle: -90, position: 'insideLeft', fill: '#64748B', fontSize: 10 }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />

          {/* Reference lines for quadrants */}
          <ReferenceLine y={50} stroke="rgba(239, 68, 68, 0.3)" strokeDasharray="5 5" />
          <ReferenceLine y={60} stroke="rgba(34, 197, 94, 0.3)" strokeDasharray="5 5" />
          <ReferenceLine x={medianRevenue} stroke="rgba(255,255,255,0.1)" strokeDasharray="5 5" />

          <Scatter
            data={filteredData}
            fill="#38BDF8"
            onClick={(data) => {
              if (onProjectSelect) {
                onProjectSelect(data as Project);
              }
            }}
          >
            {filteredData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={getColor(entry.gross_profit_pct)}
                fillOpacity={0.7}
                stroke={getColor(entry.gross_profit_pct)}
                strokeWidth={1}
                r={Math.sqrt(entry.z / Math.PI)}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>

      {/* Quadrant Legend */}
      <div className="flex items-center justify-center gap-4 mt-2 text-[9px]">
        <div className="flex items-center gap-1">
          <span className="text-[#22C55E]">●</span>
          <span className="text-[#94A3B8]">Stars (GPM {'>'}60%)</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[#F59E0B]">●</span>
          <span className="text-[#94A3B8]">Watch (50-60%)</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[#EF4444]">●</span>
          <span className="text-[#94A3B8]">At Risk ({'<'}50%)</span>
        </div>
      </div>
    </motion.div>
  );
}
