/**
 * NetSuite Order Metrics Queries
 *
 * These functions query NetSuite for Order→Cash KPIs including:
 * - Sales Order aging
 * - Backlog value
 * - Fulfillment status (on-time delivery)
 * - Revenue at risk
 */

import { netsuiteRequest } from './netsuite';

// =============================================================================
// TYPES
// =============================================================================

export interface SalesOrderAgingRecord {
  id: string;
  tranid: string;
  trandate: string;
  status: string;
  customer_id: string;
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

export interface FulfillmentRecord {
  id: string;
  tranid: string;
  trandate: string;
  sales_order_id: string;
  sales_order_number: string;
  ship_date: string | null;
  expected_date: string | null;
  status: string;
  customer_name: string;
  is_on_time: boolean;
}

export interface OrderMetrics {
  // Aging buckets
  aging0to30: { count: number; value: number };
  aging31to60: { count: number; value: number };
  aging61to90: { count: number; value: number };
  aging90Plus: { count: number; value: number };

  // Summary KPIs
  totalOpenOrders: number;
  totalBacklogValue: number;
  revenueAtRisk: number;
  onTimeDeliveryPct: number;

  // Detail lists
  orders: SalesOrderAgingRecord[];
  recentFulfillments: FulfillmentRecord[];
}

// =============================================================================
// SALES ORDER AGING QUERY
// =============================================================================

/**
 * Query Sales Orders with aging information and manufacturing vs deferred value breakdown
 * Returns open sales orders that are not Closed, Cancelled, or Billed
 *
 * Classification Logic (by account number):
 * - Manufacturing (401x-404x): Test Bench equipment, components, install/training
 * - Deferred/Software (405x, 408x-409x, 418x): M3 Software, deferred revenue
 * - Maintenance (410x-411x): MCC services, TB service
 */
export async function getSalesOrderAging(filters?: {
  status?: string[];
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}): Promise<SalesOrderAgingRecord[]> {
  const { limit = 1000 } = filters || {};

  // Build date filter
  let dateFilter = '';
  if (filters?.dateFrom) {
    const [y, m, d] = filters.dateFrom.split('-');
    dateFilter += ` AND so.trandate >= TO_DATE('${m}/${d}/${y}', 'MM/DD/YYYY')`;
  }
  if (filters?.dateTo) {
    const [y, m, d] = filters.dateTo.split('-');
    dateFilter += ` AND so.trandate <= TO_DATE('${m}/${d}/${y}', 'MM/DD/YYYY')`;
  }

  // Build customer filter
  let customerFilter = '';
  if (filters?.customerId) {
    customerFilter = ` AND so.entity = '${filters.customerId.replace(/'/g, "''")}'`;
  }

  // Status filter - exclude closed/cancelled/billed by default
  // NetSuite Sales Order status codes:
  //   A = Pending Approval
  //   B = Pending Fulfillment
  //   C = Partially Fulfilled
  //   D = Pending Billing
  //   E = Billed
  //   F = Closed
  //   G = Cancelled
  //   H = Undefined (legacy)
  let statusFilter = "AND so.status NOT IN ('E', 'F', 'G', 'H', 'Billed', 'Closed', 'Cancelled')"; // Exclude: E=Billed, F=Closed, G=Cancelled, H=Undefined
  if (filters?.status && filters.status.length > 0) {
    const statuses = filters.status.map(s => `'${s.replace(/'/g, "''")}'`).join(',');
    statusFilter = ` AND so.status IN (${statuses})`;
  }

  // Exclude test orders (customer name contains TEST)
  const testFilter = "AND UPPER(BUILTIN.DF(so.entity)) NOT LIKE '%TEST%'";

  // Default: only show orders from last 2 years to filter out stale data
  let ageFilter = '';
  if (!filters?.dateFrom && !filters?.dateTo) {
    ageFilter = "AND so.trandate >= ADD_MONTHS(SYSDATE, -24)";
  }

  // Query with line-level aggregation for manufacturing vs deferred values
  // Manufacturing accounts: 401x-404x (Test Bench equipment, components, install/training)
  // Deferred/Software accounts: 405x, 408x-409x, 418x (M3 Software, deferred revenue)
  // Maintenance accounts: 410x-411x (MCC services, TB service)
  const query = `
    SELECT
      so.id,
      so.tranid,
      so.trandate,
      so.status,
      so.entity AS customer_id,
      BUILTIN.DF(so.entity) AS customer_name,
      so.total AS total_amount,
      ROUND(SYSDATE - so.trandate) AS days_open,
      so.shipdate AS expected_ship_date,
      so.memo,
      NVL(line_agg.manufacturing_value, 0) AS manufacturing_value,
      NVL(line_agg.deferred_value, 0) AS deferred_value
    FROM Transaction so
    LEFT JOIN (
      SELECT
        tl.transaction AS so_id,
        SUM(CASE
          WHEN a.acctnumber LIKE '401%' OR a.acctnumber LIKE '402%'
               OR a.acctnumber LIKE '403%' OR a.acctnumber LIKE '404%'
          THEN NVL(tl.amount, 0)
          ELSE 0
        END) AS manufacturing_value,
        SUM(CASE
          WHEN a.acctnumber LIKE '405%' OR a.acctnumber LIKE '408%'
               OR a.acctnumber LIKE '409%' OR a.acctnumber LIKE '410%'
               OR a.acctnumber LIKE '411%' OR a.acctnumber LIKE '418%'
          THEN NVL(tl.amount, 0)
          ELSE 0
        END) AS deferred_value
      FROM TransactionLine tl
      LEFT JOIN Account a ON a.id = tl.account
      WHERE tl.mainline = 'F'
      GROUP BY tl.transaction
    ) line_agg ON line_agg.so_id = so.id
    WHERE so.type = 'SalesOrd'
      ${statusFilter}
      ${testFilter}
      ${ageFilter}
      ${dateFilter}
      ${customerFilter}
    ORDER BY so.trandate
  `;

  try {
    console.log('Fetching sales order aging with manufacturing/deferred breakdown...');

    const response = await netsuiteRequest<{ items: any[]; hasMore: boolean }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: query },
        params: { limit: limit.toString() },
      }
    );

    const records: SalesOrderAgingRecord[] = (response.items || []).map(row => {
      const manufacturingValue = parseFloat(row.manufacturing_value) || 0;
      const deferredValue = parseFloat(row.deferred_value) || 0;

      // Determine order type based on value breakdown
      let orderType: 'Manufacturing' | 'Deferred Only' | 'Mixed';
      if (manufacturingValue > 0 && deferredValue > 0) {
        orderType = 'Mixed';
      } else if (manufacturingValue > 0) {
        orderType = 'Manufacturing';
      } else {
        orderType = 'Deferred Only';
      }

      return {
        id: row.id?.toString() || '',
        tranid: row.tranid || '',
        trandate: row.trandate || '',
        status: row.status || '',
        customer_id: row.customer_id?.toString() || '',
        customer_name: row.customer_name || '',
        total_amount: parseFloat(row.total_amount) || 0,
        days_open: parseInt(row.days_open) || 0,
        expected_ship_date: row.expected_ship_date || null,
        memo: row.memo || null,
        manufacturing_value: manufacturingValue,
        deferred_value: deferredValue,
        order_type: orderType,
      };
    });

    console.log(`Fetched ${records.length} open sales orders with value breakdown`);

    // Log summary for debugging
    const mfgOrders = records.filter(r => r.order_type === 'Manufacturing').length;
    const deferredOrders = records.filter(r => r.order_type === 'Deferred Only').length;
    const mixedOrders = records.filter(r => r.order_type === 'Mixed').length;
    console.log(`Order types: ${mfgOrders} Manufacturing, ${deferredOrders} Deferred Only, ${mixedOrders} Mixed`);

    return records;
  } catch (error) {
    console.error('Error fetching sales order aging:', error);
    throw error;
  }
}

// =============================================================================
// FULFILLMENT STATUS QUERY
// =============================================================================

/**
 * Query Item Fulfillments with on-time delivery tracking
 * Returns recent fulfillments and calculates on-time delivery percentage
 */
export async function getFulfillmentStatus(filters?: {
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}): Promise<FulfillmentRecord[]> {
  const { limit = 500 } = filters || {};

  // Build date filter - default to last 90 days
  let dateFilter = '';
  if (filters?.dateFrom) {
    const [y, m, d] = filters.dateFrom.split('-');
    dateFilter += ` AND if.trandate >= TO_DATE('${m}/${d}/${y}', 'MM/DD/YYYY')`;
  } else {
    // Default: last 90 days
    dateFilter = " AND if.trandate >= SYSDATE - 90";
  }
  if (filters?.dateTo) {
    const [y, m, d] = filters.dateTo.split('-');
    dateFilter += ` AND if.trandate <= TO_DATE('${m}/${d}/${y}', 'MM/DD/YYYY')`;
  }

  const query = `
    SELECT
      if.id,
      if.tranid,
      if.trandate,
      ifl.createdfrom AS sales_order_id,
      so.tranid AS sales_order_number,
      if.shipdate AS ship_date,
      so.shipdate AS expected_date,
      if.status,
      BUILTIN.DF(if.entity) AS customer_name
    FROM Transaction if
    INNER JOIN TransactionLine ifl ON if.id = ifl.transaction AND ifl.mainline = 'T'
    LEFT JOIN Transaction so ON ifl.createdfrom = so.id
    WHERE if.type = 'ItemShip'
      ${dateFilter}
    ORDER BY if.trandate DESC
  `;

  try {
    console.log('Fetching fulfillment status...');

    const response = await netsuiteRequest<{ items: any[]; hasMore: boolean }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: query },
        params: { limit: limit.toString() },
      }
    );

    const records: FulfillmentRecord[] = (response.items || []).map(row => {
      const shipDate = row.ship_date || row.trandate;
      const expectedDate = row.expected_date;

      // Calculate on-time: shipped on or before expected date
      let isOnTime = true;
      if (expectedDate && shipDate) {
        isOnTime = new Date(shipDate) <= new Date(expectedDate);
      }

      return {
        id: row.id?.toString() || '',
        tranid: row.tranid || '',
        trandate: row.trandate || '',
        sales_order_id: row.sales_order_id?.toString() || '',
        sales_order_number: row.sales_order_number || '',
        ship_date: shipDate || null,
        expected_date: expectedDate || null,
        status: row.status || '',
        customer_name: row.customer_name || '',
        is_on_time: isOnTime,
      };
    });

    console.log(`Fetched ${records.length} fulfillments`);
    return records;
  } catch (error) {
    console.error('Error fetching fulfillment status:', error);
    throw error;
  }
}

// =============================================================================
// AGGREGATED METRICS
// =============================================================================

/**
 * Calculate Revenue at Risk based on order aging
 * Orders aging 90+ days get 100% weight, 61-90 get 70%, 31-60 get 40%, 0-30 get 10%
 */
export function calculateRevenueAtRisk(orders: SalesOrderAgingRecord[]): number {
  return orders.reduce((risk, order) => {
    const ageWeight =
      order.days_open > 90 ? 1.0 :
      order.days_open > 60 ? 0.7 :
      order.days_open > 30 ? 0.4 : 0.1;
    return risk + (order.total_amount * ageWeight);
  }, 0);
}

/**
 * Calculate On-Time Delivery Percentage
 */
export function calculateOnTimeDelivery(fulfillments: FulfillmentRecord[]): number {
  const shipped = fulfillments.filter(f => f.status === 'Shipped' || f.ship_date);
  if (shipped.length === 0) return 100;

  const onTime = shipped.filter(f => f.is_on_time);
  return (onTime.length / shipped.length) * 100;
}

/**
 * Aggregate orders into aging buckets
 */
export function aggregateOrderAging(orders: SalesOrderAgingRecord[]) {
  const buckets = {
    aging0to30: { count: 0, value: 0 },
    aging31to60: { count: 0, value: 0 },
    aging61to90: { count: 0, value: 0 },
    aging90Plus: { count: 0, value: 0 },
  };

  for (const order of orders) {
    const amount = order.total_amount || 0;
    if (order.days_open > 90) {
      buckets.aging90Plus.count++;
      buckets.aging90Plus.value += amount;
    } else if (order.days_open > 60) {
      buckets.aging61to90.count++;
      buckets.aging61to90.value += amount;
    } else if (order.days_open > 30) {
      buckets.aging31to60.count++;
      buckets.aging31to60.value += amount;
    } else {
      buckets.aging0to30.count++;
      buckets.aging0to30.value += amount;
    }
  }

  return buckets;
}

/**
 * Get complete order metrics including all KPIs
 */
export async function getOrderMetrics(filters?: {
  dateFrom?: string;
  dateTo?: string;
}): Promise<OrderMetrics> {
  // Fetch orders and fulfillments in parallel
  const [orders, fulfillments] = await Promise.all([
    getSalesOrderAging(filters),
    getFulfillmentStatus(filters),
  ]);

  // Calculate aging buckets
  const agingBuckets = aggregateOrderAging(orders);

  // Calculate summary KPIs
  const totalBacklogValue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const revenueAtRisk = calculateRevenueAtRisk(orders);
  const onTimeDeliveryPct = calculateOnTimeDelivery(fulfillments);

  return {
    ...agingBuckets,
    totalOpenOrders: orders.length,
    totalBacklogValue,
    revenueAtRisk,
    onTimeDeliveryPct,
    orders,
    recentFulfillments: fulfillments.slice(0, 50), // Latest 50
  };
}
