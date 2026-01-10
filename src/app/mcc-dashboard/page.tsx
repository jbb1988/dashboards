'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar, { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from '@/components/Sidebar';
import { DashboardBackground, backgroundPresets, KPICard } from '@/components/mars-ui';

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

interface MCCData {
  kpis: {
    totalRevenue: number;
    totalCOGS: number;
    totalGrossProfit: number;
    overallGPM: number;
    customerCount: number;
    atRiskCount: number;
    highPerformerCount: number;
    avgRevenuePerCustomer: number;
  };
  customers: MCCCustomer[];
  atRiskCustomers: MCCCustomer[];
  highPerformers: MCCCustomer[];
  yearTotals: Record<number, { revenue: number; cogs: number; gp: number; gpm: number; customerCount: number }>;
  years: number[];
  gpmDistribution: {
    excellent: number;
    good: number;
    average: number;
    poor: number;
  };
  lastUpdated: string;
}

// Format currency
function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

// Format percent
function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

// Customer Row Component
function CustomerRow({ customer, index, years, isSelected, onSelect, maxRevenue }: {
  customer: MCCCustomer;
  index: number;
  years: number[];
  isSelected: boolean;
  onSelect: (customer: MCCCustomer) => void;
  maxRevenue: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const isEvenRow = index % 2 === 0;
  const gpmColor = customer.avgGPM >= 0.6 ? '#22C55E' : customer.avgGPM >= 0.5 ? '#F59E0B' : '#EF4444';
  const isAtRisk = customer.avgGPM < 0.5;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.015, duration: 0.15 }}
      className={`relative border-b border-white/[0.03] transition-all duration-150 ${
        isEvenRow ? 'bg-[#131B28]' : 'bg-[#111827]'
      } ${isSelected ? 'bg-[#38BDF8]/8 ring-1 ring-inset ring-[#38BDF8]/20' : ''} hover:bg-[#1a2740] hover:shadow-[0_0_20px_rgba(56,189,248,0.04)]`}
    >
      {/* At-risk accent line */}
      {isAtRisk && (
        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#EF4444] animate-pulse" />
      )}

      <div
        onClick={() => {
          setExpanded(!expanded);
          onSelect(customer);
        }}
        className="grid gap-4 px-6 py-3.5 cursor-pointer transition-colors"
        style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr' }}
      >
        {/* Customer Name */}
        <div className="flex items-center gap-3">
          <div>
            <div className="font-medium text-[#EAF2FF] text-[14px]">{customer.customer}</div>
            <div className="text-[11px] text-[#64748B]">{customer.yearsActive} years active</div>
          </div>
        </div>

        {/* Total Revenue */}
        <div className="text-right">
          <div className="text-[#CBD5E1] font-semibold text-[14px]">{formatCurrency(customer.totalRevenue)}</div>
          <div className="w-16 h-[3px] rounded-full bg-white/10 overflow-hidden mt-1 ml-auto">
            <div
              className="h-full rounded-full bg-[#38BDF8]"
              style={{ width: `${(customer.totalRevenue / maxRevenue) * 100}%` }}
            />
          </div>
        </div>

        {/* Total COGS */}
        <div className="text-right">
          <div className="text-[#CBD5E1] font-semibold text-[14px]">{formatCurrency(customer.totalCOGS)}</div>
          <div className="text-[11px] text-[#64748B]">COGS</div>
        </div>

        {/* Total GP */}
        <div className="text-right">
          <div className="text-[#CBD5E1] font-semibold text-[14px]">{formatCurrency(customer.totalGP)}</div>
          <div className="text-[11px] text-[#64748B]">Gross Profit</div>
        </div>

        {/* GPM */}
        <div className="text-center">
          <span
            className="inline-flex items-center gap-1.5 justify-center px-2.5 py-1 rounded-full text-[12px] font-semibold"
            style={{ backgroundColor: `${gpmColor}20`, color: gpmColor }}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isAtRisk ? 'animate-pulse' : ''}`} style={{ background: gpmColor }} />
            {formatPercent(customer.avgGPM)}
          </span>
        </div>
      </div>

      {/* Expanded Details - Year by Year Breakdown */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="mx-4 mb-4 p-4 rounded-lg bg-[#0B1220] border border-white/[0.04] shadow-[inset_0_2px_8px_rgba(0,0,0,0.3)]">
              <div className="text-[10px] text-[#475569] uppercase tracking-wider mb-3">Year-over-Year Performance</div>

              <div className="grid grid-cols-5 gap-3">
                {years.map(year => {
                  const rev = customer.revenue[year] || 0;
                  const gpVal = customer.gp[year] || 0;
                  const gpmVal = customer.gpm[year] || 0;
                  const yearGpmColor = gpmVal >= 0.6 ? '#22C55E' : gpmVal >= 0.5 ? '#F59E0B' : '#EF4444';

                  return (
                    <div
                      key={year}
                      className={`p-3 rounded-lg ${rev > 0 ? 'bg-white/[0.03] border border-white/[0.04]' : 'bg-white/[0.01] border border-white/[0.02] opacity-50'}`}
                    >
                      <div className="text-[12px] font-semibold text-[#8FA3BF] mb-2">{year}</div>
                      {rev > 0 ? (
                        <>
                          <div className="text-[14px] font-semibold text-[#EAF2FF] mb-1">{formatCurrency(rev)}</div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-[#64748B]">GP: {formatCurrency(gpVal)}</span>
                            <span
                              className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: `${yearGpmColor}20`, color: yearGpmColor }}
                            >
                              {formatPercent(gpmVal)}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="text-[11px] text-[#475569]">No data</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// GPM Filter type
type GPMFilter = 'excellent' | 'good' | 'average' | 'poor' | null;

// GPM Distribution Bar
function GPMDistributionBar({
  distribution,
  activeFilter,
  onFilterChange
}: {
  distribution: { excellent: number; good: number; average: number; poor: number };
  activeFilter: GPMFilter;
  onFilterChange: (filter: GPMFilter) => void;
}) {
  const total = distribution.excellent + distribution.good + distribution.average + distribution.poor;
  if (total === 0) return null;

  const segments: { key: GPMFilter; count: number; color: string; label: string }[] = [
    { key: 'excellent', count: distribution.excellent, color: '#22C55E', label: '≥65%' },
    { key: 'good', count: distribution.good, color: '#38BDF8', label: '55-65%' },
    { key: 'average', count: distribution.average, color: '#F59E0B', label: '45-55%' },
    { key: 'poor', count: distribution.poor, color: '#EF4444', label: '<45%' },
  ];

  return (
    <div className="space-y-2">
      <div className="flex h-3 rounded-full overflow-hidden bg-white/[0.05]">
        {segments.map(seg => (
          <div
            key={seg.key}
            onClick={() => onFilterChange(activeFilter === seg.key ? null : seg.key)}
            className={`cursor-pointer transition-all duration-150 hover:brightness-110 ${
              activeFilter && activeFilter !== seg.key ? 'opacity-30' : ''
            } ${activeFilter === seg.key ? 'ring-2 ring-white ring-inset' : ''}`}
            style={{
              width: `${(seg.count / total) * 100}%`,
              backgroundColor: seg.color
            }}
            title={`${seg.label}: ${seg.count} customers`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between text-[10px]">
        {segments.map(seg => (
          <button
            key={seg.key}
            onClick={() => onFilterChange(activeFilter === seg.key ? null : seg.key)}
            className={`flex items-center gap-1 px-2 py-1 rounded transition-all duration-150 ${
              activeFilter === seg.key
                ? 'bg-white/10 ring-1 ring-white/20'
                : 'hover:bg-white/5'
            } ${activeFilter && activeFilter !== seg.key ? 'opacity-40' : ''}`}
          >
            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: seg.color }} />
            <span className="text-[#64748B]">{seg.label} ({seg.count})</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function MCCDashboard() {
  const [data, setData] = useState<MCCData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'revenue' | 'gpm' | 'gp' | 'customer'>('revenue');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showAtRiskOnly, setShowAtRiskOnly] = useState(false);
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<MCCCustomer | null>(null);
  const [gpmFilter, setGpmFilter] = useState<GPMFilter>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleHeaderClick = (field: 'revenue' | 'gpm' | 'gp' | 'customer') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/api/mcc?bust=true');
        const result = await response.json();

        if (result.error) {
          setError(result.message || result.error);
        } else {
          setData(result);
        }
      } catch (err) {
        setError('Failed to load MCC data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filteredCustomers = useMemo(() => {
    if (!data) return [];

    let customers = [...data.customers];

    // Filter by at-risk
    if (showAtRiskOnly) {
      customers = customers.filter(c => c.avgGPM < 0.5);
    }

    // Filter by GPM bucket
    if (gpmFilter) {
      customers = customers.filter(c => {
        switch (gpmFilter) {
          case 'excellent': return c.avgGPM >= 0.65;
          case 'good': return c.avgGPM >= 0.55 && c.avgGPM < 0.65;
          case 'average': return c.avgGPM >= 0.45 && c.avgGPM < 0.55;
          case 'poor': return c.avgGPM < 0.45;
          default: return true;
        }
      });
    }

    // Filter by year (show only customers with data in that year)
    if (selectedYear !== 'all') {
      const year = parseInt(selectedYear);
      customers = customers.filter(c => c.revenue[year] > 0);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      customers = customers.filter(c => c.customer.toLowerCase().includes(query));
    }

    // Sort
    return [...customers].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'revenue':
          comparison = b.totalRevenue - a.totalRevenue;
          break;
        case 'gpm':
          comparison = b.avgGPM - a.avgGPM;
          break;
        case 'gp':
          comparison = b.totalGP - a.totalGP;
          break;
        case 'customer':
          comparison = a.customer.localeCompare(b.customer);
          break;
      }
      return sortDirection === 'asc' ? -comparison : comparison;
    });
  }, [data, searchQuery, sortField, sortDirection, showAtRiskOnly, selectedYear, gpmFilter]);

  // Calculate filtered KPIs - ALL metrics change based on filters
  const filteredKpis = useMemo(() => {
    if (!data || filteredCustomers.length === 0) {
      return {
        totalRevenue: 0,
        totalCOGS: 0,
        totalGP: 0,
        avgGPM: 0,
        customerCount: 0,
        atRiskCount: 0,
        highPerformerCount: 0,
        avgRevenuePerCustomer: 0,
      };
    }

    // If a specific year is selected, calculate from that year's data only
    let totalRevenue = 0;
    let totalCOGS = 0;

    if (selectedYear !== 'all') {
      const year = parseInt(selectedYear);
      filteredCustomers.forEach(c => {
        totalRevenue += c.revenue[year] || 0;
        totalCOGS += c.cogs[year] || 0;
      });
    } else {
      totalRevenue = filteredCustomers.reduce((sum, c) => sum + c.totalRevenue, 0);
      totalCOGS = filteredCustomers.reduce((sum, c) => sum + c.totalCOGS, 0);
    }

    const totalGP = totalRevenue - totalCOGS;
    const avgGPM = totalRevenue > 0 ? totalGP / totalRevenue : 0;

    // Calculate at-risk and high performers from filtered customers
    // When year is selected, use that year's GPM for classification
    let atRiskCount = 0;
    let highPerformerCount = 0;

    if (selectedYear !== 'all') {
      const year = parseInt(selectedYear);
      filteredCustomers.forEach(c => {
        const yearGPM = c.gpm[year] || 0;
        const yearRev = c.revenue[year] || 0;
        if (yearRev > 0) {
          if (yearGPM < 0.5) atRiskCount++;
          if (yearGPM >= 0.6) highPerformerCount++;
        }
      });
    } else {
      atRiskCount = filteredCustomers.filter(c => c.avgGPM < 0.5).length;
      highPerformerCount = filteredCustomers.filter(c => c.avgGPM >= 0.6).length;
    }

    return {
      totalRevenue,
      totalCOGS,
      totalGP,
      avgGPM,
      customerCount: filteredCustomers.length,
      atRiskCount,
      highPerformerCount,
      avgRevenuePerCustomer: filteredCustomers.length > 0 ? totalRevenue / filteredCustomers.length : 0,
    };
  }, [data, filteredCustomers, selectedYear]);

  const maxRevenue = useMemo(() => {
    if (!data) return 1;
    return Math.max(...data.customers.map(c => c.totalRevenue));
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B1220] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-[#22C55E]/20 border-t-[#22C55E] rounded-full animate-spin mx-auto mb-4" />
          <div className="text-[#8FA3BF]">Loading MCC data...</div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0B1220] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-[#EF4444] text-xl mb-2">Error Loading Data</div>
          <div className="text-[#8FA3BF] mb-4">{error}</div>
          <p className="text-[#64748B] text-sm">
            Make sure the Excel file has the <code className="bg-white/10 px-1 rounded">MCC Margin Analysis</code> tab.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1220] relative overflow-hidden">
      <DashboardBackground {...backgroundPresets.finance} />
      <Sidebar isCollapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />
      <div className="fixed inset-0 bg-gradient-to-b from-[#0F1722] via-[#0B1220] to-[#0B1220]" />

      <motion.div
        className="relative z-10 text-white"
        animate={{ marginLeft: sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        {/* Header */}
        <header className="border-b border-white/[0.04] bg-[#0B1220]/90 backdrop-blur-xl sticky top-0 z-50">
          <div className="px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold text-[#EAF2FF] tracking-tight">MCC Profitability</h1>
                <p className="text-[11px] text-[#475569] mt-0.5">
                  Annual Maintenance Contract Performance
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-[11px] text-[#475569] flex items-center gap-2 justify-end">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
                    Updated {(() => {
                      const mins = Math.floor((Date.now() - new Date(data.lastUpdated).getTime()) / 60000);
                      if (mins < 1) return 'just now';
                      if (mins < 60) return `${mins} min ago`;
                      const hours = Math.floor(mins / 60);
                      if (hours < 24) return `${hours}h ago`;
                      return `${Math.floor(hours / 24)}d ago`;
                    })()}
                  </div>
                  <div className="text-[#8FA3BF] font-medium text-[12px]">Excel Source</div>
                </div>
                <button
                  onClick={() => window.location.reload()}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                  title="Refresh data"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="w-full px-8 py-6">
          {/* KPI Cards */}
          <div className="w-full grid grid-cols-5 gap-4 mb-6">
            <KPICard
              title="Total MCC Revenue"
              value={formatCurrency(filteredKpis.totalRevenue)}
              subtitle={`${filteredKpis.customerCount} customers`}
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              color="#22C55E"
            />
            <KPICard
              title="Gross Profit"
              value={formatCurrency(filteredKpis.totalGP)}
              subtitle="Revenue minus COGS"
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
              color="#38BDF8"
            />
            <KPICard
              title="Overall GPM"
              value={formatPercent(filteredKpis.avgGPM)}
              subtitle="Gross profit margin"
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
              color={filteredKpis.avgGPM >= 0.6 ? '#22C55E' : filteredKpis.avgGPM >= 0.5 ? '#F59E0B' : '#EF4444'}
            />
            <KPICard
              title="High Performers"
              value={data.kpis.highPerformerCount.toString()}
              subtitle="GPM ≥ 60%"
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>}
              color="#22C55E"
            />
            <div
              onClick={() => setShowAtRiskOnly(!showAtRiskOnly)}
              className={`cursor-pointer transition-all ${showAtRiskOnly ? 'ring-2 ring-[#EF4444] ring-offset-2 ring-offset-[#0B1220] rounded-xl' : ''}`}
            >
              <KPICard
                title="At Risk"
                value={filteredKpis.atRiskCount.toString()}
                subtitle={showAtRiskOnly ? 'Click to show all' : 'GPM < 50%'}
                icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
                color="#EF4444"
              />
            </div>
          </div>

          {/* GPM Distribution */}
          <div className="mb-6 p-4 rounded-xl bg-[#111827] border border-white/[0.04]">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] font-semibold text-[#475569] uppercase tracking-[0.08em]">
                Customer GPM Distribution
              </div>
              {gpmFilter && (
                <button
                  onClick={() => setGpmFilter(null)}
                  className="text-[10px] text-[#64748B] hover:text-white transition-colors flex items-center gap-1"
                >
                  <span>Clear filter</span>
                  <span>✕</span>
                </button>
              )}
            </div>
            <GPMDistributionBar
              distribution={data.gpmDistribution}
              activeFilter={gpmFilter}
              onFilterChange={setGpmFilter}
            />
          </div>

          <div className="w-full grid grid-cols-4 gap-6">
            {/* Main Content - Customer List */}
            <div className="col-span-3 w-full">
              <div className="rounded-xl bg-[#111827] border border-white/[0.04] shadow-[0_4px_16px_rgba(0,0,0,0.25)] overflow-hidden">
                {/* Filters */}
                <div className="px-6 py-3 border-b border-white/[0.04] bg-[#0B1220]/60">
                  <div className="flex items-center gap-4">
                    <div className="relative flex-1 max-w-xs">
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        type="text"
                        placeholder="Search customers..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-lg bg-[#0B1220] border border-white/10 text-[#EAF2FF] placeholder-[#64748B] focus:outline-none focus:border-[#22C55E]/50 text-[13px]"
                      />
                    </div>

                    <select
                      value={selectedYear}
                      onChange={e => setSelectedYear(e.target.value)}
                      className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none text-sm"
                    >
                      <option value="all">All Years</option>
                      {data.years.map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>

                    <select
                      value={sortField}
                      onChange={e => setSortField(e.target.value as any)}
                      className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none text-sm"
                    >
                      <option value="revenue">Sort by Revenue</option>
                      <option value="gpm">Sort by GPM</option>
                      <option value="gp">Sort by Gross Profit</option>
                      <option value="customer">Sort by Name</option>
                    </select>

                    <button
                      onClick={() => setShowAtRiskOnly(!showAtRiskOnly)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        showAtRiskOnly
                          ? 'bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30'
                          : 'bg-white/5 text-gray-400 border border-white/10'
                      }`}
                    >
                      {showAtRiskOnly ? '⚠ At Risk Only' : 'Show All'}
                    </button>

                    <div className="text-[12px] text-[#64748B]">
                      {filteredCustomers.length} customers
                    </div>
                  </div>
                </div>

                {/* Table Header */}
                <div
                  className="grid gap-4 px-6 py-2.5 text-[11px] font-semibold text-[#475569] uppercase tracking-[0.06em] border-b border-white/[0.04] bg-[#0B1220] sticky top-0 z-10 shadow-[0_1px_0_rgba(255,255,255,0.05)]"
                  style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr' }}
                >
                  <button
                    onClick={() => handleHeaderClick('customer')}
                    className={`flex items-center gap-1 transition-colors hover:text-white ${sortField === 'customer' ? 'text-[#38BDF8]' : ''}`}
                  >
                    Customer
                    {sortField === 'customer' && (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sortDirection === 'desc' ? "M19 9l-7 7-7-7" : "M5 15l7-7 7 7"} />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => handleHeaderClick('revenue')}
                    className={`flex items-center gap-1 justify-end ml-auto transition-colors hover:text-white ${sortField === 'revenue' ? 'text-[#38BDF8]' : ''}`}
                  >
                    Total Revenue
                    {sortField === 'revenue' && (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sortDirection === 'desc' ? "M19 9l-7 7-7-7" : "M5 15l7-7 7 7"} />
                      </svg>
                    )}
                  </button>
                  <div className="text-right">COGS</div>
                  <button
                    onClick={() => handleHeaderClick('gp')}
                    className={`flex items-center gap-1 justify-end ml-auto transition-colors hover:text-white ${sortField === 'gp' ? 'text-[#38BDF8]' : ''}`}
                  >
                    Gross Profit
                    {sortField === 'gp' && (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sortDirection === 'desc' ? "M19 9l-7 7-7-7" : "M5 15l7-7 7 7"} />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => handleHeaderClick('gpm')}
                    className={`flex items-center gap-1 justify-center transition-colors hover:text-white ${sortField === 'gpm' ? 'text-[#38BDF8]' : ''}`}
                  >
                    GPM
                    {sortField === 'gpm' && (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sortDirection === 'desc' ? "M19 9l-7 7-7-7" : "M5 15l7-7 7 7"} />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Customer Rows */}
                <div className="max-h-[600px] overflow-y-auto">
                  {filteredCustomers.map((customer, index) => (
                    <CustomerRow
                      key={customer.customer}
                      customer={customer}
                      index={index}
                      years={data.years}
                      isSelected={selectedCustomer?.customer === customer.customer}
                      onSelect={setSelectedCustomer}
                      maxRevenue={maxRevenue}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="col-span-1 space-y-6">
              {/* Year-over-Year Totals */}
              <div className="rounded-xl bg-[#111827] border border-white/[0.04] shadow-[0_4px_16px_rgba(0,0,0,0.2)] p-4">
                <h3 className="text-[10px] font-semibold text-[#475569] uppercase tracking-[0.08em] mb-4">
                  Year-over-Year
                </h3>
                <div className="space-y-3">
                  {data.years.map(year => {
                    const yearData = data.yearTotals[year];
                    if (!yearData || yearData.revenue === 0) return null;
                    const gpmColor = yearData.gpm >= 0.6 ? '#22C55E' : yearData.gpm >= 0.5 ? '#F59E0B' : '#EF4444';

                    return (
                      <div key={year} className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[13px] font-semibold text-[#EAF2FF]">{year}</span>
                          <span
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: `${gpmColor}20`, color: gpmColor }}
                          >
                            {formatPercent(yearData.gpm)}
                          </span>
                        </div>
                        <div className="text-[12px] text-[#8FA3BF]">{formatCurrency(yearData.revenue)}</div>
                        <div className="text-[10px] text-[#64748B]">{yearData.customerCount} customers</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Selected Customer Detail */}
              {selectedCustomer && (
                <div className="rounded-xl bg-[#111827] border border-[#38BDF8]/20 shadow-[0_4px_16px_rgba(0,0,0,0.2)] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[10px] font-semibold text-[#38BDF8] uppercase tracking-[0.08em]">
                      Customer Detail
                    </h3>
                    <button
                      onClick={() => setSelectedCustomer(null)}
                      className="text-[10px] text-[#64748B] hover:text-white transition-colors"
                    >
                      ✕ Clear
                    </button>
                  </div>
                  <div className="text-[13px] font-semibold text-[#EAF2FF] mb-1">{selectedCustomer.customer}</div>
                  <div className="text-[10px] text-[#64748B] mb-4">{selectedCustomer.yearsActive} years of data</div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-[12px]">
                      <span className="text-[#64748B]">Total Revenue</span>
                      <span className="text-[#EAF2FF] font-medium">{formatCurrency(selectedCustomer.totalRevenue)}</span>
                    </div>
                    <div className="flex justify-between text-[12px]">
                      <span className="text-[#64748B]">Total COGS</span>
                      <span className="text-[#EAF2FF] font-medium">{formatCurrency(selectedCustomer.totalCOGS)}</span>
                    </div>
                    <div className="flex justify-between text-[12px]">
                      <span className="text-[#64748B]">Total GP</span>
                      <span className="text-[#EAF2FF] font-medium">{formatCurrency(selectedCustomer.totalGP)}</span>
                    </div>
                    <div className="flex justify-between text-[12px] pt-2 border-t border-white/[0.04]">
                      <span className="text-[#64748B]">Avg GPM</span>
                      <span
                        className="font-semibold px-2 py-0.5 rounded text-[11px]"
                        style={{
                          backgroundColor: `${selectedCustomer.avgGPM >= 0.6 ? '#22C55E' : selectedCustomer.avgGPM >= 0.5 ? '#F59E0B' : '#EF4444'}20`,
                          color: selectedCustomer.avgGPM >= 0.6 ? '#22C55E' : selectedCustomer.avgGPM >= 0.5 ? '#F59E0B' : '#EF4444'
                        }}
                      >
                        {formatPercent(selectedCustomer.avgGPM)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Top Performers */}
              {!selectedCustomer && (
                <div className="rounded-xl bg-[#111827] border border-white/[0.04] shadow-[0_4px_16px_rgba(0,0,0,0.2)] p-4">
                  <h3 className="text-[10px] font-semibold text-[#475569] uppercase tracking-[0.08em] mb-3">
                    Top Performers
                  </h3>
                  <div className="space-y-2">
                    {data.highPerformers.slice(0, 5).map((customer, idx) => (
                      <div
                        key={customer.customer}
                        className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] cursor-pointer transition-colors"
                        onClick={() => setSelectedCustomer(customer)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-[#64748B]">{idx + 1}</span>
                          <span className="text-[12px] text-[#EAF2FF] truncate max-w-[140px]">{customer.customer}</span>
                        </div>
                        <span className="text-[10px] font-semibold text-[#22C55E]">{formatPercent(customer.avgGPM)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </motion.div>
    </div>
  );
}
