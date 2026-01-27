'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { TableRowSkeleton } from '@/components/mars-ui';
import {
  AlertTriangle,
  Package,
  Zap,
  TrendingDown,
  Users,
  Calendar,
  Truck,
  CircleAlert,
  CheckCircle,
  Clock,
  ArrowUpRight,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

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
  // Actionable fields
  orders_blocked: number;
  revenue_blocked: number;
  customers_impacted: number;
  days_until_stockout: number | null;
  can_expedite: boolean;
  next_po_date: string | null;
  root_cause: 'Inventory' | 'Vendor Delay' | 'No PO' | 'Unknown';
}

interface ActionItem {
  id: string;
  type: 'stale_order' | 'blocking_sku' | 'low_stock_critical' | 'backorder_critical';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  metric: string;
  metric_value: string;
  owner: string;
  deadline: string | null;
  related_orders?: string[];
  related_items?: string[];
}

interface BackorderBlastRadius {
  totalItems: number;
  ordersImpacted: number;
  customersImpacted: number;
  revenueDelayed: number;
  installsAtRisk30Days: number;
  topBlockingItems: Array<{
    item_id: string;
    display_name: string;
    orders_blocked: number;
    revenue_blocked: number;
    quantity_short: number;
  }>;
}

interface InventoryTabProps {
  loading: boolean;
  lowStockItems: InventoryItem[];
  backorderedItems: InventoryItem[];
  valueByType: Record<string, number>;
  actionItems?: ActionItem[];
  backorderBlastRadius?: BackorderBlastRadius;
}

// =============================================================================
// HELPERS
// =============================================================================

function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// =============================================================================
// GRID LAYOUTS
// =============================================================================

// Critical Items: Item | On Hand | Revenue Blocked | Orders Blocked | Root Cause | Owner | Next Action
const CRITICAL_GRID = '1.2fr 80px 110px 90px 100px 80px 90px';

// Backorder Impact: Item | Shortage | Orders | Customers | Revenue | Expedite?
const BACKORDER_GRID = '1.2fr 90px 80px 90px 110px 80px';

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function SeverityBadge({ severity }: { severity: 'critical' | 'warning' | 'info' }) {
  const config = {
    critical: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
    warning: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' },
    info: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
  };
  const c = config[severity];
  return (
    <span className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded border ${c.bg} ${c.text} ${c.border}`}>
      {severity}
    </span>
  );
}

function RootCauseBadge({ cause }: { cause: string }) {
  const config: Record<string, { bg: string; text: string }> = {
    'Inventory': { bg: 'bg-amber-500/20', text: 'text-amber-400' },
    'Vendor Delay': { bg: 'bg-purple-500/20', text: 'text-purple-400' },
    'No PO': { bg: 'bg-red-500/20', text: 'text-red-400' },
    'Unknown': { bg: 'bg-gray-500/20', text: 'text-gray-400' },
  };
  const c = config[cause] || config['Unknown'];
  return (
    <span className={`px-2 py-0.5 text-[10px] font-medium rounded ${c.bg} ${c.text}`}>
      {cause}
    </span>
  );
}

function OwnerBadge({ owner }: { owner: string }) {
  const config: Record<string, { bg: string; text: string }> = {
    'Purchasing': { bg: 'bg-blue-500/20', text: 'text-blue-400' },
    'Ops': { bg: 'bg-green-500/20', text: 'text-green-400' },
    'Engineering': { bg: 'bg-purple-500/20', text: 'text-purple-400' },
    'Field': { bg: 'bg-amber-500/20', text: 'text-amber-400' },
  };
  const c = config[owner] || { bg: 'bg-gray-500/20', text: 'text-gray-400' };
  return (
    <span className={`px-2 py-0.5 text-[10px] font-medium rounded ${c.bg} ${c.text}`}>
      {owner}
    </span>
  );
}

function BlastRadiusSummary({ data }: { data: BackorderBlastRadius }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-1">
          <Package className="w-4 h-4 text-red-400" />
          <span className="text-xs text-gray-400">Items</span>
        </div>
        <div className="text-xl font-bold text-red-400">{data.totalItems}</div>
      </div>
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-1">
          <TrendingDown className="w-4 h-4 text-amber-400" />
          <span className="text-xs text-gray-400">Orders Impacted</span>
        </div>
        <div className="text-xl font-bold text-amber-400">{data.ordersImpacted}</div>
      </div>
      <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-1">
          <Users className="w-4 h-4 text-purple-400" />
          <span className="text-xs text-gray-400">Customers</span>
        </div>
        <div className="text-xl font-bold text-purple-400">{data.customersImpacted}</div>
      </div>
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-1">
          <Calendar className="w-4 h-4 text-blue-400" />
          <span className="text-xs text-gray-400">Installs at Risk (30d)</span>
        </div>
        <div className="text-xl font-bold text-blue-400">{data.installsAtRisk30Days}</div>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function InventoryTab({
  loading,
  lowStockItems,
  backorderedItems,
  valueByType,
  actionItems = [],
  backorderBlastRadius,
}: InventoryTabProps) {
  // Default to action queue if there are action items, otherwise critical items
  const [view, setView] = useState<'actions' | 'critical' | 'backorders' | 'value'>(
    actionItems.length > 0 ? 'actions' : 'critical'
  );

  // Calculate total value
  const totalValue = Object.values(valueByType).reduce((sum, v) => sum + v, 0);

  // Calculate summary stats for critical items
  const totalRevenueBlocked = lowStockItems.reduce((sum, item) => sum + (item.revenue_blocked || 0), 0);
  const itemsBlockingOrders = lowStockItems.filter(item => item.orders_blocked > 0).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* View Toggle */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setView('actions')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            view === 'actions'
              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
              : 'bg-white/[0.02] text-gray-400 border border-white/[0.06] hover:bg-white/[0.05]'
          }`}
        >
          <Zap className="w-4 h-4" />
          Action Queue ({actionItems.length})
        </button>
        <button
          onClick={() => setView('critical')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            view === 'critical'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : 'bg-white/[0.02] text-gray-400 border border-white/[0.06] hover:bg-white/[0.05]'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          Critical Items ({itemsBlockingOrders})
        </button>
        <button
          onClick={() => setView('backorders')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            view === 'backorders'
              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
              : 'bg-white/[0.02] text-gray-400 border border-white/[0.06] hover:bg-white/[0.05]'
          }`}
        >
          <Package className="w-4 h-4" />
          Backorder Impact
        </button>
        <button
          onClick={() => setView('value')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            view === 'value'
              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              : 'bg-white/[0.02] text-gray-400 border border-white/[0.06] hover:bg-white/[0.05]'
          }`}
        >
          Value by Type
        </button>
      </div>

      {/* =========================================================================
          ACTION QUEUE VIEW - "What do I do TODAY?"
          ========================================================================= */}
      {view === 'actions' && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.06] bg-gradient-to-r from-red-500/10 to-transparent">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Today's Action Queue</h2>
                  <p className="text-sm text-gray-400">Problems requiring immediate attention</p>
                </div>
              </div>
              {totalRevenueBlocked > 0 && (
                <div className="text-right">
                  <div className="text-2xl font-bold text-red-400">{formatCurrency(totalRevenueBlocked)}</div>
                  <div className="text-xs text-gray-500">Revenue at Risk</div>
                </div>
              )}
            </div>
          </div>

          {loading ? (
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => (
                <TableRowSkeleton key={i} columns={4} />
              ))}
            </div>
          ) : actionItems.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
              <p className="text-green-400 font-medium">No Critical Actions Required</p>
              <p className="text-gray-500 text-sm mt-1">All systems operating normally</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {actionItems.map((action, index) => (
                <motion.div
                  key={action.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(index * 0.03, 0.3) }}
                  className={`px-4 py-4 hover:bg-white/[0.02] transition-colors ${
                    action.severity === 'critical' ? 'bg-red-500/[0.03]' : ''
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Severity Icon */}
                    <div className={`mt-0.5 ${
                      action.severity === 'critical' ? 'text-red-400' :
                      action.severity === 'warning' ? 'text-amber-400' : 'text-blue-400'
                    }`}>
                      {action.severity === 'critical' ? (
                        <CircleAlert className="w-5 h-5" />
                      ) : action.severity === 'warning' ? (
                        <AlertTriangle className="w-5 h-5" />
                      ) : (
                        <Clock className="w-5 h-5" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-white">{action.title}</span>
                        <SeverityBadge severity={action.severity} />
                      </div>
                      <p className="text-sm text-gray-400">{action.description}</p>
                    </div>

                    {/* Metric */}
                    <div className="text-right">
                      <div className={`text-lg font-bold ${
                        action.severity === 'critical' ? 'text-red-400' :
                        action.severity === 'warning' ? 'text-amber-400' : 'text-blue-400'
                      }`}>
                        {action.metric_value}
                      </div>
                      <div className="text-xs text-gray-500">{action.metric}</div>
                    </div>

                    {/* Owner & Deadline */}
                    <div className="flex flex-col items-end gap-1 min-w-[80px]">
                      <OwnerBadge owner={action.owner} />
                      {action.deadline && (
                        <span className="text-xs text-gray-500">
                          Due: {formatDate(action.deadline)}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          CRITICAL ITEMS VIEW - Sorted by Revenue Blocked
          ========================================================================= */}
      {view === 'critical' && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.06] bg-white/[0.02]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <h2 className="text-lg font-semibold text-white">Critical Inventory Items</h2>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-400">
                  {itemsBlockingOrders} items blocking orders
                </span>
                {totalRevenueBlocked > 0 && (
                  <span className="text-sm font-medium text-red-400">
                    {formatCurrency(totalRevenueBlocked)} blocked
                  </span>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">Sorted by revenue blocked (highest first)</p>
          </div>

          {/* Header */}
          <div
            className="grid gap-4 px-4 py-3 border-b border-white/[0.06] text-xs font-semibold text-gray-500 uppercase tracking-wider"
            style={{ gridTemplateColumns: CRITICAL_GRID }}
          >
            <div>Item</div>
            <div className="text-right">On Hand</div>
            <div className="text-right">Rev Blocked</div>
            <div className="text-right">Orders</div>
            <div>Root Cause</div>
            <div>Owner</div>
            <div>Next PO</div>
          </div>

          {/* Rows */}
          {loading ? (
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => (
                <TableRowSkeleton key={i} columns={7} />
              ))}
            </div>
          ) : lowStockItems.filter(i => i.orders_blocked > 0 || i.quantity_on_hand <= 0).length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
              <p className="text-gray-400">No critical inventory constraints</p>
            </div>
          ) : (
            lowStockItems
              .filter(item => item.orders_blocked > 0 || item.quantity_on_hand <= 0)
              .map((item, index) => {
                const isEven = index % 2 === 0;
                const isCritical = item.quantity_on_hand === 0 || item.revenue_blocked > 100000;

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.015, 0.3) }}
                    className={`grid gap-4 px-4 py-3 items-center border-b border-white/[0.04] transition-colors hover:bg-white/[0.02] ${
                      isCritical ? 'bg-red-500/[0.03]' : isEven ? 'bg-[#151F2E]' : 'bg-[#131B28]'
                    }`}
                    style={{ gridTemplateColumns: CRITICAL_GRID }}
                  >
                    {/* Item */}
                    <div className="min-w-0">
                      <span className="font-medium text-white truncate block">{item.item_id}</span>
                      <span className="text-xs text-gray-500 truncate block">{item.display_name}</span>
                    </div>

                    {/* On Hand */}
                    <div className="text-right">
                      <span className={`font-medium ${item.quantity_on_hand === 0 ? 'text-red-400' : 'text-amber-400'}`}>
                        {formatNumber(item.quantity_on_hand)}
                      </span>
                    </div>

                    {/* Revenue Blocked */}
                    <div className="text-right">
                      {item.revenue_blocked > 0 ? (
                        <span className="font-bold text-red-400">{formatCurrency(item.revenue_blocked)}</span>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </div>

                    {/* Orders Blocked */}
                    <div className="text-right">
                      {item.orders_blocked > 0 ? (
                        <span className="font-medium text-amber-400">{item.orders_blocked}</span>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </div>

                    {/* Root Cause */}
                    <div>
                      <RootCauseBadge cause={item.root_cause} />
                    </div>

                    {/* Owner */}
                    <div>
                      <OwnerBadge owner={item.root_cause === 'Vendor Delay' || item.root_cause === 'No PO' ? 'Purchasing' : 'Ops'} />
                    </div>

                    {/* Next PO Date */}
                    <div className="text-right">
                      {item.can_expedite ? (
                        <div className="flex items-center justify-end gap-1">
                          <Truck className="w-3 h-3 text-green-400" />
                          <span className="text-xs text-green-400">{formatDate(item.next_po_date)}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-red-400">No PO</span>
                      )}
                    </div>
                  </motion.div>
                );
              })
          )}
        </div>
      )}

      {/* =========================================================================
          BACKORDER IMPACT VIEW - Blast Radius
          ========================================================================= */}
      {view === 'backorders' && (
        <div className="space-y-4">
          {/* Blast Radius Summary Cards */}
          {backorderBlastRadius && (
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <TrendingDown className="w-5 h-5 text-red-400" />
                <h3 className="text-lg font-semibold text-white">Backorder Blast Radius</h3>
                <span className="ml-auto text-2xl font-bold text-red-400">
                  {formatCurrency(backorderBlastRadius.revenueDelayed)}
                </span>
                <span className="text-sm text-gray-500">revenue delayed</span>
              </div>
              <BlastRadiusSummary data={backorderBlastRadius} />
            </div>
          )}

          {/* Top Blocking Items Table */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.06] bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-purple-400" />
                <h2 className="text-lg font-semibold text-white">Top Blocking Items</h2>
              </div>
              <p className="text-xs text-gray-500 mt-1">Items causing the most order delays</p>
            </div>

            {/* Header */}
            <div
              className="grid gap-4 px-4 py-3 border-b border-white/[0.06] text-xs font-semibold text-gray-500 uppercase tracking-wider"
              style={{ gridTemplateColumns: BACKORDER_GRID }}
            >
              <div>Item</div>
              <div className="text-right">Shortage</div>
              <div className="text-right">Orders</div>
              <div className="text-right">Customers</div>
              <div className="text-right">Rev Blocked</div>
              <div className="text-center">Expedite?</div>
            </div>

            {/* Rows */}
            {loading ? (
              <div className="p-4 space-y-2">
                {[...Array(5)].map((_, i) => (
                  <TableRowSkeleton key={i} columns={6} />
                ))}
              </div>
            ) : !backorderBlastRadius?.topBlockingItems?.length ? (
              <div className="p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="w-6 h-6 text-green-400" />
                </div>
                <p className="text-gray-400">No items currently blocking orders</p>
              </div>
            ) : (
              backorderBlastRadius.topBlockingItems.map((item, index) => {
                const fullItem = lowStockItems.find(i => i.item_id === item.item_id);
                const isEven = index % 2 === 0;

                return (
                  <motion.div
                    key={item.item_id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.02, 0.3) }}
                    className={`grid gap-4 px-4 py-3 items-center border-b border-white/[0.04] transition-colors hover:bg-white/[0.02] ${
                      isEven ? 'bg-[#151F2E]' : 'bg-[#131B28]'
                    }`}
                    style={{ gridTemplateColumns: BACKORDER_GRID }}
                  >
                    {/* Item */}
                    <div className="min-w-0">
                      <span className="font-medium text-white truncate block">{item.item_id}</span>
                      <span className="text-xs text-gray-500 truncate block">{item.display_name}</span>
                    </div>

                    {/* Shortage */}
                    <div className="text-right">
                      <span className="font-medium text-red-400">-{formatNumber(item.quantity_short)}</span>
                    </div>

                    {/* Orders */}
                    <div className="text-right">
                      <span className="font-medium text-amber-400">{item.orders_blocked}</span>
                    </div>

                    {/* Customers */}
                    <div className="text-right">
                      <span className="text-purple-400">{fullItem?.customers_impacted || '-'}</span>
                    </div>

                    {/* Revenue Blocked */}
                    <div className="text-right">
                      <span className="font-bold text-red-400">{formatCurrency(item.revenue_blocked)}</span>
                    </div>

                    {/* Can Expedite */}
                    <div className="text-center">
                      {fullItem?.can_expedite ? (
                        <div className="flex items-center justify-center gap-1">
                          <CheckCircle className="w-4 h-4 text-green-400" />
                          <ArrowUpRight className="w-3 h-3 text-green-400" />
                        </div>
                      ) : (
                        <span className="text-red-400 text-xs">No PO</span>
                      )}
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          VALUE BY TYPE VIEW
          ========================================================================= */}
      {view === 'value' && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.06] bg-white/[0.02] flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Inventory Value by Type</h2>
            <span className="text-sm font-medium text-blue-400">
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
                  const barColors = [
                    'bg-blue-500',
                    'bg-purple-500',
                    'bg-cyan-500',
                    'bg-green-500',
                    'bg-amber-500',
                    'bg-orange-500',
                  ];
                  const color = barColors[index % barColors.length];

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
