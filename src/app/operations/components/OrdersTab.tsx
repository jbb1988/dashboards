'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Package, Clock, DollarSign, AlertTriangle, ChevronUp, ChevronDown, Wrench, FileText, Layers } from 'lucide-react';

interface SalesOrder {
  id: string;
  tranid: string;
  trandate: string;
  status: string;
  customer_name: string;
  total_amount: number;
  days_open: number;
  expected_ship_date: string | null;
  memo: string | null;
  // Manufacturing vs Deferred Revenue breakdown
  manufacturing_value: number;
  deferred_value: number;
  order_type: 'Manufacturing' | 'Deferred Only' | 'Mixed';
}

interface AgingBucket {
  count: number;
  value: number;
}

interface OrdersTabProps {
  loading: boolean;
  orders: SalesOrder[];
  aging?: {
    '0-30': AgingBucket;
    '31-60': AgingBucket;
    '61-90': AgingBucket;
    '90+': AgingBucket;
  };
  fulfillments: any[];
}

// Sales Order Status mapping
const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  'A': { label: 'Pending Approval', color: '#64748B', bg: 'rgba(100, 116, 139, 0.15)' },
  'B': { label: 'Pending Fulfillment', color: '#38BDF8', bg: 'rgba(56, 189, 248, 0.15)' },
  'C': { label: 'Partially Fulfilled', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)' },
  'D': { label: 'Pending Billing', color: '#A78BFA', bg: 'rgba(167, 139, 250, 0.15)' },
  'E': { label: 'Billed', color: '#22C55E', bg: 'rgba(34, 197, 94, 0.15)' },
  'F': { label: 'Closed', color: '#6B7280', bg: 'rgba(107, 114, 128, 0.15)' },
  'G': { label: 'Cancelled', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)' },
};

function getStatusInfo(status: string): { label: string; color: string; bg: string } {
  if (STATUS_MAP[status]) {
    return STATUS_MAP[status];
  }
  const entry = Object.entries(STATUS_MAP).find(([_, v]) => v.label.toLowerCase() === status.toLowerCase());
  if (entry) {
    return entry[1];
  }
  return { label: status, color: '#64748B', bg: 'rgba(100, 116, 139, 0.15)' };
}

function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const date = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

function getAgingColor(days: number): string {
  if (days > 90) return 'text-red-400 font-semibold';
  if (days > 60) return 'text-orange-400';
  if (days > 30) return 'text-amber-400';
  return 'text-green-400';
}

type FilterType = 'all' | '0-30' | '31-60' | '61-90' | '90+';
type OrderTypeFilter = 'all' | 'manufacturing' | 'deferred' | 'mixed';
type SortField = 'order' | 'customer' | 'status' | 'amount' | 'mfg' | 'deferred' | 'age';

// Grid columns: Alert | Order | Customer | Status | Mfg Value | Deferred | Age
const GRID_COLS = '28px 1fr 1.5fr 140px 90px 90px 60px';

export default function OrdersTab({ loading, orders, aging }: OrdersTabProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [orderTypeFilter, setOrderTypeFilter] = useState<OrderTypeFilter>('all');
  const [sortBy, setSortBy] = useState<SortField>('age');
  const [sortDesc, setSortDesc] = useState(true);

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDesc(!sortDesc);
    } else {
      setSortBy(field);
      setSortDesc(field === 'age' || field === 'amount' || field === 'mfg' || field === 'deferred'); // Default desc for numeric fields
    }
  };

  // First filter by aging bucket
  const agingFilteredOrders = orders.filter(order => {
    if (filter === 'all') return true;
    if (filter === '90+') return order.days_open > 90;
    if (filter === '61-90') return order.days_open > 60 && order.days_open <= 90;
    if (filter === '31-60') return order.days_open > 30 && order.days_open <= 60;
    if (filter === '0-30') return order.days_open <= 30;
    return true;
  });

  // Then filter by order type
  const filteredOrders = agingFilteredOrders.filter(order => {
    if (orderTypeFilter === 'all') return true;
    if (orderTypeFilter === 'manufacturing') return order.order_type === 'Manufacturing' || order.order_type === 'Mixed';
    if (orderTypeFilter === 'deferred') return order.order_type === 'Deferred Only';
    if (orderTypeFilter === 'mixed') return order.order_type === 'Mixed';
    return true;
  });

  // Calculate order type counts for badges
  const orderTypeCounts = {
    all: agingFilteredOrders.length,
    manufacturing: agingFilteredOrders.filter(o => o.order_type === 'Manufacturing' || o.order_type === 'Mixed').length,
    deferred: agingFilteredOrders.filter(o => o.order_type === 'Deferred Only').length,
    mixed: agingFilteredOrders.filter(o => o.order_type === 'Mixed').length,
  };

  // Calculate value totals for the current type filter
  const mfgTotal = filteredOrders.reduce((sum, o) => sum + (o.manufacturing_value || 0), 0);
  const deferredTotal = filteredOrders.reduce((sum, o) => sum + (o.deferred_value || 0), 0);

  const sortedOrders = [...filteredOrders].sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case 'order':
        cmp = a.tranid.localeCompare(b.tranid);
        break;
      case 'customer':
        cmp = (a.customer_name || '').localeCompare(b.customer_name || '');
        break;
      case 'status':
        cmp = (a.status || '').localeCompare(b.status || '');
        break;
      case 'amount':
        cmp = a.total_amount - b.total_amount;
        break;
      case 'mfg':
        cmp = (a.manufacturing_value || 0) - (b.manufacturing_value || 0);
        break;
      case 'deferred':
        cmp = (a.deferred_value || 0) - (b.deferred_value || 0);
        break;
      case 'age':
        cmp = a.days_open - b.days_open;
        break;
    }
    return sortDesc ? -cmp : cmp;
  });

  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return null;
    return sortDesc ? (
      <ChevronDown className="w-3 h-3 inline ml-0.5" />
    ) : (
      <ChevronUp className="w-3 h-3 inline ml-0.5" />
    );
  };

  // Aging buckets config
  const agingBuckets: { key: FilterType; label: string; icon: React.ReactNode; color: string; borderColor: string }[] = [
    { key: '0-30', label: '0-30 Days', icon: <Clock className="w-4 h-4" />, color: 'text-green-400', borderColor: 'border-green-500/30' },
    { key: '31-60', label: '31-60 Days', icon: <Clock className="w-4 h-4" />, color: 'text-amber-400', borderColor: 'border-amber-500/30' },
    { key: '61-90', label: '61-90 Days', icon: <AlertTriangle className="w-4 h-4" />, color: 'text-orange-400', borderColor: 'border-orange-500/30' },
    { key: '90+', label: '90+ Days', icon: <AlertCircle className="w-4 h-4" />, color: 'text-red-400', borderColor: 'border-red-500/30' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Aging Distribution Cards */}
      {aging && (
        <div className="grid grid-cols-5 gap-4">
          {/* All Orders Card */}
          <button
            onClick={() => setFilter('all')}
            className={`p-4 rounded-xl transition-all text-left ${
              filter === 'all'
                ? 'bg-[#1E3A5F] border border-blue-500/30 ring-1 ring-blue-500/20'
                : 'bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04]'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Package className={`w-4 h-4 ${filter === 'all' ? 'text-blue-400' : 'text-gray-500'}`} />
              <span className={`text-xs font-medium ${filter === 'all' ? 'text-blue-400' : 'text-gray-500'}`}>
                All Orders
              </span>
            </div>
            <div className={`text-2xl font-bold ${filter === 'all' ? 'text-white' : 'text-gray-300'}`}>
              {orders.length}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {formatCurrency(orders.reduce((sum, o) => sum + o.total_amount, 0))}
            </div>
          </button>

          {/* Aging Bucket Cards */}
          {agingBuckets.map(bucket => {
            const data = aging[bucket.key as keyof typeof aging];
            const isActive = filter === bucket.key;

            return (
              <button
                key={bucket.key}
                onClick={() => setFilter(bucket.key)}
                className={`p-4 rounded-xl transition-all text-left ${
                  isActive
                    ? `bg-white/[0.05] border ${bucket.borderColor} ring-1 ring-white/10`
                    : 'bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={isActive ? bucket.color : 'text-gray-500'}>{bucket.icon}</span>
                  <span className={`text-xs font-medium ${isActive ? bucket.color : 'text-gray-500'}`}>
                    {bucket.label}
                  </span>
                </div>
                <div className={`text-2xl font-bold ${isActive ? bucket.color : 'text-gray-300'}`}>
                  {data?.count || 0}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {formatCurrency(data?.value || 0)}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Order Type Filter Row */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Order Type:</span>
        <div className="flex gap-2">
          <button
            onClick={() => setOrderTypeFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              orderTypeFilter === 'all'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'bg-white/[0.02] text-gray-400 border border-white/[0.06] hover:bg-white/[0.04]'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            All Types
            <span className="ml-1 px-1.5 py-0.5 rounded bg-white/10 text-[10px]">
              {orderTypeCounts.all}
            </span>
          </button>
          <button
            onClick={() => setOrderTypeFilter('manufacturing')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              orderTypeFilter === 'manufacturing'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-white/[0.02] text-gray-400 border border-white/[0.06] hover:bg-white/[0.04]'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            Manufacturing
            <span className="ml-1 px-1.5 py-0.5 rounded bg-white/10 text-[10px]">
              {orderTypeCounts.manufacturing}
            </span>
          </button>
          <button
            onClick={() => setOrderTypeFilter('deferred')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              orderTypeFilter === 'deferred'
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                : 'bg-white/[0.02] text-gray-400 border border-white/[0.06] hover:bg-white/[0.04]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Deferred Only
            <span className="ml-1 px-1.5 py-0.5 rounded bg-white/10 text-[10px]">
              {orderTypeCounts.deferred}
            </span>
          </button>
          <button
            onClick={() => setOrderTypeFilter('mixed')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              orderTypeFilter === 'mixed'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-white/[0.02] text-gray-400 border border-white/[0.06] hover:bg-white/[0.04]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Mixed
            <span className="ml-1 px-1.5 py-0.5 rounded bg-white/10 text-[10px]">
              {orderTypeCounts.mixed}
            </span>
          </button>
        </div>

        {/* Value Summary */}
        <div className="ml-auto flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <Wrench className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-gray-500">Mfg:</span>
            <span className="text-emerald-400 font-medium">{formatCurrency(mfgTotal)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-gray-500">Deferred:</span>
            <span className="text-purple-400 font-medium">{formatCurrency(deferredTotal)}</span>
          </div>
        </div>
      </div>

      {/* Orders List */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/[0.06] bg-white/[0.02] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-semibold text-white">Open Orders</h2>
            {filter !== 'all' && (
              <span className="text-xs font-normal px-2 py-0.5 rounded-md bg-white/[0.06] text-gray-400">
                {filter}
              </span>
            )}
          </div>
          <span className="text-sm text-gray-500">{sortedOrders.length} orders</span>
        </div>

        {/* Column Headers */}
        <div
          className="grid gap-4 px-4 py-3 border-b border-white/[0.06] text-xs font-semibold text-gray-500 uppercase tracking-wider"
          style={{ gridTemplateColumns: GRID_COLS }}
        >
          <div></div>
          <div
            className="cursor-pointer hover:text-gray-300 transition-colors"
            onClick={() => handleSort('order')}
          >
            Order<SortIndicator field="order" />
          </div>
          <div
            className="cursor-pointer hover:text-gray-300 transition-colors"
            onClick={() => handleSort('customer')}
          >
            Customer<SortIndicator field="customer" />
          </div>
          <div
            className="cursor-pointer hover:text-gray-300 transition-colors"
            onClick={() => handleSort('status')}
          >
            Status<SortIndicator field="status" />
          </div>
          <div
            className="text-right cursor-pointer hover:text-gray-300 transition-colors"
            onClick={() => handleSort('mfg')}
            title="Manufacturing value (equipment, components, install)"
          >
            Mfg<SortIndicator field="mfg" />
          </div>
          <div
            className="text-right cursor-pointer hover:text-gray-300 transition-colors"
            onClick={() => handleSort('deferred')}
            title="Deferred revenue (software, maintenance)"
          >
            Deferred<SortIndicator field="deferred" />
          </div>
          <div
            className="text-right cursor-pointer hover:text-gray-300 transition-colors"
            onClick={() => handleSort('age')}
          >
            Age<SortIndicator field="age" />
          </div>
        </div>

        {/* Rows */}
        <div className="max-h-[600px] overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading orders...</div>
          ) : sortedOrders.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
                <Package className="w-6 h-6 text-green-400" />
              </div>
              <p className="text-gray-400">No orders found</p>
            </div>
          ) : (
            sortedOrders.map((order, index) => {
              const isOverdue = order.days_open > 90;
              const isWarning = order.days_open > 60 && order.days_open <= 90;
              const statusInfo = getStatusInfo(order.status);
              const isEven = index % 2 === 0;
              const hasMfg = (order.manufacturing_value || 0) > 0;
              const hasDeferred = (order.deferred_value || 0) > 0;

              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.015, 0.3) }}
                  className={`grid gap-4 px-4 py-3 items-center border-b border-white/[0.04] transition-colors hover:bg-white/[0.03] ${
                    isOverdue ? 'bg-red-500/[0.04]' : isWarning ? 'bg-orange-500/[0.02]' : isEven ? 'bg-[#151F2E]' : 'bg-[#131B28]'
                  }`}
                  style={{ gridTemplateColumns: GRID_COLS }}
                >
                  {/* Alert/Type Icon */}
                  <div className="flex justify-center" title={
                    isOverdue ? 'Overdue (90+ days)' :
                    isWarning ? 'Warning (61-90 days)' :
                    order.order_type
                  }>
                    {isOverdue ? (
                      <AlertCircle className="w-4 h-4 text-red-400" />
                    ) : isWarning ? (
                      <AlertTriangle className="w-4 h-4 text-orange-400" />
                    ) : order.order_type === 'Deferred Only' ? (
                      <FileText className="w-4 h-4 text-purple-400" />
                    ) : order.order_type === 'Mixed' ? (
                      <Layers className="w-4 h-4 text-amber-400" />
                    ) : (
                      <Wrench className="w-4 h-4 text-emerald-400" />
                    )}
                  </div>

                  {/* Order */}
                  <div className="min-w-0">
                    <span className="font-medium text-white truncate block">{order.tranid}</span>
                    <span className="text-[11px] text-gray-500 truncate block">{formatDate(order.trandate)}</span>
                  </div>

                  {/* Customer */}
                  <div className="min-w-0">
                    <span className="text-gray-300 truncate block" title={order.customer_name}>
                      {order.customer_name || '-'}
                    </span>
                    {order.memo && (
                      <span className="text-[11px] text-gray-500 truncate block" title={order.memo}>
                        {order.memo}
                      </span>
                    )}
                  </div>

                  {/* Status */}
                  <div>
                    <span
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium"
                      style={{
                        backgroundColor: statusInfo.bg,
                        color: statusInfo.color,
                      }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: statusInfo.color }}
                      />
                      {statusInfo.label}
                    </span>
                  </div>

                  {/* Manufacturing Value */}
                  <div className="text-right">
                    {hasMfg ? (
                      <span className="text-sm font-medium text-emerald-400 tabular-nums">
                        {formatCurrency(order.manufacturing_value)}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-600">-</span>
                    )}
                  </div>

                  {/* Deferred Value */}
                  <div className="text-right">
                    {hasDeferred ? (
                      <span className="text-sm font-medium text-purple-400 tabular-nums">
                        {formatCurrency(order.deferred_value)}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-600">-</span>
                    )}
                  </div>

                  {/* Age */}
                  <div className="text-right">
                    <span className={`text-sm tabular-nums ${getAgingColor(order.days_open)}`}>
                      {order.days_open}d
                    </span>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        {sortedOrders.length > 50 && (
          <div className="px-4 py-3 text-center text-gray-500 text-sm border-t border-white/[0.06]">
            Showing {sortedOrders.length} orders
          </div>
        )}
      </div>
    </motion.div>
  );
}
