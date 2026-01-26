'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { TableRowSkeleton } from '@/components/mars-ui';

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
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    // Handle MM/DD/YYYY format from NetSuite
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const date = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

function getAgingColor(daysOpen: number): string {
  if (daysOpen > 90) return 'text-red-400';
  if (daysOpen > 60) return 'text-orange-400';
  if (daysOpen > 30) return 'text-amber-400';
  return 'text-green-400';
}

function getAgingBadge(daysOpen: number): { bg: string; text: string; label: string } {
  if (daysOpen > 90) return { bg: 'bg-red-500/20', text: 'text-red-400', label: '90+' };
  if (daysOpen > 60) return { bg: 'bg-orange-500/20', text: 'text-orange-400', label: '61-90' };
  if (daysOpen > 30) return { bg: 'bg-amber-500/20', text: 'text-amber-400', label: '31-60' };
  return { bg: 'bg-green-500/20', text: 'text-green-400', label: '0-30' };
}

export default function OrdersTab({ loading, orders, aging, fulfillments }: OrdersTabProps) {
  const [filter, setFilter] = useState<'all' | '90+' | '61-90' | '31-60' | '0-30'>('all');

  // Filter orders based on selected aging bucket
  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true;
    if (filter === '90+') return order.days_open > 90;
    if (filter === '61-90') return order.days_open > 60 && order.days_open <= 90;
    if (filter === '31-60') return order.days_open > 30 && order.days_open <= 60;
    if (filter === '0-30') return order.days_open <= 30;
    return true;
  });

  // Sort by days_open descending (oldest first)
  const sortedOrders = [...filteredOrders].sort((a, b) => b.days_open - a.days_open);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Aging Distribution Bar */}
      {aging && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Order Aging Distribution</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`flex-1 p-3 rounded-lg transition-all ${
                filter === 'all'
                  ? 'bg-white/[0.1] border border-white/[0.2]'
                  : 'bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.05]'
              }`}
            >
              <div className="text-xs text-gray-500 mb-1">All</div>
              <div className="text-lg font-semibold text-white">{orders.length}</div>
            </button>
            <button
              onClick={() => setFilter('0-30')}
              className={`flex-1 p-3 rounded-lg transition-all ${
                filter === '0-30'
                  ? 'bg-green-500/20 border border-green-500/30'
                  : 'bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.05]'
              }`}
            >
              <div className="text-xs text-gray-500 mb-1">0-30 days</div>
              <div className="text-lg font-semibold text-green-400">{aging['0-30'].count}</div>
              <div className="text-xs text-gray-500">{formatCurrency(aging['0-30'].value)}</div>
            </button>
            <button
              onClick={() => setFilter('31-60')}
              className={`flex-1 p-3 rounded-lg transition-all ${
                filter === '31-60'
                  ? 'bg-amber-500/20 border border-amber-500/30'
                  : 'bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.05]'
              }`}
            >
              <div className="text-xs text-gray-500 mb-1">31-60 days</div>
              <div className="text-lg font-semibold text-amber-400">{aging['31-60'].count}</div>
              <div className="text-xs text-gray-500">{formatCurrency(aging['31-60'].value)}</div>
            </button>
            <button
              onClick={() => setFilter('61-90')}
              className={`flex-1 p-3 rounded-lg transition-all ${
                filter === '61-90'
                  ? 'bg-orange-500/20 border border-orange-500/30'
                  : 'bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.05]'
              }`}
            >
              <div className="text-xs text-gray-500 mb-1">61-90 days</div>
              <div className="text-lg font-semibold text-orange-400">{aging['61-90'].count}</div>
              <div className="text-xs text-gray-500">{formatCurrency(aging['61-90'].value)}</div>
            </button>
            <button
              onClick={() => setFilter('90+')}
              className={`flex-1 p-3 rounded-lg transition-all ${
                filter === '90+'
                  ? 'bg-red-500/20 border border-red-500/30'
                  : 'bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.05]'
              }`}
            >
              <div className="text-xs text-gray-500 mb-1">90+ days</div>
              <div className="text-lg font-semibold text-red-400">{aging['90+'].count}</div>
              <div className="text-xs text-gray-500">{formatCurrency(aging['90+'].value)}</div>
            </button>
          </div>
        </div>
      )}

      {/* Orders Table */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06] bg-white/[0.02] flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">
            Open Orders
            {filter !== 'all' && (
              <span className="ml-2 text-sm font-normal text-gray-400">
                ({filter} days)
              </span>
            )}
          </h2>
          <span className="text-sm text-gray-400">{sortedOrders.length} orders</span>
        </div>

        {loading ? (
          <div className="p-4 space-y-2">
            {[...Array(5)].map((_, i) => (
              <TableRowSkeleton key={i} columns={6} />
            ))}
          </div>
        ) : sortedOrders.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No orders found in this aging bucket
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Order #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Age
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {sortedOrders.map((order, index) => {
                  const badge = getAgingBadge(order.days_open);
                  return (
                    <motion.tr
                      key={order.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-white">{order.tranid}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-300">{order.customer_name}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-400">{formatDate(order.trandate)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-1 rounded bg-white/[0.06] text-gray-300">
                          {order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-medium text-white">
                          {formatCurrency(order.total_amount)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${getAgingColor(order.days_open)}`}>
                          {order.days_open}d
                          <span className={`text-xs px-1.5 py-0.5 rounded ${badge.bg} ${badge.text}`}>
                            {badge.label}
                          </span>
                        </span>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  );
}
