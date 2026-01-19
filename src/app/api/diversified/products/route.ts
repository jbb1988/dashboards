import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const admin = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);

    // Parse year/month/class filters
    const yearsParam = searchParams.get('years');
    const monthsParam = searchParams.get('months');
    const classNameParam = searchParams.get('className');
    const years = yearsParam ? yearsParam.split(',').map(Number).filter(n => !isNaN(n)) : [];
    const months = monthsParam ? monthsParam.split(',').map(Number).filter(n => !isNaN(n)) : [];
    const className = classNameParam && classNameParam.trim() ? classNameParam.trim() : null;

    // Debug logging
    console.log('Products API - Received filters:', {
      years,
      months,
      className,
      classNameParam
    });

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    // Calculate date ranges based on filters (not R12 from today)
    let currentPeriodStart: Date;
    let currentPeriodEnd: Date;
    let priorPeriodStart: Date;
    let priorPeriodEnd: Date;

    if (years.length > 0) {
      // User has selected specific year(s) - compare against prior year
      // Use Date.UTC to ensure consistent timezone handling with database dates
      const selectedYears = [...years].sort((a, b) => a - b);
      const minYear = selectedYears[0];
      const maxYear = selectedYears[selectedYears.length - 1];

      if (months.length > 0) {
        const selectedMonths = [...months].sort((a, b) => a - b);
        const minMonth = selectedMonths[0];
        const maxMonth = selectedMonths[selectedMonths.length - 1];

        currentPeriodStart = new Date(Date.UTC(minYear, minMonth - 1, 1));
        currentPeriodEnd = new Date(Date.UTC(maxYear, maxMonth, 0, 23, 59, 59, 999)); // End of last day

        // Prior period: same months in prior year(s)
        priorPeriodStart = new Date(Date.UTC(minYear - 1, minMonth - 1, 1));
        priorPeriodEnd = new Date(Date.UTC(maxYear - 1, maxMonth, 0, 23, 59, 59, 999));
      } else {
        // All months in selected year(s)
        currentPeriodStart = new Date(Date.UTC(minYear, 0, 1));
        currentPeriodEnd = new Date(Date.UTC(maxYear, 11, 31, 23, 59, 59, 999));

        // Prior period: same in prior year(s)
        priorPeriodStart = new Date(Date.UTC(minYear - 1, 0, 1));
        priorPeriodEnd = new Date(Date.UTC(maxYear - 1, 11, 31, 23, 59, 59, 999));
      }
    } else {
      // No year filter - use R12 periods from today (UTC)
      const now = new Date();
      currentPeriodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
      currentPeriodStart = new Date(currentPeriodEnd);
      currentPeriodStart.setUTCMonth(currentPeriodStart.getUTCMonth() - 12);
      currentPeriodStart.setUTCHours(0, 0, 0, 0);

      priorPeriodEnd = new Date(currentPeriodStart);
      priorPeriodEnd.setUTCDate(priorPeriodEnd.getUTCDate() - 1);
      priorPeriodEnd.setUTCHours(23, 59, 59, 999);
      priorPeriodStart = new Date(priorPeriodEnd);
      priorPeriodStart.setUTCMonth(priorPeriodStart.getUTCMonth() - 12);
      priorPeriodStart.setUTCHours(0, 0, 0, 0);
    }

    // Fetch all product data (last 24 months)
    const allData: Array<{
      item_id: string;
      item_name: string;
      item_description: string;
      class_name: string;
      class_category: string;
      customer_id: string;
      customer_name: string;
      transaction_date: string;
      year: number;
      month: number;
      revenue: number;
      cost: number;
      quantity: number;
    }> = [];

    let offset = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = admin
        .from('diversified_sales')
        .select('item_id, item_name, item_description, class_name, class_category, customer_id, customer_name, transaction_date, year, month, revenue, cost, quantity');

      // Apply year/month/class filters if provided
      if (years.length > 0) {
        // Include both current and prior years for YoY comparison
        const yearsToQuery = [...new Set([...years, ...years.map(y => y - 1)])];
        query = query.in('year', yearsToQuery);
      } else {
        query = query.gte('transaction_date', formatDate(priorPeriodStart));
      }

      if (months.length > 0) {
        query = query.in('month', months);
      }

      if (className) {
        // Use ilike for case-insensitive matching
        query = query.ilike('class_name', className);
      }

      const { data, error } = await query
        .order('transaction_date', { ascending: false })
        .range(offset, offset + batchSize - 1);

      if (error) {
        console.error('Error fetching products data:', error);
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

    // Aggregate by product
    const productMap = new Map<string, {
      item_id: string;
      item_name: string;
      item_description: string;
      class_name: string;
      class_category: string;
      current_revenue: number;
      current_cost: number;
      current_units: number;
      prior_revenue: number;
      prior_cost: number;
      prior_units: number;
      current_customers: Set<string>;
      prior_customers: Set<string>;
      all_customers: Map<string, { id: string; name: string; revenue: number }>;
      last_purchase_date: string;
    }>();

    for (const row of allData) {
      const itemKey = row.item_id || row.item_name;
      if (!itemKey) continue;

      if (!productMap.has(itemKey)) {
        productMap.set(itemKey, {
          item_id: row.item_id,
          item_name: row.item_name,
          item_description: row.item_description || '',
          class_name: row.class_name || '',
          class_category: row.class_category || '',
          current_revenue: 0,
          current_cost: 0,
          current_units: 0,
          prior_revenue: 0,
          prior_cost: 0,
          prior_units: 0,
          current_customers: new Set(),
          prior_customers: new Set(),
          all_customers: new Map(),
          last_purchase_date: '',
        });
      }

      const product = productMap.get(itemKey)!;
      const txDate = new Date(row.transaction_date);
      const customerKey = row.customer_id || row.customer_name;

      // Track last purchase date
      if (!product.last_purchase_date || row.transaction_date > product.last_purchase_date) {
        product.last_purchase_date = row.transaction_date;
      }

      // Track customer revenue
      if (customerKey) {
        if (!product.all_customers.has(customerKey)) {
          product.all_customers.set(customerKey, {
            id: row.customer_id,
            name: row.customer_name,
            revenue: 0,
          });
        }
        product.all_customers.get(customerKey)!.revenue += row.revenue || 0;
      }

      // Aggregate by period
      if (txDate >= currentPeriodStart && txDate <= currentPeriodEnd) {
        product.current_revenue += row.revenue || 0;
        product.current_cost += row.cost || 0;
        product.current_units += row.quantity || 0;
        if (customerKey) product.current_customers.add(customerKey);
      } else if (txDate >= priorPeriodStart && txDate <= priorPeriodEnd) {
        product.prior_revenue += row.revenue || 0;
        product.prior_cost += row.cost || 0;
        product.prior_units += row.quantity || 0;
        if (customerKey) product.prior_customers.add(customerKey);
      }
    }

    // Build products array
    let products = Array.from(productMap.values()).map(p => {
      const change_pct = p.prior_revenue > 0
        ? ((p.current_revenue - p.prior_revenue) / p.prior_revenue) * 100
        : p.current_revenue > 0 ? 100 : 0;

      let trend: 'growing' | 'stable' | 'declining';
      if (change_pct >= 10) trend = 'growing';
      else if (change_pct <= -10) trend = 'declining';
      else trend = 'stable';

      // Customer changes
      const customersLost = [...p.prior_customers].filter(c => !p.current_customers.has(c)).length;
      const customersGained = [...p.current_customers].filter(c => !p.prior_customers.has(c)).length;

      // Margin calculation
      const current_margin_pct = p.current_revenue > 0
        ? ((p.current_revenue - p.current_cost) / p.current_revenue) * 100
        : 0;
      const prior_margin_pct = p.prior_revenue > 0
        ? ((p.prior_revenue - p.prior_cost) / p.prior_revenue) * 100
        : 0;

      // Top customers
      const topCustomers = Array.from(p.all_customers.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      return {
        item_id: p.item_id,
        item_name: p.item_name,
        item_description: p.item_description,
        class_name: p.class_name,
        class_category: p.class_category,
        current_revenue: p.current_revenue,
        current_units: p.current_units,
        current_cost: p.current_cost,
        prior_revenue: p.prior_revenue,
        prior_units: p.prior_units,
        prior_cost: p.prior_cost,
        change_pct,
        trend,
        current_margin_pct,
        prior_margin_pct,
        current_customer_count: p.current_customers.size,
        prior_customer_count: p.prior_customers.size,
        customers_lost: customersLost,
        customers_gained: customersGained,
        total_customer_count: p.all_customers.size,
        last_purchase_date: p.last_purchase_date,
        top_customers: topCustomers,
      };
    }).sort((a, b) => b.current_revenue - a.current_revenue);

    // Apply class name filter if provided (in-memory backup filter)
    if (className) {
      const beforeFilter = products.length;
      // Case-insensitive comparison with trimmed values
      const classNameLower = className.toLowerCase().trim();
      products = products.filter(p => p.class_name?.toLowerCase().trim() === classNameLower);
      console.log(`Products API - Filtered by class "${className}": ${beforeFilter} -> ${products.length} products`);
      if (products.length === 0) {
        console.log('No products found! Available class names:', [...new Set(Array.from(productMap.values()).map(p => p.class_name))].slice(0, 10));
      } else {
        console.log('Sample product class names:', products.slice(0, 3).map(p => p.class_name));
      }
    }

    // Summary stats
    const totalCurrentRevenue = products.reduce((sum, p) => sum + p.current_revenue, 0);
    const totalPriorRevenue = products.reduce((sum, p) => sum + p.prior_revenue, 0);
    const growingProducts = products.filter(p => p.trend === 'growing').length;
    const decliningProducts = products.filter(p => p.trend === 'declining').length;
    const productsWithLostCustomers = products.filter(p => p.customers_lost > 0).length;

    // Class breakdown
    const classMap = new Map<string, { revenue: number; count: number }>();
    for (const p of products) {
      if (!classMap.has(p.class_name)) {
        classMap.set(p.class_name, { revenue: 0, count: 0 });
      }
      classMap.get(p.class_name)!.revenue += p.current_revenue;
      classMap.get(p.class_name)!.count += 1;
    }
    const byClass = Array.from(classMap.entries())
      .map(([name, data]) => ({ class_name: name, ...data }))
      .sort((a, b) => b.revenue - a.revenue);

    console.log('Products API - Returning response:', {
      total_products: products.length,
      total_current_revenue: totalCurrentRevenue,
      className_filter: className,
    });

    return NextResponse.json({
      products,
      summary: {
        total_products: products.length,
        total_current_revenue: totalCurrentRevenue,
        total_prior_revenue: totalPriorRevenue,
        overall_change_pct: totalPriorRevenue > 0
          ? ((totalCurrentRevenue - totalPriorRevenue) / totalPriorRevenue) * 100
          : 0,
        growing_products: growingProducts,
        declining_products: decliningProducts,
        products_with_lost_customers: productsWithLostCustomers,
      },
      by_class: byClass,
      periods: {
        current: {
          start: formatDate(currentPeriodStart),
          end: formatDate(currentPeriodEnd),
        },
        prior: {
          start: formatDate(priorPeriodStart),
          end: formatDate(priorPeriodEnd),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching products data:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch products data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
