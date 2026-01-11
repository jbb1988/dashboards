'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
  ReferenceLine,
} from 'recharts';
import { ChartContainer, tooltipStyle, formatChartCurrency, CHART_COLORS } from './ChartContainer';

interface AttritionData {
  customer_id: string;
  customer_name: string;
  attrition_score: number;
  status: 'active' | 'declining' | 'at_risk' | 'churned';
  revenue_at_risk: number;
  recency_days: number;
  frequency_change_pct: number;
  monetary_change_pct: number;
}

interface AttritionBarChartProps {
  data: AttritionData[];
  index?: number;
  onCustomerClick?: (customerId: string) => void;
}

function getAttritionColor(score: number, status: string): string {
  if (status === 'churned') return '#6B7280'; // Gray for churned
  if (score >= 70) return CHART_COLORS.red; // High risk
  if (score >= 50) return CHART_COLORS.amber; // Medium risk
  if (score >= 30) return CHART_COLORS.orange; // Low-medium
  return CHART_COLORS.emerald; // Low risk
}

function truncateName(name: string, maxLength: number = 20): string {
  if (name.length <= maxLength) return name;
  return name.substring(0, maxLength - 3) + '...';
}

export function AttritionBarChart({ data, index = 0, onCustomerClick }: AttritionBarChartProps) {
  const chartData = useMemo(() => {
    // Filter to at-risk and declining, sort by revenue at risk
    return data
      .filter(d => d.status === 'at_risk' || d.status === 'declining' || d.status === 'churned')
      .sort((a, b) => b.revenue_at_risk - a.revenue_at_risk)
      .slice(0, 10)
      .map(d => ({
        name: d.customer_name,
        shortName: truncateName(d.customer_name),
        revenue: d.revenue_at_risk,
        score: d.attrition_score,
        status: d.status,
        customerId: d.customer_id,
        recencyDays: d.recency_days,
        freqChange: d.frequency_change_pct,
        monetaryChange: d.monetary_change_pct,
        color: getAttritionColor(d.attrition_score, d.status),
      }))
      .reverse(); // Reverse for horizontal bar chart (highest at top)
  }, [data]);

  const totalAtRisk = useMemo(() => {
    return data
      .filter(d => d.status === 'at_risk' || d.status === 'declining')
      .reduce((sum, d) => sum + d.revenue_at_risk, 0);
  }, [data]);

  const handleClick = (entry: typeof chartData[0]) => {
    if (onCustomerClick) {
      onCustomerClick(entry.customerId);
    }
  };

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: typeof chartData[0] }> }) => {
    if (!active || !payload || !payload.length) return null;

    const entry = payload[0].payload;
    return (
      <div className="bg-[#1B1F39] border border-white/10 rounded-xl p-4 shadow-xl">
        <p className="text-white font-semibold mb-2">{entry.name}</p>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-[#64748B]">Revenue at Risk:</span>
            <span className="text-white font-medium">{formatChartCurrency(entry.revenue)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[#64748B]">Attrition Score:</span>
            <span className={`font-medium ${entry.score >= 70 ? 'text-red-400' : entry.score >= 50 ? 'text-amber-400' : 'text-green-400'}`}>
              {entry.score}/100
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[#64748B]">Status:</span>
            <span className="text-white capitalize">{entry.status.replace('_', ' ')}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[#64748B]">Last Purchase:</span>
            <span className="text-white">{entry.recencyDays} days ago</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[#64748B]">Frequency Change:</span>
            <span className={entry.freqChange < 0 ? 'text-red-400' : 'text-green-400'}>
              {entry.freqChange > 0 ? '+' : ''}{entry.freqChange}%
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[#64748B]">Revenue Change:</span>
            <span className={entry.monetaryChange < 0 ? 'text-red-400' : 'text-green-400'}>
              {entry.monetaryChange > 0 ? '+' : ''}{entry.monetaryChange}%
            </span>
          </div>
        </div>
      </div>
    );
  };

  if (chartData.length === 0) {
    return (
      <ChartContainer
        title="At-Risk Customers"
        subtitle="No at-risk customers identified"
        icon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        }
        index={index}
        height={380}
      >
        <div className="flex items-center justify-center h-full text-[#64748B]">
          <div className="text-center">
            <svg className="w-12 h-12 mx-auto mb-3 text-green-500/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>All customers are healthy!</p>
          </div>
        </div>
      </ChartContainer>
    );
  }

  return (
    <ChartContainer
      title="At-Risk Customers"
      subtitle={`${chartData.length} customers • ${formatChartCurrency(totalAtRisk)} at risk`}
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      }
      index={index}
      height={380}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 80, left: 0, bottom: 5 }}
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
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={110}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(239, 68, 68, 0.05)' }} />
          <Bar
            dataKey="revenue"
            radius={[0, 6, 6, 0]}
            animationDuration={1000}
            animationEasing="ease-out"
            onClick={(data: { payload?: typeof chartData[0] }) => {
              if (data.payload) handleClick(data.payload);
            }}
            style={{ cursor: onCustomerClick ? 'pointer' : 'default' }}
          >
            {chartData.map((entry, idx) => (
              <Cell key={`cell-${idx}`} fill={entry.color} fillOpacity={0.85} />
            ))}
            <LabelList
              dataKey="score"
              position="right"
              formatter={(value) => `${value}`}
              fill="#94A3B8"
              fontSize={11}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-2 text-[10px]">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: CHART_COLORS.red }} />
          <span className="text-[#64748B]">High Risk (70+)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: CHART_COLORS.amber }} />
          <span className="text-[#64748B]">Medium (50-70)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: CHART_COLORS.orange }} />
          <span className="text-[#64748B]">Watch (30-50)</span>
        </div>
      </div>
    </ChartContainer>
  );
}
