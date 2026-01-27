'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { KPICard, AnimatedCounter, KPIIcons, colors, KPICardSkeleton } from '@/components/mars-ui';
import { AlertToast } from '@/components/alerts';
import OrdersTab from './OrdersTab';
import InventoryTab from './InventoryTab';
import WIPOperationsDashboard from '@/app/wip-dashboard/components/WIPOperationsDashboard';

// =============================================================================
// TYPES
// =============================================================================

interface OrderMetrics {
  aging: {
    '0-30': { count: number; value: number };
    '31-60': { count: number; value: number };
    '61-90': { count: number; value: number };
    '90+': { count: number; value: number };
  };
  summary: {
    totalOpenOrders: number;
    totalBacklogValue: number;
    revenueAtRisk: number;
    onTimeDeliveryPct: number;
  };
  orders: any[];
  fulfillments: any[];
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

interface InventoryMetrics {
  summary: {
    totalInventoryValue: number;
    totalItemsOnHand: number;
    totalBackorderedItems: number;
    lowStockItemCount: number;
    // New actionable KPIs
    revenueBlockedByInventory: number;
    ordersBlockedByInventory: number;
    topBlockingDriver: string;
    topBlockingDriverCount: number;
  };
  valueByType: Record<string, number>;
  backorderBlastRadius: BackorderBlastRadius;
  actionItems: ActionItem[];
  lowStockItems: any[];
  backorderedItems: any[];
  allItems: any[];
}

type TabId = 'orders' | 'inventory' | 'wip';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface OperationsCommandCenterProps {
  initialTab?: TabId;
}

export default function OperationsCommandCenter({ initialTab = 'orders' }: OperationsCommandCenterProps) {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [orderMetrics, setOrderMetrics] = useState<OrderMetrics | null>(null);
  const [inventoryMetrics, setInventoryMetrics] = useState<InventoryMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Alert state
  const [alert, setAlert] = useState<{
    visible: boolean;
    type: 'warning' | 'error' | 'info' | 'success';
    title: string;
    message?: string;
  }>({ visible: false, type: 'info', title: '' });

  // Fetch metrics
  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch order and inventory metrics in parallel
      const [orderRes, inventoryRes] = await Promise.all([
        fetch('/api/netsuite/order-metrics'),
        fetch('/api/netsuite/inventory-metrics'),
      ]);

      if (!orderRes.ok || !inventoryRes.ok) {
        throw new Error('Failed to fetch metrics');
      }

      const orderData = await orderRes.json();
      const inventoryData = await inventoryRes.json();

      if (orderData.success) {
        setOrderMetrics(orderData.metrics);
      }
      if (inventoryData.success) {
        setInventoryMetrics(inventoryData.metrics);
      }

      // Show alert if there are critical issues
      const aging90Plus = orderData.metrics?.aging?.['90+']?.count || 0;
      const revenueBlocked = inventoryData.metrics?.summary?.revenueBlockedByInventory || 0;
      const actionCount = inventoryData.metrics?.actionItems?.length || 0;

      if (aging90Plus > 0 || revenueBlocked > 100000 || actionCount > 0) {
        const issues = [];
        if (aging90Plus > 0) issues.push(`${aging90Plus} orders aging 90+ days`);
        if (revenueBlocked > 100000) issues.push(`${formatCurrency(revenueBlocked)} revenue blocked`);
        if (actionCount > 0) issues.push(`${actionCount} actions requiring attention`);

        setAlert({
          visible: true,
          type: revenueBlocked > 500000 || aging90Plus > 5 ? 'error' : 'warning',
          title: 'Attention Required',
          message: issues.join(', '),
        });
      }
    } catch (err) {
      console.error('Error fetching metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load metrics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // Calculate derived metrics for display
  const revenueBlocked = inventoryMetrics?.summary?.revenueBlockedByInventory || 0;
  const topDriver = inventoryMetrics?.summary?.topBlockingDriver || 'None';
  const topDriverCount = inventoryMetrics?.summary?.topBlockingDriverCount || 0;
  const actionCount = inventoryMetrics?.actionItems?.length || 0;
  const blastRadius = inventoryMetrics?.backorderBlastRadius;

  // Tab configuration with action count
  const tabs = [
    {
      id: 'orders' as TabId,
      label: 'Orders',
      badge: orderMetrics?.aging?.['90+']?.count || 0,
    },
    {
      id: 'inventory' as TabId,
      label: 'Inventory',
      badge: actionCount > 0 ? actionCount : (inventoryMetrics?.summary?.lowStockItemCount || 0),
    },
    {
      id: 'wip' as TabId,
      label: 'WIP Operations',
      badge: 0,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Alert Toast */}
      <AlertToast
        visible={alert.visible}
        type={alert.type}
        title={alert.title}
        message={alert.message}
        onDismiss={() => setAlert(prev => ({ ...prev, visible: false }))}
        autoHide={true}
        autoHideDelay={8000}
      />

      {/* Error Banner */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500/10 border border-red-500/30 rounded-xl p-4"
        >
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={fetchMetrics}
            className="text-red-400 text-xs underline mt-2 hover:text-red-300"
          >
            Retry
          </button>
        </motion.div>
      )}

      {/* KPI Cards Row - Enhanced with context */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          <>
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
          </>
        ) : (
          <>
            {/* Revenue at Risk - Now with context */}
            <KPICard
              title="Revenue at Risk"
              value={formatCurrency(orderMetrics?.summary?.revenueAtRisk || 0)}
              subtitle={
                revenueBlocked > 0
                  ? `${formatCurrency(revenueBlocked)} blocked by inventory`
                  : `${orderMetrics?.aging?.['90+']?.count || 0} orders 90+ days`
              }
              icon={KPIIcons.alert}
              color={
                (orderMetrics?.summary?.revenueAtRisk || 0) > 1000000
                  ? colors.accent.red
                  : colors.accent.amber
              }
              badge={(orderMetrics?.aging?.['90+']?.count || 0) > 0 ? orderMetrics?.aging?.['90+']?.count : undefined}
              delay={0}
              onClick={() => setActiveTab('orders')}
              tooltip="Sum of order values weighted by age. 90+ days = 100%, 61-90 = 70%, 31-60 = 40%, 0-30 = 10%"
            />

            {/* Backlog Value */}
            <KPICard
              title="Backlog Value"
              value={formatCurrency(orderMetrics?.summary?.totalBacklogValue || 0)}
              subtitle={`${orderMetrics?.summary?.totalOpenOrders || 0} open orders`}
              icon={KPIIcons.dollar}
              color={colors.accent.blue}
              delay={0.1}
              onClick={() => setActiveTab('orders')}
            />

            {/* On-Time Delivery */}
            <KPICard
              title="On-Time Delivery"
              value={`${(orderMetrics?.summary?.onTimeDeliveryPct || 100).toFixed(1)}%`}
              subtitle="Last 90 days"
              icon={KPIIcons.checkCircle}
              color={(orderMetrics?.summary?.onTimeDeliveryPct || 100) >= 90 ? colors.accent.green : colors.accent.red}
              delay={0.2}
            />

            {/* Action Items - NEW: Primary actionable KPI */}
            <KPICard
              title="Action Required"
              value={<AnimatedCounter value={actionCount} />}
              subtitle={
                actionCount > 0
                  ? `Top: ${topDriver} (${topDriverCount} orders)`
                  : 'No critical actions'
              }
              icon={KPIIcons.warning}
              color={actionCount > 0 ? colors.accent.red : colors.accent.green}
              badge={actionCount > 0 ? actionCount : undefined}
              delay={0.3}
              onClick={() => setActiveTab('inventory')}
              tooltip="Prioritized list of inventory issues, stale orders, and blocking items requiring immediate attention"
            />
          </>
        )}
      </div>

      {/* Additional KPI Row - Enhanced with blast radius context */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {loading ? (
          <>
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
          </>
        ) : (
          <>
            {/* Inventory Value */}
            <KPICard
              title="Inventory Value"
              value={formatCurrency(inventoryMetrics?.summary?.totalInventoryValue || 0)}
              subtitle={`${inventoryMetrics?.summary?.totalItemsOnHand || 0} items on hand`}
              icon={KPIIcons.folder}
              color={colors.accent.purple}
              delay={0.4}
              onClick={() => setActiveTab('inventory')}
            />

            {/* Backorder Blast Radius - Enhanced */}
            <KPICard
              title="Backorder Impact"
              value={<AnimatedCounter value={blastRadius?.ordersImpacted || 0} />}
              subtitle={
                blastRadius && blastRadius.revenueDelayed > 0
                  ? `${formatCurrency(blastRadius.revenueDelayed)} delayed, ${blastRadius.customersImpacted} customers`
                  : 'Awaiting stock'
              }
              icon={KPIIcons.clock}
              color={
                (blastRadius?.ordersImpacted || 0) > 10
                  ? colors.accent.red
                  : (blastRadius?.ordersImpacted || 0) > 0
                    ? colors.accent.amber
                    : colors.accent.green
              }
              badge={(blastRadius?.installsAtRisk30Days || 0) > 0 ? blastRadius?.installsAtRisk30Days : undefined}
              delay={0.5}
              onClick={() => setActiveTab('inventory')}
              tooltip={
                blastRadius
                  ? `${blastRadius.totalItems} items backordered, ${blastRadius.installsAtRisk30Days} installs at risk in next 30 days`
                  : 'Items awaiting stock'
              }
            />

            {/* Orders Aging 31-90d */}
            <KPICard
              title="Orders Aging 31-90d"
              value={<AnimatedCounter value={(orderMetrics?.aging?.['31-60']?.count || 0) + (orderMetrics?.aging?.['61-90']?.count || 0)} />}
              subtitle={formatCurrency((orderMetrics?.aging?.['31-60']?.value || 0) + (orderMetrics?.aging?.['61-90']?.value || 0))}
              icon={KPIIcons.calendar}
              color={colors.accent.orange}
              delay={0.6}
              onClick={() => setActiveTab('orders')}
            />
          </>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-white/[0.06] pb-0">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-all rounded-t-lg ${
              activeTab === tab.id
                ? 'bg-white/[0.1] text-white border-b-2 border-[#F97316]'
                : 'text-gray-400 hover:text-white hover:bg-white/[0.05]'
            }`}
          >
            {tab.label}
            {tab.badge > 0 && (
              <span className="ml-2 px-1.5 py-0.5 bg-red-500/20 text-red-400 text-xs rounded">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'orders' && (
          <OrdersTab
            loading={loading}
            orders={orderMetrics?.orders || []}
            aging={orderMetrics?.aging}
            fulfillments={orderMetrics?.fulfillments || []}
          />
        )}
        {activeTab === 'inventory' && (
          <InventoryTab
            loading={loading}
            lowStockItems={inventoryMetrics?.lowStockItems || []}
            backorderedItems={inventoryMetrics?.backorderedItems || []}
            valueByType={inventoryMetrics?.valueByType || {}}
            actionItems={inventoryMetrics?.actionItems || []}
            backorderBlastRadius={inventoryMetrics?.backorderBlastRadius}
          />
        )}
        {activeTab === 'wip' && (
          <WIPOperationsDashboard />
        )}
      </div>
    </div>
  );
}
