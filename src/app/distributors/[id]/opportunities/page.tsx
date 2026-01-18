'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';

interface OpportunityLocation {
  customer_id: string;
  customer_name: string;
  location: string;
  state: string;
  revenue: number;
  prior_revenue: number;
  yoy_change_pct: number;
  margin_pct: number;
  category_count: number;
  last_purchase_date: string | null;
  growth_score?: {
    overall: number;
    category_diversity: number;
    revenue_consistency: number;
    margin_quality: number;
  };
  opportunity_reasons: string[];
}

interface OpportunityData {
  distributor_name: string;
  total_opportunities: number;
  opportunities: OpportunityLocation[];
  summary: {
    bottom_25_pct: number;
    yoy_decline: number;
    high_growth_score: number;
  };
}

export default function DistributorOpportunitiesPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const distributorId = params.id as string;

  const [data, setData] = useState<OpportunityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<'revenue' | 'yoy' | 'score' | 'categories'>('revenue');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Get filter params
  const years = searchParams.get('years')?.split(',').map(Number) || [];
  const months = searchParams.get('months')?.split(',').map(Number) || [];
  const className = searchParams.get('className');

  useEffect(() => {
    fetchOpportunities();
  }, [distributorId, years, months, className]);

  const fetchOpportunities = async () => {
    setLoading(true);
    try {
      // Build query params
      const params = new URLSearchParams();
      if (years.length > 0) params.set('years', years.join(','));
      if (months.length > 0) params.set('months', months.join(','));
      if (className) params.set('className', className);
      params.set('view', 'opportunities');

      const url = `/api/diversified/distributors/${distributorId}?${params.toString()}`;
      const response = await fetch(url);
      const result = await response.json();

      // Filter locations to only opportunities
      const opportunities = result.locations.filter((loc: any) => loc.is_opportunity);

      // Determine reasons for each opportunity
      const sortedByRevenue = [...result.locations].sort((a: any, b: any) => a.revenue - b.revenue);
      const percentile25Index = Math.floor(sortedByRevenue.length * 0.25);
      const percentile25Revenue = sortedByRevenue[percentile25Index]?.revenue || 0;

      const opportunitiesWithReasons = opportunities.map((loc: any) => {
        const reasons: string[] = [];
        if (loc.revenue <= percentile25Revenue) {
          reasons.push('Bottom 25% revenue');
        }
        if (loc.yoy_change_pct <= -15) {
          reasons.push(`${loc.yoy_change_pct.toFixed(1)}% YoY decline`);
        }
        if ((loc.growth_score?.overall || 0) >= 35) {
          reasons.push(`High growth score (${loc.growth_score?.overall || 0})`);
        }
        return { ...loc, opportunity_reasons: reasons };
      });

      // Calculate summary
      const summary = {
        bottom_25_pct: opportunitiesWithReasons.filter((loc: any) =>
          loc.opportunity_reasons.some((r: string) => r.includes('Bottom 25%'))
        ).length,
        yoy_decline: opportunitiesWithReasons.filter((loc: any) =>
          loc.opportunity_reasons.some((r: string) => r.includes('decline'))
        ).length,
        high_growth_score: opportunitiesWithReasons.filter((loc: any) =>
          loc.opportunity_reasons.some((r: string) => r.includes('growth score'))
        ).length,
      };

      setData({
        distributor_name: result.distributor_name,
        total_opportunities: opportunities.length,
        opportunities: opportunitiesWithReasons,
        summary,
      });
    } catch (error) {
      console.error('Error fetching opportunities:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'revenue' ? 'asc' : 'desc');
    }
  };

  const sortedOpportunities = data ? [...data.opportunities].sort((a, b) => {
    let aVal: number, bVal: number;

    switch (sortField) {
      case 'revenue':
        aVal = a.revenue;
        bVal = b.revenue;
        break;
      case 'yoy':
        aVal = a.yoy_change_pct;
        bVal = b.yoy_change_pct;
        break;
      case 'score':
        aVal = a.growth_score?.overall || 0;
        bVal = b.growth_score?.overall || 0;
        break;
      case 'categories':
        aVal = a.category_count;
        bVal = b.category_count;
        break;
      default:
        return 0;
    }

    return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
  }) : [];

  const formatCurrency = (value: number): string => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const formatPercent = (value: number): string => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  const handleLocationClick = (customerId: string) => {
    // Build URL with current filter params
    const params = new URLSearchParams();
    if (years.length > 0) params.set('years', years.join(','));
    if (months.length > 0) params.set('months', months.join(','));
    if (className) params.set('className', className);

    const url = params.toString()
      ? `/distributors/${distributorId}/${customerId}?${params.toString()}`
      : `/distributors/${distributorId}/${customerId}`;
    router.push(url);
  };

  const SortIcon = ({ field }: { field: typeof sortField }) => (
    <svg
      className={`w-4 h-4 ml-1 transition-all ${
        sortField === field ? 'opacity-100 text-[#14B8A6]' : 'opacity-40'
      }`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      {sortField === field && sortDirection === 'asc' ? (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      )}
    </svg>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B1220] flex items-center justify-center">
        <div className="text-white">Loading opportunities...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0B1220] flex items-center justify-center">
        <div className="text-white">No data found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1220] p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-[#64748B] hover:text-white transition-colors mb-4"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </button>

        <h1 className="text-3xl font-bold text-white mb-2">
          Growth Opportunities: {data.distributor_name}
        </h1>
        <p className="text-[#64748B]">
          {data.total_opportunities} location{data.total_opportunities !== 1 ? 's' : ''} identified for potential growth
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-[#151F2E] border border-white/[0.06] rounded-xl p-6"
        >
          <div className="text-[#64748B] text-sm mb-2">Bottom 25% Revenue</div>
          <div className="text-3xl font-bold text-red-400">{data.summary.bottom_25_pct}</div>
          <div className="text-xs text-[#64748B] mt-1">Underperforming locations</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-[#151F2E] border border-white/[0.06] rounded-xl p-6"
        >
          <div className="text-[#64748B] text-sm mb-2">YoY Decline ≥15%</div>
          <div className="text-3xl font-bold text-amber-400">{data.summary.yoy_decline}</div>
          <div className="text-xs text-[#64748B] mt-1">At-risk locations</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="bg-[#151F2E] border border-white/[0.06] rounded-xl p-6"
        >
          <div className="text-[#64748B] text-sm mb-2">High Growth Score</div>
          <div className="text-3xl font-bold text-green-400">{data.summary.high_growth_score}</div>
          <div className="text-xs text-[#64748B] mt-1">High potential locations</div>
        </motion.div>
      </div>

      {/* Opportunities Table */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.3 }}
        className="rounded-xl bg-[#151F2E] border border-white/[0.04] overflow-hidden"
      >
        {/* Table Header */}
        <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_1fr_2fr] gap-4 px-6 py-4 bg-[#0F1824] border-b border-white/[0.04]">
          <div className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
            Location
          </div>
          <div className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
            City, State
          </div>
          <button
            onClick={() => handleSort('revenue')}
            className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider text-right flex items-center justify-end hover:text-[#14B8A6] transition-colors"
          >
            Revenue
            <SortIcon field="revenue" />
          </button>
          <button
            onClick={() => handleSort('yoy')}
            className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider text-right flex items-center justify-end hover:text-[#14B8A6] transition-colors"
          >
            YoY %
            <SortIcon field="yoy" />
          </button>
          <button
            onClick={() => handleSort('categories')}
            className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider text-right flex items-center justify-end hover:text-[#14B8A6] transition-colors"
          >
            Categories
            <SortIcon field="categories" />
          </button>
          <button
            onClick={() => handleSort('score')}
            className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider text-right flex items-center justify-end hover:text-[#14B8A6] transition-colors"
          >
            Growth Score
            <SortIcon field="score" />
          </button>
          <div className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
            Opportunity Reasons
          </div>
        </div>

        {/* Table Body */}
        <div className="max-h-[600px] overflow-y-auto">
          {sortedOpportunities.map((opp, idx) => (
            <motion.div
              key={opp.customer_id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: idx * 0.02 }}
              onClick={() => handleLocationClick(opp.customer_id)}
              className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_1fr_2fr] gap-4 px-6 py-4 border-b border-white/[0.02] hover:bg-[#1E293B] cursor-pointer transition-colors group"
            >
              {/* Location Name */}
              <div className="text-[13px] font-medium text-white group-hover:text-[#14B8A6] transition-colors">
                {opp.customer_name}
              </div>

              {/* City, State */}
              <div className="text-[13px] text-[#94A3B8]">
                {opp.location}, {opp.state}
              </div>

              {/* Revenue */}
              <div className="text-right text-[13px] font-medium text-white">
                {formatCurrency(opp.revenue)}
              </div>

              {/* YoY % */}
              <div className="text-right">
                <div
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold ${
                    opp.yoy_change_pct > 0
                      ? 'bg-[#14B8A6]/20 text-[#14B8A6]'
                      : opp.yoy_change_pct > -10
                      ? 'bg-[#F59E0B]/20 text-[#F59E0B]'
                      : 'bg-[#EF4444]/20 text-[#EF4444]'
                  }`}
                >
                  {opp.yoy_change_pct < 0 && (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  )}
                  {formatPercent(opp.yoy_change_pct)}
                </div>
              </div>

              {/* Categories */}
              <div className="text-right text-[13px] font-medium text-white">
                {opp.category_count}
              </div>

              {/* Growth Score */}
              <div className="text-right">
                {opp.growth_score ? (
                  <div
                    className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                      opp.growth_score.overall >= 50
                        ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                        : opp.growth_score.overall >= 35
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        : 'bg-[#64748B]/20 text-[#64748B]'
                    }`}
                  >
                    {opp.growth_score.overall}
                  </div>
                ) : (
                  <div className="text-[12px] text-[#475569]">—</div>
                )}
              </div>

              {/* Opportunity Reasons */}
              <div className="flex flex-wrap gap-1.5">
                {opp.opportunity_reasons.map((reason, idx) => (
                  <span
                    key={idx}
                    className={`px-2 py-1 rounded-md text-[10px] font-medium ${
                      reason.includes('Bottom 25%')
                        ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                        : reason.includes('decline')
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-green-500/20 text-green-300 border border-green-500/30'
                    }`}
                  >
                    {reason}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}

          {sortedOpportunities.length === 0 && (
            <div className="p-12 text-center">
              <div className="text-[#64748B] text-[14px]">No opportunities found</div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
