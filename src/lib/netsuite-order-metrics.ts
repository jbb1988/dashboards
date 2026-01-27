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
 * Query Sales Orders with aging information
 * Returns open sales orders that are not Closed, Cancelled, or Billed
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
      so.memo
    FROM Transaction so
    WHERE so.type = 'SalesOrd'
      ${statusFilter}
      ${testFilter}
      ${ageFilter}
      ${dateFilter}
      ${customerFilter}
    ORDER BY so.trandate
  `;

  try {
    console.log('Fetching sales order aging...');

    const response = await netsuiteRequest<{ items: any[]; hasMore: boolean }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: query },
        params: { limit: limit.toString() },
      }
    );

    const records: SalesOrderAgingRecord[] = (response.items || []).map(row => ({
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
    }));

    console.log(`Fetched ${records.length} open sales orders`);
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
