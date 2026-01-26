'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, Filter, AlertCircle } from 'lucide-react';
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
}

interface KPIData {
  totalWIP: number;
  wipValue: number;
  operationsBehind: number;
  avgDaysInOp: number;
  readyToShip: number;
  avgMargin: number | null;
  totalCost: number;
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

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

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

  // Filter data based on search term (client-side)
  const filteredData = data.filter(wo => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      wo.work_order.toLowerCase().includes(term) ||
      (wo.customer_name || '').toLowerCase().includes(term) ||
      (wo.so_number || '').toLowerCase().includes(term) ||
      (wo.assembly_description || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Filters Row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search WO#, Customer, SO#..."
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
            <option value="WorkOrd:A,WorkOrd:B">Active</option>
            <option value="WorkOrd:D">Released</option>
            <option value="WorkOrd:C">Closed</option>
          </select>
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
              {error.includes('permission') && (
                <div className="mt-3 p-3 bg-red-500/10 rounded-md">
                  <p className="text-xs text-red-400/80">
                    Required NetSuite Permissions:
                  </p>
                  <ul className="text-xs text-red-400/60 mt-1 space-y-1">
                    <li>- Lists {'>'} Manufacturing {'>'} Manufacturing Operation Task - View</li>
                    <li>- Lists {'>'} Manufacturing {'>'} Manufacturing Routing - View</li>
                    <li>- Setup {'>'} SuiteQL - Full</li>
                  </ul>
                </div>
              )}
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
              title="Operations Behind"
              value={<AnimatedCounter value={kpis.operationsBehind} />}
              subtitle={`${kpis.avgDaysInOp} avg days in op`}
              icon={KPIIcons.alert}
              color={kpis.operationsBehind > 0 ? colors.accent.amber : colors.accent.cyan}
              badge={kpis.operationsBehind > 0 ? kpis.operationsBehind : undefined}
              delay={0.2}
            />
            <KPICard
              title="Ready to Ship"
              value={<AnimatedCounter value={kpis.readyToShip} />}
              subtitle="At final operation"
              icon={KPIIcons.checkCircle}
              color={colors.accent.green}
              delay={0.3}
            />
          </>
        ) : null}
      </div>

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
              {searchTerm || statusFilter
                ? 'Try adjusting your filters'
                : 'Work orders with operations will appear here'}
            </p>
          </div>
        ) : (
          <WIPTable data={filteredData} />
        )}
      </div>
    </div>
  );
}
