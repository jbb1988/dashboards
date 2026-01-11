'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { ChartContainer, formatChartCurrency, CHART_COLORS } from './ChartContainer';

interface ConcentrationMetrics {
  hhi_index: number;
  hhi_interpretation: 'diversified' | 'moderate' | 'concentrated';
  top_customer_pct: number;
  top_customer_name: string;
  top_3_concentration: number;
  top_3_names: string[];
  customers_for_80_pct: number;
  total_customers: number;
  total_revenue: number;
  segments: {
    tier: 'platinum' | 'gold' | 'silver' | 'bronze';
    customer_count: number;
    total_revenue: number;
    pct_of_total: number;
    threshold_description: string;
    customers?: Array<{ name: string; revenue: number; pct: number }>;
  }[];
}

interface ConcentrationChartProps {
  data: ConcentrationMetrics;
  index?: number;
}

const TIER_COLORS = {
  platinum: '#E5E4E2',
  gold: '#FFD700',
  silver: '#C0C0C0',
  bronze: '#CD7F32',
};

const TIER_LABELS = {
  platinum: 'Platinum',
  gold: 'Gold',
  silver: 'Silver',
  bronze: 'Bronze',
};

function getHHIColor(hhi: number): string {
  if (hhi < 1500) return CHART_COLORS.emerald;
  if (hhi < 2500) return CHART_COLORS.amber;
  return CHART_COLORS.red;
}

function getHHIRiskLevel(interpretation: string): { text: string; color: string } {
  switch (interpretation) {
    case 'diversified':
      return { text: 'Low Risk', color: 'text-green-400' };
    case 'moderate':
      return { text: 'Medium Risk', color: 'text-amber-400' };
    case 'concentrated':
      return { text: 'High Risk', color: 'text-red-400' };
    default:
      return { text: 'Unknown', color: 'text-gray-400' };
  }
}

export function ConcentrationChart({ data, index = 0 }: ConcentrationChartProps) {
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const pieData = useMemo(() => {
    return data.segments.map(segment => ({
      name: TIER_LABELS[segment.tier],
      value: segment.total_revenue,
      pct: segment.pct_of_total,
      count: segment.customer_count,
      tier: segment.tier,
      description: segment.threshold_description,
      color: TIER_COLORS[segment.tier],
      customers: segment.customers || [],
    }));
  }, [data.segments]);

  const hhiColor = getHHIColor(data.hhi_index);
  const riskLevel = getHHIRiskLevel(data.hhi_interpretation);

  const selectedSegment = selectedTier ? pieData.find(p => p.tier === selectedTier) : null;

  const handleSegmentClick = (entry: typeof pieData[0], idx: number) => {
    if (selectedTier === entry.tier) {
      setSelectedTier(null);
    } else {
      setSelectedTier(entry.tier);
    }
  };

  return (
    <ChartContainer
      title="Revenue Concentration"
      subtitle={`HHI: ${data.hhi_index.toLocaleString()} • ${data.hhi_interpretation}`}
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
        </svg>
      }
      index={index}
      height={380}
    >
      <div className="flex h-full">
        {/* Donut Chart with center label */}
        <div className="flex-1 flex items-center justify-center">
          <div className="relative" style={{ width: 220, height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={activeIndex !== null ? 105 : 95}
                  paddingAngle={2}
                  dataKey="value"
                  animationDuration={800}
                  animationEasing="ease-out"
                  onClick={(_, idx) => handleSegmentClick(pieData[idx], idx)}
                  onMouseEnter={(_, idx) => setActiveIndex(idx)}
                  onMouseLeave={() => setActiveIndex(null)}
                  style={{ cursor: 'pointer' }}
                >
                  {pieData.map((entry, idx) => (
                    <Cell
                      key={`cell-${idx}`}
                      fill={entry.color}
                      fillOpacity={selectedTier && selectedTier !== entry.tier ? 0.3 : 0.85}
                      stroke={selectedTier === entry.tier ? entry.color : 'rgba(0,0,0,0.3)'}
                      strokeWidth={selectedTier === entry.tier ? 3 : 1}
                    />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const entry = payload[0].payload;
                    return (
                      <div className="bg-[#1B1F39] border border-white/10 rounded-xl p-4 shadow-xl z-50">
                        <p className="text-white font-semibold mb-2 flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                          {entry.name} Tier
                        </p>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between gap-4">
                            <span className="text-[#64748B]">Revenue:</span>
                            <span className="text-white font-medium">{formatChartCurrency(entry.value)}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-[#64748B]">% of Total:</span>
                            <span className="text-white">{entry.pct.toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-[#64748B]">Customers:</span>
                            <span className="text-white">{entry.count}</span>
                          </div>
                          <p className="text-[#64748B] text-[11px] pt-1 border-t border-white/10">
                            {entry.description}
                          </p>
                          <p className="text-cyan-400 text-[10px] pt-1">
                            Click to view details
                          </p>
                        </div>
                      </div>
                    );
                  }}
                  position={{ x: 10, y: 10 }}
                  wrapperStyle={{ zIndex: 100 }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Center HHI Display - absolutely centered in the donut hole */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <div className="text-3xl font-bold" style={{ color: hhiColor }}>
                  {data.hhi_index.toLocaleString()}
                </div>
                <div className={`text-xs font-medium ${riskLevel.color}`}>
                  {riskLevel.text}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Panel / Drill-down Panel */}
        <div className="w-44 pl-4 flex flex-col justify-center gap-3">
          <AnimatePresence mode="wait">
            {selectedSegment ? (
              /* Drill-down view */
              <motion.div
                key="drilldown"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-2"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedSegment.color }} />
                    <span className="text-white font-semibold text-sm">{selectedSegment.name}</span>
                  </div>
                  <button
                    onClick={() => setSelectedTier(null)}
                    className="text-[#64748B] hover:text-white text-xs"
                  >
                    ✕
                  </button>
                </div>

                <div className="bg-white/[0.03] rounded-lg p-2 text-center">
                  <div className="text-[10px] text-[#64748B] uppercase">Revenue</div>
                  <div className="text-white font-bold">{formatChartCurrency(selectedSegment.value)}</div>
                  <div className="text-cyan-400 text-sm font-medium">{selectedSegment.pct.toFixed(1)}%</div>
                </div>

                <div className="text-[10px] text-[#64748B] uppercase mt-2">
                  {selectedSegment.count} Customers
                </div>

                {/* Customer list from segment data or top 3 names if available */}
                <div className="space-y-1 max-h-[140px] overflow-y-auto">
                  {selectedSegment.tier === 'platinum' && data.top_3_names ? (
                    data.top_3_names.map((name, idx) => (
                      <div key={idx} className="bg-white/[0.02] rounded px-2 py-1.5">
                        <div className="text-white text-[11px] truncate" title={name}>{name}</div>
                      </div>
                    ))
                  ) : selectedSegment.customers && selectedSegment.customers.length > 0 ? (
                    selectedSegment.customers.slice(0, 5).map((customer, idx) => (
                      <div key={idx} className="bg-white/[0.02] rounded px-2 py-1.5">
                        <div className="text-white text-[11px] truncate" title={customer.name}>{customer.name}</div>
                        <div className="text-[#64748B] text-[10px]">{formatChartCurrency(customer.revenue)}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-[#64748B] text-[11px] italic py-2">
                      {selectedSegment.description}
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              /* Default stats view */
              <motion.div
                key="stats"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-3"
              >
                {/* Top Customer */}
                <div className="bg-white/[0.03] rounded-lg p-3">
                  <div className="text-[10px] text-[#64748B] uppercase tracking-wide mb-1">Top Customer</div>
                  <div className="text-white text-sm font-medium truncate" title={data.top_customer_name}>
                    {data.top_customer_name}
                  </div>
                  <div className={`text-lg font-bold ${data.top_customer_pct > 25 ? 'text-red-400' : data.top_customer_pct > 15 ? 'text-amber-400' : 'text-green-400'}`}>
                    {data.top_customer_pct.toFixed(1)}%
                  </div>
                </div>

                {/* Top 3 */}
                <div className="bg-white/[0.03] rounded-lg p-3">
                  <div className="text-[10px] text-[#64748B] uppercase tracking-wide mb-1">Top 3 Customers</div>
                  <div className={`text-lg font-bold ${data.top_3_concentration > 50 ? 'text-red-400' : data.top_3_concentration > 35 ? 'text-amber-400' : 'text-green-400'}`}>
                    {data.top_3_concentration.toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-[#64748B] mt-1">
                    of total revenue
                  </div>
                </div>

                {/* Pareto */}
                <div className="bg-white/[0.03] rounded-lg p-3">
                  <div className="text-[10px] text-[#64748B] uppercase tracking-wide mb-1">80% Revenue From</div>
                  <div className="text-lg font-bold text-cyan-400">
                    {data.customers_for_80_pct}
                  </div>
                  <div className="text-[10px] text-[#64748B] mt-1">
                    of {data.total_customers} customers
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Tier Legend - clickable */}
      <div className="flex items-center justify-center gap-4 mt-2 text-[10px]">
        {pieData.map(tier => (
          <button
            key={tier.tier}
            onClick={() => handleSegmentClick(tier, pieData.indexOf(tier))}
            className={`flex items-center gap-1.5 px-2 py-1 rounded transition-all ${
              selectedTier === tier.tier
                ? 'bg-white/10 ring-1 ring-white/20'
                : 'hover:bg-white/5'
            }`}
          >
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tier.color }} />
            <span className={selectedTier === tier.tier ? 'text-white' : 'text-[#64748B]'}>
              {tier.name} ({tier.count})
            </span>
          </button>
        ))}
      </div>
    </ChartContainer>
  );
}
