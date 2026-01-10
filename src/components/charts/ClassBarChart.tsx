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
import { ChartContainer, tooltipStyle, formatChartCurrency, getClassColor, CHART_COLORS } from './ChartContainer';

interface ClassData {
  class_name: string;
  total_revenue: number;
  total_cost: number;
  total_gross_profit: number;
  avg_gross_profit_pct: number;
}

interface ClassMonthlyData {
  className: string;
  year: number;
  month: number;
  revenue: number;
}

interface ClassBarChartProps {
  data: ClassData[];
  classMonthlyData?: ClassMonthlyData[];
  selectedYear?: number;
  index?: number;
}

export function ClassBarChart({ data, classMonthlyData, selectedYear, index = 0 }: ClassBarChartProps) {
  const [showYoY, setShowYoY] = useState(false);

  // Determine current and previous year from data
  const { currentYear, previousYear, hasMultipleYears } = useMemo(() => {
    if (!classMonthlyData || classMonthlyData.length === 0) {
      return { currentYear: selectedYear || 2025, previousYear: (selectedYear || 2025) - 1, hasMultipleYears: false };
    }
    const years = [...new Set(classMonthlyData.map(d => d.year))].sort((a, b) => b - a);
    return {
      currentYear: years[0],
      previousYear: years[1] || years[0] - 1,
      hasMultipleYears: years.length > 1,
    };
  }, [classMonthlyData, selectedYear]);

  // Calculate YoY data by class
  const yoyData = useMemo(() => {
    if (!classMonthlyData || !showYoY) return null;

    const classMap = new Map<string, { current: number; previous: number }>();

    for (const item of classMonthlyData) {
      if (!classMap.has(item.className)) {
        classMap.set(item.className, { current: 0, previous: 0 });
      }
      const entry = classMap.get(item.className)!;
      if (item.year === currentYear) {
        entry.current += item.revenue;
      } else if (item.year === previousYear) {
        entry.previous += item.revenue;
      }
    }

    return Array.from(classMap.entries())
      .map(([className, values]) => ({
        name: className,
        current: values.current,
        previous: values.previous,
        change: values.previous > 0 ? ((values.current - values.previous) / values.previous) * 100 : 0,
        color: getClassColor(className),
      }))
      .sort((a, b) => b.current - a.current)
      .slice(0, 10)
      .reverse();
  }, [classMonthlyData, showYoY, currentYear, previousYear]);

  // Standard chart data (no YoY)
  const chartData = useMemo(() => {
    const topClasses = [...data]
      .sort((a, b) => b.total_revenue - a.total_revenue)
      .slice(0, 10)
      .reverse();

    return topClasses.map(d => ({
      name: d.class_name,
      revenue: d.total_revenue,
      profit: d.total_gross_profit,
      gpPct: d.avg_gross_profit_pct,
      color: getClassColor(d.class_name),
    }));
  }, [data]);

  const displayData = showYoY && yoyData ? yoyData : chartData;

  return (
    <ChartContainer
      title="Revenue by Class"
      subtitle={showYoY ? `${currentYear} vs ${previousYear} comparison` : 'Top 10 product classes by revenue'}
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      }
      index={index}
      height={380}
    >
      {/* YoY Toggle */}
      {hasMultipleYears && classMonthlyData && (
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
          data={displayData}
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
                if (name === 'current') return [formatChartCurrency(numValue), `${currentYear}`];
                if (name === 'previous') return [formatChartCurrency(numValue), `${previousYear}`];
              }
              return [formatChartCurrency(numValue), name === 'revenue' ? 'Revenue' : 'Gross Profit'];
            }}
            cursor={{ fill: 'rgba(56, 189, 248, 0.05)' }}
          />
          {showYoY && (
            <Legend
              verticalAlign="top"
              height={30}
              formatter={(value) => (
                <span style={{ color: '#94A3B8', fontSize: 11 }}>
                  {value === 'current' ? currentYear : previousYear}
                </span>
              )}
            />
          )}
          {showYoY ? (
            <>
              <Bar
                dataKey="current"
                fill={CHART_COLORS.cyan}
                radius={[0, 4, 4, 0]}
                animationDuration={1000}
                animationEasing="ease-out"
              />
              <Bar
                dataKey="previous"
                fill={CHART_COLORS.purple}
                radius={[0, 4, 4, 0]}
                animationDuration={1000}
                animationEasing="ease-out"
                fillOpacity={0.5}
              />
            </>
          ) : (
            <Bar
              dataKey="revenue"
              radius={[0, 6, 6, 0]}
              animationDuration={1000}
              animationEasing="ease-out"
            >
              {chartData.map((entry, idx) => (
                <Cell key={`cell-${idx}`} fill={entry.color} fillOpacity={0.8} />
              ))}
              <LabelList
                dataKey="revenue"
                position="right"
                formatter={(value) => formatChartCurrency(typeof value === 'number' ? value : 0)}
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
