'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { ChartContainer, tooltipStyle, formatChartCurrency, CHART_COLORS } from './ChartContainer';

interface MonthlyData {
  year: number;
  month: number;
  monthName: string;
  revenue: number;
  cost: number;
  grossProfit: number;
  grossProfitPct: number;
  units: number;
  transactionCount: number;
}

interface RevenueAreaChartProps {
  data: MonthlyData[];
  index?: number;
}

export function RevenueAreaChart({ data, index = 0 }: RevenueAreaChartProps) {
  // Sort data by year and month
  const sortedData = [...data].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });

  // Format data for chart
  const chartData = sortedData.map(d => ({
    name: `${d.monthName} ${d.year}`,
    month: d.monthName,
    revenue: d.revenue,
    cost: d.cost,
    grossProfit: d.grossProfit,
    gpPct: d.grossProfitPct,
  }));

  return (
    <ChartContainer
      title="Monthly Revenue Trend"
      subtitle="Revenue, cost, and gross profit over time"
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
      }
      index={index}
      height={320}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS.cyan} stopOpacity={0.4} />
              <stop offset="95%" stopColor={CHART_COLORS.cyan} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS.orange} stopOpacity={0.3} />
              <stop offset="95%" stopColor={CHART_COLORS.orange} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS.emerald} stopOpacity={0.3} />
              <stop offset="95%" stopColor={CHART_COLORS.emerald} stopOpacity={0} />
            </linearGradient>
          </defs>
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
            tickFormatter={(value) => formatChartCurrency(value)}
          />
          <Tooltip
            {...tooltipStyle}
            formatter={(value, name) => [
              formatChartCurrency(typeof value === 'number' ? value : 0),
              name === 'revenue' ? 'Revenue' : name === 'cost' ? 'Cost' : 'Gross Profit',
            ]}
            labelFormatter={(label) => label}
            cursor={{ fill: 'rgba(56, 189, 248, 0.05)' }}
          />
          <Legend
            verticalAlign="top"
            height={36}
            formatter={(value) =>
              value === 'revenue' ? 'Revenue' : value === 'cost' ? 'Cost' : 'Gross Profit'
            }
            wrapperStyle={{ color: '#94A3B8', fontSize: 12 }}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke={CHART_COLORS.cyan}
            strokeWidth={3}
            fill="url(#revenueGradient)"
            dot={{ r: 4, strokeWidth: 2, fill: '#0F1123' }}
            activeDot={{ r: 6, strokeWidth: 0, fill: CHART_COLORS.cyan }}
            animationDuration={1500}
            animationEasing="ease-out"
          />
          <Area
            type="monotone"
            dataKey="cost"
            stroke={CHART_COLORS.orange}
            strokeWidth={2}
            fill="url(#costGradient)"
            dot={false}
            animationDuration={1500}
            animationEasing="ease-out"
            animationBegin={300}
          />
          <Area
            type="monotone"
            dataKey="grossProfit"
            stroke={CHART_COLORS.emerald}
            strokeWidth={2}
            fill="url(#profitGradient)"
            dot={false}
            animationDuration={1500}
            animationEasing="ease-out"
            animationBegin={600}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
