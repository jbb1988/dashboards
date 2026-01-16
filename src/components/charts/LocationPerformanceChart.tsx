'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import { ChartContainer, tooltipStyle, formatChartCurrency } from './ChartContainer';

interface PerformanceData {
  location: string;
  distributor: string;
  revenue: number;
  distributorAvg: number;
  variance: number; // % above/below average
  varianceAmount: number; // $ amount above/below average
}

interface LocationPerformanceChartProps {
  data: PerformanceData[];
  index?: number;
  showTop?: number; // Number of top/bottom locations to show
}

export function LocationPerformanceChart({
  data,
  index = 0,
  showTop = 20
}: LocationPerformanceChartProps) {
  // Sort by variance and take top/bottom performers
  const sorted = [...data].sort((a, b) => b.variance - a.variance);
  const topPerformers = sorted.slice(0, Math.floor(showTop / 2));
  const bottomPerformers = sorted.slice(-Math.floor(showTop / 2)).reverse();
  const chartData = [...topPerformers, ...bottomPerformers];

  // Get color based on variance
  const getBarColor = (variance: number) => {
    if (variance > 25) return '#22C55E'; // Strong green
    if (variance > 0) return '#14B8A6';  // Teal
    if (variance > -25) return '#F59E0B'; // Amber
    return '#EF4444'; // Red
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{
          backgroundColor: '#1B1F39',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '12px',
          padding: '12px 16px',
        }}>
          <p className="text-white font-semibold mb-2">{data.location}</p>
          <p className="text-[#64748B] text-[11px] mb-2">{data.distributor}</p>
          <div className="space-y-1">
            <p className="text-[#94A3B8] text-[12px]">
              Revenue: <span className="text-white font-medium">{formatChartCurrency(data.revenue)}</span>
            </p>
            <p className="text-[#94A3B8] text-[12px]">
              Distributor Avg: <span className="text-[#64748B]">{formatChartCurrency(data.distributorAvg)}</span>
            </p>
            <p className="text-[#94A3B8] text-[12px]">
              Variance: <span
                className="font-medium"
                style={{ color: getBarColor(data.variance) }}
              >
                {data.variance >= 0 ? '+' : ''}{data.variance.toFixed(1)}%
              </span>
              {' '}
              <span className="text-[#64748B]">
                ({data.varianceAmount >= 0 ? '+' : ''}{formatChartCurrency(data.varianceAmount)})
              </span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <ChartContainer
      title="Location Performance vs Distributor Average"
      subtitle={`Top ${showTop} locations by variance from their distributor's average`}
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      }
      index={index}
      height={400}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
          <XAxis
            type="number"
            stroke="#64748B"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            tickFormatter={(value) => `${value >= 0 ? '+' : ''}${value}%`}
          />
          <YAxis
            type="category"
            dataKey="location"
            stroke="#64748B"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            width={120}
            tick={({ x, y, payload }) => (
              <text
                x={x}
                y={y}
                textAnchor="end"
                fill="#94A3B8"
                fontSize={10}
                className="font-medium"
              >
                <tspan>{payload.value.length > 18 ? payload.value.substring(0, 18) + '...' : payload.value}</tspan>
              </text>
            )}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(20, 184, 166, 0.05)' }} />
          <ReferenceLine
            x={0}
            stroke="#64748B"
            strokeDasharray="5 5"
            strokeOpacity={0.5}
            label={{
              value: 'Distributor Avg',
              position: 'top',
              fill: '#64748B',
              fontSize: 10
            }}
          />
          <Bar
            dataKey="variance"
            radius={[0, 4, 4, 0]}
            animationDuration={1200}
            animationBegin={index * 100}
          >
            {chartData.map((entry, idx) => (
              <Cell key={`cell-${idx}`} fill={getBarColor(entry.variance)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Summary */}
      <div className="mt-4 pt-4 border-t border-white/[0.04] flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#22C55E' }} />
            <span className="text-[#94A3B8]">Strong (+25%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#14B8A6' }} />
            <span className="text-[#94A3B8]">Above Avg</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#F59E0B' }} />
            <span className="text-[#94A3B8]">Below Avg</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#EF4444' }} />
            <span className="text-[#94A3B8]">At Risk (-25%)</span>
          </div>
        </div>
        <span className="text-[#475569]">Showing {chartData.length} locations</span>
      </div>
    </ChartContainer>
  );
}
