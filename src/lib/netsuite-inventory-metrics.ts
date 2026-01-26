/**
 * NetSuite Inventory Metrics Queries
 *
 * These functions query NetSuite for inventory KPIs including:
 * - Inventory value (on-hand × cost)
 * - Backorder counts
 * - Low stock alerts (items below reorder point)
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
}

export interface InventoryMetrics {
  // Summary KPIs
  totalInventoryValue: number;
  totalItemsOnHand: number;
  totalBackorderedItems: number;
  lowStockItemCount: number;

  // Breakdown
  valueByType: Record<string, number>;

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
    locationFilter = ` AND ib.location = '${filters.locationId.replace(/'/g, "''")}'`;
  }

  // Use InventoryBalance table for actual stock quantities
  // Item table quantityonhand is often 0; InventoryBalance has real data
  const query = `
    SELECT
      item.id,
      item.itemid,
      item.displayname,
      item.itemtype AS item_type,
      COALESCE(ib.quantityonhand, 0) AS quantity_on_hand,
      COALESCE(ib.quantityavailable, 0) AS quantity_available,
      COALESCE(item.quantitybackordered, 0) AS quantity_backordered,
      COALESCE(item.averagecost, item.lastpurchaseprice, item.cost, 0) AS unit_cost,
      item.reorderpoint,
      item.preferredstocklevel,
      ib.location AS location_id,
      BUILTIN.DF(ib.location) AS location_name
    FROM Item item
    LEFT JOIN InventoryBalance ib ON item.id = ib.item
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
 * Get complete inventory metrics including all KPIs
 */
export async function getInventoryMetrics(filters?: {
  locationId?: string;
}): Promise<InventoryMetrics> {
  // Fetch inventory items and backorders in parallel
  const [items, backorders] = await Promise.all([
    getInventoryBalances({ locationId: filters?.locationId }),
    getBackorderedItems(),
  ]);

  // Calculate summary KPIs
  const totalInventoryValue = calculateInventoryValue(items);
  const totalItemsOnHand = items.filter(i => i.quantity_on_hand > 0).length;
  const lowStockItems = items.filter(i => i.is_low_stock);
  const backorderedItems = items.filter(i => i.quantity_backordered > 0);
  const valueByType = calculateValueByType(items);

  return {
    totalInventoryValue,
    totalItemsOnHand,
    totalBackorderedItems: backorders.length,
    lowStockItemCount: lowStockItems.length,
    valueByType,
    lowStockItems,
    backorderedItems,
    allItems: items,
  };
}
