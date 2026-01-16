'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

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
}

interface DistributorTableProps {
  data: DistributorData[];
  maxRevenue: number;
}

type SortField = 'revenue' | 'margin' | 'yoy' | 'locations' | 'opps';
type SortDirection = 'asc' | 'desc';

export default function DistributorTable({ data, maxRevenue }: DistributorTableProps) {
  const router = useRouter();
  const [sortField, setSortField] = useState<SortField>('revenue');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
    let aVal: number, bVal: number;

    switch (sortField) {
      case 'revenue':
        aVal = a.total_revenue;
        bVal = b.total_revenue;
        break;
      case 'margin':
        aVal = a.total_margin_pct;
        bVal = b.total_margin_pct;
        break;
      case 'yoy':
        aVal = a.yoy_change_pct;
        bVal = b.yoy_change_pct;
        break;
      case 'locations':
        aVal = a.location_count;
        bVal = b.location_count;
        break;
      case 'opps':
        aVal = a.growth_opportunities;
        bVal = b.growth_opportunities;
        break;
      default:
        return 0;
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

  const handleRowClick = (distributorName: string) => {
    const id = distributorName.toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and');
    router.push(`/distributors/${id}`);
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
      <div className="grid grid-cols-[2fr_1.2fr_1fr_1fr_1fr_1fr_1fr] gap-4 px-6 py-4 bg-[#0F1824] border-b border-white/[0.04]">
        <div className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
          Distributor
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
          onClick={() => handleSort('locations')}
          className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider text-right flex items-center justify-end hover:text-[#14B8A6] transition-colors"
        >
          Locations
          <SortIcon field="locations" />
        </button>
        <div className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider text-right">
          Avg/Loc
        </div>
        <button
          onClick={() => handleSort('opps')}
          className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider text-right flex items-center justify-end hover:text-[#14B8A6] transition-colors"
        >
          Growth Opps
          <SortIcon field="opps" />
        </button>
      </div>

      {/* Table Body */}
      <div className="max-h-[600px] overflow-y-auto">
        {sortedData.map((row, idx) => {
          const revenueBarWidth = maxRevenue > 0 ? (row.total_revenue / maxRevenue) * 100 : 0;

          return (
            <motion.div
              key={row.distributor_name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: idx * 0.02 }}
              onClick={() => handleRowClick(row.distributor_name)}
              className="grid grid-cols-[2fr_1.2fr_1fr_1fr_1fr_1fr_1fr] gap-4 px-6 py-4 border-b border-white/[0.02] hover:bg-[#1E293B] cursor-pointer transition-colors group"
            >
              {/* Distributor Name with Revenue Bar */}
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="text-[13px] font-medium text-white mb-1.5 group-hover:text-[#14B8A6] transition-colors">
                    {row.distributor_name}
                  </div>
                  <div className="w-full h-1.5 bg-white/[0.03] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#14B8A6] to-[#06B6D4] rounded-full transition-all duration-500"
                      style={{ width: `${revenueBarWidth}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Revenue */}
              <div className="text-right">
                <div className="text-[13px] font-semibold text-white">
                  {formatCurrency(row.total_revenue)}
                </div>
                <div className="text-[11px] text-[#64748B] mt-0.5">
                  vs {formatCurrency(row.prior_revenue)}
                </div>
              </div>

              {/* Margin % */}
              <div className="text-right">
                <div className="text-[13px] font-medium text-white">
                  {row.total_margin_pct.toFixed(1)}%
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

              {/* Locations */}
              <div className="text-right">
                <div className="text-[13px] font-medium text-white">
                  {row.location_count}
                </div>
              </div>

              {/* Avg per Location */}
              <div className="text-right">
                <div className="text-[13px] font-medium text-[#64748B]">
                  {formatCurrency(row.avg_revenue_per_location)}
                </div>
              </div>

              {/* Growth Opportunities */}
              <div className="text-right">
                {row.growth_opportunities > 0 ? (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#14B8A6]/20 border border-[#14B8A6]/30">
                    <svg className="w-3.5 h-3.5 text-[#14B8A6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    <span className="text-[12px] font-semibold text-[#14B8A6]">
                      {row.growth_opportunities}
                    </span>
                  </div>
                ) : (
                  <div className="text-[12px] text-[#475569]">—</div>
                )}
              </div>
            </motion.div>
          );
        })}

        {sortedData.length === 0 && (
          <div className="p-12 text-center">
            <div className="text-[#64748B] text-[14px]">No distributors found</div>
            <p className="text-[#475569] text-[12px] mt-1">
              Try adjusting your filters or syncing data from NetSuite
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
