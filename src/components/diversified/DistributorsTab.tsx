'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis,
  Cell,
} from 'recharts';
import { formatLocationDisplay } from '@/lib/distributorAnalysis';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface GrowthScoreComponents {
  revenueGap: number;
  trendScore: number;
  categoryGap: number;
  marginHealth: number;
}

interface GrowthScore {
  overall: number;
  components: GrowthScoreComponents;
  tier: 'high' | 'medium' | 'low';
}

interface DistributorLocation {
  customer_id: string;
  customer_name: string;
  location: string;
  state: string;
  location_confidence: number;
  revenue: number;
  prior_revenue: number;
  cost: number;
  gross_profit: number;
  margin_pct: number;
  yoy_change_pct: number;
  units: number;
  categories: string[];
  category_count: number;
  last_purchase_date: string | null;
  growth_score?: GrowthScore;
  is_opportunity: boolean;
}

interface DistributorData {
  distributor_name: string;
  total_revenue: number;
  prior_revenue: number;
  yoy_change_pct: number;
  location_count: number;
  avg_revenue_per_location: number;
  total_margin_pct: number;
  category_penetration: number;
  growth_opportunities: number;
  locations: DistributorLocation[];
}

interface DistributorsResponse {
  distributors: DistributorData[];
  summary: {
    total_distributors: number;
    total_locations: number;
    total_revenue: number;
    avg_revenue_per_location: number;
    total_growth_opportunities: number;
    opportunities_by_tier: {
      high: number;
      medium: number;
      low: number;
    };
  };
  periods: {
    current: { start: string; end: string };
    prior: { start: string; end: string };
  };
  categories: string[];
}

interface DistributorsTabProps {
  onCustomerClick?: (customerId: string, customerName: string) => void;
  selectedYears?: number[];
  selectedMonths?: number[];
  selectedClass?: string | null;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const TIER_CONFIG = {
  high: { label: 'High', color: '#EF4444', bg: 'bg-red-500/10', text: 'text-red-400' },
  medium: { label: 'Medium', color: '#F59E0B', bg: 'bg-amber-500/10', text: 'text-amber-400' },
  low: { label: 'Low', color: '#6B7280', bg: 'bg-gray-500/10', text: 'text-gray-400' },
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${Math.round(value).toLocaleString()}`;
}

function formatPercentage(value: number, decimals: number = 1): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

function getYoYColor(value: number): string {
  if (value > 0) return 'text-green-400';
  if (value < 0) return 'text-red-400';
  return 'text-gray-400';
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function DistributorsTab({
  onCustomerClick,
  selectedYears,
  selectedMonths,
  selectedClass
}: DistributorsTabProps) {
  const [data, setData] = useState<DistributorsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDistributor, setExpandedDistributor] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'revenue' | 'growth_opps' | 'yoy'>('revenue');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();

        if (selectedYears && selectedYears.length > 0) {
          params.append('years', selectedYears.join(','));
        }
        if (selectedMonths && selectedMonths.length > 0) {
          params.append('months', selectedMonths.join(','));
        }
        if (selectedClass) {
          params.append('className', selectedClass);
        }

        const response = await fetch(`/api/diversified/distributors?${params}`);
        if (!response.ok) throw new Error('Failed to fetch distributor data');

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        console.error('Error fetching distributor data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedYears, selectedMonths, selectedClass]);

  // Sort distributors
  const sortedDistributors = useMemo(() => {
    if (!data) return [];

    const sorted = [...data.distributors];

    sorted.sort((a, b) => {
      let aVal: number;
      let bVal: number;

      switch (sortBy) {
        case 'revenue':
          aVal = a.total_revenue;
          bVal = b.total_revenue;
          break;
        case 'growth_opps':
          aVal = a.growth_opportunities;
          bVal = b.growth_opportunities;
          break;
        case 'yoy':
          aVal = a.yoy_change_pct;
          bVal = b.yoy_change_pct;
          break;
        default:
          aVal = a.total_revenue;
          bVal = b.total_revenue;
      }

      return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
    });

    return sorted;
  }, [data, sortBy, sortDir]);

  // Toggle sort
  const handleSort = (column: 'revenue' | 'growth_opps' | 'yoy') => {
    if (sortBy === column) {
      setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(column);
      setSortDir('desc');
    }
  };

  // =============================================================================
  // RENDER LOADING/ERROR STATES
  // =============================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="flex items-center gap-3 text-[#94A3B8]">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>Loading distributor data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="text-center">
          <div className="text-red-400 text-lg mb-2">Error loading distributor data</div>
          <div className="text-[#64748B] text-sm">{error}</div>
        </div>
      </div>
    );
  }

  if (!data || data.distributors.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="text-center text-[#64748B]">
          No distributor data found for the selected filters
        </div>
      </div>
    );
  }

  // =============================================================================
  // PREPARE CHART DATA
  // =============================================================================

  // Bar chart data - top 10 distributors by revenue
  const barChartData = sortedDistributors.slice(0, 10).map(d => ({
    name: d.distributor_name,
    revenue: d.total_revenue,
    yoy: d.yoy_change_pct,
    locations: d.location_count
  })).reverse();  // Reverse for horizontal bar chart

  // Scatter chart data - all locations with growth scores
  const scatterData: Array<{ x: number; y: number; name: string; tier: string; revenue: number }> = [];
  for (const dist of data.distributors) {
    for (const loc of dist.locations) {
      if (loc.growth_score) {
        scatterData.push({
          x: loc.revenue,
          y: loc.growth_score.overall,
          name: `${dist.distributor_name} - ${formatLocationDisplay({
            location: loc.location,
            state: loc.state,
            confidence: loc.location_confidence,
            rawName: loc.customer_name
          })}`,
          tier: loc.growth_score.tier,
          revenue: loc.revenue
        });
      }
    }
  }

  // =============================================================================
  // RENDER MAIN UI
  // =============================================================================

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Total Distributors */}
        <div className="bg-[#1E293B] rounded-lg p-4 border border-white/[0.08]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[#94A3B8] text-xs font-medium">Total Distributors</span>
            <svg className="w-4 h-4 text-[#14B8A6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div className="text-2xl font-bold text-[#14B8A6]">
            {data.summary.total_distributors}
          </div>
        </div>

        {/* Total Locations */}
        <div className="bg-[#1E293B] rounded-lg p-4 border border-white/[0.08]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[#94A3B8] text-xs font-medium">Total Locations</span>
            <svg className="w-4 h-4 text-[#14B8A6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div className="text-2xl font-bold text-[#14B8A6]">
            {data.summary.total_locations}
          </div>
        </div>

        {/* Total Revenue */}
        <div className="bg-[#1E293B] rounded-lg p-4 border border-white/[0.08]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[#94A3B8] text-xs font-medium">Total Revenue</span>
            <svg className="w-4 h-4 text-[#14B8A6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-2xl font-bold text-[#14B8A6]">
            {formatCurrency(data.summary.total_revenue)}
          </div>
        </div>

        {/* Avg Revenue/Location */}
        <div className="bg-[#1E293B] rounded-lg p-4 border border-white/[0.08]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[#94A3B8] text-xs font-medium">Avg/Location</span>
            <svg className="w-4 h-4 text-[#14B8A6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div className="text-2xl font-bold text-[#14B8A6]">
            {formatCurrency(data.summary.avg_revenue_per_location)}
          </div>
        </div>

        {/* Growth Opportunities */}
        <div className="bg-[#1E293B] rounded-lg p-4 border border-white/[0.08]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[#94A3B8] text-xs font-medium">Opportunities</span>
            <svg className="w-4 h-4 text-[#14B8A6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div className="text-2xl font-bold text-[#14B8A6]">
            {data.summary.total_growth_opportunities}
          </div>
          <div className="flex gap-2 mt-2 text-[10px]">
            <span className="text-red-400">{data.summary.opportunities_by_tier.high} High</span>
            <span className="text-amber-400">{data.summary.opportunities_by_tier.medium} Med</span>
            <span className="text-gray-400">{data.summary.opportunities_by_tier.low} Low</span>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distributor Revenue Bar Chart */}
        <div className="bg-[#1E293B] rounded-lg p-6 border border-white/[0.08]">
          <h3 className="text-[15px] font-semibold text-white mb-4">Distributor Revenue Comparison</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={barChartData} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
              <XAxis type="number" stroke="#64748B" tickFormatter={formatCurrency} />
              <YAxis type="category" dataKey="name" stroke="#64748B" width={90} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1B1F39',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  padding: '12px'
                }}
                formatter={(value: any, name?: string) => {
                  if (name === 'revenue') return [formatCurrency(Number(value)), 'Revenue'];
                  return [value, name];
                }}
                labelFormatter={(label) => `${label}`}
              />
              <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                {barChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.yoy > 0 ? '#22C55E' : entry.yoy < 0 ? '#EF4444' : '#6B7280'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Growth Opportunity Scatter Plot */}
        <div className="bg-[#1E293B] rounded-lg p-6 border border-white/[0.08]">
          <h3 className="text-[15px] font-semibold text-white mb-4">Growth Opportunity Matrix</h3>
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <XAxis
                type="number"
                dataKey="x"
                name="Revenue"
                stroke="#64748B"
                tickFormatter={formatCurrency}
                scale="log"
                domain={['auto', 'auto']}
              />
              <YAxis type="number" dataKey="y" name="Growth Score" stroke="#64748B" domain={[0, 100]} />
              <ZAxis type="number" dataKey="revenue" range={[50, 400]} />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                contentStyle={{
                  backgroundColor: '#1B1F39',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  padding: '12px'
                }}
                formatter={(value: any, name?: string) => {
                  if (name === 'Revenue') return formatCurrency(Number(value));
                  if (name === 'Growth Score') return `${value}/100`;
                  return value;
                }}
              />
              <Scatter name="Locations" data={scatterData} fill="#8884d8">
                {scatterData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={TIER_CONFIG[entry.tier as keyof typeof TIER_CONFIG].color} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-4 text-xs justify-center">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-[#94A3B8]">High Opportunity</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-[#94A3B8]">Medium</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-500" />
              <span className="text-[#94A3B8]">Low</span>
            </div>
          </div>
        </div>
      </div>

      {/* Distributors Table */}
      <div className="bg-[#1E293B] rounded-lg border border-white/[0.08] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.08]">
                <th className="px-4 py-3 text-left text-xs font-medium text-[#94A3B8] uppercase tracking-wider">
                  Distributor
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#94A3B8] uppercase tracking-wider">
                  Locations
                </th>
                <th
                  className="px-4 py-3 text-right text-xs font-medium text-[#94A3B8] uppercase tracking-wider cursor-pointer hover:text-white"
                  onClick={() => handleSort('revenue')}
                >
                  Revenue {sortBy === 'revenue' && (sortDir === 'desc' ? '▼' : '▲')}
                </th>
                <th
                  className="px-4 py-3 text-right text-xs font-medium text-[#94A3B8] uppercase tracking-wider cursor-pointer hover:text-white"
                  onClick={() => handleSort('yoy')}
                >
                  YoY {sortBy === 'yoy' && (sortDir === 'desc' ? '▼' : '▲')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[#94A3B8] uppercase tracking-wider">
                  Margin %
                </th>
                <th
                  className="px-4 py-3 text-right text-xs font-medium text-[#94A3B8] uppercase tracking-wider cursor-pointer hover:text-white"
                  onClick={() => handleSort('growth_opps')}
                >
                  Opps {sortBy === 'growth_opps' && (sortDir === 'desc' ? '▼' : '▲')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedDistributors.map((distributor) => (
                <React.Fragment key={distributor.distributor_name}>
                  {/* Distributor Row */}
                  <tr
                    className="border-b border-white/[0.04] hover:bg-white/[0.02] cursor-pointer transition-colors"
                    onClick={() =>
                      setExpandedDistributor(
                        expandedDistributor === distributor.distributor_name ? null : distributor.distributor_name
                      )
                    }
                  >
                    <td className="px-4 py-3 text-sm font-medium text-white">
                      <div className="flex items-center gap-2">
                        <span className="text-[#94A3B8]">
                          {expandedDistributor === distributor.distributor_name ? '▼' : '▶'}
                        </span>
                        {distributor.distributor_name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#94A3B8]">{distributor.location_count}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-white">
                      {formatCurrency(distributor.total_revenue)}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right font-medium ${getYoYColor(distributor.yoy_change_pct)}`}>
                      {formatPercentage(distributor.yoy_change_pct)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-[#94A3B8]">
                      {distributor.total_margin_pct.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {distributor.growth_opportunities > 0 ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-[#14B8A6]/20 text-[#14B8A6]">
                          {distributor.growth_opportunities}
                        </span>
                      ) : (
                        <span className="text-[#94A3B8]">-</span>
                      )}
                    </td>
                  </tr>

                  {/* Expanded Locations */}
                  <AnimatePresence>
                    {expandedDistributor === distributor.distributor_name && (
                      <tr>
                        <td colSpan={6} className="p-0">
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="bg-[#0F172A] px-4 py-2">
                              <table className="w-full">
                                <thead>
                                  <tr className="border-b border-white/[0.04]">
                                    <th className="px-4 py-2 text-left text-xs font-medium text-[#64748B] uppercase">Location</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-[#64748B] uppercase">Revenue</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-[#64748B] uppercase">YoY</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-[#64748B] uppercase">Margin</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-[#64748B] uppercase">Categories</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-[#64748B] uppercase">Score</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {distributor.locations.map((location) => (
                                    <tr
                                      key={location.customer_id}
                                      className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                                    >
                                      <td className="px-4 py-2 text-sm">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onCustomerClick?.(location.customer_id, location.customer_name);
                                          }}
                                          className="text-[#14B8A6] hover:text-[#0D9488] transition-colors text-left"
                                        >
                                          {formatLocationDisplay({
                                            location: location.location,
                                            state: location.state,
                                            confidence: location.location_confidence,
                                            rawName: location.customer_name
                                          })}
                                        </button>
                                      </td>
                                      <td className="px-4 py-2 text-sm text-right text-white">
                                        {formatCurrency(location.revenue)}
                                      </td>
                                      <td className={`px-4 py-2 text-sm text-right font-medium ${getYoYColor(location.yoy_change_pct)}`}>
                                        {formatPercentage(location.yoy_change_pct)}
                                      </td>
                                      <td className="px-4 py-2 text-sm text-right text-[#94A3B8]">
                                        {location.margin_pct.toFixed(1)}%
                                      </td>
                                      <td className="px-4 py-2 text-sm text-right text-[#94A3B8]">
                                        {location.category_count}
                                      </td>
                                      <td className="px-4 py-2 text-sm text-right">
                                        {location.growth_score && (
                                          <span
                                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                              TIER_CONFIG[location.growth_score.tier].bg
                                            } ${TIER_CONFIG[location.growth_score.tier].text}`}
                                          >
                                            {location.growth_score.overall} ({TIER_CONFIG[location.growth_score.tier].label})
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </motion.div>
                        </td>
                      </tr>
                    )}
                  </AnimatePresence>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Fix missing React import for Fragment
import React from 'react';
