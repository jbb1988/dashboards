'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Package,
  Calendar,
  User,
  DollarSign,
  Wrench,
  FileText,
  Layers,
  ExternalLink,
  Loader2,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';

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
  manufacturing_value: number;
  deferred_value: number;
  order_type: 'Manufacturing' | 'Deferred Only' | 'Mixed';
}

interface LineItem {
  line_id: string;
  item_id: string;
  item_name: string;
  item_description: string;
  quantity: number;
  rate: number;
  amount: number;
  income_account: string;
  income_account_name: string;
  is_manufacturing: boolean;
}

interface OrderDetailDrawerProps {
  order: SalesOrder | null;
  onClose: () => void;
}

// Status mapping
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
  if (STATUS_MAP[status]) return STATUS_MAP[status];
  const entry = Object.entries(STATUS_MAP).find(([_, v]) => v.label.toLowerCase() === status.toLowerCase());
  if (entry) return entry[1];
  return { label: status, color: '#64748B', bg: 'rgba(100, 116, 139, 0.15)' };
}

function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  try {
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

export default function OrderDetailDrawer({ order, onClose }: OrderDetailDrawerProps) {
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch line items when order changes
  useEffect(() => {
    if (order) {
      setLoading(true);
      setError(null);
      setLineItems([]);

      fetch(`/api/netsuite/order-lines?orderId=${order.id}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setLineItems(data.lines || []);
          } else {
            setError(data.error || 'Failed to load line items');
          }
        })
        .catch(err => {
          console.error('Error fetching line items:', err);
          setError('Failed to load line items');
        })
        .finally(() => setLoading(false));
    }
  }, [order?.id]);

  if (!order) return null;

  const statusInfo = getStatusInfo(order.status);
  const isOverdue = order.days_open > 90;
  const isWarning = order.days_open > 60 && order.days_open <= 90;

  // Separate line items by type
  const mfgItems = lineItems.filter(li => li.is_manufacturing);
  const deferredItems = lineItems.filter(li => !li.is_manufacturing);

  return (
    <AnimatePresence>
      {order && (
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
            className="fixed right-0 top-0 bottom-0 w-[560px] bg-[#151F2E] border-l border-white/[0.06] shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex-shrink-0 border-b border-white/[0.06] bg-[#151F2E]">
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0 pr-4">
                    {/* Status Badge */}
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium"
                        style={{ backgroundColor: statusInfo.bg, color: statusInfo.color }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: statusInfo.color }}
                        />
                        {statusInfo.label}
                      </span>
                      {order.order_type === 'Manufacturing' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-500/15 text-emerald-400">
                          <Wrench className="w-3 h-3" />
                          Manufacturing
                        </span>
                      )}
                      {order.order_type === 'Deferred Only' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-purple-500/15 text-purple-400">
                          <FileText className="w-3 h-3" />
                          Deferred
                        </span>
                      )}
                      {order.order_type === 'Mixed' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-500/15 text-amber-400">
                          <Layers className="w-3 h-3" />
                          Mixed
                        </span>
                      )}
                    </div>

                    {/* Order Number */}
                    <h2 className="text-xl font-semibold text-white mb-1">
                      {order.tranid}
                    </h2>

                    {/* Customer */}
                    <div className="flex items-center gap-2 text-[#8FA3BF]">
                      <User className="w-4 h-4" />
                      <span className="text-sm">{order.customer_name}</span>
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

                {/* Quick Stats */}
                <div className="grid grid-cols-4 gap-3 mt-4">
                  <div className="bg-white/[0.03] rounded-lg p-3">
                    <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Order Date</div>
                    <div className="text-sm font-medium text-white flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-gray-500" />
                      {formatDate(order.trandate)}
                    </div>
                  </div>
                  <div className="bg-white/[0.03] rounded-lg p-3">
                    <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Age</div>
                    <div className={`text-sm font-medium ${isOverdue ? 'text-red-400' : isWarning ? 'text-orange-400' : 'text-white'}`}>
                      {order.days_open} days
                      {isOverdue && <AlertCircle className="w-3.5 h-3.5 inline ml-1" />}
                    </div>
                  </div>
                  <div className="bg-white/[0.03] rounded-lg p-3">
                    <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Total</div>
                    <div className="text-sm font-medium text-white">
                      {formatCurrency(order.total_amount)}
                    </div>
                  </div>
                  <div className="bg-white/[0.03] rounded-lg p-3">
                    <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Lines</div>
                    <div className="text-sm font-medium text-white">
                      {loading ? '-' : lineItems.length}
                    </div>
                  </div>
                </div>

                {/* Value Breakdown */}
                <div className="flex gap-3 mt-3">
                  <div className="flex-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Wrench className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs text-emerald-400 font-medium">Manufacturing</span>
                    </div>
                    <div className="text-lg font-bold text-emerald-400">
                      {formatCurrency(order.manufacturing_value)}
                    </div>
                  </div>
                  <div className="flex-1 bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="w-4 h-4 text-purple-400" />
                      <span className="text-xs text-purple-400 font-medium">Deferred</span>
                    </div>
                    <div className="text-lg font-bold text-purple-400">
                      {formatCurrency(order.deferred_value)}
                    </div>
                  </div>
                </div>

                {/* Memo */}
                {order.memo && (
                  <div className="mt-3 p-3 bg-white/[0.02] rounded-lg border border-white/[0.04]">
                    <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Memo</div>
                    <p className="text-sm text-gray-300">{order.memo}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Line Items */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-gray-500 animate-spin" />
                  <span className="ml-2 text-gray-500">Loading line items...</span>
                </div>
              ) : error ? (
                <div className="p-6 text-center">
                  <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                  <p className="text-red-400">{error}</p>
                </div>
              ) : lineItems.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No line items found</p>
                </div>
              ) : (
                <div className="p-4 space-y-4">
                  {/* Manufacturing Items */}
                  {mfgItems.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 px-2 py-2 mb-2">
                        <Wrench className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                          Manufacturing Items ({mfgItems.length})
                        </span>
                      </div>
                      <div className="space-y-2">
                        {mfgItems.map((item) => (
                          <LineItemCard key={item.line_id} item={item} type="manufacturing" />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Deferred Items */}
                  {deferredItems.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 px-2 py-2 mb-2">
                        <FileText className="w-4 h-4 text-purple-400" />
                        <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">
                          Deferred Items ({deferredItems.length})
                        </span>
                      </div>
                      <div className="space-y-2">
                        {deferredItems.map((item) => (
                          <LineItemCard key={item.line_id} item={item} type="deferred" />
                        ))}
                      </div>
                    </div>
                  )}
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

// Line Item Card Component
function LineItemCard({ item, type }: { item: LineItem; type: 'manufacturing' | 'deferred' }) {
  const borderColor = type === 'manufacturing' ? 'border-emerald-500/20' : 'border-purple-500/20';
  const bgColor = type === 'manufacturing' ? 'bg-emerald-500/5' : 'bg-purple-500/5';

  return (
    <div className={`${bgColor} ${borderColor} border rounded-lg p-3`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-white text-sm truncate" title={item.item_name}>
            {item.item_name}
          </div>
          {item.item_description && item.item_description !== item.item_name && (
            <div className="text-xs text-gray-500 truncate mt-0.5" title={item.item_description}>
              {item.item_description}
            </div>
          )}
          <div className="text-[10px] text-gray-600 mt-1">
            {item.income_account_name || item.income_account}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-sm font-medium text-white">
            {formatCurrency(Math.abs(item.amount))}
          </div>
          <div className="text-[10px] text-gray-500">
            {item.quantity} × {formatCurrency(Math.abs(item.rate))}
          </div>
        </div>
      </div>
    </div>
  );
}
