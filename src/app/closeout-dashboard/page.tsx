'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import Sidebar, { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from '@/components/Sidebar';
import { DashboardBackground, backgroundPresets, KPICard } from '@/components/mars-ui';
import ProjectsTab from './components/ProjectsTab';
import MCCTab from './components/MCCTab';
import AnalyticsTab from './components/AnalyticsTab';
import { RefreshCw, Upload } from 'lucide-react';

type TabType = 'projects' | 'mcc' | 'analytics';

// Format currency
function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

// Format percent
function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export default function CloseoutDashboard() {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('projects');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  // Fetch data
  const fetchData = async (bust = false) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/closeout${bust ? '?bust=true' : ''}`);
      const result = await response.json();

      if (result.error) {
        setError(result.message || result.error);
      } else {
        setData(result);
        setError(null);
      }
    } catch (err) {
      setError('Failed to load closeout data');
    } finally {
      setLoading(false);
    }
  };

  // Enrich from NetSuite
  const enrichData = async () => {
    try {
      setEnriching(true);
      const response = await fetch('/api/closeout/enrich', { method: 'POST' });
      const result = await response.json();

      if (result.success) {
        // Refresh data after enrichment
        await fetchData(true);
      } else {
        setError(result.message || 'Enrichment failed');
      }
    } catch (err) {
      setError('Enrichment failed');
    } finally {
      setEnriching(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter data based on selected year/month
  const filteredData = useMemo(() => {
    if (!data) return null;

    // Filter projects
    let filteredProjects = data.projects || [];
    if (selectedYear) {
      filteredProjects = filteredProjects.filter((p: any) => p.projectYear === selectedYear);
    }
    if (selectedMonth) {
      filteredProjects = filteredProjects.filter((p: any) => p.projectMonth === selectedMonth);
    }

    // Recalculate KPIs for filtered data
    const totalRevenue = filteredProjects.reduce((sum: number, p: any) => sum + p.actualRevenue, 0);
    const totalCost = filteredProjects.reduce((sum: number, p: any) => sum + p.actualCost, 0);
    const totalGP = totalRevenue - totalCost;
    const overallGPM = totalRevenue > 0 ? totalGP / totalRevenue : 0;
    const atRiskProjects = filteredProjects.filter((p: any) => p.actualGPM < 0.5 || p.variance < -10000);

    return {
      ...data,
      projects: filteredProjects,
      atRiskProjects,
      kpis: {
        ...data.kpis,
        totalRevenue,
        totalCost,
        totalGrossProfit: totalGP,
        overallGPM,
        atRiskCount: atRiskProjects.length,
      },
    };
  }, [data, selectedYear, selectedMonth]);

  // Calculate tab-specific KPIs
  const kpis = useMemo(() => {
    if (!filteredData) return null;
    const displayData = filteredData;

    switch (activeTab) {
      case 'projects':
        return [
          {
            title: 'Total Revenue',
            value: formatCurrency(displayData.kpis.totalRevenue),
            subtitle: selectedYear ? `Year ${selectedYear}` : 'Current year',
            color: '#22C55E',
          },
          {
            title: 'Total Cost',
            value: formatCurrency(displayData.kpis.totalCost),
            subtitle: selectedYear ? `Year ${selectedYear}` : 'Current year',
            color: '#F59E0B',
          },
          {
            title: 'Gross Profit',
            value: formatCurrency(displayData.kpis.totalGrossProfit),
            subtitle: selectedYear ? `Year ${selectedYear}` : 'Current year',
            color: '#38BDF8',
          },
          {
            title: 'Overall GPM',
            value: formatPercent(displayData.kpis.overallGPM * 100),
            subtitle: 'Margin percentage',
            color: displayData.kpis.overallGPM >= 0.6 ? '#22C55E' : displayData.kpis.overallGPM >= 0.5 ? '#F59E0B' : '#EF4444',
          },
          {
            title: 'At Risk',
            value: displayData.kpis.atRiskCount.toString(),
            subtitle: 'Projects under 50% GPM',
            color: '#EF4444',
          },
        ];

      case 'mcc':
        const mccKPIs = calculateMCCKPIs(displayData.mccMargins || []);
        return [
          {
            title: 'MCC Revenue',
            value: formatCurrency(mccKPIs.totalRevenue),
            subtitle: 'All years',
            color: '#22C55E',
          },
          {
            title: 'Gross Profit',
            value: formatCurrency(mccKPIs.totalGP),
            subtitle: 'All years',
            color: '#38BDF8',
          },
          {
            title: 'Avg GPM',
            value: formatPercent(mccKPIs.avgGPM * 100),
            subtitle: 'Average margin',
            color: mccKPIs.avgGPM >= 0.6 ? '#22C55E' : mccKPIs.avgGPM >= 0.5 ? '#F59E0B' : '#EF4444',
          },
          {
            title: 'Customers',
            value: mccKPIs.customerCount.toString(),
            subtitle: 'Total customers',
            color: '#8FA3BF',
          },
          {
            title: 'At Risk',
            value: mccKPIs.atRiskCount.toString(),
            subtitle: 'Under 50% GPM',
            color: '#EF4444',
          },
        ];

      case 'analytics':
        return [
          {
            title: 'Total Projects',
            value: displayData.projects.length.toString(),
            subtitle: selectedYear ? `Year ${selectedYear}` : 'All years',
            color: '#38BDF8',
          },
          {
            title: 'Revenue',
            value: formatCurrency(displayData.kpis.totalRevenue),
            subtitle: selectedYear ? `Year ${selectedYear}` : 'Current year',
            color: '#22C55E',
          },
          {
            title: 'Avg GPM',
            value: formatPercent(displayData.kpis.overallGPM * 100),
            subtitle: 'Average margin',
            color: displayData.kpis.overallGPM >= 0.6 ? '#22C55E' : '#F59E0B',
          },
          {
            title: 'Budget Variance',
            value: formatCurrency(displayData.kpis.budgetVariance || 0),
            subtitle: 'vs Budget',
            color: (displayData.kpis.budgetVariance || 0) >= 0 ? '#22C55E' : '#EF4444',
          },
          {
            title: 'Enrichment',
            value: `${displayData.kpis.enrichmentPct || 0}%`,
            subtitle: 'NetSuite data',
            color: '#8FA3BF',
          },
        ];
    }
  }, [filteredData, activeTab, selectedYear]);

  const mainStyle = {
    marginLeft: sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,
    transition: 'margin-left 0.3s ease',
  };

  return (
    <div className="min-h-screen bg-[#0B1220]">
      <DashboardBackground {...backgroundPresets.finance} />
      <Sidebar isCollapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />

      <motion.div className="relative z-10 text-white" style={mainStyle}>
        {/* Header */}
        <header className="border-b border-white/[0.04] bg-[#0B1220]/90 backdrop-blur-xl sticky top-0 z-50">
          <div className="max-w-[1600px] mx-auto px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-[22px] font-bold mb-1 bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-[#8FA3BF]">
                  Project Profitability
                </h1>
                <p className="text-[11px] text-[#475569]">
                  Financial Performance & Margin Analysis
                </p>
              </div>
              <div className="flex items-center gap-3">
                {/* Year Filter */}
                <select
                  value={selectedYear || ''}
                  onChange={(e) => setSelectedYear(e.target.value ? parseInt(e.target.value) : null)}
                  className="px-3 py-2 rounded-lg bg-[#111827] border border-white/[0.08] text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#22C55E]/20"
                >
                  <option value="">All Years</option>
                  {data?.allYears?.map((year: number) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>

                {/* Month Filter */}
                <select
                  value={selectedMonth || ''}
                  onChange={(e) => setSelectedMonth(e.target.value ? parseInt(e.target.value) : null)}
                  className="px-3 py-2 rounded-lg bg-[#111827] border border-white/[0.08] text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#22C55E]/20"
                  disabled={!selectedYear}
                >
                  <option value="">All Months</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((month) => (
                    <option key={month} value={month}>
                      {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month - 1]}
                    </option>
                  ))}
                </select>

                {/* Clear Filters */}
                {(selectedYear || selectedMonth) && (
                  <button
                    onClick={() => {
                      setSelectedYear(null);
                      setSelectedMonth(null);
                    }}
                    className="px-3 py-2 rounded-lg bg-[#111827] border border-white/[0.08] text-xs text-gray-400 hover:text-white hover:bg-white/[0.04] transition-colors"
                  >
                    Clear
                  </button>
                )}

                <div className="h-6 w-px bg-white/[0.08]"></div>
                <button
                  onClick={() => fetchData(true)}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-[#111827] border border-white/[0.08] text-sm font-medium text-white hover:bg-white/[0.04] transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                <button
                  onClick={enrichData}
                  disabled={enriching || loading}
                  className="px-4 py-2 rounded-lg bg-[#22C55E] text-white text-sm font-medium hover:bg-[#16A34A] transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <Upload className={`w-4 h-4 ${enriching ? 'animate-bounce' : ''}`} />
                  {enriching ? 'Enriching...' : 'Enrich from NetSuite'}
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-[1600px] mx-auto px-8 py-6">
          {/* Loading State */}
          {loading && !data && (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-[#22C55E]" />
                <p className="text-gray-400">Loading profitability data...</p>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-lg p-4 mb-6">
              <p className="text-[#EF4444] text-sm">{error}</p>
            </div>
          )}

          {/* Main Content */}
          {data && (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-5 gap-4 mb-8">
                {kpis?.map((kpi, idx) => (
                  <KPICard
                    key={idx}
                    title={kpi.title}
                    value={kpi.value}
                    subtitle={kpi.subtitle}
                    color={kpi.color}
                  />
                ))}
              </div>

              {/* Tab Navigation */}
              <div className="flex gap-1 mb-6 p-1 bg-[#111827] rounded-lg w-fit border border-white/[0.04]">
                <TabButton
                  active={activeTab === 'projects'}
                  onClick={() => setActiveTab('projects')}
                >
                  Projects
                </TabButton>
                <TabButton
                  active={activeTab === 'mcc'}
                  onClick={() => setActiveTab('mcc')}
                >
                  MCC
                </TabButton>
                <TabButton
                  active={activeTab === 'analytics'}
                  onClick={() => setActiveTab('analytics')}
                >
                  Analytics
                </TabButton>
              </div>

              {/* Tab Content */}
              {activeTab === 'projects' && filteredData && (
                <ProjectsTab
                  projects={filteredData.projects || []}
                  atRiskProjects={filteredData.atRiskProjects || []}
                  typeBreakdown={filteredData.typeBreakdown || []}
                />
              )}
              {activeTab === 'mcc' && filteredData && (
                <MCCTab
                  mccMargins={filteredData.mccMargins || []}
                  years={[2021, 2022, 2023, 2024, 2025]}
                />
              )}
              {activeTab === 'analytics' && filteredData && (
                <AnalyticsTab
                  projects={filteredData.projects || []}
                  monthly={filteredData.yearSummary ? Object.entries(filteredData.yearSummary).map(([year, stats]: [string, any]) => ({
                    year: parseInt(year),
                    month: 1,
                    monthName: year,
                    revenue: stats.revenue,
                    cogs: stats.cost,
                    grossProfit: stats.gp,
                    grossProfitPct: stats.gpm * 100,
                  })) : []}
                  types={filteredData.typeBreakdown || []}
                />
              )}
            </>
          )}
        </main>
      </motion.div>
    </div>
  );
}

// Tab Button Component
function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-6 py-2.5 rounded-md text-[13px] font-medium transition-all ${
        active
          ? 'bg-[#22C55E] text-white shadow-lg shadow-[#22C55E]/20'
          : 'text-[#8FA3BF] hover:text-white hover:bg-white/[0.04]'
      }`}
    >
      {children}
    </button>
  );
}

// Calculate MCC KPIs
function calculateMCCKPIs(mccMargins: any[]) {
  const totalRevenue = mccMargins.reduce((sum, c) => sum + (c.totalRevenue || 0), 0);
  const totalGP = mccMargins.reduce((sum, c) => sum + (c.totalGP || 0), 0);
  const avgGPM = totalRevenue > 0 ? totalGP / totalRevenue : 0;
  const customerCount = mccMargins.length;
  const atRiskCount = mccMargins.filter(c => c.avgGPM < 0.5).length;

  return { totalRevenue, totalGP, avgGPM, customerCount, atRiskCount };
}
