'use client';

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { ChartContainer, tooltipStyle, CHART_COLORS } from '../charts/ChartContainer';

// Array of colors for line charts
const COLOR_ARRAY = [
  CHART_COLORS.cyan,
  CHART_COLORS.emerald,
  CHART_COLORS.orange,
  CHART_COLORS.purple,
  CHART_COLORS.amber,
  CHART_COLORS.blue,
  CHART_COLORS.pink,
  CHART_COLORS.teal,
  CHART_COLORS.indigo,
  CHART_COLORS.red,
];

interface MonthlyTrendData {
  year: number;
  month: number;
  class_name: string;
  units: number;
  revenue: number;
}

interface UnitsMonthlyTrendProps {
  data: MonthlyTrendData[];
  title?: string;
  subtitle?: string;
  index?: number;
  topN?: number;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatNumber = (value: number): string => {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toLocaleString();
};

export function UnitsMonthlyTrend({
  data,
  title = 'Monthly Units Trend',
  subtitle = 'Top classes by units over time',
  index = 0,
  topN = 6,
}: UnitsMonthlyTrendProps) {
  // Find top N classes by total units
  const topClasses = useMemo(() => {
    const classMap = new Map<string, number>();

    for (const item of data) {
      const current = classMap.get(item.class_name) || 0;
      classMap.set(item.class_name, current + item.units);
    }

    return Array.from(classMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([className]) => className);
  }, [data, topN]);

  // Transform data for chart
  const chartData = useMemo(() => {
    // Group by year/month
    const monthMap = new Map<string, Record<string, number>>();

    for (const item of data) {
      // Only include top classes
      if (!topClasses.includes(item.class_name)) continue;

      const monthKey = `${item.year}-${String(item.month).padStart(2, '0')}`;
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          year: item.year,
          month: item.month,
          monthName: MONTH_NAMES[item.month - 1],
        });
      }

      const monthData = monthMap.get(monthKey)!;
      monthData[item.class_name] = (monthData[item.class_name] || 0) + item.units;
    }

    // Convert to array and sort
    return Array.from(monthMap.values())
      .sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      })
      .map(d => ({
        name: `${d.monthName} ${d.year}`,
        month: d.monthName,
        ...Object.fromEntries(topClasses.map(className => [className, d[className] || 0])),
      }));
  }, [data, topClasses]);

  return (
    <ChartContainer
      title={title}
      subtitle={subtitle}
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
      }
      index={index}
      height={320}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey="month"
            stroke="#64748B"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
          />
          <YAxis
            stroke="#64748B"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => formatNumber(value)}
          />
          <Tooltip
            {...tooltipStyle}
            formatter={(value, name) => [
              formatNumber(typeof value === 'number' ? value : 0),
              name,
            ]}
            labelFormatter={(label) => label}
            cursor={{ stroke: 'rgba(56, 189, 248, 0.3)', strokeWidth: 1 }}
          />
          <Legend
            verticalAlign="top"
            height={36}
            wrapperStyle={{ color: '#94A3B8', fontSize: 11 }}
          />
          {topClasses.map((className, idx) => (
            <Line
              key={className}
              type="monotone"
              dataKey={className}
              stroke={COLOR_ARRAY[idx % COLOR_ARRAY.length]}
              strokeWidth={2}
              dot={{ r: 3, strokeWidth: 2, fill: '#0F1123' }}
              activeDot={{ r: 5, strokeWidth: 0, fill: COLOR_ARRAY[idx % COLOR_ARRAY.length] }}
              animationDuration={1500}
              animationEasing="ease-out"
              animationBegin={idx * 100}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
