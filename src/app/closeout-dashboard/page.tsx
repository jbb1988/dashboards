'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import Sidebar, { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from '@/components/Sidebar';
import { DashboardBackground, backgroundPresets, KPICard } from '@/components/mars-ui';
import ProjectsTab from './components/ProjectsTab';
import MCCTab from './components/MCCTab';
import AnalyticsTab from './components/AnalyticsTab';
import { RefreshCw, Upload, Database } from 'lucide-react';

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
  const [loading, setLoading] = useState(false); // Start false - don't load until user selects year
  const [error, setError] = useState<string | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('projects');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(2025); // Default to current year
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  // Fetch data
  const fetchData = async (bust = false) => {
    try {
      setLoading(true);
      setError(null); // Clear previous errors
      const params = new URLSearchParams();
      if (bust) params.append('bust', 'true');
      params.append('includeEnrichment', 'true'); // Always include enrichment data

      const response = await fetch(`/api/closeout?${params.toString()}`, {
        // Add cache control for better performance
        next: { revalidate: bust ? 0 : 1800 } // 30 minutes cache unless bust
      });
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

  // Import data from Excel to database
  const [importing, setImporting] = useState(false);

  const importData = async () => {
    try {
      setImporting(true);
      const response = await fetch('/api/closeout/import', { method: 'POST' });
      const result = await response.json();

      if (result.success) {
        // Refresh data after import
        await fetchData(true);
        alert(`Successfully imported:\n- ${result.stats.projectsCreated} projects\n- ${result.stats.workOrdersCreated} work orders`);
      } else {
        const errorMsg = result.message || 'Import failed';
        setError(errorMsg);
        console.error('Import error details:', result.details);
        alert(`Import failed: ${errorMsg}\n\nCheck browser console for details.`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Import failed';
      setError(errorMsg);
      console.error('Import error:', err);
      alert(`Import failed: ${errorMsg}`);
    } finally {
      setImporting(false);
    }
  };

  // Enrich from NetSuite
  const enrichData = async () => {
    try {
      setEnriching(true);

      // Build query params based on current filters
      const params = new URLSearchParams();
      if (selectedYear) {
        params.append('year', selectedYear.toString());
      }

      const url = `/api/closeout/enrich${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url, { method: 'POST' });
      const result = await response.json();

      if (result.success || result.stats) {
        // Refresh data after enrichment
        await fetchData(true);

        const stats = result.stats;
        let message = result.message;

        // Add error details if any
        if (stats.errors && stats.errors.length > 0) {
          console.error('Enrichment errors:', stats.errors);
          message += `\n\nErrors (${stats.errors.length}):\n` + stats.errors.slice(0, 5).join('\n');
          if (stats.errors.length > 5) {
            message += `\n... and ${stats.errors.length - 5} more (check console)`;
          }
        }

        alert(message);
      } else {
        setError(result.message || 'Enrichment failed');
        console.error('Enrichment failed:', result);
        alert(`Enrichment failed: ${result.message || 'Unknown error'}`);
      }
    } catch (err) {
      setError('Enrichment failed');
    } finally {
      setEnriching(false);
    }
  };

  // Combined Load & Enrich workflow
  const [loadingAndEnriching, setLoadingAndEnriching] = useState(false);

  const loadAndEnrichData = async () => {
    try {
      setLoadingAndEnriching(true);
      setError(null);

      // Step 1: Import from Excel to database
      console.log('Step 1: Importing data from Excel...');
      const importResponse = await fetch('/api/closeout/import', { method: 'POST' });
      const importResult = await importResponse.json();

      if (!importResult.success) {
        throw new Error(importResult.message || 'Import failed');
      }

      console.log(`Import complete: ${importResult.stats.projectsCreated} projects, ${importResult.stats.workOrdersCreated} work orders`);

      // Step 2: Enrich from NetSuite (filtered by selected year)
      console.log(`Step 2: Enriching ${selectedYear} data from NetSuite...`);
      const params = new URLSearchParams();
      params.append('year', selectedYear.toString());

      const enrichResponse = await fetch(`/api/closeout/enrich?${params.toString()}`, { method: 'POST' });
      const enrichResult = await enrichResponse.json();

      if (enrichResult.stats?.errors && enrichResult.stats.errors.length > 0) {
        console.error('Enrichment errors:', enrichResult.stats.errors);
      }

      console.log(`Enrichment complete: ${enrichResult.stats.workOrdersProcessed} work orders enriched`);

      // Step 3: Load the data into UI
      console.log('Step 3: Loading data into dashboard...');
      await fetchData(true);

      alert(
        `✅ Data loaded successfully!\n\n` +
        `📊 Imported: ${importResult.stats.projectsCreated} projects, ${importResult.stats.workOrdersCreated} work orders\n` +
        `🔗 Enriched: ${enrichResult.stats.workOrdersProcessed} work orders with ${enrichResult.stats.lineItemsCached} line items\n\n` +
        (enrichResult.stats.errors && enrichResult.stats.errors.length > 0
          ? `⚠️ ${enrichResult.stats.errors.length} errors (check console)`
          : `✨ No errors!`)
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Load & Enrich failed';
      setError(errorMsg);
      console.error('Load & Enrich error:', err);
      alert(`❌ Failed: ${errorMsg}`);
    } finally {
      setLoadingAndEnriching(false);
    }
  };

  // Don't auto-load data - wait for user to select year and click Load button
  // useEffect(() => {
  //   fetchData();
  // }, []);

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
                {/* Year Filter - Available Years */}
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="px-4 py-2.5 rounded-lg bg-[#111827] border border-[#22C55E]/30 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-[#22C55E]/40"
                >
                  <option value={2025}>2025</option>
                  <option value={2024}>2024</option>
                  <option value={2023}>2023</option>
                  <option value={2022}>2022</option>
                  <option value={2021}>2021</option>
                  <option value={2020}>2020</option>
                </select>

                <div className="h-6 w-px bg-white/[0.08]"></div>

                {/* Primary Action: Load & Enrich Data */}
                {!data && (
                  <button
                    onClick={loadAndEnrichData}
                    disabled={loadingAndEnriching}
                    className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white text-sm font-semibold hover:from-[#16A34A] hover:to-[#15803D] transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-[#22C55E]/20"
                  >
                    <Database className={`w-4 h-4 ${loadingAndEnriching ? 'animate-pulse' : ''}`} />
                    {loadingAndEnriching ? `Loading ${selectedYear}...` : `Load ${selectedYear} Data`}
                  </button>
                )}

                {/* Secondary Actions: After data is loaded */}
                {data && (
                  <>
                    <button
                      onClick={() => fetchData(true)}
                      disabled={loading}
                      className="px-4 py-2 rounded-lg bg-[#111827] border border-white/[0.08] text-sm font-medium text-white hover:bg-white/[0.04] transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                      Refresh
                    </button>
                    <button
                      onClick={loadAndEnrichData}
                      disabled={loadingAndEnriching}
                      className="px-4 py-2 rounded-lg bg-[#22C55E] text-white text-sm font-medium hover:bg-[#16A34A] transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      <Upload className={`w-4 h-4 ${loadingAndEnriching ? 'animate-bounce' : ''}`} />
                      {loadingAndEnriching ? `Loading ${selectedYear}...` : `Reload ${selectedYear}`}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-[1600px] mx-auto px-8 py-6">
          {/* Empty State - No Data Loaded Yet */}
          {!data && !loadingAndEnriching && !error && (
            <div className="flex items-center justify-center py-20">
              <div className="text-center max-w-md">
                <Database className="w-16 h-16 mx-auto mb-6 text-[#22C55E]/40" />
                <h2 className="text-2xl font-bold text-white mb-3">Ready to Load Data</h2>
                <p className="text-gray-400 mb-6">
                  Select a year above and click <span className="text-[#22C55E] font-semibold">"Load {selectedYear} Data"</span> to import
                  from Excel and enrich with NetSuite details.
                </p>
                <div className="bg-[#111827] border border-white/[0.08] rounded-lg p-4 text-left text-sm text-gray-400">
                  <p className="mb-2">📊 Imports projects and work orders from Excel</p>
                  <p className="mb-2">🔗 Enriches with Sales Order line items from NetSuite</p>
                  <p>⚡ Optimized to load only the selected year (~30-60 seconds)</p>
                </div>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loadingAndEnriching && (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <Database className="w-12 h-12 animate-pulse mx-auto mb-4 text-[#22C55E]" />
                <h3 className="text-xl font-semibold text-white mb-2">Loading {selectedYear} Data...</h3>
                <div className="space-y-2 text-sm text-gray-400">
                  <p>Step 1: Importing from Excel...</p>
                  <p>Step 2: Enriching from NetSuite...</p>
                  <p>Step 3: Building dashboard...</p>
                </div>
                <p className="text-xs text-gray-500 mt-4">This may take 30-60 seconds</p>
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
