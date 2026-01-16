'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

interface LocationData {
  customer_id: string;
  customer_name: string;
  location: string;
  state: string;
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
  is_opportunity: boolean;
  growth_score?: {
    overall: number;
    components: {
      revenueGap: number;
      trendScore: number;
      categoryGap: number;
      marginHealth: number;
    };
    tier: 'high' | 'medium' | 'low';
  };
}

interface DistributorData {
  distributor_name: string;
  locations: LocationData[];
}

interface LocationTableProps {
  data: DistributorData[];
  maxRevenue: number;
}

type SortField = 'revenue' | 'margin' | 'yoy' | 'categories' | 'tier';
type SortDirection = 'asc' | 'desc';

export default function LocationTable({ data, maxRevenue }: LocationTableProps) {
  const router = useRouter();
  const [sortField, setSortField] = useState<SortField>('revenue');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Flatten all locations with distributor name
  const allLocations = data.flatMap(dist =>
    dist.locations.map(loc => ({
      ...loc,
      distributor_name: dist.distributor_name
    }))
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedLocations = [...allLocations].sort((a, b) => {
    let aVal: number, bVal: number;

    switch (sortField) {
      case 'revenue':
        aVal = a.revenue;
        bVal = b.revenue;
        break;
      case 'margin':
        aVal = a.margin_pct;
        bVal = b.margin_pct;
        break;
      case 'yoy':
        aVal = a.yoy_change_pct;
        bVal = b.yoy_change_pct;
        break;
      case 'categories':
        aVal = a.category_count;
        bVal = b.category_count;
        break;
      case 'tier':
        const tierOrder = { high: 3, medium: 2, low: 1 };
        aVal = a.growth_score ? tierOrder[a.growth_score.tier] : 0;
        bVal = b.growth_score ? tierOrder[b.growth_score.tier] : 0;
        break;
      default:
        aVal = 0;
        bVal = 0;
    }

    return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
  });

  const formatCurrency = (value: number): string => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const formatPercent = (value: number): string => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  const handleRowClick = (customerId: string) => {
    router.push(`/distributors/${customerId}`);
  };

  const getTierBadge = (tier: 'high' | 'medium' | 'low' | undefined) => {
    if (!tier) return null;

    const colors = {
      high: 'bg-[#EF4444]/20 text-[#EF4444] border-[#EF4444]/30',
      medium: 'bg-[#F59E0B]/20 text-[#F59E0B] border-[#F59E0B]/30',
      low: 'bg-[#06B6D4]/20 text-[#06B6D4] border-[#06B6D4]/30',
    };

    return (
      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-semibold ${colors[tier]}`}>
        {tier === 'high' && '🔥'}
        {tier === 'medium' && '⚡'}
        {tier === 'low' && '💡'}
        {tier.charAt(0).toUpperCase() + tier.slice(1)}
      </div>
    );
  };

  const SortIcon = ({ field }: { field: SortField }) => (
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl bg-[#151F2E] border border-white/[0.04] overflow-hidden shadow-[0_4px_16px_rgba(0,0,0,0.25)]"
    >
      {/* Table Header */}
      <div className="grid grid-cols-[1.5fr_1.5fr_1.2fr_1fr_1fr_1fr_1fr] gap-4 px-6 py-4 bg-[#0F1824] border-b border-white/[0.04]">
        <div className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
          Distributor
        </div>
        <div className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
          Location
        </div>
        <button
          onClick={() => handleSort('revenue')}
          className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider text-right flex items-center justify-end hover:text-[#14B8A6] transition-colors"
        >
          Revenue
          <SortIcon field="revenue" />
        </button>
        <button
          onClick={() => handleSort('margin')}
          className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider text-right flex items-center justify-end hover:text-[#14B8A6] transition-colors"
        >
          Margin %
          <SortIcon field="margin" />
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
          onClick={() => handleSort('tier')}
          className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider text-right flex items-center justify-end hover:text-[#14B8A6] transition-colors"
        >
          Growth Tier
          <SortIcon field="tier" />
        </button>
      </div>

      {/* Table Body */}
      <div className="max-h-[600px] overflow-y-auto">
        {sortedLocations.map((row, idx) => {
          const revenueBarWidth = maxRevenue > 0 ? (row.revenue / maxRevenue) * 100 : 0;

          return (
            <motion.div
              key={`${row.distributor_name}-${row.customer_id}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: idx * 0.01 }}
              onClick={() => handleRowClick(row.customer_id)}
              className="grid grid-cols-[1.5fr_1.5fr_1.2fr_1fr_1fr_1fr_1fr] gap-4 px-6 py-4 border-b border-white/[0.02] hover:bg-[#1E293B] cursor-pointer transition-colors group"
            >
              {/* Distributor Name */}
              <div className="flex items-center">
                <div className="text-[13px] font-medium text-[#64748B] group-hover:text-[#14B8A6] transition-colors">
                  {row.distributor_name}
                </div>
              </div>

              {/* Location with Revenue Bar */}
              <div className="flex flex-col justify-center gap-1.5">
                <div className="text-[13px] font-medium text-white group-hover:text-[#14B8A6] transition-colors">
                  {row.location}
                </div>
                <div className="w-full h-1.5 bg-white/[0.03] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#14B8A6] to-[#06B6D4] rounded-full transition-all duration-500"
                    style={{ width: `${revenueBarWidth}%` }}
                  />
                </div>
              </div>

              {/* Revenue */}
              <div className="text-right">
                <div className="text-[13px] font-semibold text-white">
                  {formatCurrency(row.revenue)}
                </div>
                <div className="text-[11px] text-[#64748B] mt-0.5">
                  vs {formatCurrency(row.prior_revenue)}
                </div>
              </div>

              {/* Margin % */}
              <div className="text-right">
                <div className="text-[13px] font-medium text-white">
                  {row.margin_pct.toFixed(1)}%
                </div>
              </div>

              {/* YoY % */}
              <div className="text-right">
                <div
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold ${
                    row.yoy_change_pct > 10
                      ? 'bg-[#22C55E]/20 text-[#22C55E]'
                      : row.yoy_change_pct > 0
                      ? 'bg-[#14B8A6]/20 text-[#14B8A6]'
                      : row.yoy_change_pct > -10
                      ? 'bg-[#F59E0B]/20 text-[#F59E0B]'
                      : 'bg-[#EF4444]/20 text-[#EF4444]'
                  }`}
                >
                  {row.yoy_change_pct > 0 && (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                  )}
                  {row.yoy_change_pct < 0 && (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  )}
                  {formatPercent(row.yoy_change_pct)}
                </div>
              </div>

              {/* Categories */}
              <div className="text-right">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1E293B] border border-white/[0.04]">
                  <svg className="w-3.5 h-3.5 text-[#14B8A6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  <span className="text-[12px] font-medium text-white">
                    {row.category_count}
                  </span>
                </div>
              </div>

              {/* Growth Tier */}
              <div className="text-right flex items-center justify-end">
                {row.is_opportunity && row.growth_score ? (
                  getTierBadge(row.growth_score.tier)
                ) : (
                  <div className="text-[12px] text-[#475569]">—</div>
                )}
              </div>
            </motion.div>
          );
        })}

        {sortedLocations.length === 0 && (
          <div className="p-12 text-center">
            <div className="text-[#64748B] text-[14px]">No locations found</div>
            <p className="text-[#475569] text-[12px] mt-1">
              Try adjusting your filters or syncing data from NetSuite
            </p>
          </div>
        )}
      </div>

      {/* Footer Summary */}
      <div className="px-6 py-3 bg-[#0F1824] border-t border-white/[0.04]">
        <div className="flex items-center justify-between text-[12px]">
          <div className="text-[#64748B]">
            Showing <span className="text-white font-medium">{sortedLocations.length}</span> locations
          </div>
          <div className="text-[#64748B]">
            <span className="text-[#14B8A6] font-medium">
              {sortedLocations.filter(l => l.is_opportunity).length}
            </span>{' '}
            growth opportunities
          </div>
        </div>
      </div>
    </motion.div>
  );
}
