'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar, { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from '@/components/Sidebar';
import { DashboardBackground, backgroundPresets, KPICard } from '@/components/mars-ui';
import {
  RevenueAreaChart,
  ClassBarChart,
  BudgetVarianceChart,
  CustomerDonut,
} from '@/components/charts';

interface ClassSummary {
  class_name: string;
  class_category: string;
  total_units: number;
  total_revenue: number;
  total_cost: number;
  total_gross_profit: number;
  avg_gross_profit_pct: number;
  transaction_count: number;
}

interface CustomerSummary {
  customer_id: string;
  customer_name: string;
  total_units: number;
  total_revenue: number;
  total_cost: number;
  total_gross_profit: number;
  avg_gross_profit_pct: number;
  transaction_count: number;
}

interface DashboardSummary {
  totalRevenue: number;
  totalUnits: number;
  totalCost: number;
  grossProfit: number;
  grossProfitPct: number;
  transactionCount: number;
  uniqueClasses: number;
  uniqueCustomers: number;
  budgetRevenue: number;
  budgetUnits: number;
  budgetCost: number;
  budgetGrossProfit: number;
  variancePct: number | null;
}

interface FilterOptions {
  years: number[];
  months: number[];
  classes: string[];
  customers: Array<{ id: string; name: string }>;
}

interface MonthlyChartData {
  year: number;
  month: number;
  monthName: string;
  revenue: number;
  cost: number;
  grossProfit: number;
  grossProfitPct: number;
  units: number;
  transactionCount: number;
}

interface ClassMonthlyData {
  className: string;
  year: number;
  month: number;
  monthName: string;
  revenue: number;
  cost: number;
  grossProfit: number;
  units: number;
}

interface BudgetData {
  year: number;
  month: number;
  class_name: string;
  budget_revenue: number;
}

interface ChartData {
  monthly: MonthlyChartData[];
  classMonthly: ClassMonthlyData[];
}

interface DashboardData {
  summary: DashboardSummary;
  byClass: ClassSummary[];
  byCustomer: CustomerSummary[];
  filterOptions: FilterOptions;
  filters: {
    years?: number[];
    months?: number[];
    className?: string;
    customerId?: string;
    view: string;
  };
  chartData?: ChartData;
  lastUpdated: string;
}

// Format currency - rounded to nearest dollar with commas (for table rows)
function formatCurrency(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

// Format currency compact - abbreviated K/M format (for KPI cards)
function formatCurrencyCompact(value: number): string {
  if (Math.abs(value) >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${Math.round(value).toLocaleString()}`;
}

// Format number with commas
function formatNumber(value: number): string {
  return value.toLocaleString();
}

// Format percent
function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

// Month names
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Filter Chip Component
function FilterChip({ label, selected, onClick, count }: {
  label: string;
  selected: boolean;
  onClick: () => void;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all ${
        selected
          ? 'bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/30'
          : 'bg-[#1E293B] text-[#94A3B8] border border-white/[0.04] hover:bg-[#334155] hover:text-white'
      }`}
    >
      {label}
      {count !== undefined && <span className="ml-1.5 opacity-60">({count})</span>}
    </button>
  );
}

// Expandable Row Component
function ExpandableRow({
  data,
  type,
  index,
  maxRevenue,
  onExpand,
  isExpanded,
  childData,
}: {
  data: ClassSummary | CustomerSummary;
  type: 'class' | 'customer';
  index: number;
  maxRevenue: number;
  onExpand: () => void;
  isExpanded: boolean;
  childData?: Array<ClassSummary | CustomerSummary>;
}) {
  const isEvenRow = index % 2 === 0;
  const gpColor = data.avg_gross_profit_pct >= 50 ? '#22C55E' : data.avg_gross_profit_pct >= 40 ? '#F59E0B' : '#EF4444';
  const name = type === 'class' ? (data as ClassSummary).class_name : (data as CustomerSummary).customer_name;
  const category = type === 'class' ? (data as ClassSummary).class_category : '';

  return (
    <div className={isEvenRow ? 'bg-[#131B28]' : 'bg-[#111827]'}>
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.02, duration: 0.15 }}
        onClick={onExpand}
        className={`grid gap-4 px-6 py-3.5 cursor-pointer transition-all hover:bg-[#1a2740] ${
          isExpanded ? 'bg-[#38BDF8]/5 ring-1 ring-inset ring-[#38BDF8]/20' : ''
        }`}
        style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 80px' }}
      >
        {/* Name */}
        <div className="flex items-center gap-3">
          <motion.span
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ duration: 0.15 }}
            className="text-[#64748B] text-[10px]"
          >
            ▶
          </motion.span>
          <div>
            <div className="font-medium text-[#EAF2FF] text-[13px]">{name}</div>
            {category && <div className="text-[10px] text-[#64748B]">{category}</div>}
          </div>
        </div>

        {/* Units */}
        <div className="text-right">
          <div className="text-[#CBD5E1] font-semibold text-[13px]">{formatNumber(data.total_units)}</div>
          <div className="text-[10px] text-[#64748B]">units</div>
        </div>

        {/* Revenue */}
        <div className="text-right">
          <div className="text-[#CBD5E1] font-semibold text-[13px]">{formatCurrency(data.total_revenue)}</div>
          <div className="w-16 h-[3px] rounded-full bg-white/10 overflow-hidden mt-1 ml-auto">
            <div
              className="h-full rounded-full bg-[#38BDF8]"
              style={{ width: `${(data.total_revenue / maxRevenue) * 100}%` }}
            />
          </div>
        </div>

        {/* Cost */}
        <div className="text-right">
          <div className="text-[#CBD5E1] font-semibold text-[13px]">{formatCurrency(data.total_cost)}</div>
          <div className="text-[10px] text-[#64748B]">COGS</div>
        </div>

        {/* Gross Profit */}
        <div className="text-right">
          <div className="text-[#CBD5E1] font-semibold text-[13px]">{formatCurrency(data.total_gross_profit)}</div>
          <div className="text-[10px] text-[#64748B]">GP</div>
        </div>

        {/* GP% */}
        <div className="text-center">
          <span
            className="inline-flex items-center gap-1.5 justify-center px-2.5 py-1 rounded-full text-[11px] font-semibold"
            style={{ backgroundColor: `${gpColor}20`, color: gpColor }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: gpColor }} />
            {formatPercent(data.avg_gross_profit_pct)}
          </span>
        </div>
      </motion.div>

      {/* Expanded Child Data */}
      <AnimatePresence>
        {isExpanded && childData && childData.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mx-4 mb-4 rounded-lg bg-[#0B1220] border border-white/[0.04] shadow-[inset_0_2px_8px_rgba(0,0,0,0.3)] overflow-hidden">
              {/* Child Header */}
              <div
                className="grid gap-4 px-4 py-2 bg-[#0F172A] border-b border-white/[0.04] text-[10px] font-semibold text-[#64748B] uppercase tracking-wider"
                style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 80px' }}
              >
                <div>{type === 'class' ? 'Customer' : 'Class'}</div>
                <div className="text-right">Units</div>
                <div className="text-right">Revenue</div>
                <div className="text-right">Cost</div>
                <div className="text-right">GP</div>
                <div className="text-center">GP%</div>
              </div>

              {/* Child Rows */}
              {childData.map((child, idx) => {
                const childName = type === 'class'
                  ? (child as CustomerSummary).customer_name
                  : (child as ClassSummary).class_name;
                const childGpColor = child.avg_gross_profit_pct >= 50 ? '#22C55E' : child.avg_gross_profit_pct >= 40 ? '#F59E0B' : '#EF4444';

                return (
                  <div
                    key={idx}
                    className={`grid gap-4 px-4 py-2.5 ${idx % 2 === 0 ? 'bg-[#0B1220]' : 'bg-[#0F1729]'} hover:bg-[#1a2740] transition-colors`}
                    style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 80px' }}
                  >
                    <div className="text-[12px] text-[#CBD5E1]">{childName}</div>
                    <div className="text-right text-[12px] text-[#94A3B8]">{formatNumber(child.total_units)}</div>
                    <div className="text-right text-[12px] text-[#94A3B8]">{formatCurrency(child.total_revenue)}</div>
                    <div className="text-right text-[12px] text-[#94A3B8]">{formatCurrency(child.total_cost)}</div>
                    <div className="text-right text-[12px] text-[#94A3B8]">{formatCurrency(child.total_gross_profit)}</div>
                    <div className="text-center">
                      <span
                        className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-medium"
                        style={{ backgroundColor: `${childGpColor}15`, color: childGpColor }}
                      >
                        {formatPercent(child.avg_gross_profit_pct)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Loading Skeleton
function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* KPI Skeletons */}
      <div className="grid grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-32 rounded-xl bg-[#151F2E] border border-white/[0.04]" />
        ))}
      </div>

      {/* Filter Skeleton */}
      <div className="h-16 rounded-xl bg-[#151F2E] border border-white/[0.04]" />

      {/* Table Skeleton */}
      <div className="rounded-xl bg-[#151F2E] border border-white/[0.04] overflow-hidden">
        <div className="h-12 bg-[#0F172A] border-b border-white/[0.04]" />
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-14 border-b border-white/[0.04]" />
        ))}
      </div>
    </div>
  );
}

export default function DiversifiedDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<'table' | 'charts'>('table');
  const [budgetData, setBudgetData] = useState<BudgetData[]>([]);

  // Filter state
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'class' | 'customer'>('class');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Child data for expanded rows
  const [childData, setChildData] = useState<Array<ClassSummary | CustomerSummary>>([]);
  const [loadingChild, setLoadingChild] = useState(false);

  // Fetch dashboard data
  const fetchData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      if (selectedYears.length > 0) params.set('years', selectedYears.join(','));
      if (selectedMonths.length > 0) params.set('months', selectedMonths.join(','));
      if (selectedClass) params.set('className', selectedClass);
      if (selectedCustomer) params.set('customerId', selectedCustomer);
      params.set('view', viewMode);

      // Request chart data when on charts tab
      if (activeTab === 'charts') {
        params.set('charts', 'true');
      }

      const response = await fetch(`/api/diversified?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch data');

      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch budget data for charts
  const fetchBudgetData = async () => {
    try {
      const response = await fetch('/api/diversified/budgets');
      if (response.ok) {
        const result = await response.json();
        setBudgetData(result.budgets || []);
      }
    } catch (err) {
      console.error('Error fetching budget data:', err);
    }
  };

  // Fetch child data when expanding a row
  const fetchChildData = async (rowId: string, type: 'class' | 'customer') => {
    setLoadingChild(true);
    try {
      const params = new URLSearchParams();
      if (selectedYears.length > 0) params.set('years', selectedYears.join(','));
      if (selectedMonths.length > 0) params.set('months', selectedMonths.join(','));

      if (type === 'class') {
        params.set('className', rowId);
        params.set('view', 'customer');
      } else {
        params.set('customerId', rowId);
        params.set('view', 'class');
      }

      const response = await fetch(`/api/diversified?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch child data');

      const result = await response.json();
      setChildData(type === 'class' ? result.byCustomer : result.byClass);
    } catch (err) {
      console.error('Error fetching child data:', err);
      setChildData([]);
    } finally {
      setLoadingChild(false);
    }
  };

  // Sync from NetSuite
  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/diversified/sync', { method: 'POST' });
      const result = await response.json();

      if (result.success) {
        await fetchData();
        alert(`Sync complete: ${result.stats.totalUpserted} records synced`);
      } else {
        alert(`Sync failed: ${result.message}`);
      }
    } catch (err) {
      alert('Sync failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSyncing(false);
    }
  };

  // Initial load and refresh on filter/tab change
  useEffect(() => {
    fetchData();
  }, [selectedYears, selectedMonths, selectedClass, selectedCustomer, viewMode, activeTab]);

  // Fetch budget data on mount
  useEffect(() => {
    fetchBudgetData();
  }, []);

  // Handle row expansion
  const handleRowExpand = (rowId: string, type: 'class' | 'customer') => {
    if (expandedRow === rowId) {
      setExpandedRow(null);
      setChildData([]);
    } else {
      setExpandedRow(rowId);
      fetchChildData(rowId, type);
    }
  };

  // Reset filters
  const resetFilters = () => {
    setSelectedYears([]);
    setSelectedMonths([]);
    setSelectedClass(null);
    setSelectedCustomer(null);
    setExpandedRow(null);
    setChildData([]);
  };

  // Max revenue for progress bars
  const maxRevenue = useMemo(() => {
    if (!data) return 1;
    const list = viewMode === 'class' ? data.byClass : data.byCustomer;
    return Math.max(...list.map(d => d.total_revenue), 1);
  }, [data, viewMode]);

  return (
    <div className="min-h-screen bg-[#0a0f1a]">
      <Sidebar />
      <DashboardBackground {...backgroundPresets.finance} />

      <main
        className="transition-all duration-300 relative z-10"
        style={{ marginLeft: SIDEBAR_WIDTH }}
      >
        <div className="p-8 max-w-[1800px] mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between mb-8"
          >
            <div>
              <h1 className="text-3xl font-bold text-[#EAF2FF] tracking-tight">Diversified Products</h1>
              <p className="text-[#64748B] mt-1">
                Sales performance by class and customer
                {data?.lastUpdated && (
                  <span className="text-[#475569]"> · Last updated {new Date(data.lastUpdated).toLocaleString()}</span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSync}
                disabled={syncing}
                className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-all flex items-center gap-2 ${
                  syncing
                    ? 'bg-[#1E293B] text-[#64748B] cursor-not-allowed'
                    : 'bg-[#22C55E]/20 text-[#22C55E] hover:bg-[#22C55E]/30 border border-[#22C55E]/30'
                }`}
              >
                {syncing ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Syncing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Sync NetSuite
                  </>
                )}
              </button>
            </div>
          </motion.div>

          {loading ? (
            <LoadingSkeleton />
          ) : error ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-8 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-center"
            >
              <p className="font-medium mb-2">Error loading dashboard</p>
              <p className="text-[13px] opacity-80">{error}</p>
              <button
                onClick={fetchData}
                className="mt-4 px-4 py-2 rounded-lg bg-[#EF4444]/20 hover:bg-[#EF4444]/30 transition-colors"
              >
                Retry
              </button>
            </motion.div>
          ) : data ? (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-6 gap-4 mb-6">
                <KPICard
                  title="Total Revenue"
                  value={formatCurrencyCompact(data.summary.totalRevenue)}
                  subtitle={`${data.summary.transactionCount} transactions`}
                  icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                  color="#38BDF8"
                  delay={0}
                />
                <KPICard
                  title="Units Sold"
                  value={formatNumber(data.summary.totalUnits)}
                  subtitle={`${data.summary.uniqueClasses} classes`}
                  icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>}
                  color="#22D3EE"
                  delay={0.05}
                />
                <KPICard
                  title="Total COGS"
                  value={formatCurrencyCompact(data.summary.totalCost)}
                  subtitle="Cost of goods sold"
                  icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>}
                  color="#F59E0B"
                  delay={0.1}
                />
                <KPICard
                  title="Gross Profit"
                  value={formatCurrencyCompact(data.summary.grossProfit)}
                  subtitle={`${data.summary.uniqueCustomers} customers`}
                  icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
                  color="#22C55E"
                  delay={0.15}
                />
                <KPICard
                  title="Gross Margin"
                  value={formatPercent(data.summary.grossProfitPct)}
                  subtitle="Overall margin"
                  icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>}
                  color="#A855F7"
                  delay={0.2}
                />
                <KPICard
                  title="vs Budget"
                  value={data.summary.variancePct !== null ? `${data.summary.variancePct >= 0 ? '+' : ''}${formatPercent(data.summary.variancePct)}` : 'N/A'}
                  subtitle={data.summary.budgetRevenue > 0 ? `Budget: ${formatCurrencyCompact(data.summary.budgetRevenue)}` : 'No budget data'}
                  icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
                  color={data.summary.variancePct !== null && data.summary.variancePct >= 0 ? '#22C55E' : '#EF4444'}
                  trend={data.summary.variancePct !== null ? (data.summary.variancePct >= 0 ? 'up' : 'down') : undefined}
                  delay={0.25}
                />
              </div>

              {/* Tab Navigation */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.28 }}
                className="flex items-center gap-1 mb-6"
              >
                <button
                  onClick={() => setActiveTab('table')}
                  className={`px-4 py-2.5 rounded-lg text-[13px] font-medium transition-all flex items-center gap-2 ${
                    activeTab === 'table'
                      ? 'bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/30 shadow-[0_0_20px_rgba(56,189,248,0.15)]'
                      : 'bg-[#1E293B] text-[#94A3B8] border border-white/[0.04] hover:bg-[#334155] hover:text-white'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Data Table
                </button>
                <button
                  onClick={() => setActiveTab('charts')}
                  className={`px-4 py-2.5 rounded-lg text-[13px] font-medium transition-all flex items-center gap-2 ${
                    activeTab === 'charts'
                      ? 'bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/30 shadow-[0_0_20px_rgba(56,189,248,0.15)]'
                      : 'bg-[#1E293B] text-[#94A3B8] border border-white/[0.04] hover:bg-[#334155] hover:text-white'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                  </svg>
                  Charts
                </button>
              </motion.div>

              {/* Filters */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="p-4 rounded-xl bg-[#151F2E] border border-white/[0.04] mb-6"
              >
                <div className="flex items-center gap-6">
                  {/* View Toggle - Only on table view */}
                  {activeTab === 'table' && (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">View:</span>
                        <div className="flex rounded-lg overflow-hidden border border-white/[0.04]">
                          <button
                            onClick={() => { setViewMode('class'); setExpandedRow(null); setChildData([]); }}
                            className={`px-3 py-1.5 text-[12px] font-medium transition-all ${
                              viewMode === 'class'
                                ? 'bg-[#38BDF8]/20 text-[#38BDF8]'
                                : 'bg-[#1E293B] text-[#94A3B8] hover:text-white'
                            }`}
                          >
                            By Class
                          </button>
                          <button
                            onClick={() => { setViewMode('customer'); setExpandedRow(null); setChildData([]); }}
                            className={`px-3 py-1.5 text-[12px] font-medium transition-all ${
                              viewMode === 'customer'
                                ? 'bg-[#38BDF8]/20 text-[#38BDF8]'
                                : 'bg-[#1E293B] text-[#94A3B8] hover:text-white'
                            }`}
                          >
                            By Customer
                          </button>
                        </div>
                      </div>
                      <div className="h-6 w-px bg-white/[0.08]" />
                    </>
                  )}

                  {/* Year Filter */}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Year:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {data.filterOptions.years.map(year => (
                        <FilterChip
                          key={year}
                          label={year.toString()}
                          selected={selectedYears.includes(year)}
                          onClick={() => {
                            setSelectedYears(prev =>
                              prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year]
                            );
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="h-6 w-px bg-white/[0.08]" />

                  {/* Month Filter */}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Month:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {data.filterOptions.months.map(month => (
                        <FilterChip
                          key={month}
                          label={MONTH_NAMES[month - 1]}
                          selected={selectedMonths.includes(month)}
                          onClick={() => {
                            setSelectedMonths(prev =>
                              prev.includes(month) ? prev.filter(m => m !== month) : [...prev, month]
                            );
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex-1" />

                  {/* Reset */}
                  {(selectedYears.length > 0 || selectedMonths.length > 0 || selectedClass || selectedCustomer) && (
                    <button
                      onClick={resetFilters}
                      className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-[#EF4444] bg-[#EF4444]/10 hover:bg-[#EF4444]/20 transition-colors"
                    >
                      Reset Filters
                    </button>
                  )}
                </div>
              </motion.div>

              {/* Main Table - Only show on table view */}
              {activeTab === 'table' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="rounded-xl bg-[#151F2E] border border-white/[0.04] overflow-hidden shadow-[0_4px_16px_rgba(0,0,0,0.25)]"
              >
                {/* Table Header */}
                <div
                  className="grid gap-4 px-6 py-3 bg-[#0F172A] border-b border-white/[0.04] text-[10px] font-semibold text-[#64748B] uppercase tracking-wider"
                  style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 80px' }}
                >
                  <div>{viewMode === 'class' ? 'Class' : 'Customer'}</div>
                  <div className="text-right">Units</div>
                  <div className="text-right">Revenue</div>
                  <div className="text-right">Cost</div>
                  <div className="text-right">Gross Profit</div>
                  <div className="text-center">GP%</div>
                </div>

                {/* Table Body */}
                <div className="max-h-[600px] overflow-y-auto">
                  {(viewMode === 'class' ? data.byClass : data.byCustomer).map((row, idx) => {
                    const rowId = viewMode === 'class'
                      ? (row as ClassSummary).class_name
                      : (row as CustomerSummary).customer_id || (row as CustomerSummary).customer_name;

                    return (
                      <ExpandableRow
                        key={rowId}
                        data={row}
                        type={viewMode}
                        index={idx}
                        maxRevenue={maxRevenue}
                        isExpanded={expandedRow === rowId}
                        onExpand={() => handleRowExpand(rowId, viewMode)}
                        childData={expandedRow === rowId ? childData : undefined}
                      />
                    );
                  })}

                  {(viewMode === 'class' ? data.byClass : data.byCustomer).length === 0 && (
                    <div className="p-12 text-center">
                      <div className="text-[#64748B] text-[14px]">No data available</div>
                      <p className="text-[#475569] text-[12px] mt-1">
                        Try syncing from NetSuite or adjusting your filters
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
              )}

              {/* Charts View */}
              {activeTab === 'charts' && data.chartData && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  {/* Row 1: Revenue Trend + Budget Variance */}
                  <div className="grid grid-cols-2 gap-6">
                    <RevenueAreaChart data={data.chartData.monthly} index={0} />
                    <BudgetVarianceChart
                      actualData={data.chartData.monthly}
                      budgetData={budgetData}
                      selectedYear={selectedYears.length === 1 ? selectedYears[0] : undefined}
                      selectedMonths={selectedMonths}
                      index={1}
                    />
                  </div>

                  {/* Row 2: Class Bar + Customer Donut */}
                  <div className="grid grid-cols-2 gap-6">
                    <ClassBarChart
                      data={data.byClass}
                      classMonthlyData={data.chartData?.classMonthly}
                      selectedYear={selectedYears.length === 1 ? selectedYears[0] : undefined}
                      index={2}
                    />
                    <CustomerDonut data={data.byCustomer} index={3} />
                  </div>
                </motion.div>
              )}

              {/* Charts Loading State */}
              {activeTab === 'charts' && !data.chartData && (
                <div className="p-12 text-center">
                  <div className="text-[#64748B] text-[14px]">Loading chart data...</div>
                  <p className="text-[#475569] text-[12px] mt-1">
                    Please wait while we fetch the visualization data
                  </p>
                </div>
              )}
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}
