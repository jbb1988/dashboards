'use client';

import { useState, useEffect, useRef } from 'react';
import { RefreshCw, Clock, Database, Search, AlertCircle, ChevronDown, ChevronRight, X, Package, Wrench } from 'lucide-react';
import ProfitabilityKPIs from './ProfitabilityKPIs';
import ProductTypeGroup from './ProductTypeGroup';
import WorkOrderCostBreakdown from './WorkOrderCostBreakdown';
import RollupValidation from './RollupValidation';

interface ProjectOption {
  name: string;
  years: number[];
}

// New API Response Structure
interface EnhancedSOLineItem {
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
  accountNumber: string | null;
  accountName: string | null;
  productType: string;
}

interface ProductTypeGroup {
  productType: string;
  productTypeName: string;
  lineItems: EnhancedSOLineItem[];
  totals: {
    lineItemCount: number;
    revenue: number;
    costEstimate: number;
    grossProfit: number;
    grossMarginPct: number;
  };
}

interface RollupValidation {
  productTypeBreakdown: Array<{ type: string; total: number }>;
  lineItemsTotal: number;
  expectedTotal: number;
  variance: number;
  variancePct: number;
  valid: boolean;
}

interface LinkedSalesOrder {
  soNumber: string;
  netsuiteId: string;
  soDate: string | null;
  status: string | null;
  customerName: string | null;
  totalAmount: number;
  productTypeGroups: ProductTypeGroup[];
  rollupValidation: RollupValidation;
  totals: {
    lineItemCount: number;
    revenue: number;
    costEstimate: number;
    grossProfit: number;
    grossMarginPct: number;
  };
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
  completionPct: number;
}

interface WorkOrderDetail {
  woNumber: string;
  netsuiteId: string;
  woDate: string | null;
  status: string | null;
  linkedSONumber: string | null;
  lineItems: WOLineItem[];
  totals: {
    lineItemCount: number;
    totalEstimatedCost: number;
    totalActualCost: number | null;
    totalCost: number;
  };
}

interface ProjectKPIs {
  revenue: number;
  cost: number;
  grossProfit: number;
  grossMarginPct: number;
  cpi: number;
  budgetRevenue: number;
  budgetCost: number;
  actualRevenue: number;
  actualCost: number;
}

interface ProfitabilityData {
  project: {
    name: string;
    year: number | null;
    customerName: string | null;
  };
  kpis: ProjectKPIs;
  salesOrders: LinkedSalesOrder[];
  workOrders: WorkOrderDetail[];
  syncStatus: {
    lastSyncedAt: string | null;
    workOrderCount: number;
    salesOrderCount: number;
  };
}

interface ProfitabilityDashboardProps {
  initialProject?: string;
  initialYear?: number;
}

function formatCurrency(value: number): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (absValue >= 1000000) return `${sign}$${(absValue / 1000000).toFixed(1)}M`;
  if (absValue >= 1000) return `${sign}$${(absValue / 1000).toFixed(0)}K`;
  return `${sign}$${absValue.toFixed(0)}`;
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

  // Expanded state
  const [expandedSOs, setExpandedSOs] = useState<Set<string>>(new Set());
  const [expandedWOs, setExpandedWOs] = useState<Set<string>>(new Set());

  const toggleSO = (soNumber: string) => {
    setExpandedSOs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(soNumber)) {
        newSet.delete(soNumber);
      } else {
        newSet.add(soNumber);
      }
      return newSet;
    });
  };

  const toggleWO = (woNumber: string) => {
    setExpandedWOs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(woNumber)) {
        newSet.delete(woNumber);
      } else {
        newSet.add(woNumber);
      }
      return newSet;
    });
  };

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

  // Transform KPIs for ProfitabilityKPIs component
  const transformedKPIs = data ? {
    budgetRevenue: data.kpis.budgetRevenue,
    actualRevenue: data.kpis.revenue,
    budgetCost: data.kpis.budgetCost,
    actualCost: data.kpis.cost,
    budgetGP: data.kpis.budgetRevenue - data.kpis.budgetCost,
    actualGP: data.kpis.grossProfit,
    budgetGPM: data.kpis.budgetRevenue > 0 ? ((data.kpis.budgetRevenue - data.kpis.budgetCost) / data.kpis.budgetRevenue) * 100 : 0,
    actualGPM: data.kpis.grossMarginPct,
    variance: data.kpis.budgetCost - data.kpis.cost,
    variancePct: data.kpis.budgetCost > 0 ? ((data.kpis.budgetCost - data.kpis.cost) / data.kpis.budgetCost) * 100 : 0,
    cpi: data.kpis.cpi,
  } : null;

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="bg-[#111827] rounded-xl border border-white/[0.04] p-4">
        <div className="flex items-center gap-4">
          {/* Searchable Dropdown */}
          <div className="flex-1 relative" ref={dropdownRef}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setIsDropdownOpen(true);
                }}
                onFocus={() => setIsDropdownOpen(true)}
                onKeyDown={handleKeyPress}
                placeholder="Search projects..."
                className="w-full pl-10 pr-10 py-2 bg-[#0A0F1E] border border-white/[0.10] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#22C55E]/50"
              />
              {searchInput && (
                <button
                  onClick={clearSelection}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Dropdown Menu */}
            {isDropdownOpen && !loadingProjects && filteredProjects.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-[#111827] border border-white/[0.10] rounded-lg shadow-xl z-50 max-h-96 overflow-auto">
                {filteredProjects.map((project, idx) => (
                  <div key={idx} className="border-b border-white/[0.04] last:border-0">
                    <div className="px-4 py-2 font-medium text-white hover:bg-white/[0.04]">
                      {project.name}
                    </div>
                    <div className="flex flex-wrap gap-2 px-4 pb-2">
                      {project.years.map(yr => (
                        <button
                          key={yr}
                          onClick={() => selectProject(project, yr)}
                          className="px-3 py-1 text-xs bg-white/[0.06] hover:bg-[#22C55E]/20 text-gray-300 hover:text-[#22C55E] rounded-full transition-colors"
                        >
                          {yr}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Year Filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">Year:</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value ? parseInt(e.target.value) : '')}
              placeholder="All"
              className="w-24 px-3 py-2 bg-[#0A0F1E] border border-white/[0.10] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#22C55E]/50"
            />
          </div>

          {/* Search Button */}
          <button
            onClick={handleSearch}
            disabled={loading || !searchInput.trim()}
            className="px-6 py-2 bg-[#22C55E] hover:bg-[#22C55E]/90 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Loading
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Search
              </>
            )}
          </button>
        </div>

        {/* Sync Status */}
        {data && (
          <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-gray-400">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Last sync: {formatSyncTime(data.syncStatus.lastSyncedAt)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5" />
                <span>{data.syncStatus.workOrderCount} WOs, {data.syncStatus.salesOrderCount} SOs</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-red-400 font-medium">Error Loading Data</div>
            <div className="text-red-300/80 text-sm mt-1">{error}</div>
          </div>
        </div>
      )}

      {/* Results */}
      {data && !error && (
        <div className="space-y-6">
          {/* 1. HIGH-LEVEL KPIs */}
          {transformedKPIs && (
            <ProfitabilityKPIs kpis={transformedKPIs} projectName={data.project.name} />
          )}

          {/* 2. SALES ORDERS BY PRODUCT TYPE */}
          <div className="bg-[#111827] rounded-xl border border-white/[0.04] p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-[#22C55E]" />
                <h2 className="text-lg font-semibold text-white">Sales Orders by Product Type</h2>
              </div>
              <div className="text-xs text-gray-400">
                {data.salesOrders.length} {data.salesOrders.length === 1 ? 'order' : 'orders'}
              </div>
            </div>

            {data.salesOrders.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                No sales orders found for this project
              </div>
            ) : (
              <div className="space-y-4">
                {data.salesOrders.map((so) => (
                  <div key={so.soNumber} className="bg-white/[0.02] rounded-lg border border-white/[0.06]">
                    {/* SO Header */}
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/[0.04] transition-colors"
                      onClick={() => toggleSO(so.soNumber)}
                    >
                      <div className="flex items-center gap-3">
                        <button className="text-gray-400 hover:text-white transition-colors">
                          {expandedSOs.has(so.soNumber) ? (
                            <ChevronDown className="w-5 h-5" />
                          ) : (
                            <ChevronRight className="w-5 h-5" />
                          )}
                        </button>
                        <div>
                          <div className="text-white font-medium">{so.soNumber}</div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {so.customerName} • {so.soDate} • {so.status}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 text-sm">
                        <div>
                          <span className="text-gray-400 mr-2">Revenue:</span>
                          <span className="text-white font-medium">{formatCurrency(so.totals.revenue)}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 mr-2">GP:</span>
                          <span className={so.totals.grossProfit >= 0 ? 'text-green-400' : 'text-red-400'}>
                            {formatCurrency(so.totals.grossProfit)}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400 mr-2">GPM:</span>
                          <span className={
                            so.totals.grossMarginPct >= 50 ? 'text-green-400' :
                            so.totals.grossMarginPct >= 30 ? 'text-yellow-400' :
                            'text-red-400'
                          }>
                            {so.totals.grossMarginPct.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Expandable Content */}
                    {expandedSOs.has(so.soNumber) && (
                      <div className="px-4 pb-4 space-y-3">
                        {/* Product Type Groups */}
                        {so.productTypeGroups.map((group) => (
                          <ProductTypeGroup
                            key={group.productType}
                            productType={group.productType}
                            productTypeName={group.productTypeName}
                            lineItems={group.lineItems}
                            totals={group.totals}
                          />
                        ))}

                        {/* Rollup Validation */}
                        <RollupValidation
                          productTypeBreakdown={so.rollupValidation.productTypeBreakdown}
                          lineItemsTotal={so.rollupValidation.lineItemsTotal}
                          expectedTotal={so.rollupValidation.expectedTotal}
                          variance={so.rollupValidation.variance}
                          variancePct={so.rollupValidation.variancePct}
                          valid={so.rollupValidation.valid}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. WORK ORDERS WITH COST DETAIL */}
          <div className="bg-[#111827] rounded-xl border border-white/[0.04] p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-[#F59E0B]" />
                <h2 className="text-lg font-semibold text-white">Work Orders with Cost Detail</h2>
              </div>
              <div className="text-xs text-gray-400">
                {data.workOrders.length} {data.workOrders.length === 1 ? 'order' : 'orders'}
              </div>
            </div>

            {data.workOrders.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                No work orders found for this project
              </div>
            ) : (
              <div className="space-y-4">
                {data.workOrders.map((wo) => (
                  <div key={wo.woNumber} className="bg-white/[0.02] rounded-lg border border-white/[0.06]">
                    {/* WO Header */}
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/[0.04] transition-colors"
                      onClick={() => toggleWO(wo.woNumber)}
                    >
                      <div className="flex items-center gap-3">
                        <button className="text-gray-400 hover:text-white transition-colors">
                          {expandedWOs.has(wo.woNumber) ? (
                            <ChevronDown className="w-5 h-5" />
                          ) : (
                            <ChevronRight className="w-5 h-5" />
                          )}
                        </button>
                        <div>
                          <div className="text-white font-medium">{wo.woNumber}</div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {wo.woDate} • {wo.status}
                            {wo.linkedSONumber && (
                              <span className="ml-2">→ Linked to {wo.linkedSONumber}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 text-sm">
                        <div>
                          <span className="text-gray-400 mr-2">Est. Cost:</span>
                          <span className="text-gray-300">{formatCurrency(wo.totals.totalEstimatedCost)}</span>
                        </div>
                        {wo.totals.totalActualCost !== null && (
                          <div>
                            <span className="text-gray-400 mr-2">Actual:</span>
                            <span className="text-white font-medium">{formatCurrency(wo.totals.totalActualCost)}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-400 mr-2">Total:</span>
                          <span className="text-white font-bold">{formatCurrency(wo.totals.totalCost)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Expandable Cost Breakdown */}
                    {expandedWOs.has(wo.woNumber) && (
                      <div className="px-4 pb-4">
                        <WorkOrderCostBreakdown
                          lineItems={wo.lineItems}
                          totals={wo.totals}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!data && !error && !loading && (
        <div className="bg-[#111827] rounded-xl border border-white/[0.04] p-12 text-center">
          <Database className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <div className="text-gray-400 text-lg mb-2">No Project Selected</div>
          <div className="text-gray-500 text-sm">
            Search for a project above to view profitability data
          </div>
        </div>
      )}
    </div>
  );
}
