'use client';

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
  ReferenceLine,
} from 'recharts';
import { ChartContainer, tooltipStyle, formatChartCurrency, CHART_COLORS } from './ChartContainer';

interface MonthlyData {
  year: number;
  month: number;
  monthName: string;
  revenue: number;
}

interface BudgetData {
  year: number;
  month: number;
  class_name: string;
  budget_revenue: number;
}

interface BudgetVarianceChartProps {
  actualData: MonthlyData[];
  budgetData: BudgetData[];
  selectedYear?: number;
  index?: number;
}

export function BudgetVarianceChart({
  actualData,
  budgetData,
  selectedYear = 2025,
  index = 0,
}: BudgetVarianceChartProps) {
  // Filter to selected year
  const yearActual = actualData.filter(d => d.year === selectedYear);

  // Aggregate budget by month (sum across all classes)
  const budgetByMonth = budgetData
    .filter(d => d.year === selectedYear)
    .reduce((acc, d) => {
      if (!acc[d.month]) acc[d.month] = 0;
      acc[d.month] += d.budget_revenue;
      return acc;
    }, {} as Record<number, number>);

  // Build chart data for all 12 months
  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const chartData = MONTH_NAMES.map((monthName, idx) => {
    const month = idx + 1;
    const actualMonth = yearActual.find(d => d.month === month);
    const actual = actualMonth?.revenue || 0;
    const budget = budgetByMonth[month] || 0;
    const variance = actual - budget;
    const variancePct = budget > 0 ? ((actual - budget) / budget) * 100 : 0;

    return {
      name: monthName,
      actual,
      budget,
      variance,
      variancePct,
      isAboveBudget: variance >= 0,
    };
  });

  // Calculate totals for subtitle
  const totalActual = chartData.reduce((sum, d) => sum + d.actual, 0);
  const totalBudget = chartData.reduce((sum, d) => sum + d.budget, 0);
  const totalVariance = totalActual - totalBudget;
  const totalVariancePct = totalBudget > 0 ? ((totalActual - totalBudget) / totalBudget) * 100 : 0;

  return (
    <ChartContainer
      title="Budget vs Actual"
      subtitle={`${selectedYear} | Actual: ${formatChartCurrency(totalActual)} | Budget: ${formatChartCurrency(totalBudget)} | Variance: ${totalVariancePct >= 0 ? '+' : ''}${totalVariancePct.toFixed(1)}%`}
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      }
      index={index}
      height={320}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="aboveBudgetGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.emerald} stopOpacity={0.8} />
              <stop offset="100%" stopColor={CHART_COLORS.emerald} stopOpacity={0.4} />
            </linearGradient>
            <linearGradient id="belowBudgetGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.amber} stopOpacity={0.8} />
              <stop offset="100%" stopColor={CHART_COLORS.amber} stopOpacity={0.4} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey="name"
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
            formatter={(value, name) => {
              const numValue = typeof value === 'number' ? value : 0;
              if (name === 'actual') return [formatChartCurrency(numValue), 'Actual'];
              if (name === 'budget') return [formatChartCurrency(numValue), 'Budget'];
              return [formatChartCurrency(numValue), String(name)];
            }}
            labelFormatter={(label) => `${label} ${selectedYear}`}
            cursor={{ fill: 'rgba(56, 189, 248, 0.05)' }}
          />
          <Legend
            verticalAlign="top"
            height={36}
            formatter={(value) => (value === 'actual' ? 'Actual Revenue' : 'Budget Target')}
            wrapperStyle={{ color: '#94A3B8', fontSize: 12 }}
          />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
          <Bar
            dataKey="actual"
            radius={[6, 6, 0, 0]}
            animationDuration={1000}
            animationEasing="ease-out"
          >
            {chartData.map((entry, idx) => (
              <Cell
                key={`cell-${idx}`}
                fill={entry.isAboveBudget ? 'url(#aboveBudgetGradient)' : 'url(#belowBudgetGradient)'}
              />
            ))}
          </Bar>
          <Line
            type="monotone"
            dataKey="budget"
            stroke={CHART_COLORS.purple}
            strokeWidth={3}
            strokeDasharray="8 4"
            dot={{ r: 4, fill: CHART_COLORS.purple, strokeWidth: 0 }}
            activeDot={{ r: 6, strokeWidth: 0, fill: CHART_COLORS.purple }}
            animationDuration={1500}
            animationEasing="ease-out"
            animationBegin={500}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
