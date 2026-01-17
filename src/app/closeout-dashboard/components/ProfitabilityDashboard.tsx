'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, Clock, Database, Search, AlertCircle } from 'lucide-react';
import ProfitabilityKPIs from './ProfitabilityKPIs';
import ProjectHierarchy from './ProjectHierarchy';

interface ProjectKPIs {
  budgetRevenue: number;
  actualRevenue: number;
  budgetCost: number;
  actualCost: number;
  budgetGP: number;
  actualGP: number;
  budgetGPM: number;
  actualGPM: number;
  variance: number;
  variancePct: number;
  cpi: number;
}

interface SOLineItem {
  lineId: string;
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
  lineId: string;
  itemId: string;
  itemName: string | null;
  itemDescription: string | null;
  itemType: string | null;
  quantity: number;
  quantityCompleted: number;
  unitCost: number;
  lineCost: number;
  isClosed: boolean;
}

interface WorkOrder {
  woNumber: string;
  netsuiteId: string;
  woDate: string | null;
  status: string | null;
  customerName: string | null;
  lineItems: WOLineItem[];
  totals: {
    itemCount: number;
    totalQuantity: number;
    totalCost: number;
  };
}

interface SalesOrder {
  soNumber: string;
  netsuiteId: string;
  soDate: string | null;
  status: string | null;
  customerName: string | null;
  totalAmount: number;
  lineItems: SOLineItem[];
  workOrders: WorkOrder[];
  totals: {
    lineItemCount: number;
    workOrderCount: number;
    revenue: number;
    costEstimate: number;
    grossProfit: number;
    grossMarginPct: number;
    woManufacturingCost: number;
  };
}

interface ProfitabilityData {
  project: {
    name: string;
    year: number | null;
    customerName: string | null;
    kpis: ProjectKPIs;
    salesOrders: SalesOrder[];
    totals: {
      salesOrderCount: number;
      workOrderCount: number;
      soLineItemCount: number;
      woLineItemCount: number;
      totalRevenue: number;
      totalCostEstimate: number;
      totalWOCost: number;
    };
  };
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

export default function ProfitabilityDashboard({ initialProject, initialYear }: ProfitabilityDashboardProps) {
  const [projectName, setProjectName] = useState(initialProject || '');
  const [year, setYear] = useState<number | ''>(initialYear || '');
  const [searchInput, setSearchInput] = useState(initialProject || '');
  const [yearInput, setYearInput] = useState(initialYear?.toString() || '');
  const [data, setData] = useState<ProfitabilityData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    const parsedYear = yearInput ? parseInt(yearInput) : '';

    if (trimmedProject) {
      setProjectName(trimmedProject);
      setYear(parsedYear);
      fetchData(trimmedProject, parsedYear);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
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
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Enter project name (e.g., Sarasota, Empire, Ferguson)..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyPress={handleKeyPress}
              className="w-full pl-10 pr-4 py-2.5 bg-[#0D1117] border border-white/[0.08] rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/20 focus:border-[#3B82F6]/40"
            />
          </div>
          <div className="w-32">
            <input
              type="number"
              placeholder="Year"
              value={yearInput}
              onChange={(e) => setYearInput(e.target.value)}
              onKeyPress={handleKeyPress}
              min="2020"
              max="2030"
              className="w-full px-4 py-2.5 bg-[#0D1117] border border-white/[0.08] rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/20 focus:border-[#3B82F6]/40"
            />
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
          <h3 className="text-lg font-medium text-white mb-2">Search for a Project</h3>
          <p className="text-sm text-gray-400 max-w-md mx-auto">
            Enter a project or customer name to view the complete profitability hierarchy
            including Sales Orders, Work Orders, and all line items.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {['Sarasota', 'Empire', 'Ferguson'].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => {
                  setSearchInput(suggestion);
                  fetchData(suggestion);
                }}
                className="px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-sm text-gray-300 rounded-lg transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Data Display */}
      {data && (
        <>
          {/* KPIs */}
          <ProfitabilityKPIs
            kpis={data.project.kpis}
            projectName={data.project.customerName || data.project.name}
          />

          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-[#111827] rounded-xl border border-white/[0.04] p-4">
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Sales Orders</div>
              <div className="text-2xl font-bold text-white">{data.project.totals.salesOrderCount}</div>
            </div>
            <div className="bg-[#111827] rounded-xl border border-white/[0.04] p-4">
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Work Orders</div>
              <div className="text-2xl font-bold text-white">{data.project.totals.workOrderCount}</div>
            </div>
            <div className="bg-[#111827] rounded-xl border border-white/[0.04] p-4">
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">SO Line Items</div>
              <div className="text-2xl font-bold text-white">{data.project.totals.soLineItemCount}</div>
            </div>
            <div className="bg-[#111827] rounded-xl border border-white/[0.04] p-4">
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">WO Line Items</div>
              <div className="text-2xl font-bold text-white">{data.project.totals.woLineItemCount}</div>
            </div>
          </div>

          {/* Project Hierarchy */}
          <ProjectHierarchy salesOrders={data.project.salesOrders} />
        </>
      )}
    </div>
  );
}
