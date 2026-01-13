'use client';

import { useState, useMemo } from 'react';
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
  Legend,
} from 'recharts';
import { ChartContainer, tooltipStyle, CHART_COLORS } from '../charts/ChartContainer';

interface UnitsData {
  class_name: string;
  parent_class: string | null;
  current_units: number;
  prior_units: number;
  units_change_pct: number;
}

interface UnitsBarChartProps {
  data: UnitsData[];
  showYoY?: boolean;
  title?: string;
  subtitle?: string;
  index?: number;
}

const formatNumber = (value: number): string => {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toLocaleString();
};

export function UnitsBarChart({
  data,
  showYoY: externalShowYoY = false,
  title = 'Units Sold by Class',
  subtitle = 'Top 10 product classes by units',
  index = 0,
}: UnitsBarChartProps) {
  const [showYoY, setShowYoY] = useState(externalShowYoY);

  // Check if we have prior period data
  const hasPriorData = useMemo(() => {
    return data.some(d => d.prior_units > 0);
  }, [data]);

  // Chart data
  const chartData = useMemo(() => {
    const topClasses = [...data]
      .sort((a, b) => b.current_units - a.current_units)
      .slice(0, 10)
      .reverse();

    return topClasses.map((d, idx) => ({
      name: d.class_name,
      current_units: d.current_units,
      prior_units: d.prior_units,
      change_pct: d.units_change_pct,
      color: CHART_COLORS[idx % CHART_COLORS.length],
    }));
  }, [data]);

  return (
    <ChartContainer
      title={title}
      subtitle={showYoY ? 'Current R12 vs Prior R12 comparison' : subtitle}
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      }
      index={index}
      height={380}
    >
      {/* YoY Toggle */}
      {hasPriorData && (
        <div className="flex items-center justify-end mb-2 -mt-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-[11px] text-[#64748B]">Year over Year</span>
            <button
              onClick={() => setShowYoY(!showYoY)}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                showYoY ? 'bg-[#38BDF8]' : 'bg-[#334155]'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  showYoY ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </label>
        </div>
      )}

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
            tickFormatter={(value) => formatNumber(value)}
          />
          <YAxis
            type="category"
            dataKey="name"
            stroke="#64748B"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={100}
          />
          <Tooltip
            {...tooltipStyle}
            formatter={(value, name) => {
              const numValue = typeof value === 'number' ? value : 0;
              if (showYoY) {
                if (name === 'current_units') return [formatNumber(numValue), 'Current R12'];
                if (name === 'prior_units') return [formatNumber(numValue), 'Prior R12'];
              }
              return [formatNumber(numValue), 'Units'];
            }}
            cursor={{ fill: 'rgba(56, 189, 248, 0.05)' }}
          />
          {showYoY && (
            <Legend
              verticalAlign="top"
              height={30}
              formatter={(value) => (
                <span style={{ color: '#94A3B8', fontSize: 11 }}>
                  {value === 'current_units' ? 'Current R12' : 'Prior R12'}
                </span>
              )}
            />
          )}
          {showYoY ? (
            <>
              <Bar
                dataKey="current_units"
                fill={CHART_COLORS[0]}
                radius={[0, 4, 4, 0]}
                animationDuration={1000}
                animationEasing="ease-out"
              />
              <Bar
                dataKey="prior_units"
                fill={CHART_COLORS[1]}
                radius={[0, 4, 4, 0]}
                animationDuration={1000}
                animationEasing="ease-out"
                fillOpacity={0.5}
              />
            </>
          ) : (
            <Bar
              dataKey="current_units"
              radius={[0, 6, 6, 0]}
              animationDuration={1000}
              animationEasing="ease-out"
            >
              {chartData.map((entry, idx) => (
                <Cell key={`cell-${idx}`} fill={entry.color} fillOpacity={0.8} />
              ))}
              <LabelList
                dataKey="current_units"
                position="right"
                formatter={(value) => formatNumber(typeof value === 'number' ? value : 0)}
                fill="#94A3B8"
                fontSize={11}
              />
            </Bar>
          )}
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
