'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

// Format currency
function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

// Format percent
function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

interface MCCCustomer {
  customer: string;
  revenue: Record<number, number>;
  cogs: Record<number, number>;
  gp: Record<number, number>;
  gpm: Record<number, number>;
  totalRevenue: number;
  totalCOGS: number;
  totalGP: number;
  avgGPM: number;
  trend: 'up' | 'down' | 'stable';
  yearsActive: number;
}

interface MCCTabProps {
  mccMargins: MCCCustomer[];
  years: number[];
}

export default function MCCTab({ mccMargins, years = [2021, 2022, 2023, 2024, 2025] }: MCCTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [gpmFilter, setGpmFilter] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'revenue' | 'gpm' | 'customer'>('revenue');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);

  // GPM Distribution
  const gpmDistribution = useMemo(() => {
    const excellent = mccMargins.filter(c => c.avgGPM >= 0.65).length;
    const good = mccMargins.filter(c => c.avgGPM >= 0.55 && c.avgGPM < 0.65).length;
    const average = mccMargins.filter(c => c.avgGPM >= 0.45 && c.avgGPM < 0.55).length;
    const poor = mccMargins.filter(c => c.avgGPM < 0.45).length;
    const total = mccMargins.length;

    return { excellent, good, average, poor, total };
  }, [mccMargins]);

  // Filter and sort customers
  const filteredCustomers = useMemo(() => {
    let filtered = [...mccMargins];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c => c.customer.toLowerCase().includes(query));
    }

    if (gpmFilter) {
      switch (gpmFilter) {
        case 'excellent':
          filtered = filtered.filter(c => c.avgGPM >= 0.65);
          break;
        case 'good':
          filtered = filtered.filter(c => c.avgGPM >= 0.55 && c.avgGPM < 0.65);
          break;
        case 'average':
          filtered = filtered.filter(c => c.avgGPM >= 0.45 && c.avgGPM < 0.55);
          break;
        case 'poor':
          filtered = filtered.filter(c => c.avgGPM < 0.45);
          break;
      }
    }

    return filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'revenue':
          comparison = b.totalRevenue - a.totalRevenue;
          break;
        case 'gpm':
          comparison = b.avgGPM - a.avgGPM;
          break;
        case 'customer':
          comparison = a.customer.localeCompare(b.customer);
          break;
      }
      return sortDirection === 'asc' ? -comparison : comparison;
    });
  }, [mccMargins, searchQuery, gpmFilter, sortField, sortDirection]);

  return (
    <div className="space-y-6">
      {/* GPM Distribution Bar */}
      <div className="bg-[#111827] rounded-xl border border-white/[0.04] p-4">
        <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-3">
          GPM Distribution
        </h3>
        <div className="flex gap-1 h-8 rounded-lg overflow-hidden">
          <GPMSegment
            label="Excellent"
            count={gpmDistribution.excellent}
            total={gpmDistribution.total}
            color="#22C55E"
            active={gpmFilter === 'excellent'}
            onClick={() => setGpmFilter(gpmFilter === 'excellent' ? null : 'excellent')}
          />
          <GPMSegment
            label="Good"
            count={gpmDistribution.good}
            total={gpmDistribution.total}
            color="#38BDF8"
            active={gpmFilter === 'good'}
            onClick={() => setGpmFilter(gpmFilter === 'good' ? null : 'good')}
          />
          <GPMSegment
            label="Average"
            count={gpmDistribution.average}
            total={gpmDistribution.total}
            color="#F59E0B"
            active={gpmFilter === 'average'}
            onClick={() => setGpmFilter(gpmFilter === 'average' ? null : 'average')}
          />
          <GPMSegment
            label="Poor"
            count={gpmDistribution.poor}
            total={gpmDistribution.total}
            color="#EF4444"
            active={gpmFilter === 'poor'}
            onClick={() => setGpmFilter(gpmFilter === 'poor' ? null : 'poor')}
          />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {/* Main Content */}
        <div className="col-span-3">
          {/* Filters */}
          <div className="flex items-center gap-4 mb-4">
            <input
              type="text"
              placeholder="Search customers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-4 py-2 bg-[#111827] border border-white/[0.08] rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#22C55E]/20"
            />
            {gpmFilter && (
              <button
                onClick={() => setGpmFilter(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-[#111827] border border-white/[0.08] text-gray-300 hover:bg-white/[0.04]"
              >
                Clear Filter
              </button>
            )}
          </div>

          {/* Customer Table */}
          <div className="bg-[#111827] rounded-xl border border-white/[0.04]">
            {/* Header */}
            <div className="grid grid-cols-5 gap-4 p-4 border-b border-white/[0.04] text-xs text-gray-400 uppercase">
              <div className="col-span-2 cursor-pointer hover:text-white" onClick={() => setSortField('customer')}>
                Customer {sortField === 'customer' && (sortDirection === 'desc' ? '↓' : '↑')}
              </div>
              <div className="text-right cursor-pointer hover:text-white" onClick={() => setSortField('revenue')}>
                Total Revenue {sortField === 'revenue' && (sortDirection === 'desc' ? '↓' : '↑')}
              </div>
              <div className="text-right">Total GP</div>
              <div className="text-right cursor-pointer hover:text-white" onClick={() => setSortField('gpm')}>
                Avg GPM% {sortField === 'gpm' && (sortDirection === 'desc' ? '↓' : '↑')}
              </div>
            </div>

            {/* Rows */}
            <div>
              {filteredCustomers.map((customer) => (
                <CustomerRow
                  key={customer.customer}
                  customer={customer}
                  years={years}
                  expanded={expandedCustomer === customer.customer}
                  onToggle={() => setExpandedCustomer(expandedCustomer === customer.customer ? null : customer.customer)}
                />
              ))}
            </div>
          </div>

          {filteredCustomers.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              No customers found
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* High Performers */}
          <div className="bg-[#111827] rounded-xl border border-white/[0.04] p-4">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-3">
              Top Performers
            </h3>
            <div className="space-y-2">
              {mccMargins
                .filter(c => c.avgGPM >= 0.6)
                .slice(0, 5)
                .map((c) => (
                  <div key={c.customer} className="text-xs">
                    <div className="text-white truncate">{c.customer}</div>
                    <div className="text-[#22C55E] text-[10px]">GPM: {formatPercent(c.avgGPM)}</div>
                  </div>
                ))}
            </div>
          </div>

          {/* At Risk */}
          <div className="bg-[#111827] rounded-xl border border-white/[0.04] p-4">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-3">
              At Risk
            </h3>
            <div className="space-y-2">
              {mccMargins
                .filter(c => c.avgGPM < 0.5)
                .slice(0, 5)
                .map((c) => (
                  <div key={c.customer} className="text-xs">
                    <div className="text-white truncate">{c.customer}</div>
                    <div className="text-[#EF4444] text-[10px]">GPM: {formatPercent(c.avgGPM)}</div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// GPM Segment Component
function GPMSegment({
  label,
  count,
  total,
  color,
  active,
  onClick
}: {
  label: string;
  count: number;
  total: number;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  const width = total > 0 ? (count / total) * 100 : 0;

  return (
    <div
      className={`flex-1 cursor-pointer transition-opacity ${active ? 'opacity-100' : 'opacity-60 hover:opacity-80'}`}
      style={{ backgroundColor: color, width: `${width}%` }}
      onClick={onClick}
    >
      <div className="h-full flex flex-col items-center justify-center text-white text-[10px] font-semibold">
        <div>{label}</div>
        <div>{count}</div>
      </div>
    </div>
  );
}

// Customer Row Component
function CustomerRow({
  customer,
  years,
  expanded,
  onToggle
}: {
  customer: MCCCustomer;
  years: number[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const TrendIcon = customer.trend === 'up' ? TrendingUp : customer.trend === 'down' ? TrendingDown : Minus;
  const trendColor = customer.trend === 'up' ? '#22C55E' : customer.trend === 'down' ? '#EF4444' : '#64748B';

  return (
    <div className="border-b border-white/[0.04]">
      {/* Main Row */}
      <div
        className="grid grid-cols-5 gap-4 p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={onToggle}
      >
        <div className="col-span-2 flex items-center gap-2">
          <div className="text-sm font-medium text-white">{customer.customer}</div>
          <TrendIcon className="w-3 h-3" style={{ color: trendColor }} />
        </div>
        <div className="text-right text-sm text-white">{formatCurrency(customer.totalRevenue)}</div>
        <div className="text-right text-sm text-[#22C55E]">{formatCurrency(customer.totalGP)}</div>
        <div className="text-right">
          <span
            className="text-sm font-semibold px-2 py-1 rounded"
            style={{
              backgroundColor: customer.avgGPM >= 0.65 ? '#22C55E20' : customer.avgGPM >= 0.55 ? '#38BDF820' : customer.avgGPM >= 0.45 ? '#F59E0B20' : '#EF444420',
              color: customer.avgGPM >= 0.65 ? '#22C55E' : customer.avgGPM >= 0.55 ? '#38BDF8' : customer.avgGPM >= 0.45 ? '#F59E0B' : '#EF4444'
            }}
          >
            {formatPercent(customer.avgGPM)}
          </span>
        </div>
      </div>

      {/* Expanded Year Breakdown */}
      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="bg-[#0B1220] px-4 pb-4"
        >
          <div className="grid grid-cols-5 gap-3 pt-3">
            {years.map((year) => {
              const revenue = customer.revenue[year] || 0;
              const gp = customer.gp[year] || 0;
              const gpm = customer.gpm[year] || 0;
              const hasData = revenue > 0;

              return (
                <div
                  key={year}
                  className={`p-3 rounded-lg border ${hasData ? 'bg-[#111827] border-white/[0.08]' : 'bg-[#111827]/50 border-white/[0.04]'}`}
                >
                  <div className="text-xs font-semibold text-white mb-2">{year}</div>
                  {hasData ? (
                    <>
                      <div className="text-[10px] text-gray-400 mb-1">Revenue</div>
                      <div className="text-xs text-white mb-2">{formatCurrency(revenue)}</div>
                      <div className="text-[10px] text-gray-400 mb-1">GP</div>
                      <div className="text-xs text-[#22C55E] mb-2">{formatCurrency(gp)}</div>
                      <div className="text-[10px] text-gray-400 mb-1">GPM</div>
                      <div className="text-xs text-white">{formatPercent(gpm)}</div>
                    </>
                  ) : (
                    <div className="text-[10px] text-gray-500 italic">No data</div>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}
