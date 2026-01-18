'use client';

import { useState, useEffect, useRef } from 'react';
import { RefreshCw, Clock, Database, Search, AlertCircle, ChevronDown, X } from 'lucide-react';
import ProfitabilityKPIs from './ProfitabilityKPIs';

interface ProjectOption {
  name: string;
  years: number[];
}

// Matches the actual API response from /api/closeout/profitability
interface SOLineItem {
  lineNumber: number;
  itemId: string;
  itemName: string | null;
  itemDescription: string | null;
  itemType: string | null;
  quantity: number;
  rate: number;
  amount: number;
  costEstimate: number;
  grossProfit: number;
  grossMarginPct: number;
  isClosed: boolean;
}

interface WOLineItem {
  lineNumber: number;
  itemId: string;
  itemName: string | null;
  itemDescription: string | null;
  itemType: string | null;
  quantity: number;
  quantityCompleted: number;
  unitCost: number;
  lineCost: number;
  costEstimate: number;
  actualCost: number | null;
  isClosed: boolean;
}

interface LinkedSalesOrder {
  soNumber: string;
  netsuiteId: string;
  soDate: string | null;
  status: string | null;
  customerName: string | null;
  totalAmount: number;
  lineItems: SOLineItem[];
  totals: {
    lineItemCount: number;
    revenue: number;
    costEstimate: number;
    grossProfit: number;
    grossMarginPct: number;
  };
}

interface WorkOrderDetail {
  woNumber: string;
  netsuiteId: string;
  woDate: string | null;
  status: string | null;
  linkedSO: LinkedSalesOrder | null;
  lineItems: WOLineItem[];
  totals: {
    lineItemCount: number;
    totalEstimatedCost: number;
    totalActualCost: number | null;
    totalCost: number;
  };
}

interface ProjectTypeDetail {
  typeCode: string;
  typeName: string;
  excelData: {
    budgetRevenue: number;
    budgetCost: number;
    budgetGP: number;
    actualRevenue: number;
    actualCost: number;
    actualGP: number;
    variance: number;
  };
  workOrders: WorkOrderDetail[];
  linkedSalesOrders: string[];
  totals: {
    woCount: number;
    soCount: number;
    netsuiteRevenue: number;
    netsuiteCostEstimate: number;
    netsuiteActualCost: number | null;
    netsuiteGrossProfit: number;
    netsuiteGrossMarginPct: number;
  };
}

interface ProfitabilityData {
  project: {
    name: string;
    year: number | null;
    customerName: string | null;
    projectTypes: ProjectTypeDetail[];
    totals: {
      projectTypeCount: number;
      workOrderCount: number;
      salesOrderCount: number;
      excelBudgetRevenue: number;
      excelActualRevenue: number;
      excelVariance: number;
      netsuiteRevenue: number;
      netsuiteCostEstimate: number;
      netsuiteActualCost: number | null;
      netsuiteGrossProfit: number;
      netsuiteGrossMarginPct: number;
    };
  };
  legend: Record<string, string>;
  syncStatus: {
    lastSyncedAt: string | null;
    workOrderCount: number;
    salesOrderCount: number;
    workOrdersWithActualCosts: number;
  };
}

interface ProfitabilityDashboardProps {
  initialProject?: string;
  initialYear?: number;
}

export default function ProfitabilityDashboard({ initialProject, initialYear }: ProfitabilityDashboardProps) {
  const [projectName, setProjectName] = useState(initialProject || '');
  const [year, setYear] = useState<number | ''>(initialYear || '');
  const [searchInput, setSearchInput] = useState(initialProject || '');
  const [data, setData] = useState<ProfitabilityData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dropdown state
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch available projects on mount
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await fetch('/api/closeout/projects');
        const result = await response.json();
        if (result.projects) {
          setProjects(result.projects);
        }
      } catch (err) {
        console.error('Failed to fetch projects:', err);
      } finally {
        setLoadingProjects(false);
      }
    };
    fetchProjects();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter projects based on search input
  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchInput.toLowerCase())
  );

  const fetchData = async (project: string, yr?: number | '') => {
    if (!project) {
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let url = `/api/closeout/profitability?project=${encodeURIComponent(project)}`;
      if (yr) {
        url += `&year=${yr}`;
      }

      const response = await fetch(url);
      const result = await response.json();

      if (!response.ok) {
        setError(result.message || result.error || 'Failed to fetch data');
        setData(null);
      } else {
        setData(result);
        setError(null);
      }
    } catch (err) {
      setError('Network error. Please check your connection.');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch if initialProject provided
  useEffect(() => {
    if (initialProject) {
      fetchData(initialProject, initialYear);
    }
  }, [initialProject, initialYear]);

  const handleSearch = () => {
    const trimmedProject = searchInput.trim();

    if (trimmedProject) {
      setProjectName(trimmedProject);
      setIsDropdownOpen(false);
      fetchData(trimmedProject, year);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
    }
  };

  const selectProject = (project: ProjectOption, selectedYear?: number) => {
    setSearchInput(project.name);
    setProjectName(project.name);
    setYear(selectedYear || '');
    setIsDropdownOpen(false);
    fetchData(project.name, selectedYear || '');
  };

  const clearSelection = () => {
    setSearchInput('');
    setProjectName('');
    setYear('');
    setData(null);
  };

  const formatSyncTime = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="bg-[#111827] rounded-xl border border-white/[0.04] p-4">
        <div className="flex items-center gap-4">
          {/* Searchable Dropdown */}
          <div className="flex-1 relative" ref={dropdownRef}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 z-10" />
              <input
                type="text"
                placeholder={loadingProjects ? "Loading projects..." : "Search or select a project..."}
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setIsDropdownOpen(true);
                }}
                onFocus={() => setIsDropdownOpen(true)}
                onKeyDown={handleKeyPress}
                disabled={loadingProjects}
                className="w-full pl-10 pr-10 py-2.5 bg-[#0D1117] border border-white/[0.08] rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/20 focus:border-[#3B82F6]/40"
              />
              {searchInput ? (
                <button
                  onClick={clearSelection}
                  className="absolute right-8 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : null}
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
              >
                <ChevronDown className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* Dropdown List */}
            {isDropdownOpen && !loadingProjects && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-80 overflow-y-auto bg-[#0D1117] border border-white/[0.08] rounded-lg shadow-xl">
                {filteredProjects.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-400">
                    No projects found matching "{searchInput}"
                  </div>
                ) : (
                  filteredProjects.map((project) => (
                    <div
                      key={project.name}
                      className="border-b border-white/[0.04] last:border-b-0"
                    >
                      {/* Project name - click to search all years */}
                      <button
                        onClick={() => selectProject(project)}
                        className="w-full px-4 py-2.5 text-left hover:bg-white/[0.04] transition-colors flex items-center justify-between"
                      >
                        <span className="text-sm text-white font-medium">{project.name}</span>
                        <span className="text-xs text-gray-500">All years</span>
                      </button>
                      {/* Year buttons */}
                      {project.years.length > 0 && (
                        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
                          {project.years.map((yr) => (
                            <button
                              key={yr}
                              onClick={() => selectProject(project, yr)}
                              className="px-2.5 py-1 text-xs bg-[#1F2937] hover:bg-[#374151] text-gray-300 hover:text-white rounded transition-colors"
                            >
                              {yr}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <button
            onClick={handleSearch}
            disabled={loading || !searchInput.trim()}
            className="px-6 py-2.5 bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Search
              </>
            )}
          </button>
        </div>

        {/* Sync Status Bar */}
        {data?.syncStatus && (
          <div className="mt-3 pt-3 border-t border-white/[0.04] flex items-center justify-between text-xs text-gray-400">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Last synced: {formatSyncTime(data.syncStatus.lastSyncedAt)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5" />
                <span>{data.syncStatus.salesOrderCount.toLocaleString()} SOs | {data.syncStatus.workOrderCount.toLocaleString()} WOs</span>
              </div>
            </div>
            <a
              href="/api/netsuite/scheduled-sync"
              target="_blank"
              className="text-[#3B82F6] hover:text-[#60A5FA] transition-colors flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Trigger Sync
            </a>
          </div>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-[#EF4444] flex-shrink-0" />
          <div>
            <p className="text-sm text-[#EF4444] font-medium">Error loading data</p>
            <p className="text-xs text-gray-400 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!data && !loading && !error && (
        <div className="bg-[#111827] rounded-xl border border-white/[0.04] p-12 text-center">
          <Search className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">Select a Project</h3>
          <p className="text-sm text-gray-400 max-w-md mx-auto">
            Use the dropdown above to select a project and view its complete profitability
            hierarchy including Sales Orders, Work Orders, and all line items.
          </p>
          {projects.length > 0 && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {projects.slice(0, 5).map((project) => (
                <button
                  key={project.name}
                  onClick={() => selectProject(project)}
                  className="px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-sm text-gray-300 rounded-lg transition-colors"
                >
                  {project.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Data Display */}
      {data && (
        <>
          {/* KPIs - Computed from project types */}
          {(() => {
            // Compute KPIs from projectTypes
            const totals = data.project.totals;
            const projectTypes = data.project.projectTypes;

            const budgetRevenue = totals.excelBudgetRevenue;
            const actualRevenue = totals.excelActualRevenue;
            const budgetCost = projectTypes.reduce((sum, pt) => sum + pt.excelData.budgetCost, 0);
            const actualCost = projectTypes.reduce((sum, pt) => sum + pt.excelData.actualCost, 0);
            const budgetGP = projectTypes.reduce((sum, pt) => sum + pt.excelData.budgetGP, 0);
            const actualGP = projectTypes.reduce((sum, pt) => sum + pt.excelData.actualGP, 0);
            const budgetGPM = budgetRevenue > 0 ? (budgetGP / budgetRevenue) * 100 : 0;
            const actualGPM = actualRevenue > 0 ? (actualGP / actualRevenue) * 100 : 0;
            const variance = totals.excelVariance;
            const variancePct = budgetCost > 0 ? (variance / budgetCost) * 100 : 0;
            const cpi = actualCost > 0 ? budgetCost / actualCost : 1;

            const kpis = {
              budgetRevenue,
              actualRevenue,
              budgetCost,
              actualCost,
              budgetGP,
              actualGP,
              budgetGPM,
              actualGPM,
              variance,
              variancePct,
              cpi,
            };

            return (
              <ProfitabilityKPIs
                kpis={kpis}
                projectName={data.project.customerName || data.project.name}
              />
            );
          })()}

          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-[#111827] rounded-xl border border-white/[0.04] p-4">
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Project Types</div>
              <div className="text-2xl font-bold text-white">{data.project.totals.projectTypeCount}</div>
            </div>
            <div className="bg-[#111827] rounded-xl border border-white/[0.04] p-4">
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Sales Orders</div>
              <div className="text-2xl font-bold text-white">{data.project.totals.salesOrderCount}</div>
            </div>
            <div className="bg-[#111827] rounded-xl border border-white/[0.04] p-4">
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Work Orders</div>
              <div className="text-2xl font-bold text-white">{data.project.totals.workOrderCount}</div>
            </div>
            <div className="bg-[#111827] rounded-xl border border-white/[0.04] p-4">
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">NetSuite GPM</div>
              <div className={`text-2xl font-bold ${data.project.totals.netsuiteGrossMarginPct >= 50 ? 'text-[#22C55E]' : data.project.totals.netsuiteGrossMarginPct >= 30 ? 'text-[#F59E0B]' : 'text-[#EF4444]'}`}>
                {data.project.totals.netsuiteGrossMarginPct.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Project Types Breakdown */}
          <div className="bg-[#111827] rounded-xl border border-white/[0.04] overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.04] bg-white/[0.02]">
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
                Project Types & Work Orders
              </h3>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {data.project.projectTypes.map((pt) => (
                <div key={pt.typeCode} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="text-sm font-medium text-white">{pt.typeName}</span>
                      <span className="ml-2 text-xs text-gray-500">({pt.typeCode})</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-gray-400">{pt.totals.woCount} WOs</span>
                      <span className="text-gray-400">{pt.totals.soCount} SOs</span>
                      <span className={`font-medium ${pt.totals.netsuiteGrossMarginPct >= 50 ? 'text-[#22C55E]' : pt.totals.netsuiteGrossMarginPct >= 30 ? 'text-[#F59E0B]' : 'text-[#EF4444]'}`}>
                        {pt.totals.netsuiteGrossMarginPct.toFixed(1)}% GPM
                      </span>
                    </div>
                  </div>

                  {/* Excel Budget vs Actual */}
                  <div className="grid grid-cols-4 gap-3 mb-3 text-xs">
                    <div className="bg-[#0D1117] rounded-lg p-2">
                      <div className="text-gray-400">Budget Revenue</div>
                      <div className="text-white font-medium">${(pt.excelData.budgetRevenue / 1000).toFixed(0)}K</div>
                    </div>
                    <div className="bg-[#0D1117] rounded-lg p-2">
                      <div className="text-gray-400">Actual Revenue</div>
                      <div className="text-white font-medium">${(pt.excelData.actualRevenue / 1000).toFixed(0)}K</div>
                    </div>
                    <div className="bg-[#0D1117] rounded-lg p-2">
                      <div className="text-gray-400">Actual Cost</div>
                      <div className="text-white font-medium">${(pt.excelData.actualCost / 1000).toFixed(0)}K</div>
                    </div>
                    <div className="bg-[#0D1117] rounded-lg p-2">
                      <div className="text-gray-400">Variance</div>
                      <div className={`font-medium ${pt.excelData.variance >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                        ${(pt.excelData.variance / 1000).toFixed(0)}K
                      </div>
                    </div>
                  </div>

                  {/* Work Orders */}
                  {pt.workOrders.length > 0 && (
                    <div className="space-y-2">
                      {pt.workOrders.slice(0, 5).map((wo) => (
                        <div key={wo.woNumber} className="bg-[#0D1117] rounded-lg p-2 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">{wo.woNumber}</span>
                            {wo.linkedSO && (
                              <span className="text-gray-500">→ {wo.linkedSO.soNumber}</span>
                            )}
                            <span className="text-gray-400">{wo.status}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-gray-400">{wo.totals.lineItemCount} items</span>
                            <span className="text-white">${(wo.totals.totalCost / 1000).toFixed(1)}K cost</span>
                            {wo.linkedSO && (
                              <span className={`${wo.linkedSO.totals.grossMarginPct >= 50 ? 'text-[#22C55E]' : wo.linkedSO.totals.grossMarginPct >= 30 ? 'text-[#F59E0B]' : 'text-[#EF4444]'}`}>
                                {wo.linkedSO.totals.grossMarginPct.toFixed(1)}% GPM
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                      {pt.workOrders.length > 5 && (
                        <div className="text-xs text-gray-500 text-center py-1">
                          + {pt.workOrders.length - 5} more work orders
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
