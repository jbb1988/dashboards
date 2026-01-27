'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Package,
  AlertTriangle,
  DollarSign,
  Truck,
  Users,
  Clock,
  TrendingDown,
  Loader2,
  ShoppingCart,
  Calendar,
  MapPin,
} from 'lucide-react';

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
  orders_blocked: number;
  revenue_blocked: number;
  customers_impacted: number;
  days_until_stockout: number | null;
  can_expedite: boolean;
  next_po_date: string | null;
  root_cause: 'Inventory' | 'Vendor Delay' | 'No PO' | 'Unknown';
}

interface BlockedOrder {
  so_number: string;
  customer_name: string;
  order_date: string;
  amount: number;
  quantity_needed: number;
}

interface InventoryDetailDrawerProps {
  item: InventoryItem | null;
  onClose: () => void;
}

function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function RootCauseBadge({ cause }: { cause: string }) {
  const config: Record<string, { bg: string; text: string; border: string }> = {
    'Inventory': { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' },
    'Vendor Delay': { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
    'No PO': { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
    'Unknown': { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30' },
  };
  const c = config[cause] || config['Unknown'];
  return (
    <span className={`px-2.5 py-1 text-xs font-medium rounded-md border ${c.bg} ${c.text} ${c.border}`}>
      {cause}
    </span>
  );
}

export default function InventoryDetailDrawer({ item, onClose }: InventoryDetailDrawerProps) {
  const [blockedOrders, setBlockedOrders] = useState<BlockedOrder[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch blocked orders when item changes
  useEffect(() => {
    if (item && item.orders_blocked > 0) {
      setLoading(true);
      // For now, we'll show placeholder data - this could be enhanced with an actual API call
      // to fetch orders blocked by this specific item
      setLoading(false);
    } else {
      setBlockedOrders([]);
    }
  }, [item?.id]);

  if (!item) return null;

  const isCritical = item.quantity_on_hand === 0 || item.revenue_blocked > 100000;
  const isWarning = item.is_low_stock || item.orders_blocked > 0;

  return (
    <AnimatePresence>
      {item && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-40"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-[520px] bg-[#151F2E] border-l border-white/[0.06] shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className={`flex-shrink-0 border-b border-white/[0.06] ${isCritical ? 'bg-red-500/10' : 'bg-[#151F2E]'}`}>
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0 pr-4">
                    {/* Status Badges */}
                    <div className="flex items-center gap-2 mb-2">
                      {isCritical && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                          <AlertTriangle className="w-3 h-3" />
                          Critical
                        </span>
                      )}
                      {!isCritical && isWarning && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          <AlertTriangle className="w-3 h-3" />
                          Low Stock
                        </span>
                      )}
                      <RootCauseBadge cause={item.root_cause} />
                    </div>

                    {/* Item ID */}
                    <h2 className="text-xl font-semibold text-white mb-1">
                      {item.item_id}
                    </h2>

                    {/* Item Name */}
                    <p className="text-sm text-[#8FA3BF]">{item.display_name}</p>

                    {/* Item Type & Location */}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Package className="w-3.5 h-3.5" />
                        {item.item_type || 'Item'}
                      </span>
                      {item.location_name && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {item.location_name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Close Button */}
                  <button
                    onClick={onClose}
                    className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Quantity Stats */}
                <div className="grid grid-cols-3 gap-3 mt-4">
                  <div className={`rounded-lg p-3 ${item.quantity_on_hand === 0 ? 'bg-red-500/20 border border-red-500/30' : 'bg-white/[0.03]'}`}>
                    <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">On Hand</div>
                    <div className={`text-xl font-bold ${item.quantity_on_hand === 0 ? 'text-red-400' : 'text-white'}`}>
                      {formatNumber(item.quantity_on_hand)}
                    </div>
                  </div>
                  <div className="bg-white/[0.03] rounded-lg p-3">
                    <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Available</div>
                    <div className="text-xl font-bold text-white">
                      {formatNumber(item.quantity_available)}
                    </div>
                  </div>
                  <div className={`rounded-lg p-3 ${item.quantity_backordered > 0 ? 'bg-amber-500/20 border border-amber-500/30' : 'bg-white/[0.03]'}`}>
                    <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Backordered</div>
                    <div className={`text-xl font-bold ${item.quantity_backordered > 0 ? 'text-amber-400' : 'text-white'}`}>
                      {formatNumber(item.quantity_backordered)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Impact Section */}
              {(item.orders_blocked > 0 || item.revenue_blocked > 0) && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingDown className="w-5 h-5 text-red-400" />
                    <h3 className="text-sm font-semibold text-red-400">Business Impact</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-2xl font-bold text-red-400">
                        {formatCurrency(item.revenue_blocked)}
                      </div>
                      <div className="text-xs text-gray-500">Revenue Blocked</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-amber-400">
                        {item.orders_blocked}
                      </div>
                      <div className="text-xs text-gray-500">Orders Blocked</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-purple-400">
                        {item.customers_impacted}
                      </div>
                      <div className="text-xs text-gray-500">Customers Impacted</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Stock Levels */}
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
                <h3 className="text-sm font-semibold text-white mb-3">Stock Levels</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Reorder Point</span>
                    <span className="text-sm font-medium text-white">
                      {item.reorder_point !== null ? formatNumber(item.reorder_point) : '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Preferred Stock Level</span>
                    <span className="text-sm font-medium text-white">
                      {item.preferred_stock_level !== null ? formatNumber(item.preferred_stock_level) : '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Unit Cost</span>
                    <span className="text-sm font-medium text-white">
                      {formatCurrency(item.unit_cost)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Days Until Stockout</span>
                    <span className={`text-sm font-medium ${
                      item.days_until_stockout !== null && item.days_until_stockout <= 7
                        ? 'text-red-400'
                        : item.days_until_stockout !== null && item.days_until_stockout <= 14
                        ? 'text-amber-400'
                        : 'text-white'
                    }`}>
                      {item.days_until_stockout !== null ? `${item.days_until_stockout} days` : '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Supply Chain */}
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
                <h3 className="text-sm font-semibold text-white mb-3">Supply Chain Status</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Can Expedite?</span>
                    {item.can_expedite ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400">
                        <Truck className="w-3 h-3" />
                        Yes
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-400">
                        No
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Next PO Expected</span>
                    <span className={`text-sm font-medium ${item.next_po_date ? 'text-green-400' : 'text-red-400'}`}>
                      {item.next_po_date ? (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(item.next_po_date)}
                        </span>
                      ) : (
                        'No PO on file'
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Blocked Orders Preview */}
              {item.orders_blocked > 0 && (
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4 text-amber-400" />
                      Blocked Orders
                    </h3>
                    <span className="text-xs text-gray-500">{item.orders_blocked} orders waiting</span>
                  </div>
                  <p className="text-sm text-gray-400">
                    {item.orders_blocked} sales orders are waiting for this item to become available,
                    impacting {item.customers_impacted} customers.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 border-t border-white/[0.06] p-4 bg-[#151F2E]">
              <button
                onClick={onClose}
                className="w-full px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg transition-colors text-sm font-medium"
              >
                Close
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
