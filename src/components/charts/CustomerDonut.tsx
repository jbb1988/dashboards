'use client';

import { useState } from 'react';
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

// Distributor patterns to match customer names
const DISTRIBUTORS = [
  { name: 'Ferguson', patterns: ['ferguson', 'ferguson enterprises', 'ferguson waterworks'] },
  { name: 'Core & Main', patterns: ['core & main', 'core and main', 'core&main'] },
  { name: 'Fortiline', patterns: ['fortiline'] },
  { name: 'Consolidated Pipe', patterns: ['consolidated pipe', 'consolidated supply'] },
];

// Check if a customer belongs to a distributor
function getDistributor(customerName: string): string | null {
  const lowerName = customerName.toLowerCase();
  for (const dist of DISTRIBUTORS) {
    for (const pattern of dist.patterns) {
      if (lowerName.includes(pattern)) {
        return dist.name;
      }
    }
  }
  return null;
}

// Roll up customers by distributor
function rollUpByDistributor(data: CustomerData[]): CustomerData[] {
  const distributorMap = new Map<string, CustomerData>();
  const nonDistributors: CustomerData[] = [];

  for (const customer of data) {
    const distributor = getDistributor(customer.customer_name);

    if (distributor) {
      const existing = distributorMap.get(distributor);
      if (existing) {
        existing.total_revenue += customer.total_revenue;
        existing.total_gross_profit += customer.total_gross_profit;
        // Weighted average for GP%
        existing.avg_gross_profit_pct = existing.total_revenue > 0
          ? (existing.total_gross_profit / existing.total_revenue) * 100
          : 0;
      } else {
        distributorMap.set(distributor, {
          customer_name: distributor,
          total_revenue: customer.total_revenue,
          total_gross_profit: customer.total_gross_profit,
          avg_gross_profit_pct: customer.total_revenue > 0
            ? (customer.total_gross_profit / customer.total_revenue) * 100
            : 0,
        });
      }
    } else {
      nonDistributors.push(customer);
    }
  }

  // Combine distributors with non-distributors
  return [...Array.from(distributorMap.values()), ...nonDistributors];
}

// Custom tooltip component for better control
function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { fullName: string; value: number; locationCount?: number } }> }) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;

  return (
    <div
      style={{
        backgroundColor: '#1B1F39',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        padding: '12px 16px',
      }}
    >
      <p style={{ color: '#fff', fontWeight: 600, marginBottom: 4, fontSize: 13 }}>
        {data.fullName}
      </p>
      <p style={{ color: '#38BDF8', fontSize: 14, fontWeight: 600 }}>
        {formatChartCurrency(data.value)}
      </p>
      {data.locationCount && data.locationCount > 1 && (
        <p style={{ color: '#64748B', fontSize: 11, marginTop: 4 }}>
          {data.locationCount} locations combined
        </p>
      )}
    </div>
  );
}

export function CustomerDonut({ data, index = 0 }: CustomerDonutProps) {
  const [showDistributorRollup, setShowDistributorRollup] = useState(false);

  // Process data based on toggle
  const processedData = showDistributorRollup ? rollUpByDistributor(data) : data;

  // Count distributor locations for tooltip
  const distributorLocationCounts = new Map<string, number>();
  if (showDistributorRollup) {
    for (const customer of data) {
      const distributor = getDistributor(customer.customer_name);
      if (distributor) {
        distributorLocationCounts.set(distributor, (distributorLocationCounts.get(distributor) || 0) + 1);
      }
    }
  }

  // Sort by revenue and take top 10
  const sortedData = [...processedData].sort((a, b) => b.total_revenue - a.total_revenue);
  const top10 = sortedData.slice(0, 10);
  const others = sortedData.slice(10);

  // Calculate "Others" total
  const othersRevenue = others.reduce((sum, c) => sum + c.total_revenue, 0);

  // Build chart data
  const chartData = top10.map((c, idx) => ({
    name: c.customer_name.length > 18 ? c.customer_name.substring(0, 18) + '...' : c.customer_name,
    fullName: c.customer_name,
    value: c.total_revenue,
    color: CLASS_COLOR_ARRAY[idx % CLASS_COLOR_ARRAY.length],
    locationCount: distributorLocationCounts.get(c.customer_name) || undefined,
  }));

  if (othersRevenue > 0) {
    chartData.push({
      name: `Others (${others.length})`,
      fullName: `${others.length} other customers`,
      value: othersRevenue,
      color: '#475569',
      locationCount: undefined,
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

  // Count how many distributor locations are in the data
  const distributorCount = DISTRIBUTORS.reduce((count, dist) => {
    const matches = data.filter(c => getDistributor(c.customer_name) === dist.name);
    return count + (matches.length > 1 ? matches.length : 0);
  }, 0);

  return (
    <ChartContainer
      title="Top Customers"
      subtitle={`${processedData.length} ${showDistributorRollup ? 'entities' : 'customers'} | Top 10 shown`}
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      }
      index={index}
      height={360}
    >
      {/* Distributor Toggle */}
      {distributorCount > 0 && (
        <div className="flex items-center justify-end mb-2 -mt-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-[11px] text-[#64748B]">Roll up distributors</span>
            <button
              onClick={() => setShowDistributorRollup(!showDistributorRollup)}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                showDistributorRollup ? 'bg-[#38BDF8]' : 'bg-[#334155]'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  showDistributorRollup ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </label>
        </div>
      )}

      <div className="relative w-full h-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="40%"
              cy="50%"
              innerRadius={55}
              outerRadius={90}
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
            <Tooltip content={<CustomTooltip />} />
            <Legend
              layout="vertical"
              align="right"
              verticalAlign="middle"
              formatter={(value) => <span style={{ color: '#94A3B8', fontSize: 11 }}>{value}</span>}
              wrapperStyle={{ paddingLeft: 10, right: 0 }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label - positioned absolutely to ensure visibility */}
        <div
          className="absolute pointer-events-none"
          style={{
            left: '40%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div className="text-center">
            <div className="text-[#EAF2FF] text-[16px] font-bold">
              {formatChartCurrency(totalRevenue)}
            </div>
            <div className="text-[#64748B] text-[10px]">
              Total Revenue
            </div>
          </div>
        </div>
      </div>
    </ChartContainer>
  );
}
