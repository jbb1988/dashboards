'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';

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

function getAgingBadge(days: number): { bg: string; text: string } {
  if (days > 90) return { bg: 'bg-red-500/20', text: 'text-red-400' };
  if (days > 60) return { bg: 'bg-orange-500/20', text: 'text-orange-400' };
  if (days > 30) return { bg: 'bg-amber-500/20', text: 'text-amber-400' };
  return { bg: 'bg-green-500/20', text: 'text-green-400' };
}

// Grid: Order# | Customer | Date | Status | Amount | Age
const GRID_COLS = '100px 1.5fr 90px 110px 100px 80px';

export default function OrdersTab({ loading, orders, aging }: OrdersTabProps) {
  const [filter, setFilter] = useState<'all' | '90+' | '61-90' | '31-60' | '0-30'>('all');

  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true;
    if (filter === '90+') return order.days_open > 90;
    if (filter === '61-90') return order.days_open > 60 && order.days_open <= 90;
    if (filter === '31-60') return order.days_open > 30 && order.days_open <= 60;
    if (filter === '0-30') return order.days_open <= 30;
    return true;
  });

  const sortedOrders = [...filteredOrders].sort((a, b) => b.days_open - a.days_open);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Aging Distribution */}
      {aging && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Order Aging Distribution</h3>
          <div className="flex gap-2">
            {[
              { key: 'all', label: 'All', count: orders.length, color: 'white' },
              { key: '0-30', label: '0-30d', count: aging['0-30'].count, value: aging['0-30'].value, color: 'green' },
              { key: '31-60', label: '31-60d', count: aging['31-60'].count, value: aging['31-60'].value, color: 'amber' },
              { key: '61-90', label: '61-90d', count: aging['61-90'].count, value: aging['61-90'].value, color: 'orange' },
              { key: '90+', label: '90+d', count: aging['90+'].count, value: aging['90+'].value, color: 'red' },
            ].map(bucket => (
              <button
                key={bucket.key}
                onClick={() => setFilter(bucket.key as any)}
                className={`flex-1 p-3 rounded-lg transition-all ${
                  filter === bucket.key
                    ? `bg-${bucket.color}-500/20 border border-${bucket.color}-500/30`
                    : 'bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.05]'
                }`}
              >
                <div className="text-xs text-gray-500 mb-1">{bucket.label}</div>
                <div className={`text-lg font-semibold text-${bucket.color}-400`}>{bucket.count}</div>
                {bucket.value !== undefined && (
                  <div className="text-xs text-gray-500">{formatCurrency(bucket.value)}</div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Orders List */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06] bg-white/[0.02] flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">
            Open Orders
            {filter !== 'all' && <span className="ml-2 text-sm font-normal text-gray-400">({filter})</span>}
          </h2>
          <span className="text-sm text-gray-400">{sortedOrders.length} orders</span>
        </div>

        {/* Header */}
        <div
          className="grid gap-4 px-4 py-3 border-b border-white/[0.06] text-xs font-semibold text-gray-500 uppercase tracking-wider"
          style={{ gridTemplateColumns: GRID_COLS }}
        >
          <div>Order #</div>
          <div>Customer</div>
          <div>Date</div>
          <div>Status</div>
          <div className="text-right">Amount</div>
          <div className="text-right">Age</div>
        </div>

        {/* Rows */}
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : sortedOrders.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No orders found</div>
        ) : (
          sortedOrders.map((order, index) => {
            const badge = getAgingBadge(order.days_open);
            const isEven = index % 2 === 0;
            const isOverdue = order.days_open > 90;

            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.015, 0.3) }}
                className={`grid gap-4 px-4 py-3 items-center border-b border-white/[0.04] transition-colors hover:bg-white/[0.02] ${
                  isOverdue ? 'bg-red-500/[0.03]' : isEven ? 'bg-[#151F2E]' : 'bg-[#131B28]'
                }`}
                style={{ gridTemplateColumns: GRID_COLS }}
              >
                {/* Order # */}
                <div className="flex items-center gap-2">
                  {isOverdue && <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
                  <span className="font-medium text-white truncate">{order.tranid}</span>
                </div>

                {/* Customer */}
                <div className="min-w-0">
                  <span className="text-gray-300 truncate block">{order.customer_name}</span>
                </div>

                {/* Date */}
                <div className="text-gray-400 text-sm">{formatDate(order.trandate)}</div>

                {/* Status */}
                <div>
                  <span className="text-xs px-2 py-1 rounded bg-white/[0.06] text-gray-300 truncate block">
                    {order.status}
                  </span>
                </div>

                {/* Amount */}
                <div className="text-right">
                  <span className="font-medium text-white">{formatCurrency(order.total_amount)}</span>
                </div>

                {/* Age */}
                <div className="text-right">
                  <span className={`text-sm ${getAgingColor(order.days_open)}`}>
                    {order.days_open}d
                  </span>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}
