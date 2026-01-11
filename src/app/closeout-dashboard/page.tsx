'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar, { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from '@/components/Sidebar';
import { DashboardBackground, backgroundPresets, KPICard } from '@/components/mars-ui';
import AIInsightsPanel from '@/components/AIInsightsPanel';
import ProfitabilityTrendChart from '@/components/ProfitabilityTrendChart';
import ProfitabilityMatrix from '@/components/ProfitabilityMatrix';

interface Project {
  customer_name: string;
  project_type: string;
  total_revenue: number;
  total_cogs: number;
  gross_profit: number;
  gross_profit_pct: number;
  transaction_count: number;
  budget_revenue: number;
  budget_cogs: number;
  budget_gp: number;
  revenue_variance: number;
  gp_variance: number;
  is_at_risk: boolean;
}

interface MonthlyData {
  year: number;
  month: number;
  monthName: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossProfitPct: number;
}

interface TypeBreakdown {
  project_type: string;
  total_revenue: number;
  total_cogs: number;
  gross_profit: number;
  gross_profit_pct: number;
  project_count: number;
}

interface DashboardData {
  summary: {
    totalRevenue: number;
    totalCogs: number;
    grossProfit: number;
    grossProfitPct: number;
    projectCount: number;
    atRiskCount: number;
  };
  budgetVariance: {
    revenueVariance: number;
    cogsVariance: number;
    gpVariance: number;
    budgetRevenue: number;
    budgetCogs: number;
    budgetGp: number;
  };
  projects: Project[];
  monthly: MonthlyData[];
  types: TypeBreakdown[];
  filterOptions: {
    years: number[];
    projectTypes: string[];
    customers: string[];
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
  return `${value.toFixed(1)}%`;
}

// Project Row Component
function ProjectRow({ project, index, isSelected, onSelect }: {
  project: Project;
  index: number;
  isSelected: boolean;
  onSelect: (project: Project) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const isAtRisk = project.is_at_risk;
  const gpmColor = project.gross_profit_pct >= 60 ? '#22C55E' : project.gross_profit_pct >= 50 ? '#F59E0B' : '#EF4444';
  const isEvenRow = index % 2 === 0;

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
          onSelect(project);
        }}
        className="grid gap-4 px-6 py-3.5 cursor-pointer transition-colors"
        style={{ gridTemplateColumns: '2fr 0.8fr 1fr 1fr 1fr 0.8fr 0.8fr' }}
      >
        <div className="flex items-center gap-3">
          <div>
            <div className="font-medium text-[#EAF2FF] text-[13px]">{project.customer_name}</div>
            <div className="text-[10px] text-[#64748B]">{project.project_type || 'Unknown'}</div>
          </div>
        </div>

        <div className="text-center">
          <div className="text-[#CBD5E1] font-medium text-[13px]">
            {project.transaction_count}
          </div>
          <div className="text-[10px] text-[#64748B]">Transactions</div>
        </div>

        <div className="text-right">
          <div className="text-[#CBD5E1] font-semibold text-[13px]">{formatCurrency(project.total_revenue)}</div>
          <div className="text-[10px] text-[#64748B]">Revenue</div>
        </div>

        <div className="text-right">
          <div className="text-[#CBD5E1] font-semibold text-[13px]">{formatCurrency(project.total_cogs)}</div>
          <div className="text-[10px] text-[#64748B]">COGS</div>
        </div>

        <div className="text-right">
          <div className="text-[#CBD5E1] font-semibold text-[13px]">{formatCurrency(project.gross_profit)}</div>
          <div className="text-[10px] text-[#64748B]">Gross Profit</div>
        </div>

        <div className="text-center">
          <span
            className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-[11px] font-semibold"
            style={{ backgroundColor: `${gpmColor}20`, color: gpmColor }}
          >
            {formatPercent(project.gross_profit_pct)}
          </span>
        </div>

        <div className="text-right">
          <div className={`font-semibold text-[13px] ${project.gp_variance >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
            {project.gp_variance >= 0 ? '+' : ''}{formatCurrency(project.gp_variance)}
          </div>
          {/* Variance indicator bar */}
          <div className="w-12 h-[3px] rounded-full bg-white/10 overflow-hidden mt-1 ml-auto">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, Math.abs(project.gp_variance / (project.budget_gp || 1)) * 100)}%`,
                background: project.gp_variance >= 0 ? '#22C55E' : '#EF4444'
              }}
            />
          </div>
        </div>
      </div>

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
              <div className="grid grid-cols-5 gap-6">
                <div>
                  <div className="text-[9px] text-[#475569] uppercase tracking-wider mb-1">Budget Revenue</div>
                  <div className="text-[#CBD5E1] font-medium text-[13px]">{formatCurrency(project.budget_revenue)}</div>
                </div>
                <div>
                  <div className="text-[9px] text-[#475569] uppercase tracking-wider mb-1">Budget GP</div>
                  <div className="text-[#CBD5E1] font-medium text-[13px]">{formatCurrency(project.budget_gp)}</div>
                </div>
                <div>
                  <div className="text-[9px] text-[#475569] uppercase tracking-wider mb-1">Revenue Variance</div>
                  <div className={`font-medium text-[13px] ${project.revenue_variance >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                    {project.revenue_variance >= 0 ? '+' : ''}{formatCurrency(project.revenue_variance)}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] text-[#475569] uppercase tracking-wider mb-1">Project Type</div>
                  <div className="text-[#CBD5E1] font-medium text-[13px]">{project.project_type || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-[9px] text-[#475569] uppercase tracking-wider mb-1">Transactions</div>
                  <div className="text-[#CBD5E1] font-medium text-[13px]">{project.transaction_count || 0}</div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Type Breakdown Bar
function TypeBreakdownBar({ type, maxRevenue }: { type: TypeBreakdown; maxRevenue: number }) {
  const barWidth = maxRevenue > 0 ? (type.total_revenue / maxRevenue) * 100 : 0;
  const gpmColor = type.gross_profit_pct >= 60 ? '#22C55E' : type.gross_profit_pct >= 50 ? '#F59E0B' : '#EF4444';

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[13px] text-[#CBD5E1] font-medium">{type.project_type}</span>
        <div className="flex items-center gap-4">
          <span className="text-[12px] text-[#8FA3BF]">{formatCurrency(type.total_revenue)}</span>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: `${gpmColor}20`, color: gpmColor }}>
            {formatPercent(type.gross_profit_pct)}
          </span>
        </div>
      </div>
      <div className="h-2 bg-white/[0.08] rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${barWidth}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${gpmColor}80, ${gpmColor})` }}
        />
      </div>
    </div>
  );
}

// Monthly Trend Mini Chart
function MonthlyTrendChart({ data }: { data: MonthlyData[] }) {
  if (!data || data.length === 0) return null;

  const maxRevenue = Math.max(...data.map(d => d.revenue));
  const chartHeight = 80;

  return (
    <div className="rounded-xl bg-[#111827] border border-white/[0.04] shadow-[0_4px_16px_rgba(0,0,0,0.2)] p-4">
      <h3 className="text-[10px] font-semibold text-[#475569] uppercase tracking-[0.08em] mb-3">
        Monthly Revenue Trend
      </h3>
      <div className="flex items-end gap-1" style={{ height: chartHeight }}>
        {data.slice(-12).map((d, i) => {
          const height = maxRevenue > 0 ? (d.revenue / maxRevenue) * chartHeight : 0;
          const gpmColor = d.grossProfitPct >= 60 ? '#22C55E' : d.grossProfitPct >= 50 ? '#F59E0B' : '#EF4444';

          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
                className="w-full rounded-t"
                style={{ backgroundColor: gpmColor }}
              />
              <span className="text-[8px] text-[#64748B]">{d.monthName}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CloseoutDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'revenue' | 'gpm' | 'variance' | 'transactions'>('revenue');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showAtRiskOnly, setShowAtRiskOnly] = useState(false);
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Fetch data
  const fetchData = async (bust = false) => {
    try {
      setLoading(true);
      const yearsParam = selectedYears.length > 0 ? `&years=${selectedYears.join(',')}` : '';
      const typesParam = selectedType !== 'all' ? `&types=${selectedType}` : '';
      const response = await fetch(`/api/profitability?view=dashboard${yearsParam}${typesParam}${bust ? '&bust=true' : ''}`);
      const result = await response.json();

      if (result.error) {
        setError(result.message || result.error);
      } else {
        setData(result);
        setError(null);
      }
    } catch (err) {
      setError('Failed to load profitability data');
    } finally {
      setLoading(false);
    }
  };

  // Sync from NetSuite
  const syncData = async () => {
    try {
      setSyncing(true);
      const response = await fetch('/api/profitability/sync?mode=delta', { method: 'POST' });
      const result = await response.json();

      if (result.success) {
        // Refresh data after sync
        await fetchData(true);
      } else {
        setError(result.message || 'Sync failed');
      }
    } catch (err) {
      setError('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedYears, selectedType]);

  // Sortable header click handler
  const handleHeaderClick = (field: 'revenue' | 'gpm' | 'variance' | 'transactions') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const filteredProjects = useMemo(() => {
    if (!data) return [];

    let projects = [...data.projects];

    // Filter at-risk
    if (showAtRiskOnly) {
      projects = projects.filter(p => p.is_at_risk);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      projects = projects.filter(p =>
        p.customer_name.toLowerCase().includes(query) ||
        p.project_type?.toLowerCase().includes(query)
      );
    }

    // Sort
    return [...projects].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'revenue':
          comparison = b.total_revenue - a.total_revenue;
          break;
        case 'gpm':
          comparison = b.gross_profit_pct - a.gross_profit_pct;
          break;
        case 'variance':
          comparison = b.gp_variance - a.gp_variance;
          break;
        case 'transactions':
          comparison = b.transaction_count - a.transaction_count;
          break;
        default:
          comparison = 0;
      }
      return sortDirection === 'asc' ? -comparison : comparison;
    });
  }, [data, searchQuery, sortField, sortDirection, showAtRiskOnly]);

  // Calculate filtered KPIs
  const filteredKpis = useMemo(() => {
    if (!data || filteredProjects.length === 0) {
      return {
        totalRevenue: 0,
        totalCogs: 0,
        grossProfit: 0,
        grossProfitPct: 0,
        projectCount: 0,
        atRiskCount: 0,
      };
    }

    let totalRevenue = 0;
    let totalCogs = 0;
    let atRiskCount = 0;

    filteredProjects.forEach(p => {
      totalRevenue += p.total_revenue;
      totalCogs += p.total_cogs;
      if (p.is_at_risk) atRiskCount++;
    });

    const grossProfit = totalRevenue - totalCogs;
    const grossProfitPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    return {
      totalRevenue,
      totalCogs,
      grossProfit,
      grossProfitPct,
      projectCount: filteredProjects.length,
      atRiskCount,
    };
  }, [data, filteredProjects]);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#0F1722] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-[#22C55E]/20 border-t-[#22C55E] rounded-full animate-spin mx-auto mb-4" />
          <div className="text-[#8FA3BF]">Loading profitability data...</div>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-[#0F1722] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-[#EF4444] text-xl mb-2">Error Loading Data</div>
          <div className="text-[#8FA3BF] mb-4">{error}</div>
          <p className="text-[#64748B] text-sm mb-4">
            Make sure the database migration has been applied and data has been synced from NetSuite.
          </p>
          <button
            onClick={syncData}
            disabled={syncing}
            className="px-4 py-2 rounded-lg bg-[#22C55E] text-white font-medium hover:bg-[#16A34A] transition-colors disabled:opacity-50"
          >
            {syncing ? 'Syncing...' : 'Sync from NetSuite'}
          </button>
        </div>
      </div>
    );
  }

  const maxTypeRevenue = data?.types ? Math.max(...data.types.map(t => t.total_revenue)) : 0;

  return (
    <div className="min-h-screen bg-[#0B1220] relative overflow-hidden">
      <DashboardBackground {...backgroundPresets.finance} />
      <Sidebar isCollapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />

      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-to-b from-[#0F1722] via-[#0B1220] to-[#0B1220]" />

      {/* Main Content */}
      <motion.div
        className="relative z-10 text-white"
        animate={{ marginLeft: sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        {/* Header */}
        <header className="border-b border-white/[0.04] bg-[#0B1220]/90 backdrop-blur-xl sticky top-0 z-50">
          <div className="max-w-[1600px] mx-auto px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold text-[#EAF2FF] tracking-tight">Project Profitability</h1>
                <p className="text-[11px] text-[#475569] mt-0.5">
                  Financial Performance & Margin Analysis
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-[11px] text-[#475569] flex items-center gap-2 justify-end">
                    <span className={`w-1.5 h-1.5 rounded-full ${syncing ? 'bg-[#F59E0B] animate-pulse' : 'bg-[#22C55E]'}`} />
                    {data?.lastUpdated ? (
                      <>
                        Updated {(() => {
                          const mins = Math.floor((Date.now() - new Date(data.lastUpdated).getTime()) / 60000);
                          if (mins < 1) return 'just now';
                          if (mins < 60) return `${mins} min ago`;
                          const hours = Math.floor(mins / 60);
                          if (hours < 24) return `${hours}h ago`;
                          return `${Math.floor(hours / 24)}d ago`;
                        })()}
                      </>
                    ) : 'Not synced'}
                  </div>
                  <div className="text-[#38BDF8] font-medium text-[12px]">
                    NetSuite Live
                  </div>
                </div>
                <button
                  onClick={syncData}
                  disabled={syncing}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                  title="Sync from NetSuite"
                >
                  <svg className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-[1600px] mx-auto px-8 py-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-5 gap-4 mb-8">
            <KPICard
              title="Total Revenue"
              value={formatCurrency(filteredKpis.totalRevenue)}
              subtitle={`${filteredKpis.projectCount} projects`}
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              color="#22C55E"
            />
            <KPICard
              title="Total COGS"
              value={formatCurrency(filteredKpis.totalCogs)}
              subtitle="Cost of goods sold"
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>}
              color="#F59E0B"
            />
            <KPICard
              title="Gross Profit"
              value={formatCurrency(filteredKpis.grossProfit)}
              subtitle="Revenue minus COGS"
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
              color="#38BDF8"
            />
            <KPICard
              title="Overall GPM"
              value={formatPercent(filteredKpis.grossProfitPct)}
              subtitle="Gross profit margin"
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
              color={filteredKpis.grossProfitPct >= 60 ? '#22C55E' : filteredKpis.grossProfitPct >= 50 ? '#F59E0B' : '#EF4444'}
            />
            <div
              onClick={() => setShowAtRiskOnly(!showAtRiskOnly)}
              className={`cursor-pointer transition-all ${showAtRiskOnly ? 'ring-2 ring-[#EF4444] ring-offset-2 ring-offset-[#0F1722] rounded-xl' : ''}`}
            >
              <KPICard
                title="At Risk Projects"
                value={filteredKpis.atRiskCount.toString()}
                subtitle={showAtRiskOnly ? 'Click to show all' : 'GPM < 50%'}
                icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
                color="#EF4444"
              />
            </div>
          </div>

          {/* Charts Row - Trend Chart + AI Insights */}
          <div className="grid grid-cols-3 gap-6 mb-6">
            <div className="col-span-2">
              <ProfitabilityTrendChart data={data?.monthly || []} height={280} />
            </div>
            <div className="col-span-1">
              <AIInsightsPanel
                projects={filteredProjects}
                types={data?.types || []}
                monthly={data?.monthly || []}
                totalRevenue={filteredKpis.totalRevenue}
                grossProfitPct={filteredKpis.grossProfitPct}
              />
            </div>
          </div>

          {/* Profitability Matrix */}
          <div className="mb-6">
            <ProfitabilityMatrix
              projects={filteredProjects}
              height={300}
              onProjectSelect={(project) => {
                if (project) {
                  setSelectedProject(project as Project);
                }
              }}
            />
          </div>

          <div className="grid grid-cols-4 gap-6">
            {/* Main Content - Project List */}
            <div className="col-span-3">
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
                        placeholder="Search projects..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-lg bg-[#0F1722] border border-white/10 text-[#EAF2FF] placeholder-[#64748B] focus:outline-none focus:border-[#22C55E]/50 text-[13px]"
                      />
                    </div>

                    <select
                      value={selectedType}
                      onChange={e => setSelectedType(e.target.value)}
                      className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none text-sm"
                    >
                      <option value="all">All Types</option>
                      {data?.filterOptions?.projectTypes?.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>

                    <select
                      value={selectedYears.length > 0 ? selectedYears[0].toString() : 'all'}
                      onChange={e => setSelectedYears(e.target.value === 'all' ? [] : [parseInt(e.target.value)])}
                      className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none text-sm"
                    >
                      <option value="all">All Years</option>
                      {data?.filterOptions?.years?.map(year => (
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
                      <option value="variance">Sort by Variance</option>
                      <option value="transactions">Sort by Transactions</option>
                    </select>

                    <button
                      onClick={() => setShowAtRiskOnly(!showAtRiskOnly)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        showAtRiskOnly
                          ? 'bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30'
                          : 'bg-white/5 text-gray-400 border border-white/10'
                      }`}
                    >
                      {showAtRiskOnly ? 'At Risk Only' : 'Show All'}
                    </button>

                    <div className="text-[12px] text-[#64748B]">
                      {filteredProjects.length} projects
                    </div>
                  </div>
                </div>

                {/* Table Header */}
                <div
                  className="grid gap-4 px-6 py-2.5 text-[10px] font-semibold text-[#475569] uppercase tracking-[0.06em] border-b border-white/[0.04] bg-[#151F2E] sticky top-0 z-10 shadow-[0_1px_0_rgba(255,255,255,0.05)]"
                  style={{ gridTemplateColumns: '2fr 0.8fr 1fr 1fr 1fr 0.8fr 0.8fr' }}
                >
                  <div>Project</div>
                  <button
                    onClick={() => handleHeaderClick('transactions')}
                    className={`flex items-center gap-1 justify-center transition-colors hover:text-white ${sortField === 'transactions' ? 'text-[#38BDF8]' : ''}`}
                  >
                    Trans
                    {sortField === 'transactions' && (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sortDirection === 'desc' ? "M19 9l-7 7-7-7" : "M5 15l7-7 7 7"} />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => handleHeaderClick('revenue')}
                    className={`flex items-center gap-1 justify-end ml-auto transition-colors hover:text-white ${sortField === 'revenue' ? 'text-[#38BDF8]' : ''}`}
                  >
                    Revenue
                    {sortField === 'revenue' && (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sortDirection === 'desc' ? "M19 9l-7 7-7-7" : "M5 15l7-7 7 7"} />
                      </svg>
                    )}
                  </button>
                  <div className="text-right">COGS</div>
                  <div className="text-right">Gross Profit</div>
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
                  <button
                    onClick={() => handleHeaderClick('variance')}
                    className={`flex items-center gap-1 justify-end ml-auto transition-colors hover:text-white ${sortField === 'variance' ? 'text-[#38BDF8]' : ''}`}
                  >
                    Variance
                    {sortField === 'variance' && (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sortDirection === 'desc' ? "M19 9l-7 7-7-7" : "M5 15l7-7 7 7"} />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Project Rows */}
                <div className="max-h-[600px] overflow-y-auto">
                  {filteredProjects.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="text-[#64748B] mb-2">No projects found</div>
                      <button
                        onClick={syncData}
                        disabled={syncing}
                        className="text-[#38BDF8] hover:underline text-sm"
                      >
                        {syncing ? 'Syncing...' : 'Sync data from NetSuite'}
                      </button>
                    </div>
                  ) : (
                    filteredProjects.map((project, index) => (
                      <ProjectRow
                        key={project.customer_name}
                        project={project}
                        index={index}
                        isSelected={selectedProject?.customer_name === project.customer_name}
                        onSelect={(p) => setSelectedProject(p)}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Budget vs Actual */}
              {(() => {
                const budgetActualData = selectedProject ? {
                  budgetGP: selectedProject.budget_gp,
                  actualGP: selectedProject.gross_profit,
                  variance: selectedProject.gp_variance,
                  revenue: selectedProject.total_revenue,
                  gpm: selectedProject.gross_profit_pct,
                  label: selectedProject.customer_name,
                } : {
                  budgetGP: data?.budgetVariance?.budgetGp || 0,
                  actualGP: filteredKpis.grossProfit,
                  variance: data?.budgetVariance?.gpVariance || 0,
                  revenue: filteredKpis.totalRevenue,
                  gpm: filteredKpis.grossProfitPct,
                  label: selectedType !== 'all' ? `${selectedType} Projects` : 'All Projects',
                };

                const gpmColor = budgetActualData.gpm >= 60 ? '#22C55E' : budgetActualData.gpm >= 50 ? '#F59E0B' : '#EF4444';

                return (
                  <div className={`rounded-xl bg-[#111827] border shadow-[0_4px_16px_rgba(0,0,0,0.2)] p-4 ${selectedProject ? 'border-[#38BDF8]/20' : 'border-white/[0.04]'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className={`text-[10px] font-semibold uppercase tracking-[0.08em] ${selectedProject ? 'text-[#38BDF8]' : 'text-[#475569]'}`}>
                        Budget vs Actual
                      </h3>
                      {selectedProject && (
                        <button
                          onClick={() => setSelectedProject(null)}
                          className="text-[10px] text-[#64748B] hover:text-white transition-colors"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <div className="text-[12px] text-[#8FA3BF] mb-3 truncate">{budgetActualData.label}</div>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-[12px] mb-1">
                          <span className="text-[#8FA3BF]">Budget GP</span>
                          <span className="text-[#CBD5E1] font-medium">{formatCurrency(budgetActualData.budgetGP)}</span>
                        </div>
                        <div className="flex justify-between text-[12px] mb-1">
                          <span className="text-[#8FA3BF]">Actual GP</span>
                          <span className="text-[#CBD5E1] font-medium">{formatCurrency(budgetActualData.actualGP)}</span>
                        </div>
                        <div className="flex justify-between text-[12px] mb-1">
                          <span className="text-[#8FA3BF]">GP %</span>
                          <span
                            className="font-semibold px-2 py-0.5 rounded text-[11px]"
                            style={{ backgroundColor: `${gpmColor}20`, color: gpmColor }}
                          >
                            {formatPercent(budgetActualData.gpm)}
                          </span>
                        </div>
                        <div className="flex justify-between text-[12px] pt-2 border-t border-white/[0.06]">
                          <span className="text-[#8FA3BF]">Variance</span>
                          <span className={`font-semibold ${budgetActualData.variance >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                            {budgetActualData.variance >= 0 ? '+' : ''}{formatCurrency(budgetActualData.variance)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Monthly Trend */}
              {data?.monthly && data.monthly.length > 0 && (
                <MonthlyTrendChart data={data.monthly} />
              )}

              {/* Type Breakdown */}
              {!selectedProject && data?.types && data.types.length > 0 && (
                <div className="rounded-xl bg-[#111827] border border-white/[0.04] shadow-[0_4px_16px_rgba(0,0,0,0.2)] p-4">
                  <h3 className="text-[10px] font-semibold text-[#475569] uppercase tracking-[0.08em] mb-4">
                    Revenue by Type
                  </h3>
                  {data.types.slice(0, 8).map(type => (
                    <TypeBreakdownBar key={type.project_type} type={type} maxRevenue={maxTypeRevenue} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </motion.div>
    </div>
  );
}
