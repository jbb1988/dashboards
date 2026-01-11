'use client';

import { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
  ReferenceLine,
} from 'recharts';
import { ChartContainer, tooltipStyle, formatChartCurrency, CHART_COLORS } from './ChartContainer';

interface YoYData {
  entity_type: 'customer' | 'class';
  entity_id: string;
  entity_name: string;
  current_revenue: number;
  prior_revenue: number;
  revenue_change_pct: number;
  current_margin_pct: number;
  prior_margin_pct: number;
  trend: 'growing' | 'stable' | 'declining';
}

interface YoYComparisonChartProps {
  data: YoYData[];
  currentYear: number;
  priorYear: number;
  index?: number;
  viewMode?: 'customer' | 'class';
  onEntityClick?: (entityId: string, entityType: 'customer' | 'class') => void;
  isRolling12?: boolean; // If true, use "Current 12 Mo" / "Prior 12 Mo" labels
}

function truncateName(name: string, maxLength: number = 18): string {
  if (name.length <= maxLength) return name;
  return name.substring(0, maxLength - 3) + '...';
}

export function YoYComparisonChart({
  data,
  currentYear,
  priorYear,
  index = 0,
  viewMode = 'customer',
  onEntityClick,
  isRolling12 = false,
}: YoYComparisonChartProps) {
  const [showGrowing, setShowGrowing] = useState(true);
  const [showDeclining, setShowDeclining] = useState(true);

  // Labels for rolling 12 vs calendar year
  const currentLabel = isRolling12 ? 'Current 12 Mo' : String(currentYear);
  const priorLabel = isRolling12 ? 'Prior 12 Mo' : String(priorYear);

  const chartData = useMemo(() => {
    let filtered = data.filter(d => d.entity_type === viewMode);

    // Apply trend filters
    if (!showGrowing) {
      filtered = filtered.filter(d => d.trend !== 'growing');
    }
    if (!showDeclining) {
      filtered = filtered.filter(d => d.trend !== 'declining');
    }

    // Sort by absolute change and take top 12
    return filtered
      .sort((a, b) => Math.abs(b.revenue_change_pct) - Math.abs(a.revenue_change_pct))
      .slice(0, 12)
      .map(d => ({
        name: d.entity_name,
        shortName: truncateName(d.entity_name),
        current: d.current_revenue,
        prior: d.prior_revenue,
        changePct: d.revenue_change_pct,
        trend: d.trend,
        entityId: d.entity_id,
        entityType: d.entity_type,
        currentMargin: d.current_margin_pct,
        priorMargin: d.prior_margin_pct,
      }))
      .sort((a, b) => b.current - a.current)
      .reverse();
  }, [data, viewMode, showGrowing, showDeclining]);

  const stats = useMemo(() => {
    const filtered = data.filter(d => d.entity_type === viewMode);
    const totalCurrent = filtered.reduce((sum, d) => sum + d.current_revenue, 0);
    const totalPrior = filtered.reduce((sum, d) => sum + d.prior_revenue, 0);
    const overallChange = totalPrior > 0 ? ((totalCurrent - totalPrior) / totalPrior) * 100 : 0;
    const growing = filtered.filter(d => d.trend === 'growing').length;
    const declining = filtered.filter(d => d.trend === 'declining').length;

    return { totalCurrent, totalPrior, overallChange, growing, declining };
  }, [data, viewMode]);

  const handleClick = (entry: typeof chartData[0]) => {
    if (onEntityClick) {
      onEntityClick(entry.entityId, entry.entityType);
    }
  };

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: typeof chartData[0] }> }) => {
    if (!active || !payload || !payload.length) return null;

    const entry = payload[0].payload;
    const changeColor = entry.changePct >= 0 ? 'text-green-400' : 'text-red-400';

    return (
      <div className="bg-[#1B1F39] border border-white/10 rounded-xl p-4 shadow-xl">
        <p className="text-white font-semibold mb-2">{entry.name}</p>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-[#64748B]">{currentLabel}:</span>
            <span className="text-cyan-400 font-medium">{formatChartCurrency(entry.current)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[#64748B]">{priorLabel}:</span>
            <span className="text-purple-400 font-medium">{formatChartCurrency(entry.prior)}</span>
          </div>
          <div className="flex justify-between gap-4 pt-1 border-t border-white/10">
            <span className="text-[#64748B]">Change:</span>
            <span className={changeColor}>
              {entry.changePct >= 0 ? '+' : ''}{entry.changePct.toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[#64748B]">Margin {currentLabel}:</span>
            <span className="text-white">{entry.currentMargin.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[#64748B]">Margin {priorLabel}:</span>
            <span className="text-white">{entry.priorMargin.toFixed(1)}%</span>
          </div>
        </div>
      </div>
    );
  };

  const chartTitle = isRolling12
    ? `Rolling 12 Month by ${viewMode === 'customer' ? 'Customer' : 'Class'}`
    : `Year-over-Year by ${viewMode === 'customer' ? 'Customer' : 'Class'}`;

  return (
    <ChartContainer
      title={chartTitle}
      subtitle={`Overall: ${stats.overallChange >= 0 ? '+' : ''}${stats.overallChange.toFixed(1)}% • ${stats.growing} growing, ${stats.declining} declining`}
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      }
      index={index}
      height={400}
    >
      {/* Filter toggles */}
      <div className="flex items-center justify-end gap-3 mb-2 -mt-2">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={showGrowing}
            onChange={() => setShowGrowing(!showGrowing)}
            className="w-3.5 h-3.5 rounded border-white/20 bg-transparent text-green-500 focus:ring-0"
          />
          <span className="text-[11px] text-green-400">Growing</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={showDeclining}
            onChange={() => setShowDeclining(!showDeclining)}
            className="w-3.5 h-3.5 rounded border-white/20 bg-transparent text-red-500 focus:ring-0"
          />
          <span className="text-[11px] text-red-400">Declining</span>
        </label>
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
          <XAxis
            type="number"
            stroke="#64748B"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            tickFormatter={(value) => formatChartCurrency(value)}
          />
          <YAxis
            type="category"
            dataKey="shortName"
            stroke="#64748B"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            width={100}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(56, 189, 248, 0.05)' }} />
          <Legend
            verticalAlign="top"
            height={30}
            formatter={(value) => (
              <span style={{ color: '#94A3B8', fontSize: 11 }}>
                {value === 'current' ? currentLabel : priorLabel}
              </span>
            )}
          />
          <Bar
            dataKey="current"
            fill={CHART_COLORS.cyan}
            radius={[0, 4, 4, 0]}
            animationDuration={1000}
            animationEasing="ease-out"
            onClick={(data: { payload?: typeof chartData[0] }) => {
              if (data.payload) handleClick(data.payload);
            }}
            style={{ cursor: onEntityClick ? 'pointer' : 'default' }}
          />
          <Bar
            dataKey="prior"
            fill={CHART_COLORS.purple}
            radius={[0, 4, 4, 0]}
            animationDuration={1000}
            animationEasing="ease-out"
            fillOpacity={0.5}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
