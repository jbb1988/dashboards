'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
  Legend,
} from 'recharts';

interface MonthlyData {
  year: number;
  month: number;
  monthName: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossProfitPct: number;
}

interface ProfitabilityTrendChartProps {
  data: MonthlyData[];
  height?: number;
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

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0]?.payload;
    return (
      <div className="bg-[#1E2028] border border-white/10 rounded-lg p-3 shadow-xl">
        <p className="text-[#94A3B8] text-xs font-medium mb-2">{label}</p>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-4">
            <span className="text-[#38BDF8] text-xs">Revenue</span>
            <span className="text-white text-xs font-semibold">{formatCurrency(data?.revenue || 0)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-[#F59E0B] text-xs">COGS</span>
            <span className="text-white text-xs font-semibold">{formatCurrency(data?.cogs || 0)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-[#22C55E] text-xs">Gross Profit</span>
            <span className="text-white text-xs font-semibold">{formatCurrency(data?.grossProfit || 0)}</span>
          </div>
          <div className="flex items-center justify-between gap-4 pt-1 border-t border-white/10">
            <span className="text-[#8B5CF6] text-xs">GPM</span>
            <span className="text-white text-xs font-semibold">{(data?.grossProfitPct || 0).toFixed(1)}%</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export default function ProfitabilityTrendChart({ data, height = 280 }: ProfitabilityTrendChartProps) {
  const [showCogs, setShowCogs] = useState(false);
  const [yearFilter, setYearFilter] = useState<number | 'all'>('all');

  // Get available years
  const years = useMemo(() => {
    const uniqueYears = [...new Set(data.map(d => d.year))].sort((a, b) => b - a);
    return uniqueYears;
  }, [data]);

  // Prepare chart data
  const chartData = useMemo(() => {
    let filtered = data;

    if (yearFilter !== 'all') {
      filtered = data.filter(d => d.year === yearFilter);
    }

    // Sort by year and month
    const sorted = [...filtered].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });

    // Create labels
    return sorted.map(d => ({
      ...d,
      label: yearFilter === 'all' ? `${d.monthName} ${d.year}` : d.monthName,
    }));
  }, [data, yearFilter]);

  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl bg-[#111827] border border-white/[0.04] shadow-[0_4px_16px_rgba(0,0,0,0.2)] p-4">
        <h3 className="text-[10px] font-semibold text-[#475569] uppercase tracking-[0.08em] mb-4">
          Revenue & GPM Trend
        </h3>
        <div className="flex items-center justify-center h-[200px] text-[#64748B] text-sm">
          No trend data available
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl bg-[#111827] border border-white/[0.04] shadow-[0_4px_16px_rgba(0,0,0,0.2)] p-4"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[10px] font-semibold text-[#475569] uppercase tracking-[0.08em]">
          Revenue & GPM Trend
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCogs(!showCogs)}
            className={`px-2 py-1 text-[10px] rounded transition-colors ${
              showCogs
                ? 'bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/30'
                : 'bg-white/5 text-[#64748B] border border-white/10'
            }`}
          >
            Show COGS
          </button>
          <select
            value={yearFilter === 'all' ? 'all' : yearFilter}
            onChange={(e) => setYearFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
            className="px-2 py-1 text-[10px] rounded bg-white/5 text-white border border-white/10 focus:outline-none"
          >
            <option value="all">All Years</option>
            {years.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#38BDF8" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="cogsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#F59E0B" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gpGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22C55E" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#22C55E" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="label"
            tick={{ fill: '#64748B', fontSize: 9 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            yAxisId="revenue"
            tick={{ fill: '#64748B', fontSize: 9 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            tickLine={false}
            tickFormatter={formatYAxis}
          />
          <YAxis
            yAxisId="gpm"
            orientation="right"
            domain={[0, 100]}
            tick={{ fill: '#8B5CF6', fontSize: 9 }}
            axisLine={{ stroke: 'rgba(139,92,246,0.3)' }}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            yAxisId="revenue"
            type="monotone"
            dataKey="revenue"
            stroke="#38BDF8"
            strokeWidth={2}
            fill="url(#revenueGradient)"
            name="Revenue"
          />
          {showCogs && (
            <Area
              yAxisId="revenue"
              type="monotone"
              dataKey="cogs"
              stroke="#F59E0B"
              strokeWidth={2}
              fill="url(#cogsGradient)"
              name="COGS"
            />
          )}
          <Line
            yAxisId="gpm"
            type="monotone"
            dataKey="grossProfitPct"
            stroke="#8B5CF6"
            strokeWidth={2}
            dot={false}
            name="GPM %"
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#38BDF8]" />
          <span className="text-[10px] text-[#94A3B8]">Revenue</span>
        </div>
        {showCogs && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#F59E0B]" />
            <span className="text-[10px] text-[#94A3B8]">COGS</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 bg-[#8B5CF6]" />
          <span className="text-[10px] text-[#94A3B8]">GPM %</span>
        </div>
      </div>
    </motion.div>
  );
}
