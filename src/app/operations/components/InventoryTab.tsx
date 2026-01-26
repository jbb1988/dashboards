'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { TableRowSkeleton } from '@/components/mars-ui';
import { AlertTriangle, Package } from 'lucide-react';

interface InventoryItem {
  id: string;
  item_id: string;
  display_name: string;
  item_type: string;
  quantity_on_hand: number;
  quantity_available: number;
  quantity_backordered: number;
  unit_cost: number;
  reorder_point: number | null;
  preferred_stock_level: number | null;
  location_name: string | null;
  is_low_stock: boolean;
}

interface InventoryTabProps {
  loading: boolean;
  lowStockItems: InventoryItem[];
  backorderedItems: InventoryItem[];
  valueByType: Record<string, number>;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export default function InventoryTab({
  loading,
  lowStockItems,
  backorderedItems,
  valueByType,
}: InventoryTabProps) {
  const [view, setView] = useState<'low-stock' | 'backorders' | 'value'>('low-stock');

  // Calculate total value
  const totalValue = Object.values(valueByType).reduce((sum, v) => sum + v, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* View Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setView('low-stock')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            view === 'low-stock'
              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
              : 'bg-white/[0.02] text-gray-400 border border-white/[0.06] hover:bg-white/[0.05]'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          Low Stock ({lowStockItems.length})
        </button>
        <button
          onClick={() => setView('backorders')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            view === 'backorders'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : 'bg-white/[0.02] text-gray-400 border border-white/[0.06] hover:bg-white/[0.05]'
          }`}
        >
          <Package className="w-4 h-4" />
          Backordered ({backorderedItems.length})
        </button>
        <button
          onClick={() => setView('value')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            view === 'value'
              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
              : 'bg-white/[0.02] text-gray-400 border border-white/[0.06] hover:bg-white/[0.05]'
          }`}
        >
          Value by Type
        </button>
      </div>

      {/* Low Stock View */}
      {view === 'low-stock' && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.06] bg-white/[0.02] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <h2 className="text-lg font-semibold text-white">Low Stock Items</h2>
            </div>
            <span className="text-sm text-gray-400">Below reorder point</span>
          </div>

          {loading ? (
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => (
                <TableRowSkeleton key={i} columns={5} />
              ))}
            </div>
          ) : lowStockItems.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
                <Package className="w-6 h-6 text-green-400" />
              </div>
              <p className="text-gray-400">All items are above reorder point</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Item
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      On Hand
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Reorder Point
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Shortage
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {lowStockItems.map((item, index) => {
                    const shortage = (item.reorder_point || 0) - item.quantity_on_hand;
                    return (
                      <motion.tr
                        key={item.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className="hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div>
                            <span className="text-sm font-medium text-white">{item.item_id}</span>
                            <p className="text-xs text-gray-500 truncate max-w-[200px]">{item.display_name}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm font-medium text-red-400">
                            {formatNumber(item.quantity_on_hand)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm text-gray-400">
                            {formatNumber(item.reorder_point || 0)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm font-medium text-red-400">
                            -{formatNumber(shortage)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm text-gray-400">
                            {formatCurrency(item.quantity_on_hand * item.unit_cost)}
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
      )}

      {/* Backorders View */}
      {view === 'backorders' && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.06] bg-white/[0.02] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-semibold text-white">Backordered Items</h2>
            </div>
            <span className="text-sm text-gray-400">Awaiting stock fulfillment</span>
          </div>

          {loading ? (
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => (
                <TableRowSkeleton key={i} columns={4} />
              ))}
            </div>
          ) : backorderedItems.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
                <Package className="w-6 h-6 text-green-400" />
              </div>
              <p className="text-gray-400">No backordered items</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Item
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      On Hand
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Backordered
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Available
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {backorderedItems.map((item, index) => (
                    <motion.tr
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <span className="text-sm font-medium text-white">{item.item_id}</span>
                          <p className="text-xs text-gray-500 truncate max-w-[200px]">{item.display_name}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-gray-300">
                          {formatNumber(item.quantity_on_hand)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-medium text-amber-400">
                          {formatNumber(item.quantity_backordered)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-sm font-medium ${item.quantity_available < 0 ? 'text-red-400' : 'text-gray-300'}`}>
                          {formatNumber(item.quantity_available)}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Value by Type View */}
      {view === 'value' && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.06] bg-white/[0.02] flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Inventory Value by Type</h2>
            <span className="text-sm font-medium text-purple-400">
              Total: {formatCurrency(totalValue)}
            </span>
          </div>

          {loading ? (
            <div className="p-4 space-y-2">
              {[...Array(3)].map((_, i) => (
                <TableRowSkeleton key={i} columns={3} />
              ))}
            </div>
          ) : Object.keys(valueByType).length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No inventory data available
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {Object.entries(valueByType)
                .sort((a, b) => b[1] - a[1])
                .map(([type, value], index) => {
                  const percentage = totalValue > 0 ? (value / totalValue) * 100 : 0;
                  const colors = [
                    'bg-purple-500',
                    'bg-blue-500',
                    'bg-cyan-500',
                    'bg-green-500',
                    'bg-amber-500',
                    'bg-orange-500',
                  ];
                  const color = colors[index % colors.length];

                  return (
                    <motion.div
                      key={type}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="space-y-1"
                    >
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-300">{type}</span>
                        <span className="text-white font-medium">{formatCurrency(value)}</span>
                      </div>
                      <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ duration: 0.5, delay: index * 0.05 }}
                          className={`h-full ${color} rounded-full`}
                        />
                      </div>
                      <div className="text-xs text-gray-500 text-right">
                        {percentage.toFixed(1)}%
                      </div>
                    </motion.div>
                  );
                })}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
