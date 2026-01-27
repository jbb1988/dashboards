'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, Filter, AlertCircle, AlertTriangle, TrendingUp, Clock, DollarSign, Package } from 'lucide-react';
import { KPICard, AnimatedCounter, KPIIcons, KPICardSkeleton, TableRowSkeleton, colors } from '@/components/mars-ui';
import WIPTable from './WIPTable';

interface WorkOrderOperation {
  operation_sequence: number;
  operation_name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  completed_quantity: number | null;
  input_quantity: number | null;
  work_center: string | null;
  estimated_time: number | null;
  actual_time: number | null;
}

interface WorkOrderWithOperations {
  work_order_id: string;
  work_order: string;
  wo_date: string | null;
  status: string | null;
  customer_id: string | null;
  customer_name: string | null;
  so_number: string | null;
  assembly_description: string | null;
  operations: WorkOrderOperation[];
  current_operation: WorkOrderOperation | null;
  total_operations: number;
  completed_operations: number;
  percent_complete: number;
  days_in_current_op: number | null;
  revenue: number | null;
  total_cost: number | null;
  margin_pct: number | null;
  // New shop status fields
  shop_status?: string | null;
  shop_status_id?: string | null;
  days_in_status?: number;
}

interface KPIData {
  totalWIP: number;
  wipValue: number;
  operationsBehind: number;
  avgDaysInOp: number;
  readyToShip: number;
  avgMargin: number | null;
  totalCost: number;
  revenueAtRisk?: number;
  stageDistribution?: Record<string, number>;
}

interface APIResponse {
  data: WorkOrderWithOperations[];
  count: number;
  kpis: KPIData;
}

function formatCurrency(value: number): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (absValue >= 1000000) return `${sign}$${(absValue / 1000000).toFixed(1)}M`;
  if (absValue >= 1000) return `${sign}$${(absValue / 1000).toFixed(0)}K`;
  return `${sign}$${absValue.toFixed(0)}`;
}

export default function WIPOperationsDashboard() {
  const [data, setData] = useState<WorkOrderWithOperations[]>([]);
  const [kpis, setKpis] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Filters - Default to active statuses (exclude Closed) and recent WOs only
  const [statusFilter, setStatusFilter] = useState<string>('A,B,D');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showStuckOnly, setShowStuckOnly] = useState(false);
  const [maxAgeDays, setMaxAgeDays] = useState<number | null>(90); // Default: only WOs from last 90 days

  const fetchData = async () => {
    try {
      setError(null);

      const params = new URLSearchParams();
      if (statusFilter) {
        params.set('status', statusFilter);
      }
      if (searchTerm) {
        params.set('workOrder', searchTerm);
      }

      const url = `/api/netsuite/work-order-operations${params.toString() ? `?${params.toString()}` : ''}`;
      console.log('Fetching:', url);

      const response = await fetch(url);
      const result: APIResponse | { error: string; message: string } = await response.json();

      if (!response.ok) {
        const errorResult = result as { error: string; message: string; details?: string };
        throw new Error(errorResult.message || errorResult.error || 'Failed to fetch data');
      }

      const successResult = result as APIResponse;
      setData(successResult.data || []);
      setKpis(successResult.kpis || null);
    } catch (err) {
      console.error('Error fetching WIP operations:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleSearch = () => {
    setLoading(true);
    fetchData();
  };

  // Filter data based on search term, stuck filter, and age filter (client-side)
  const filteredData = data.filter(wo => {
    // Apply max age filter (exclude stale WOs)
    if (maxAgeDays !== null) {
      const days = wo.days_in_status ?? wo.days_in_current_op ?? 0;
      if (days > maxAgeDays) return false;
    }

    // Apply stuck filter
    if (showStuckOnly) {
      const days = wo.days_in_status ?? wo.days_in_current_op ?? 0;
      if (days <= 7) return false;
    }

    // Apply search filter
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      wo.work_order.toLowerCase().includes(term) ||
      (wo.customer_name || '').toLowerCase().includes(term) ||
      (wo.so_number || '').toLowerCase().includes(term) ||
      (wo.assembly_description || '').toLowerCase().includes(term) ||
      (wo.shop_status || '').toLowerCase().includes(term)
    );
  });

  // Get stuck WOs for attention section
  const stuckWOs = data.filter(wo => {
    const days = wo.days_in_status ?? wo.days_in_current_op ?? 0;
    return days > 7;
  });

  return (
    <div className="space-y-6">
      {/* Attention Required Banner */}
      {!loading && stuckWOs.length > 0 && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-400">
                Attention Required
              </h3>
              <p className="text-red-400/80 mt-1">
                <span className="font-semibold">{stuckWOs.length} work orders</span> stuck for more than 7 days,
                representing <span className="font-semibold">{formatCurrency(kpis?.revenueAtRisk || 0)}</span> revenue at risk
              </p>
              <button
                onClick={() => setShowStuckOnly(!showStuckOnly)}
                className="mt-3 px-4 py-1.5 text-sm bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
              >
                {showStuckOnly ? 'Show All WOs' : 'View Stuck WOs Only'}
              </button>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-red-400">{stuckWOs.length}</div>
              <div className="text-sm text-red-400/60">stuck WOs</div>
            </div>
          </div>
        </div>
      )}

      {/* Filters Row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search WO#, Customer, Stage..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-[280px] px-4 py-2 bg-white/[0.03] border border-white/[0.08] rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-white/[0.03] border border-white/[0.08] rounded-lg text-sm text-white focus:outline-none focus:border-white/20"
          >
            <option value="">All Statuses</option>
            <option value="A,B,D">Active - Planned/Released/In Process (A,B,D)</option>
            <option value="B">Released (B)</option>
            <option value="D">In Process (D)</option>
            <option value="A">Planned (A)</option>
            <option value="C">Built (C)</option>
            <option value="H">Closed (H)</option>
          </select>

          {/* Age Filter - exclude stale WOs */}
          <select
            value={maxAgeDays === null ? 'all' : maxAgeDays.toString()}
            onChange={(e) => setMaxAgeDays(e.target.value === 'all' ? null : parseInt(e.target.value))}
            className="px-4 py-2 bg-white/[0.03] border border-white/[0.08] rounded-lg text-sm text-white focus:outline-none focus:border-white/20"
          >
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="180">Last 6 months</option>
            <option value="365">Last year</option>
            <option value="all">All time (incl. stale)</option>
          </select>

          {/* Stuck Filter Toggle */}
          {stuckWOs.length > 0 && (
            <button
              onClick={() => setShowStuckOnly(!showStuckOnly)}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                showStuckOnly
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-white/[0.03] text-gray-400 border border-white/[0.08] hover:bg-white/[0.05]'
              }`}
            >
              Stuck Only ({stuckWOs.length})
            </button>
          )}
        </div>

        {/* Refresh Button */}
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white hover:bg-white/[0.08] transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 font-medium">Error Loading Data</p>
              <p className="text-red-400/70 text-sm mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        {loading ? (
          <>
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
          </>
        ) : kpis ? (
          <>
            <KPICard
              title="Total WIP"
              value={<AnimatedCounter value={kpis.totalWIP} />}
              subtitle="Active work orders"
              icon={KPIIcons.folder}
              color={colors.accent.blue}
              delay={0}
            />
            <KPICard
              title="WIP Value"
              value={formatCurrency(kpis.wipValue)}
              subtitle="Total revenue in progress"
              icon={KPIIcons.dollar}
              color={colors.accent.green}
              delay={0.1}
            />
            <KPICard
              title="Stuck (>7 days)"
              value={<AnimatedCounter value={kpis.operationsBehind} />}
              subtitle={kpis.revenueAtRisk ? `${formatCurrency(kpis.revenueAtRisk)} at risk` : 'Revenue at risk'}
              icon={KPIIcons.alert}
              color={kpis.operationsBehind > 0 ? colors.accent.red : colors.accent.green}
              badge={kpis.operationsBehind > 0 ? kpis.operationsBehind : undefined}
              delay={0.2}
            />
            <KPICard
              title="Avg Days in Stage"
              value={kpis.avgDaysInOp.toFixed(1)}
              subtitle={kpis.readyToShip > 0 ? `${kpis.readyToShip} ready to ship` : 'Days in current stage'}
              icon={KPIIcons.clock}
              color={kpis.avgDaysInOp > 7 ? colors.accent.amber : colors.accent.cyan}
              delay={0.3}
            />
          </>
        ) : null}
      </div>

      {/* Stage Distribution Summary */}
      {!loading && kpis?.stageDistribution && Object.keys(kpis.stageDistribution).length > 0 && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-400 mb-3">Stage Distribution</h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(kpis.stageDistribution)
              .sort((a, b) => b[1] - a[1])
              .map(([stage, count]) => (
                <div
                  key={stage}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.03] rounded-lg"
                >
                  <span className="text-gray-300">{stage || 'Unknown'}</span>
                  <span className="px-2 py-0.5 bg-white/[0.08] rounded text-sm text-gray-400">
                    {count}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Data Table */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
        {/* Table Header */}
        <div className="px-6 py-4 border-b border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              Work Orders
              {!loading && (
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({filteredData.length} {filteredData.length === 1 ? 'order' : 'orders'})
                  {showStuckOnly && ' - showing stuck only'}
                </span>
              )}
            </h2>
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRowSkeleton key={i} columns={7} />
            ))}
          </div>
        ) : filteredData.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/[0.03] flex items-center justify-center">
              <Filter className="w-8 h-8 text-gray-600" />
            </div>
            <p className="text-gray-400">No work orders found</p>
            <p className="text-gray-600 text-sm mt-1">
              {searchTerm || statusFilter || showStuckOnly
                ? 'Try adjusting your filters'
                : 'Work orders will appear here'}
            </p>
          </div>
        ) : (
          <WIPTable data={filteredData} />
        )}
      </div>
    </div>
  );
}
