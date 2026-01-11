import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const admin = getSupabaseAdmin();

    // Calculate date ranges
    // Current period: last 6 months (for "stopped buying" detection)
    // Prior period: 6-18 months ago (what they used to buy)
    const now = new Date();
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const eighteenMonthsAgo = new Date(now);
    eighteenMonthsAgo.setMonth(eighteenMonthsAgo.getMonth() - 18);

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    // Fetch all data for the 18-month window
    const allData: Array<{
      customer_id: string;
      customer_name: string;
      item_id: string;
      item_name: string;
      item_description: string;
      class_name: string;
      transaction_date: string;
      revenue: number;
      quantity: number;
    }> = [];

    let offset = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await admin
        .from('diversified_sales')
        .select('customer_id, customer_name, item_id, item_name, item_description, class_name, transaction_date, revenue, quantity')
        .gte('transaction_date', formatDate(eighteenMonthsAgo))
        .order('transaction_date', { ascending: false })
        .range(offset, offset + batchSize - 1);

      if (error) {
        console.error('Error fetching stopped buying data:', error);
        break;
      }

      if (data && data.length > 0) {
        allData.push(...data);
        offset += batchSize;
        hasMore = data.length === batchSize;
      } else {
        hasMore = false;
      }
    }

    // Track customer-product combinations
    // Key: `${customerId}|${itemId}`
    const customerProductMap = new Map<string, {
      customer_id: string;
      customer_name: string;
      item_id: string;
      item_name: string;
      item_description: string;
      class_name: string;
      recent_revenue: number;  // Last 6 months
      prior_revenue: number;   // 6-18 months ago
      recent_units: number;
      prior_units: number;
      last_purchase_date: string;
    }>();

    for (const row of allData) {
      const customerKey = row.customer_id || row.customer_name;
      const itemKey = row.item_id || row.item_name;
      if (!customerKey || !itemKey) continue;

      const mapKey = `${customerKey}|${itemKey}`;
      const txDate = new Date(row.transaction_date);

      if (!customerProductMap.has(mapKey)) {
        customerProductMap.set(mapKey, {
          customer_id: row.customer_id,
          customer_name: row.customer_name,
          item_id: row.item_id,
          item_name: row.item_name,
          item_description: row.item_description || '',
          class_name: row.class_name || '',
          recent_revenue: 0,
          prior_revenue: 0,
          recent_units: 0,
          prior_units: 0,
          last_purchase_date: '',
        });
      }

      const entry = customerProductMap.get(mapKey)!;

      // Track last purchase date
      if (!entry.last_purchase_date || row.transaction_date > entry.last_purchase_date) {
        entry.last_purchase_date = row.transaction_date;
      }

      // Aggregate by period
      if (txDate >= sixMonthsAgo) {
        entry.recent_revenue += row.revenue || 0;
        entry.recent_units += row.quantity || 0;
      } else {
        entry.prior_revenue += row.revenue || 0;
        entry.prior_units += row.quantity || 0;
      }
    }

    // Find "stopped buying" combinations:
    // Had purchases in prior period (6-18 months ago) but NOT in recent period (last 6 months)
    const stoppedBuying = Array.from(customerProductMap.values())
      .filter(entry => entry.prior_revenue > 0 && entry.recent_revenue === 0);

    // Aggregate by product (which products are being dropped)
    const productChurnMap = new Map<string, {
      item_id: string;
      item_name: string;
      item_description: string;
      class_name: string;
      customers_lost: number;
      total_prior_revenue: number;
      total_prior_units: number;
      customer_list: Array<{
        customer_id: string;
        customer_name: string;
        prior_revenue: number;
        prior_units: number;
        last_purchase_date: string;
        days_since_purchase: number;
      }>;
    }>();

    for (const entry of stoppedBuying) {
      const itemKey = entry.item_id || entry.item_name;

      if (!productChurnMap.has(itemKey)) {
        productChurnMap.set(itemKey, {
          item_id: entry.item_id,
          item_name: entry.item_name,
          item_description: entry.item_description,
          class_name: entry.class_name,
          customers_lost: 0,
          total_prior_revenue: 0,
          total_prior_units: 0,
          customer_list: [],
        });
      }

      const product = productChurnMap.get(itemKey)!;
      product.customers_lost += 1;
      product.total_prior_revenue += entry.prior_revenue;
      product.total_prior_units += entry.prior_units;

      const daysSincePurchase = Math.ceil(
        (now.getTime() - new Date(entry.last_purchase_date).getTime()) / (1000 * 60 * 60 * 24)
      );

      product.customer_list.push({
        customer_id: entry.customer_id,
        customer_name: entry.customer_name,
        prior_revenue: entry.prior_revenue,
        prior_units: entry.prior_units,
        last_purchase_date: entry.last_purchase_date,
        days_since_purchase: daysSincePurchase,
      });
    }

    // Sort customer lists by revenue
    for (const product of productChurnMap.values()) {
      product.customer_list.sort((a, b) => b.prior_revenue - a.prior_revenue);
    }

    // Convert to array and sort by revenue lost
    const stoppedProducts = Array.from(productChurnMap.values())
      .sort((a, b) => b.total_prior_revenue - a.total_prior_revenue);

    // Aggregate by customer (which customers are dropping products)
    const customerChurnMap = new Map<string, {
      customer_id: string;
      customer_name: string;
      products_stopped: number;
      total_prior_revenue: number;
      product_list: Array<{
        item_id: string;
        item_name: string;
        class_name: string;
        prior_revenue: number;
        last_purchase_date: string;
      }>;
    }>();

    for (const entry of stoppedBuying) {
      const customerKey = entry.customer_id || entry.customer_name;

      if (!customerChurnMap.has(customerKey)) {
        customerChurnMap.set(customerKey, {
          customer_id: entry.customer_id,
          customer_name: entry.customer_name,
          products_stopped: 0,
          total_prior_revenue: 0,
          product_list: [],
        });
      }

      const customer = customerChurnMap.get(customerKey)!;
      customer.products_stopped += 1;
      customer.total_prior_revenue += entry.prior_revenue;
      customer.product_list.push({
        item_id: entry.item_id,
        item_name: entry.item_name,
        class_name: entry.class_name,
        prior_revenue: entry.prior_revenue,
        last_purchase_date: entry.last_purchase_date,
      });
    }

    // Sort product lists by revenue
    for (const customer of customerChurnMap.values()) {
      customer.product_list.sort((a, b) => b.prior_revenue - a.prior_revenue);
    }

    // Convert to array and sort by revenue at risk
    const customerChurn = Array.from(customerChurnMap.values())
      .sort((a, b) => b.total_prior_revenue - a.total_prior_revenue);

    // Summary stats
    const totalProductsWithChurn = stoppedProducts.length;
    const totalCustomersWithChurn = customerChurn.length;
    const totalRevenueAtRisk = stoppedProducts.reduce((sum, p) => sum + p.total_prior_revenue, 0);
    const totalUnitsLost = stoppedProducts.reduce((sum, p) => sum + p.total_prior_units, 0);

    // Class breakdown
    const classChurnMap = new Map<string, { revenue: number; count: number }>();
    for (const product of stoppedProducts) {
      if (!classChurnMap.has(product.class_name)) {
        classChurnMap.set(product.class_name, { revenue: 0, count: 0 });
      }
      classChurnMap.get(product.class_name)!.revenue += product.total_prior_revenue;
      classChurnMap.get(product.class_name)!.count += product.customers_lost;
    }
    const byClass = Array.from(classChurnMap.entries())
      .map(([class_name, data]) => ({ class_name, ...data }))
      .sort((a, b) => b.revenue - a.revenue);

    return NextResponse.json({
      summary: {
        total_products_with_churn: totalProductsWithChurn,
        total_customers_with_churn: totalCustomersWithChurn,
        total_revenue_at_risk: totalRevenueAtRisk,
        total_units_lost: totalUnitsLost,
      },
      by_product: stoppedProducts,
      by_customer: customerChurn,
      by_class: byClass,
      periods: {
        detection_window: {
          start: formatDate(sixMonthsAgo),
          end: formatDate(now),
          description: 'Last 6 months (no purchases)',
        },
        comparison_window: {
          start: formatDate(eighteenMonthsAgo),
          end: formatDate(sixMonthsAgo),
          description: 'Prior 6-18 months (had purchases)',
        },
      },
    });
  } catch (error) {
    console.error('Error fetching stopped buying data:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch stopped buying data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
