'use client';

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
} from 'recharts';
import { ChartContainer, tooltipStyle, formatChartCurrency, getClassColor } from './ChartContainer';

interface ClassData {
  class_name: string;
  total_revenue: number;
  total_cost: number;
  total_gross_profit: number;
  avg_gross_profit_pct: number;
}

interface ClassBarChartProps {
  data: ClassData[];
  index?: number;
}

export function ClassBarChart({ data, index = 0 }: ClassBarChartProps) {
  // Sort by revenue descending and take top 10
  const topClasses = [...data]
    .sort((a, b) => b.total_revenue - a.total_revenue)
    .slice(0, 10)
    .reverse(); // Reverse for horizontal bar chart (highest at top)

  const chartData = topClasses.map(d => ({
    name: d.class_name,
    revenue: d.total_revenue,
    profit: d.total_gross_profit,
    gpPct: d.avg_gross_profit_pct,
    color: getClassColor(d.class_name),
  }));

  return (
    <ChartContainer
      title="Revenue by Class"
      subtitle="Top 10 product classes by revenue"
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      }
      index={index}
      height={350}
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
            dataKey="name"
            stroke="#64748B"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={100}
          />
          <Tooltip
            {...tooltipStyle}
            formatter={(value, name) => [
              formatChartCurrency(typeof value === 'number' ? value : 0),
              name === 'revenue' ? 'Revenue' : 'Gross Profit',
            ]}
            cursor={{ fill: 'rgba(56, 189, 248, 0.05)' }}
          />
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
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
