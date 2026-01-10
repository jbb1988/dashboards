'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { ChartContainer, tooltipStyle, formatChartCurrency, CLASS_COLOR_ARRAY } from './ChartContainer';

interface CustomerData {
  customer_name: string;
  total_revenue: number;
  total_gross_profit: number;
  avg_gross_profit_pct: number;
}

interface CustomerDonutProps {
  data: CustomerData[];
  index?: number;
}

export function CustomerDonut({ data, index = 0 }: CustomerDonutProps) {
  // Sort by revenue and take top 10
  const sortedData = [...data].sort((a, b) => b.total_revenue - a.total_revenue);
  const top10 = sortedData.slice(0, 10);
  const others = sortedData.slice(10);

  // Calculate "Others" total
  const othersRevenue = others.reduce((sum, c) => sum + c.total_revenue, 0);

  // Build chart data
  const chartData = top10.map((c, idx) => ({
    name: c.customer_name.length > 20 ? c.customer_name.substring(0, 20) + '...' : c.customer_name,
    fullName: c.customer_name,
    value: c.total_revenue,
    color: CLASS_COLOR_ARRAY[idx % CLASS_COLOR_ARRAY.length],
  }));

  if (othersRevenue > 0) {
    chartData.push({
      name: `Others (${others.length})`,
      fullName: `${others.length} other customers`,
      value: othersRevenue,
      color: '#475569',
    });
  }

  // Calculate total for center label
  const totalRevenue = chartData.reduce((sum, d) => sum + d.value, 0);

  // Custom label renderer
  const renderCustomizedLabel = (props: {
    cx?: number;
    cy?: number;
    midAngle?: number;
    innerRadius?: number;
    outerRadius?: number;
    percent?: number;
    name?: string;
  }) => {
    const { cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, percent = 0 } = props;
    if (percent < 0.05) return null; // Don't show label for small slices
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={10}
        fontWeight={600}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <ChartContainer
      title="Top Customers"
      subtitle={`${data.length} total customers | Top 10 shown`}
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      }
      index={index}
      height={320}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
            labelLine={false}
            label={renderCustomizedLabel}
            animationDuration={1000}
            animationEasing="ease-out"
          >
            {chartData.map((entry, idx) => (
              <Cell
                key={`cell-${idx}`}
                fill={entry.color}
                stroke="rgba(0,0,0,0.3)"
                strokeWidth={1}
              />
            ))}
          </Pie>
          <Tooltip
            {...tooltipStyle}
            formatter={(value) => [formatChartCurrency(typeof value === 'number' ? value : 0), 'Revenue']}
            labelFormatter={(_, payload) => {
              if (payload && payload.length > 0) {
                return (payload[0].payload as { fullName: string }).fullName;
              }
              return '';
            }}
          />
          <Legend
            layout="vertical"
            align="right"
            verticalAlign="middle"
            formatter={(value) => <span style={{ color: '#94A3B8', fontSize: 11 }}>{value}</span>}
            wrapperStyle={{ paddingLeft: 20 }}
          />
          {/* Center label */}
          <text
            x="50%"
            y="45%"
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#EAF2FF"
            fontSize={18}
            fontWeight={700}
          >
            {formatChartCurrency(totalRevenue)}
          </text>
          <text
            x="50%"
            y="55%"
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#64748B"
            fontSize={11}
          >
            Total Revenue
          </text>
        </PieChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
