/**
 * NetSuite Inventory Metrics Queries
 *
 * These functions query NetSuite for inventory KPIs including:
 * - Inventory value (on-hand × cost)
 * - Backorder counts and blast radius
 * - Low stock alerts (items below reorder point)
 * - Orders/Revenue blocked by inventory constraints
 */

import { netsuiteRequest } from './netsuite';

// =============================================================================
// TYPES
// =============================================================================

export interface InventoryItemRecord {
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
  location_id: string | null;
  location_name: string | null;
  is_low_stock: boolean;
  // New actionable fields
  orders_blocked: number;
  revenue_blocked: number;
  customers_impacted: number;
  days_until_stockout: number | null;
  avg_daily_usage: number;
  can_expedite: boolean;
  last_receipt_date: string | null;
  next_po_date: string | null;
  root_cause: 'Inventory' | 'Vendor Delay' | 'No PO' | 'Unknown';
}

export interface BackorderBlastRadius {
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

export interface ActionItem {
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

export interface InventoryMetrics {
  // Summary KPIs
  totalInventoryValue: number;
  totalItemsOnHand: number;
  totalBackorderedItems: number;
  lowStockItemCount: number;

  // Enhanced KPIs with context
  revenueBlockedByInventory: number;
  ordersBlockedByInventory: number;
  topBlockingDriver: string;
  topBlockingDriverCount: number;

  // Breakdown
  valueByType: Record<string, number>;

  // Backorder blast radius
  backorderBlastRadius: BackorderBlastRadius;

  // Today's action queue
  actionItems: ActionItem[];

  // Detail lists
  lowStockItems: InventoryItemRecord[];
  backorderedItems: InventoryItemRecord[];
  allItems: InventoryItemRecord[];
}

// =============================================================================
// INVENTORY BALANCE QUERY
// =============================================================================

/**
 * Query Inventory Balances with item details
 * Returns on-hand quantities, costs, and reorder point comparison
 */
export async function getInventoryBalances(filters?: {
  itemType?: string[];
  locationId?: string;
  lowStockOnly?: boolean;
  limit?: number;
}): Promise<InventoryItemRecord[]> {
  const { limit = 999 } = filters || {}; // NetSuite max is 1000

  // Build item type filter - use itemtype field (not type)
  let typeFilter = "AND item.itemtype IN ('InvtPart', 'Assembly')";
  if (filters?.itemType && filters.itemType.length > 0) {
    const types = filters.itemType.map(t => `'${t.replace(/'/g, "''")}'`).join(',');
    typeFilter = ` AND item.itemtype IN (${types})`;
  }

  // Build location filter (uses InventoryBalance.location)
  let locationFilter = '';
  if (filters?.locationId) {
    locationFilter = ` AND ail.location = '${filters.locationId.replace(/'/g, "''")}'`;
  }

  // Use aggregateItemLocation for inventory quantities (has reorderpoint, quantityonhand, etc.)
  // Join with Item table for item details
  const query = `
    SELECT
      item.id,
      item.itemid,
      item.displayname,
      item.itemtype AS item_type,
      COALESCE(ail.quantityonhand, 0) AS quantity_on_hand,
      COALESCE(ail.quantityavailable, 0) AS quantity_available,
      COALESCE(ail.quantitybackordered, 0) AS quantity_backordered,
      COALESCE(ail.averagecostmli, item.averagecost, item.lastpurchaseprice, item.cost, 0) AS unit_cost,
      ail.reorderpoint,
      ail.preferredstocklevel,
      ail.location AS location_id,
      BUILTIN.DF(ail.location) AS location_name
    FROM Item item
    INNER JOIN aggregateItemLocation ail ON item.id = ail.item
    WHERE item.isinactive = 'F'
      ${typeFilter}
      ${locationFilter}
    ORDER BY item.itemid
  `;

  try {
    console.log('Fetching inventory balances...');

    const response = await netsuiteRequest<{ items: any[]; hasMore: boolean }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: query },
        params: { limit: limit.toString() },
      }
    );

    const records: InventoryItemRecord[] = (response.items || []).map(row => {
      const qtyOnHand = parseFloat(row.quantity_on_hand) || 0;
      const reorderPoint = row.reorderpoint !== null ? parseFloat(row.reorderpoint) : null;
      const isLowStock = reorderPoint !== null && qtyOnHand > 0 && qtyOnHand < reorderPoint;

      return {
        id: row.id?.toString() || '',
        item_id: row.itemid || '',
        display_name: row.displayname || row.itemid || '',
        item_type: row.item_type || '',
        quantity_on_hand: qtyOnHand,
        quantity_available: parseFloat(row.quantity_available) || 0,
        quantity_backordered: parseFloat(row.quantity_backordered) || 0,
        unit_cost: parseFloat(row.unit_cost) || 0,
        reorder_point: reorderPoint,
        preferred_stock_level: row.preferredstocklevel !== null ? parseFloat(row.preferredstocklevel) : null,
        location_id: row.location_id?.toString() || null,
        location_name: row.location_name || null,
        is_low_stock: isLowStock,
        // Initialize actionable fields - will be enriched later
        orders_blocked: 0,
        revenue_blocked: 0,
        customers_impacted: 0,
        days_until_stockout: null,
        avg_daily_usage: 0,
        can_expedite: false,
        last_receipt_date: null,
        next_po_date: null,
        root_cause: 'Unknown',
      };
    });

    // Filter for low stock only if requested
    if (filters?.lowStockOnly) {
      return records.filter(r => r.is_low_stock);
    }

    console.log(`Fetched ${records.length} inventory items`);
    return records;
  } catch (error) {
    console.error('Error fetching inventory balances:', error);
    throw error;
  }
}

// =============================================================================
// ORDERS BLOCKED BY INVENTORY
// =============================================================================

/**
 * Query orders that are blocked due to inventory constraints
 * Returns the "blast radius" of inventory shortages
 */
export async function getOrdersBlockedByInventory(): Promise<{
  byItem: Map<string, { orders: Set<string>; customers: Set<string>; revenue: number; orderDetails: Array<{ id: string; tranid: string; customer: string; amount: number; ship_date: string | null }> }>;
  totalOrdersBlocked: number;
  totalCustomersImpacted: number;
  totalRevenueBlocked: number;
}> {
  // Find orders with line items that have insufficient inventory
  const query = `
    SELECT
      tl.item AS item_id,
      BUILTIN.DF(tl.item) AS item_name,
      so.id AS order_id,
      so.tranid AS order_number,
      so.entity AS customer_id,
      BUILTIN.DF(so.entity) AS customer_name,
      so.total AS order_total,
      so.shipdate AS expected_ship_date,
      tl.quantity AS qty_ordered,
      tl.quantitycommitted AS qty_committed,
      COALESCE(tl.quantitybackordered, 0) AS qty_backordered,
      tl.amount AS line_amount
    FROM TransactionLine tl
    INNER JOIN Transaction so ON so.id = tl.transaction
    WHERE so.type = 'SalesOrd'
      AND so.status NOT IN ('E', 'F', 'G', 'H', 'Billed', 'Closed', 'Cancelled')
      AND tl.item IS NOT NULL
      AND tl.mainline = 'F'
      AND (tl.quantitybackordered > 0 OR (tl.quantity > tl.quantitycommitted AND tl.quantitycommitted IS NOT NULL))
      AND UPPER(BUILTIN.DF(so.entity)) NOT LIKE '%TEST%'
    ORDER BY tl.item
  `;

  try {
    console.log('Fetching orders blocked by inventory...');

    const response = await netsuiteRequest<{ items: any[]; hasMore: boolean }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: query },
        params: { limit: '1000' },
      }
    );

    const byItem = new Map<string, {
      orders: Set<string>;
      customers: Set<string>;
      revenue: number;
      orderDetails: Array<{ id: string; tranid: string; customer: string; amount: number; ship_date: string | null }>;
    }>();
    const allOrders = new Set<string>();
    const allCustomers = new Set<string>();
    let totalRevenue = 0;

    for (const row of response.items || []) {
      const itemId = row.item_id?.toString() || '';
      const orderId = row.order_id?.toString() || '';
      const customerId = row.customer_id?.toString() || '';
      const orderTotal = parseFloat(row.order_total) || 0;

      if (!byItem.has(itemId)) {
        byItem.set(itemId, { orders: new Set(), customers: new Set(), revenue: 0, orderDetails: [] });
      }

      const itemData = byItem.get(itemId)!;

      // Only count order once per item
      if (!itemData.orders.has(orderId)) {
        itemData.orders.add(orderId);
        itemData.customers.add(customerId);
        itemData.revenue += orderTotal;
        itemData.orderDetails.push({
          id: orderId,
          tranid: row.order_number || '',
          customer: row.customer_name || '',
          amount: orderTotal,
          ship_date: row.expected_ship_date || null,
        });
      }

      allOrders.add(orderId);
      allCustomers.add(customerId);

      // Count total revenue only once per order
      if (!allOrders.has(orderId + '_counted')) {
        totalRevenue += orderTotal;
        allOrders.add(orderId + '_counted');
      }
    }

    // Remove the _counted markers from the set
    const cleanOrders = new Set([...allOrders].filter(o => !o.endsWith('_counted')));

    console.log(`Found ${cleanOrders.size} orders blocked by inventory constraints`);

    return {
      byItem,
      totalOrdersBlocked: cleanOrders.size,
      totalCustomersImpacted: allCustomers.size,
      totalRevenueBlocked: totalRevenue,
    };
  } catch (error) {
    console.error('Error fetching blocked orders:', error);
    return {
      byItem: new Map(),
      totalOrdersBlocked: 0,
      totalCustomersImpacted: 0,
      totalRevenueBlocked: 0,
    };
  }
}

// =============================================================================
// PURCHASE ORDER STATUS
// =============================================================================

/**
 * Get pending purchase orders for items (for "Can Expedite?" and next PO date)
 */
export async function getPendingPurchaseOrders(): Promise<Map<string, { next_po_date: string; po_number: string; qty_ordered: number }>> {
  const query = `
    SELECT
      tl.item AS item_id,
      MIN(po.expectedreceiptdate) AS next_receipt_date,
      MIN(po.tranid) AS po_number,
      SUM(tl.quantity) AS total_qty_ordered
    FROM TransactionLine tl
    INNER JOIN Transaction po ON po.id = tl.transaction
    WHERE po.type = 'PurchOrd'
      AND po.status IN ('A', 'B', 'D', 'E', 'F')
      AND tl.item IS NOT NULL
      AND tl.mainline = 'F'
    GROUP BY tl.item
  `;

  try {
    const response = await netsuiteRequest<{ items: any[]; hasMore: boolean }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: query },
        params: { limit: '1000' },
      }
    );

    const poMap = new Map<string, { next_po_date: string; po_number: string; qty_ordered: number }>();

    for (const row of response.items || []) {
      const itemId = row.item_id?.toString() || '';
      if (itemId) {
        poMap.set(itemId, {
          next_po_date: row.next_receipt_date || '',
          po_number: row.po_number || '',
          qty_ordered: parseFloat(row.total_qty_ordered) || 0,
        });
      }
    }

    return poMap;
  } catch (error) {
    console.error('Error fetching pending POs:', error);
    return new Map();
  }
}

// =============================================================================
// STALE ORDERS (NO MOVEMENT > 30 DAYS)
// =============================================================================

/**
 * Get orders with no activity in the last 30 days
 */
export async function getStaleOrders(): Promise<Array<{
  id: string;
  tranid: string;
  customer_name: string;
  days_stale: number;
  total_amount: number;
  status: string;
  last_activity: string | null;
}>> {
  const query = `
    SELECT
      so.id,
      so.tranid,
      BUILTIN.DF(so.entity) AS customer_name,
      so.total AS total_amount,
      so.status,
      so.trandate,
      ROUND(SYSDATE - so.lastmodifieddate) AS days_since_modified
    FROM Transaction so
    WHERE so.type = 'SalesOrd'
      AND so.status NOT IN ('E', 'F', 'G', 'H', 'Billed', 'Closed', 'Cancelled')
      AND so.lastmodifieddate < SYSDATE - 30
      AND so.trandate >= ADD_MONTHS(SYSDATE, -12)
      AND UPPER(BUILTIN.DF(so.entity)) NOT LIKE '%TEST%'
    ORDER BY days_since_modified DESC
  `;

  try {
    const response = await netsuiteRequest<{ items: any[]; hasMore: boolean }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: query },
        params: { limit: '100' },
      }
    );

    return (response.items || []).map(row => ({
      id: row.id?.toString() || '',
      tranid: row.tranid || '',
      customer_name: row.customer_name || '',
      days_stale: parseInt(row.days_since_modified) || 0,
      total_amount: parseFloat(row.total_amount) || 0,
      status: row.status || '',
      last_activity: row.trandate || null,
    }));
  } catch (error) {
    console.error('Error fetching stale orders:', error);
    return [];
  }
}

// =============================================================================
// BACKORDER QUERY
// =============================================================================

/**
 * Query items that are backordered (from Sales Orders)
 * Returns items where quantity ordered exceeds quantity available
 */
export async function getBackorderedItems(filters?: {
  limit?: number;
}): Promise<{ item_id: string; item_name: string; total_backordered: number; order_count: number }[]> {
  const { limit = 500 } = filters || {};

  const query = `
    SELECT
      tl.item AS item_id,
      BUILTIN.DF(tl.item) AS item_name,
      SUM(COALESCE(tl.quantitybackordered, 0)) AS total_backordered,
      COUNT(DISTINCT tl.transaction) AS order_count
    FROM TransactionLine tl
    INNER JOIN Transaction t ON t.id = tl.transaction
    WHERE t.type = 'SalesOrd'
      AND t.status NOT IN ('Closed', 'Cancelled', 'Billed')
      AND tl.quantitybackordered > 0
    GROUP BY tl.item, BUILTIN.DF(tl.item)
    ORDER BY total_backordered DESC
  `;

  try {
    console.log('Fetching backordered items...');

    const response = await netsuiteRequest<{ items: any[]; hasMore: boolean }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: query },
        params: { limit: limit.toString() },
      }
    );

    const records = (response.items || []).map(row => ({
      item_id: row.item_id?.toString() || '',
      item_name: row.item_name || '',
      total_backordered: parseFloat(row.total_backordered) || 0,
      order_count: parseInt(row.order_count) || 0,
    }));

    console.log(`Fetched ${records.length} backordered items`);
    return records;
  } catch (error) {
    console.error('Error fetching backordered items:', error);
    // Return empty array if query fails (backorder field may not exist)
    return [];
  }
}

// =============================================================================
// AGGREGATED METRICS
// =============================================================================

/**
 * Calculate total inventory value
 */
export function calculateInventoryValue(items: InventoryItemRecord[]): number {
  return items.reduce((total, item) => {
    return total + (item.quantity_on_hand * item.unit_cost);
  }, 0);
}

/**
 * Calculate value breakdown by item type
 */
export function calculateValueByType(items: InventoryItemRecord[]): Record<string, number> {
  const byType: Record<string, number> = {};

  for (const item of items) {
    const type = item.item_type || 'Other';
    const value = item.quantity_on_hand * item.unit_cost;
    byType[type] = (byType[type] || 0) + value;
  }

  return byType;
}

/**
 * Build the "Today's Action Queue" - prioritized list of what needs attention
 */
function buildActionQueue(
  lowStockItems: InventoryItemRecord[],
  staleOrders: Array<{ id: string; tranid: string; customer_name: string; days_stale: number; total_amount: number }>,
  blockedOrders: { totalOrdersBlocked: number; totalRevenueBlocked: number }
): ActionItem[] {
  const actions: ActionItem[] = [];

  // Critical: Low stock items blocking high revenue
  const criticalLowStock = lowStockItems
    .filter(item => item.revenue_blocked > 100000)
    .slice(0, 5);

  for (const item of criticalLowStock) {
    actions.push({
      id: `low-stock-${item.id}`,
      type: 'low_stock_critical',
      severity: 'critical',
      title: `${item.item_id} blocking $${(item.revenue_blocked / 1000).toFixed(0)}K revenue`,
      description: `${item.orders_blocked} orders waiting, ${item.customers_impacted} customers impacted`,
      metric: 'Revenue Blocked',
      metric_value: `$${(item.revenue_blocked / 1000).toFixed(0)}K`,
      owner: 'Purchasing',
      deadline: item.next_po_date,
      related_items: [item.item_id],
    });
  }

  // Warning: Stale orders (no movement > 30 days)
  const criticalStale = staleOrders.slice(0, 10);
  for (const order of criticalStale) {
    actions.push({
      id: `stale-${order.id}`,
      type: 'stale_order',
      severity: order.days_stale > 60 ? 'critical' : 'warning',
      title: `SO#${order.tranid} - ${order.days_stale} days no movement`,
      description: `${order.customer_name} - $${(order.total_amount / 1000).toFixed(0)}K order value`,
      metric: 'Days Stale',
      metric_value: `${order.days_stale}d`,
      owner: 'Ops',
      deadline: null,
      related_orders: [order.tranid],
    });
  }

  // Sort by severity then by metric value
  actions.sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    return 0;
  });

  return actions;
}

/**
 * Get complete inventory metrics including all KPIs
 */
export async function getInventoryMetrics(filters?: {
  locationId?: string;
}): Promise<InventoryMetrics> {
  // Fetch all data in parallel
  const [items, backorders, blockedOrders, pendingPOs, staleOrders] = await Promise.all([
    getInventoryBalances({ locationId: filters?.locationId }),
    getBackorderedItems(),
    getOrdersBlockedByInventory(),
    getPendingPurchaseOrders(),
    getStaleOrders(),
  ]);

  // Enrich items with blocked order data
  for (const item of items) {
    const blocked = blockedOrders.byItem.get(item.id);
    if (blocked) {
      item.orders_blocked = blocked.orders.size;
      item.customers_impacted = blocked.customers.size;
      item.revenue_blocked = blocked.revenue;
    }

    // Add PO info
    const poInfo = pendingPOs.get(item.id);
    if (poInfo) {
      item.next_po_date = poInfo.next_po_date;
      item.can_expedite = true;
    }

    // Determine root cause
    if (item.quantity_on_hand <= 0 && !poInfo) {
      item.root_cause = 'No PO';
    } else if (item.quantity_on_hand <= 0 && poInfo) {
      item.root_cause = 'Vendor Delay';
    } else if (item.is_low_stock) {
      item.root_cause = 'Inventory';
    }
  }

  // Calculate summary KPIs
  const totalInventoryValue = calculateInventoryValue(items);
  const totalItemsOnHand = items.filter(i => i.quantity_on_hand > 0).length;
  const lowStockItems = items
    .filter(i => i.is_low_stock || i.quantity_on_hand <= 0)
    .sort((a, b) => b.revenue_blocked - a.revenue_blocked); // Sort by revenue blocked DESC
  const backorderedItems = items
    .filter(i => i.quantity_backordered > 0)
    .sort((a, b) => b.revenue_blocked - a.revenue_blocked);
  const valueByType = calculateValueByType(items);

  // Find top blocking driver
  const topBlocking = lowStockItems[0];
  const topBlockingDriver = topBlocking?.item_id || 'None';
  const topBlockingDriverCount = topBlocking?.orders_blocked || 0;

  // Build backorder blast radius
  const topBlockingItems = lowStockItems
    .filter(i => i.orders_blocked > 0)
    .slice(0, 10)
    .map(i => ({
      item_id: i.item_id,
      display_name: i.display_name,
      orders_blocked: i.orders_blocked,
      revenue_blocked: i.revenue_blocked,
      quantity_short: Math.max(0, (i.reorder_point || 0) - i.quantity_on_hand),
    }));

  // Calculate installs at risk (orders with ship date in next 30 days that are blocked)
  let installsAtRisk30Days = 0;
  const now = new Date();
  const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  for (const [, itemData] of blockedOrders.byItem) {
    for (const order of itemData.orderDetails) {
      if (order.ship_date) {
        const shipDate = new Date(order.ship_date);
        if (shipDate <= thirtyDaysOut) {
          installsAtRisk30Days++;
        }
      }
    }
  }

  const backorderBlastRadius: BackorderBlastRadius = {
    totalItems: backorders.length,
    ordersImpacted: blockedOrders.totalOrdersBlocked,
    customersImpacted: blockedOrders.totalCustomersImpacted,
    revenueDelayed: blockedOrders.totalRevenueBlocked,
    installsAtRisk30Days,
    topBlockingItems,
  };

  // Build action queue
  const actionItems = buildActionQueue(lowStockItems, staleOrders, blockedOrders);

  return {
    totalInventoryValue,
    totalItemsOnHand,
    totalBackorderedItems: backorders.length,
    lowStockItemCount: lowStockItems.length,
    revenueBlockedByInventory: blockedOrders.totalRevenueBlocked,
    ordersBlockedByInventory: blockedOrders.totalOrdersBlocked,
    topBlockingDriver,
    topBlockingDriverCount,
    valueByType,
    backorderBlastRadius,
    actionItems,
    lowStockItems,
    backorderedItems,
    allItems: items,
  };
}
