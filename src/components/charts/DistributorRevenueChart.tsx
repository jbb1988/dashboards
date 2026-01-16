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

interface DistributorTrendData {
  month: string;
  [key: string]: number | string; // distributor names as keys with revenue values
}

interface DistributorRevenueTrendProps {
  data: DistributorTrendData[];
  distributorNames: string[];
  index?: number;
}

const DISTRIBUTOR_COLORS = [
  CHART_COLORS.teal,      // #14B8A6
  CHART_COLORS.cyan,      // #38BDF8
  CHART_COLORS.emerald,   // #22C55E
  CHART_COLORS.purple,    // #8B5CF6
  CHART_COLORS.orange,    // #F97316
  CHART_COLORS.blue,      // #3B82F6
  CHART_COLORS.pink,      // #EC4899
  CHART_COLORS.amber,     // #F59E0B
];

export function DistributorRevenueChart({
  data,
  distributorNames,
  index = 0
}: DistributorRevenueTrendProps) {
  // Ensure we have at least 3 months of data for meaningful trends
  const hasData = data.length >= 3;

  return (
    <ChartContainer
      title="Revenue Trend by Distributor"
      subtitle="Monthly revenue comparison across distributors"
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      }
      index={index}
      height={320}
    >
      {hasData ? (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              {distributorNames.slice(0, 8).map((name, idx) => (
                <linearGradient key={name} id={`gradient-${idx}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={DISTRIBUTOR_COLORS[idx % DISTRIBUTOR_COLORS.length]} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={DISTRIBUTOR_COLORS[idx % DISTRIBUTOR_COLORS.length]} stopOpacity={0} />
                </linearGradient>
              ))}
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
                name,
              ]}
              cursor={{ fill: 'rgba(20, 184, 166, 0.05)' }}
            />
            <Legend
              verticalAlign="top"
              height={36}
              wrapperStyle={{ color: '#94A3B8', fontSize: 12 }}
            />
            {distributorNames.slice(0, 8).map((name, idx) => (
              <Area
                key={name}
                type="monotone"
                dataKey={name}
                stroke={DISTRIBUTOR_COLORS[idx % DISTRIBUTOR_COLORS.length]}
                strokeWidth={idx === 0 ? 3 : 2}
                fill={`url(#gradient-${idx})`}
                dot={idx === 0 ? { r: 4, strokeWidth: 2, fill: '#0F1123' } : false}
                activeDot={{ r: 6, strokeWidth: 0, fill: DISTRIBUTOR_COLORS[idx % DISTRIBUTOR_COLORS.length] }}
                animationDuration={1500}
                animationEasing="ease-out"
                animationBegin={idx * 150}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-full flex items-center justify-center">
          <div className="text-center text-[#64748B]">
            <p className="text-[13px]">Insufficient data for trend analysis</p>
            <p className="text-[11px] mt-1">Select a longer time period or sync more data</p>
          </div>
        </div>
      )}
    </ChartContainer>
  );
}
