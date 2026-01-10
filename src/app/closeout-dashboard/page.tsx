'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar, { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from '@/components/Sidebar';
import { DashboardBackground, backgroundPresets, KPICard } from '@/components/mars-ui';

interface LineItem {
  itemNumber: string;
  itemDescription: string;
  budgetRevenue: number;
  budgetCost: number;
  budgetGP: number;
  actualRevenue: number;
  actualCost: number;
  actualGP: number;
  variance: number;
  year: number;
  month: number;
  comments: string;
}

interface NegativeVarianceItem {
  itemNumber: string;
  itemDescription: string;
  budgetGP: number;
  actualGP: number;
  variance: number;
  year: number;
  month: number;
  comments: string;
}

interface YearlyData {
  actualRevenue: number;
  actualCost: number;
  budgetRevenue: number;
  budgetGP: number;
  itemCount: number;
}

interface Project {
  project: string;
  projectKey: string;
  type: string;
  projectDate: string; // "Mon YYYY" format
  projectYear: number;
  projectMonth: number;
  actualRevenue: number;
  actualCost: number;
  actualGP: number;
  actualGPM: number;
  budgetRevenue: number;
  budgetGP: number;
  variance: number;
  variancePercent: number;
  itemCount: number;
  lineItems: LineItem[];
  negativeVarianceItems: NegativeVarianceItem[];
}

interface TypeBreakdown {
  type: string;
  revenue: number;
  cost: number;
  gp: number;
  gpm: number;
  count: number;
}

interface YearSummary {
  revenue: number;
  cost: number;
  gp: number;
  gpm: number;
}

interface CloseoutData {
  kpis: {
    totalRevenue: number;
    totalCost: number;
    totalGrossProfit: number;
    overallGPM: number;
    budgetRevenue: number;
    budgetGP: number;
    budgetVariance: number;
    projectCount: number;
    atRiskCount: number;
  };
  projects: Project[];
  atRiskProjects: Project[];
  yearSummary: Record<number, YearSummary>;
  allYears: number[];
  typeBreakdown: TypeBreakdown[];
  lastUpdated: string;
}

// Animated counter component
function AnimatedCounter({ value, prefix = '', suffix = '', decimals = 0 }: { value: number; prefix?: string; suffix?: string; decimals?: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const duration = 1000;
    const steps = 60;
    const stepValue = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += stepValue;
      if (current >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(current);
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [value]);

  return <span>{prefix}{displayValue.toFixed(decimals)}{suffix}</span>;
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

// Month name helper
const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Project Row Component
function ProjectRow({ project, index, isSelected, onSelect }: {
  project: Project;
  index: number;
  isSelected: boolean;
  onSelect: (project: Project) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showVarianceItems, setShowVarianceItems] = useState(false);

  const isAtRisk = project.variance < 0;
  const gpmColor = project.actualGPM >= 0.6 ? '#22C55E' : project.actualGPM >= 0.5 ? '#F59E0B' : '#EF4444';
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
      {/* Negative variance accent line - left edge only */}
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
            <div className="font-medium text-[#EAF2FF] text-[13px]">{project.project}</div>
            <div className="text-[10px] text-[#64748B]">{project.type}</div>
          </div>
        </div>

        <div className="text-center">
          <div className="text-[#CBD5E1] font-medium text-[13px]">
            {project.projectDate || '-'}
          </div>
        </div>

        <div className="text-right">
          <div className="text-[#CBD5E1] font-semibold text-[13px]">{formatCurrency(project.actualRevenue)}</div>
          <div className="text-[10px] text-[#64748B]">Revenue</div>
        </div>

        <div className="text-right">
          <div className="text-[#CBD5E1] font-semibold text-[13px]">{formatCurrency(project.actualCost)}</div>
          <div className="text-[10px] text-[#64748B]">COGS</div>
        </div>

        <div className="text-right">
          <div className="text-[#CBD5E1] font-semibold text-[13px]">{formatCurrency(project.actualGP)}</div>
          <div className="text-[10px] text-[#64748B]">Gross Profit</div>
        </div>

        <div className="text-center">
          <span
            className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-[11px] font-semibold"
            style={{ backgroundColor: `${gpmColor}20`, color: gpmColor }}
          >
            {formatPercent(project.actualGPM)}
          </span>
        </div>

        <div className="text-right">
          <div className={`font-semibold text-[13px] ${project.variance >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
            {project.variance >= 0 ? '+' : ''}{formatCurrency(project.variance)}
          </div>
          {/* Variance indicator bar */}
          <div className="w-12 h-[3px] rounded-full bg-white/10 overflow-hidden mt-1 ml-auto">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, Math.abs(project.variancePercent) * 100 * 2)}%`,
                background: project.variance >= 0 ? '#22C55E' : '#EF4444'
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
            {/* Nested card with inset shadow */}
            <div className="mx-4 mb-4 p-4 rounded-lg bg-[#0B1220] border border-white/[0.04] shadow-[inset_0_2px_8px_rgba(0,0,0,0.3)]">
              <div className="grid grid-cols-5 gap-6 mb-4">
                <div>
                  <div className="text-[9px] text-[#475569] uppercase tracking-wider mb-1">Budget Revenue</div>
                  <div className="text-[#CBD5E1] font-medium text-[13px]">{formatCurrency(project.budgetRevenue)}</div>
                </div>
                <div>
                  <div className="text-[9px] text-[#475569] uppercase tracking-wider mb-1">Budget GP</div>
                  <div className="text-[#CBD5E1] font-medium text-[13px]">{formatCurrency(project.budgetGP)}</div>
                </div>
                <div>
                  <div className="text-[9px] text-[#475569] uppercase tracking-wider mb-1">Variance %</div>
                  <div className={`font-medium text-[13px] ${project.variancePercent >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                    {project.variancePercent >= 0 ? '+' : ''}{formatPercent(project.variancePercent)}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] text-[#475569] uppercase tracking-wider mb-1">Project Type</div>
                  <div className="text-[#CBD5E1] font-medium text-[13px]">{project.type || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-[9px] text-[#475569] uppercase tracking-wider mb-1">Line Items</div>
                  <div className="text-[#CBD5E1] font-medium text-[13px]">{project.itemCount || 0}</div>
                </div>
              </div>

            {/* Negative Variance Line Items - Collapsible */}
            {project.negativeVarianceItems && project.negativeVarianceItems.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/[0.06]">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowVarianceItems(!showVarianceItems);
                  }}
                  className="w-full flex items-center justify-between text-[11px] font-semibold text-[#EF4444] uppercase tracking-wider mb-3 hover:text-[#F87171] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Negative Variance Line Items ({project.negativeVarianceItems.length})
                  </div>
                  <svg className={`w-4 h-4 transition-transform ${showVarianceItems ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                <AnimatePresence>
                  {showVarianceItems && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {project.negativeVarianceItems.map((item, idx) => (
                          <div key={idx} className="py-2 px-3 rounded-lg bg-[#EF4444]/5 border border-[#EF4444]/10">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="text-[12px] text-[#EAF2FF] font-medium">{item.itemDescription || item.itemNumber || 'Line Item'}</div>
                                <div className="flex items-center gap-2 text-[10px] text-[#64748B]">
                                  {item.itemNumber && <span>#{item.itemNumber}</span>}
                                  <span className="px-1.5 py-0.5 rounded bg-[#38BDF8]/20 text-[#38BDF8] font-medium">
                                    {MONTH_NAMES[item.month] || item.month} {item.year}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-[11px] text-[#64748B]">
                                  Budget: {formatCurrency(item.budgetGP)} → Actual: {formatCurrency(item.actualGP)}
                                </div>
                                <div className="text-[12px] font-semibold text-[#EF4444]">
                                  {formatCurrency(item.variance)}
                                </div>
                              </div>
                            </div>
                            {item.comments && (
                              <div className="mt-2 pt-2 border-t border-white/[0.04]">
                                <div className="text-[10px] text-[#F59E0B] uppercase tracking-wider mb-1">Note</div>
                                <div className="text-[11px] text-[#CBD5E1] italic">{item.comments}</div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Type Breakdown Bar
function TypeBreakdownBar({ type, maxRevenue }: { type: TypeBreakdown; maxRevenue: number }) {
  const barWidth = maxRevenue > 0 ? (type.revenue / maxRevenue) * 100 : 0;
  const gpmColor = type.gpm >= 0.6 ? '#22C55E' : type.gpm >= 0.5 ? '#F59E0B' : '#EF4444';

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[13px] text-[#CBD5E1] font-medium">{type.type}</span>
        <div className="flex items-center gap-4">
          <span className="text-[12px] text-[#8FA3BF]">{formatCurrency(type.revenue)}</span>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: `${gpmColor}20`, color: gpmColor }}>
            {formatPercent(type.gpm)}
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

export default function CloseoutDashboard() {
  const [data, setData] = useState<CloseoutData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'revenue' | 'gpm' | 'variance' | 'date'>('revenue');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showAtRiskOnly, setShowAtRiskOnly] = useState(false);
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('MCC'); // Default to MCC
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Sortable header click handler
  const handleHeaderClick = (field: 'revenue' | 'gpm' | 'variance' | 'date') => {
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
        // Bust cache on initial load to get fresh data with lineItems
        const response = await fetch('/api/closeout?bust=true');
        const result = await response.json();

        if (result.error) {
          setError(result.message || result.error);
        } else {
          setData(result);
          console.log('Loaded projects with lineItems:', result.projects?.[0]?.lineItems?.length || 0, 'items in first project');
        }
      } catch (err) {
        setError('Failed to load closeout data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filteredProjects = useMemo(() => {
    if (!data) return [];

    let projects = [...data.projects];

    // 1. Filter by type
    if (selectedType !== 'all') {
      projects = projects.filter(p => p.type === selectedType);
    }

    // 2. Filter by year - each project has ONE year (projectYear)
    if (selectedYear !== 'all') {
      const yearNum = parseInt(selectedYear);
      projects = projects.filter(p => p.projectYear === yearNum);
    }

    // 3. Filter at-risk (negative variance)
    if (showAtRiskOnly) {
      projects = projects.filter(p => p.variance < 0);
    }

    // 4. Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      projects = projects.filter(p =>
        p.project.toLowerCase().includes(query) ||
        p.type?.toLowerCase().includes(query)
      );
    }

    // 5. Sort
    return [...projects].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'revenue':
          comparison = b.actualRevenue - a.actualRevenue;
          break;
        case 'gpm':
          comparison = b.actualGPM - a.actualGPM;
          break;
        case 'variance':
          comparison = b.variance - a.variance;
          break;
        case 'date':
          // Sort by projectYear then projectMonth
          const dateA = (a.projectYear || 0) * 100 + (a.projectMonth || 0);
          const dateB = (b.projectYear || 0) * 100 + (b.projectMonth || 0);
          comparison = dateB - dateA;
          break;
        default:
          comparison = 0;
      }
      // Reverse if ascending
      return sortDirection === 'asc' ? -comparison : comparison;
    });
  }, [data, searchQuery, sortField, sortDirection, showAtRiskOnly, selectedYear, selectedType]);

  // Calculate filtered KPIs from filtered projects (uses total project values)
  const filteredKpis = useMemo(() => {
    if (!data || filteredProjects.length === 0) {
      return {
        totalRevenue: 0,
        totalCost: 0,
        totalGrossProfit: 0,
        overallGPM: 0,
        budgetRevenue: 0,
        budgetGP: 0,
        budgetVariance: 0,
        projectCount: 0,
        atRiskCount: 0,
      };
    }

    let totalRevenue = 0;
    let totalCost = 0;
    let budgetRevenue = 0;
    let budgetGP = 0;
    let atRiskCount = 0;

    filteredProjects.forEach(p => {
      totalRevenue += p.actualRevenue;
      totalCost += p.actualCost;
      budgetRevenue += p.budgetRevenue;
      budgetGP += p.budgetGP;
      if (p.variance < 0) atRiskCount++;
    });

    const totalGrossProfit = totalRevenue - totalCost;
    const overallGPM = totalRevenue > 0 ? totalGrossProfit / totalRevenue : 0;

    return {
      totalRevenue,
      totalCost,
      totalGrossProfit,
      overallGPM,
      budgetRevenue,
      budgetGP,
      budgetVariance: totalGrossProfit - budgetGP,
      projectCount: filteredProjects.length,
      atRiskCount,
    };
  }, [data, filteredProjects]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F1722] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-[#22C55E]/20 border-t-[#22C55E] rounded-full animate-spin mx-auto mb-4" />
          <div className="text-[#8FA3BF]">Loading closeout data...</div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0F1722] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-[#EF4444] text-xl mb-2">Error Loading Data</div>
          <div className="text-[#8FA3BF] mb-4">{error}</div>
          <p className="text-[#64748B] text-sm">
            Make sure the Excel file is in the <code className="bg-white/10 px-1 rounded">data/closeout-data.xlsx</code> folder.
          </p>
        </div>
      </div>
    );
  }

  const maxTypeRevenue = Math.max(...data.typeBreakdown.map(t => t.revenue));

  return (
    <div className="min-h-screen bg-[#0B1220] relative overflow-hidden">
      <DashboardBackground {...backgroundPresets.finance} />
      {/* Global Sidebar */}
      <Sidebar isCollapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />

      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-to-b from-[#0F1722] via-[#0B1220] to-[#0B1220]" />

      {/* Main Content - offset by sidebar width */}
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
                <h1 className="text-xl font-semibold text-[#EAF2FF] tracking-tight">Project Closeout</h1>
                <p className="text-[11px] text-[#475569] mt-0.5">
                  Financial Performance & Margin Analysis
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
                  <div className="text-[#8FA3BF] font-medium text-[12px]">
                    Excel Source
                  </div>
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

        <main className="max-w-[1600px] mx-auto px-8 py-6">
        {/* KPI Cards - Dynamic based on filters */}
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
            value={formatCurrency(filteredKpis.totalCost)}
            subtitle="Cost of goods sold"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>}
            color="#F59E0B"
          />
          <KPICard
            title="Gross Profit"
            value={formatCurrency(filteredKpis.totalGrossProfit)}
            subtitle="Revenue minus COGS"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
            color="#38BDF8"
          />
          <KPICard
            title="Overall GPM"
            value={formatPercent(filteredKpis.overallGPM)}
            subtitle="Gross profit margin"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
            color={filteredKpis.overallGPM >= 0.6 ? '#22C55E' : filteredKpis.overallGPM >= 0.5 ? '#F59E0B' : '#EF4444'}
          />
          <div
            onClick={() => setShowAtRiskOnly(!showAtRiskOnly)}
            className={`cursor-pointer transition-all ${showAtRiskOnly ? 'ring-2 ring-[#EF4444] ring-offset-2 ring-offset-[#0F1722] rounded-xl' : ''}`}
          >
            <KPICard
              title="At Risk Projects"
              value={filteredKpis.atRiskCount.toString()}
              subtitle={showAtRiskOnly ? 'Click to show all' : 'Click to filter'}
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
              color="#EF4444"
            />
          </div>
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
                    <option value="MCC">MCC</option>
                    <option value="TBEN">TBEN</option>
                    <option value="TB">TB</option>
                    {data.typeBreakdown
                      .filter(t => !['MCC', 'TBEN', 'TB'].includes(t.type))
                      .map(t => (
                        <option key={t.type} value={t.type}>{t.type}</option>
                      ))
                    }
                  </select>

                  <select
                    value={selectedYear}
                    onChange={e => setSelectedYear(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none text-sm"
                  >
                    <option value="all">All Years</option>
                    {data.allYears.map(year => (
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
                    <option value="date">Sort by Date</option>
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
                  onClick={() => handleHeaderClick('date')}
                  className={`flex items-center gap-1 justify-center transition-colors hover:text-white ${sortField === 'date' ? 'text-[#38BDF8]' : ''}`}
                >
                  Date
                  {sortField === 'date' && (
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
                {filteredProjects.map((project, index) => (
                  <ProjectRow
                    key={project.projectKey}
                    project={project}
                    index={index}
                    isSelected={selectedProject?.projectKey === project.projectKey}
                    onSelect={(p) => setSelectedProject(p)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Budget vs Actual - Dynamic based on selection */}
            {(() => {
              // Calculate budget vs actual values based on selection
              const budgetActualData = selectedProject ? {
                budgetGP: selectedProject.budgetGP,
                actualGP: selectedProject.actualGP,
                variance: selectedProject.variance,
                revenue: selectedProject.actualRevenue,
                gpm: selectedProject.actualGPM,
                label: selectedProject.project,
              } : {
                budgetGP: filteredKpis.budgetGP,
                actualGP: filteredKpis.totalGrossProfit,
                variance: filteredKpis.budgetVariance,
                revenue: filteredKpis.totalRevenue,
                gpm: filteredKpis.overallGPM,
                label: selectedType !== 'all' ? `${selectedType} Projects` : selectedYear !== 'all' ? `${selectedYear} Projects` : 'All Projects',
              };

              const gpmColor = budgetActualData.gpm >= 0.6 ? '#22C55E' : budgetActualData.gpm >= 0.5 ? '#F59E0B' : '#EF4444';

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
                        ✕ Clear
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

            {/* Line Items or Type Breakdown */}
            {selectedProject ? (
              <div className="rounded-xl bg-[#111827] border border-[#38BDF8]/15 shadow-[0_4px_16px_rgba(0,0,0,0.2)] p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[10px] font-semibold text-[#38BDF8] uppercase tracking-[0.08em]">
                    Line Items
                  </h3>
                </div>
                <div className="text-[12px] font-semibold text-[#EAF2FF] mb-0.5">{selectedProject.project}</div>
                <div className="text-[10px] text-[#475569] mb-3">{selectedProject.lineItems?.length || 0} line items</div>

                {/* All Line Items with Visual Bars */}
                <div className="space-y-2 max-h-[350px] overflow-y-auto">
                  {(() => {
                    // Calculate max for bar scaling
                    const maxAmount = Math.max(
                      ...((selectedProject.lineItems || []).map(item => Math.max(item.actualRevenue, item.actualCost)))
                    ) || 1;

                    return selectedProject.lineItems?.map((item, idx) => {
                      const hasNegativeVariance = item.variance < -100;
                      const revenueWidth = (item.actualRevenue / maxAmount) * 100;
                      const costWidth = (item.actualCost / maxAmount) * 100;
                      const gpm = item.actualRevenue > 0 ? (item.actualGP / item.actualRevenue) : 0;

                      return (
                        <div
                          key={idx}
                          className={`p-2.5 rounded-lg border ${hasNegativeVariance ? 'bg-[#EF4444]/5 border-[#EF4444]/20' : 'bg-white/[0.02] border-white/[0.06]'}`}
                        >
                          <div className="text-[11px] text-[#EAF2FF] font-medium mb-1.5 line-clamp-1">
                            {item.itemDescription || item.itemNumber || 'Line Item'}
                          </div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-1.5 py-0.5 rounded bg-[#38BDF8]/20 text-[#38BDF8] text-[9px] font-medium">
                              {MONTH_NAMES[item.month] || item.month} {item.year}
                            </span>
                            <span className={`text-[9px] font-medium ${gpm >= 0.5 ? 'text-[#22C55E]' : gpm >= 0.3 ? 'text-[#F59E0B]' : 'text-[#EF4444]'}`}>
                              {(gpm * 100).toFixed(0)}% margin
                            </span>
                          </div>

                          {/* Revenue Bar (Green) */}
                          <div className="mb-1">
                            <div className="flex items-center justify-between text-[9px] mb-0.5">
                              <span className="text-[#22C55E]">Revenue</span>
                              <span className="text-[#22C55E] font-medium">{formatCurrency(item.actualRevenue)}</span>
                            </div>
                            <div className="h-2 bg-[#0F1722] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-[#22C55E] to-[#22C55E]/60 rounded-full transition-all"
                                style={{ width: `${revenueWidth}%` }}
                              />
                            </div>
                          </div>

                          {/* Cost Bar (Orange) */}
                          <div className="mb-2">
                            <div className="flex items-center justify-between text-[9px] mb-0.5">
                              <span className="text-[#F59E0B]">COGS</span>
                              <span className="text-[#F59E0B] font-medium">{formatCurrency(item.actualCost)}</span>
                            </div>
                            <div className="h-2 bg-[#0F1722] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-[#F59E0B] to-[#F59E0B]/60 rounded-full transition-all"
                                style={{ width: `${costWidth}%` }}
                              />
                            </div>
                          </div>

                          {/* GP and Variance in compact row */}
                          <div className="flex items-center justify-between text-[9px] pt-1.5 border-t border-white/[0.04]">
                            <div>
                              <span className="text-[#64748B]">GP: </span>
                              <span className={`font-medium ${item.actualGP >= 0 ? 'text-[#38BDF8]' : 'text-[#EF4444]'}`}>
                                {formatCurrency(item.actualGP)}
                              </span>
                            </div>
                            <div>
                              <span className="text-[#64748B]">Var: </span>
                              <span className={`font-medium ${item.variance >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                                {item.variance >= 0 ? '+' : ''}{formatCurrency(item.variance)}
                              </span>
                            </div>
                          </div>

                          {item.comments && (
                            <div className="mt-2 pt-1.5 border-t border-white/[0.04]">
                              <div className="text-[9px] text-[#F59E0B] italic">{item.comments}</div>
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>

                {(!selectedProject.lineItems || selectedProject.lineItems.length === 0) && (
                  <div className="text-center py-4">
                    <div className="text-[11px] text-[#64748B]">No line items</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl bg-[#111827] border border-white/[0.04] shadow-[0_4px_16px_rgba(0,0,0,0.2)] p-4">
                <h3 className="text-[10px] font-semibold text-[#475569] uppercase tracking-[0.08em] mb-4">
                  Revenue by Type
                </h3>
                {data.typeBreakdown.slice(0, 8).map(type => (
                  <TypeBreakdownBar key={type.type} type={type} maxRevenue={maxTypeRevenue} />
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
