'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import Sidebar, { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from '@/components/Sidebar';
import { DashboardBackground, backgroundPresets, KPICard } from '@/components/mars-ui';
import ProjectsTab from './components/ProjectsTab';
import MCCTab from './components/MCCTab';
import AnalyticsTab from './components/AnalyticsTab';
import ProfitabilityDashboard from './components/ProfitabilityDashboard';
import { RefreshCw, Upload, Database, TrendingUp } from 'lucide-react';

type TabType = 'projects' | 'mcc' | 'analytics' | 'profitability';

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

// Live Timer Component
function LiveTimer({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startTime) return;

    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 100); // Update every 100ms for smooth counting

    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <div className="text-sm text-gray-400">
      <span className="font-mono">{elapsed}s</span> elapsed
    </div>
  );
}

export default function CloseoutDashboard() {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false); // Start false - don't load until user selects year
  const [error, setError] = useState<string | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('profitability');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedYears, setSelectedYears] = useState<number[]>([2025]); // Default to current year
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const availableYears = [2026, 2025, 2024, 2023, 2022, 2021, 2020];

  const toggleYear = (year: number) => {
    setSelectedYears(prev =>
      prev.includes(year)
        ? prev.filter(y => y !== year)
        : [...prev, year].sort((a, b) => b - a)
    );
  };

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
      selectedYears.forEach(year => {
        params.append('year', year.toString());
      });

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

  // Combined Load & Enrich workflow with progress tracking
  const [loadingAndEnriching, setLoadingAndEnriching] = useState(false);
  const [loadingStep, setLoadingStep] = useState<'import' | 'enrich' | 'display' | null>(null);
  const [loadingProgress, setLoadingProgress] = useState({
    step: '',
    detail: '',
    startTime: 0,
  });

  const loadAndEnrichData = async () => {
    const startTime = Date.now();

    try {
      // IMMEDIATE feedback - show loading state right away
      setLoadingAndEnriching(true);
      setError(null);
      setLoadingStep('import');
      setLoadingProgress({
        step: 'Step 1 of 3: Importing from Excel',
        detail: 'Reading closeout worksheet and saving to database...',
        startTime,
      });

      // Step 1: Import from Excel to database
      console.log('Step 1: Importing data from Excel...');
      const importResponse = await fetch('/api/closeout/import', { method: 'POST' });
      const importResult = await importResponse.json();

      if (!importResult.success) {
        throw new Error(importResult.message || 'Import failed');
      }

      const importTime = Math.round((Date.now() - startTime) / 1000);
      console.log(`Import complete in ${importTime}s: ${importResult.stats.projectsCreated} projects, ${importResult.stats.workOrdersCreated} work orders`);

      // Step 2: Enrich from NetSuite (filtered by selected years)
      setLoadingStep('enrich');
      const yearText = selectedYears.length === 1 ? selectedYears[0].toString() : selectedYears.join(', ');
      setLoadingProgress({
        step: 'Step 2 of 3: Enriching from NetSuite',
        detail: `Fetching Sales Order details for ${yearText} work orders... This may take 30-60 seconds.`,
        startTime,
      });

      console.log(`Step 2: Enriching ${yearText} data from NetSuite...`);
      const params = new URLSearchParams();
      selectedYears.forEach(year => {
        params.append('year', year.toString());
      });

      const enrichResponse = await fetch(`/api/closeout/enrich?${params.toString()}`, { method: 'POST' });
      const enrichResult = await enrichResponse.json();

      if (enrichResult.stats?.errors && enrichResult.stats.errors.length > 0) {
        console.error('Enrichment errors:', enrichResult.stats.errors);
        console.log('First 10 errors:');
        enrichResult.stats.errors.slice(0, 10).forEach((err: string, idx: number) => {
          console.log(`${idx + 1}. ${err}`);
        });
      }

      const enrichTime = Math.round((Date.now() - startTime) / 1000);
      console.log(`Enrichment complete in ${enrichTime}s: ${enrichResult.stats.workOrdersProcessed} work orders enriched`);

      // Step 3: Load the data into UI
      setLoadingStep('display');
      setLoadingProgress({
        step: 'Step 3 of 3: Building Dashboard',
        detail: 'Loading enriched data and rendering visualizations...',
        startTime,
      });

      console.log('Step 3: Loading data into dashboard...');
      await fetchData(true);

      const totalTime = Math.round((Date.now() - startTime) / 1000);
      console.log(`Total time: ${totalTime}s`);

      // Build error summary for alert
      let errorSummary = '';
      if (enrichResult.stats.errors && enrichResult.stats.errors.length > 0) {
        errorSummary = `⚠️ ${enrichResult.stats.errors.length} errors:\n\n`;
        errorSummary += enrichResult.stats.errors.slice(0, 3).join('\n');
        if (enrichResult.stats.errors.length > 3) {
          errorSummary += `\n\n... and ${enrichResult.stats.errors.length - 3} more (see console)`;
        }
      } else {
        errorSummary = '✨ No errors!';
      }

      alert(
        `${enrichResult.stats.workOrdersProcessed > 0 ? '✅' : '⚠️'} Data loaded in ${totalTime} seconds!\n\n` +
        `📊 Imported: ${importResult.stats.projectsCreated} projects, ${importResult.stats.workOrdersCreated} work orders\n` +
        `🔗 Enriched: ${enrichResult.stats.workOrdersProcessed} work orders with ${enrichResult.stats.lineItemsCached} line items\n\n` +
        errorSummary
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Load & Enrich failed';
      setError(errorMsg);
      console.error('Load & Enrich error:', err);
      alert(`❌ Failed: ${errorMsg}`);
    } finally {
      setLoadingAndEnriching(false);
      setLoadingStep(null);
    }
  };

  // Don't auto-load data - wait for user to select year and click Load button
  // useEffect(() => {
  //   fetchData();
  // }, []);

  // Filter data based on selected years/month
  const filteredData = useMemo(() => {
    if (!data) return null;

    // Filter projects
    let filteredProjects = data.projects || [];
    if (selectedYears.length > 0) {
      filteredProjects = filteredProjects.filter((p: any) => selectedYears.includes(p.projectYear));
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
  }, [data, selectedYears, selectedMonth]);

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
            subtitle: selectedYears.length > 0 ? selectedYears.join(', ') : 'All years',
            color: '#22C55E',
          },
          {
            title: 'Total Cost',
            value: formatCurrency(displayData.kpis.totalCost),
            subtitle: selectedYears.length > 0 ? selectedYears.join(', ') : 'All years',
            color: '#F59E0B',
          },
          {
            title: 'Gross Profit',
            value: formatCurrency(displayData.kpis.totalGrossProfit),
            subtitle: selectedYears.length > 0 ? selectedYears.join(', ') : 'All years',
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
            subtitle: selectedYears.length > 0 ? selectedYears.join(', ') : 'All years',
            color: '#38BDF8',
          },
          {
            title: 'Revenue',
            value: formatCurrency(displayData.kpis.totalRevenue),
            subtitle: selectedYears.length > 0 ? selectedYears.join(', ') : 'All years',
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
  }, [filteredData, activeTab, selectedYears]);

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
                {/* Year Filter & Load Button - Only for Excel-based tabs */}
                {activeTab !== 'profitability' && (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 font-medium">Years:</span>
                      {availableYears.map(year => (
                        <button
                          key={year}
                          onClick={() => toggleYear(year)}
                          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                            selectedYears.includes(year)
                              ? 'bg-[#22C55E] text-white'
                              : 'bg-[#111827] text-gray-400 hover:bg-[#1F2937] hover:text-white border border-white/[0.08]'
                          }`}
                        >
                          {year}
                        </button>
                      ))}
                    </div>

                    <div className="h-6 w-px bg-white/[0.08]"></div>
                  </>
                )}

                {/* Primary Action: Load & Enrich Data */}
                {activeTab !== 'profitability' && !data && (
                  <button
                    onClick={loadAndEnrichData}
                    disabled={loadingAndEnriching}
                    className={`px-6 py-2.5 rounded-lg text-white text-sm font-semibold transition-all flex items-center gap-2 shadow-lg ${
                      loadingAndEnriching
                        ? 'bg-[#22C55E]/50 cursor-not-allowed'
                        : 'bg-gradient-to-r from-[#22C55E] to-[#16A34A] hover:from-[#16A34A] hover:to-[#15803D] shadow-[#22C55E]/20 hover:shadow-[#22C55E]/40'
                    }`}
                  >
                    {loadingAndEnriching ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Loading {selectedYears.join(', ')}...
                      </>
                    ) : (
                      <>
                        <Database className="w-4 h-4" />
                        Load {selectedYears.join(', ')} Data
                      </>
                    )}
                  </button>
                )}

                {/* Secondary Actions: After data is loaded (only for Excel tabs) */}
                {activeTab !== 'profitability' && data && (
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
                      {loadingAndEnriching
                        ? `Loading ${selectedYears.join(', ')}...`
                        : `Reload ${selectedYears.join(', ')}`}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-[1600px] mx-auto px-8 py-6">
          {/* Tab Navigation - Always visible at top */}
          <div className="flex gap-1 mb-6 p-1 bg-[#111827] rounded-lg w-fit border border-white/[0.04]">
            <TabButton
              active={activeTab === 'profitability'}
              onClick={() => setActiveTab('profitability')}
            >
              <span className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" />
                Profitability (NetSuite)
              </span>
            </TabButton>
            <TabButton
              active={activeTab === 'projects'}
              onClick={() => setActiveTab('projects')}
            >
              Projects (Excel)
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

          {/* Empty State - No Data Loaded Yet (only for non-profitability tabs) */}
          {activeTab !== 'profitability' && !data && !loadingAndEnriching && !error && (
            <div className="flex items-center justify-center py-20">
              <div className="text-center max-w-md">
                <Database className="w-16 h-16 mx-auto mb-6 text-[#22C55E]/40" />
                <h2 className="text-2xl font-bold text-white mb-3">Ready to Load Data</h2>
                <p className="text-gray-400 mb-6">
                  Select year(s) above and click <span className="text-[#22C55E] font-semibold">"Load {selectedYears.join(', ')} Data"</span> to import
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

          {/* Loading State with Live Progress (only for non-profitability tabs) */}
          {activeTab !== 'profitability' && loadingAndEnriching && (
            <div className="flex items-center justify-center py-20">
              <div className="text-center max-w-2xl">
                {/* Animated Icon */}
                <div className="relative mb-6">
                  <Database className="w-16 h-16 mx-auto text-[#22C55E] animate-pulse" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-24 h-24 border-4 border-[#22C55E]/20 border-t-[#22C55E] rounded-full animate-spin"></div>
                  </div>
                </div>

                {/* Current Step */}
                <h3 className="text-2xl font-bold text-white mb-2">
                  {loadingProgress.step}
                </h3>
                <p className="text-gray-400 mb-6">{loadingProgress.detail}</p>

                {/* Progress Steps */}
                <div className="flex items-center justify-center gap-4 mb-6">
                  {/* Step 1: Import */}
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
                    loadingStep === 'import'
                      ? 'bg-[#22C55E]/10 border-[#22C55E] text-[#22C55E]'
                      : (loadingStep === 'enrich' || loadingStep === 'display')
                      ? 'bg-[#22C55E]/5 border-[#22C55E]/30 text-[#22C55E]/60'
                      : 'bg-gray-500/10 border-gray-500/30 text-gray-500'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${
                      loadingStep === 'import' ? 'bg-[#22C55E] animate-pulse' :
                      (loadingStep === 'enrich' || loadingStep === 'display') ? 'bg-[#22C55E]' : 'bg-gray-500'
                    }`}></div>
                    <span className="text-xs font-medium">Import</span>
                  </div>

                  {/* Arrow */}
                  <div className="text-gray-600">→</div>

                  {/* Step 2: Enrich */}
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
                    loadingStep === 'enrich'
                      ? 'bg-[#22C55E]/10 border-[#22C55E] text-[#22C55E]'
                      : loadingStep === 'display'
                      ? 'bg-[#22C55E]/5 border-[#22C55E]/30 text-[#22C55E]/60'
                      : 'bg-gray-500/10 border-gray-500/30 text-gray-500'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${
                      loadingStep === 'enrich' ? 'bg-[#22C55E] animate-pulse' :
                      loadingStep === 'display' ? 'bg-[#22C55E]' : 'bg-gray-500'
                    }`}></div>
                    <span className="text-xs font-medium">Enrich</span>
                  </div>

                  {/* Arrow */}
                  <div className="text-gray-600">→</div>

                  {/* Step 3: Display */}
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
                    loadingStep === 'display'
                      ? 'bg-[#22C55E]/10 border-[#22C55E] text-[#22C55E]'
                      : 'bg-gray-500/10 border-gray-500/30 text-gray-500'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${
                      loadingStep === 'display' ? 'bg-[#22C55E] animate-pulse' : 'bg-gray-500'
                    }`}></div>
                    <span className="text-xs font-medium">Display</span>
                  </div>
                </div>

                {/* Time Elapsed */}
                <LiveTimer startTime={loadingProgress.startTime} />

                {/* Tip */}
                <p className="text-xs text-gray-500 mt-4">
                  {loadingStep === 'import' && '⚡ Parsing Excel and saving to database...'}
                  {loadingStep === 'enrich' && '🔗 Querying NetSuite for Sales Order line items...'}
                  {loadingStep === 'display' && '📊 Rendering dashboard with enriched data...'}
                </p>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-lg p-4 mb-6">
              <p className="text-[#EF4444] text-sm">{error}</p>
            </div>
          )}

          {/* Profitability Tab - Works independently with pre-synced NetSuite data */}
          {activeTab === 'profitability' && (
            <ProfitabilityDashboard />
          )}

          {/* Main Content - Requires Excel data load */}
          {activeTab !== 'profitability' && data && (
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
