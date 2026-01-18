import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface CustomerDetailParams {
  params: Promise<{ customerId: string }>;
}

export async function GET(request: NextRequest, { params }: CustomerDetailParams) {
  try {
    const { customerId } = await params;
    const admin = getSupabaseAdmin();

    // Calculate date ranges for R12 comparison
    const now = new Date();
    const currentPeriodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const currentPeriodStart = new Date(currentPeriodEnd);
    currentPeriodStart.setMonth(currentPeriodStart.getMonth() - 12);

    const priorPeriodEnd = new Date(currentPeriodStart);
    priorPeriodEnd.setDate(priorPeriodEnd.getDate() - 1);
    const priorPeriodStart = new Date(priorPeriodEnd);
    priorPeriodStart.setMonth(priorPeriodStart.getMonth() - 12);

    // 6 months ago for "stopped buying" detection
    const sixMonthsAgo = new Date(currentPeriodEnd);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // 3-4 months ago for "warning" detection
    const fourMonthsAgo = new Date(currentPeriodEnd);
    fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4);

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    // Fetch all customer data (last 24 months)
    const allData: Array<{
      customer_id: string;
      customer_name: string;
      item_id: string;
      item_name: string;
      item_description: string;
      class_name: string;
      transaction_date: string;
      transaction_number: string;
      revenue: number;
      cost: number;
      quantity: number;
      year: number;
      month: number;
    }> = [];

    let offset = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await admin
        .from('diversified_sales')
        .select('customer_id, customer_name, item_id, item_name, item_description, class_name, transaction_date, transaction_number, revenue, cost, quantity, year, month')
        .or(`customer_id.eq.${customerId},customer_name.eq.${customerId}`)
        .gte('transaction_date', formatDate(priorPeriodStart))
        .order('transaction_date', { ascending: false })
        .range(offset, offset + batchSize - 1);

      if (error) {
        console.error('Error fetching customer data:', error);
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

    if (allData.length === 0) {
      return NextResponse.json(
        { error: 'Customer not found', customerId },
        { status: 404 }
      );
    }

    // Get customer info
    const customerName = allData[0].customer_name;

    // Calculate summary
    const allRevenue = allData.reduce((sum, r) => sum + (r.revenue || 0), 0);
    const allUnits = allData.reduce((sum, r) => sum + (r.quantity || 0), 0);
    const dates = allData.map(r => new Date(r.transaction_date)).sort((a, b) => a.getTime() - b.getTime());
    const firstOrder = dates[0]?.toISOString().split('T')[0] || null;
    const lastOrder = dates[dates.length - 1]?.toISOString().split('T')[0] || null;
    const lastOrderDate = dates[dates.length - 1];

    // Determine customer status based on recency
    const daysSinceLast = lastOrderDate
      ? Math.ceil((now.getTime() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    let status: 'active' | 'warning' | 'at_risk' | 'churned';
    if (daysSinceLast > 365) {
      status = 'churned';
    } else if (daysSinceLast > 180) {
      status = 'at_risk';
    } else if (daysSinceLast > 120) {
      status = 'warning';
    } else {
      status = 'active';
    }

    // Calculate monthly trend (last 24 months)
    const monthlyMap = new Map<string, { revenue: number; units: number; cost: number }>();
    for (const row of allData) {
      const monthKey = `${row.year}-${String(row.month).padStart(2, '0')}`;
      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, { revenue: 0, units: 0, cost: 0 });
      }
      const m = monthlyMap.get(monthKey)!;
      m.revenue += row.revenue || 0;
      m.units += row.quantity || 0;
      m.cost += row.cost || 0;
    }

    const monthlyTrend = Array.from(monthlyMap.entries())
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Calculate product breakdown with stopped_buying detection
    const productMap = new Map<string, {
      item_id: string;
      item_name: string;
      item_description: string;
      class_name: string;
      current_revenue: number;
      current_units: number;
      current_cost: number;
      prior_revenue: number;
      prior_units: number;
      prior_cost: number;
      last_purchase_date: string;
      transactions: Array<{ date: string; transaction_number: string; quantity: number; revenue: number }>;
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
          current_revenue: 0,
          current_units: 0,
          current_cost: 0,
          prior_revenue: 0,
          prior_units: 0,
          prior_cost: 0,
          last_purchase_date: '',
          transactions: [],
        });
      }

      const product = productMap.get(itemKey)!;
      const txDate = new Date(row.transaction_date);

      // Track last purchase date
      if (!product.last_purchase_date || row.transaction_date > product.last_purchase_date) {
        product.last_purchase_date = row.transaction_date;
      }

      // Add to transactions list
      product.transactions.push({
        date: row.transaction_date,
        transaction_number: row.transaction_number,
        quantity: row.quantity || 0,
        revenue: row.revenue || 0,
      });

      // Aggregate by period
      if (txDate >= currentPeriodStart && txDate <= currentPeriodEnd) {
        product.current_revenue += row.revenue || 0;
        product.current_units += row.quantity || 0;
        product.current_cost += row.cost || 0;
      } else if (txDate >= priorPeriodStart && txDate <= priorPeriodEnd) {
        product.prior_revenue += row.revenue || 0;
        product.prior_units += row.quantity || 0;
        product.prior_cost += row.cost || 0;
      }
    }

    // Build products array with stopped_buying flags
    const products = Array.from(productMap.values()).map(p => {
      const lastPurchase = new Date(p.last_purchase_date);
      const daysSinceProduct = Math.ceil((now.getTime() - lastPurchase.getTime()) / (1000 * 60 * 60 * 24));

      // Determine stopped_buying status
      // "stopped" = bought in prior period but not in last 6 months
      // "warning" = bought in prior period but not in last 3-4 months
      let stopped_buying: 'active' | 'warning' | 'stopped' = 'active';
      if (p.prior_revenue > 0 && p.current_revenue === 0 && daysSinceProduct > 180) {
        stopped_buying = 'stopped';
      } else if (p.prior_revenue > 0 && daysSinceProduct > 120) {
        stopped_buying = 'warning';
      }

      const change_pct = p.prior_revenue > 0
        ? ((p.current_revenue - p.prior_revenue) / p.prior_revenue) * 100
        : p.current_revenue > 0 ? 100 : 0;

      let trend: 'growing' | 'stable' | 'declining';
      if (change_pct >= 10) trend = 'growing';
      else if (change_pct <= -10) trend = 'declining';
      else trend = 'stable';

      return {
        item_id: p.item_id,
        item_name: p.item_name,
        item_description: p.item_description,
        class_name: p.class_name,
        current_revenue: p.current_revenue,
        current_units: p.current_units,
        prior_revenue: p.prior_revenue,
        prior_units: p.prior_units,
        change_pct,
        trend,
        last_purchase_date: p.last_purchase_date,
        days_since_purchase: daysSinceProduct,
        stopped_buying,
      };
    }).sort((a, b) => b.current_revenue - a.current_revenue || b.prior_revenue - a.prior_revenue);

    // Get recent transactions (last 50 unique)
    const transactionMap = new Map<string, {
      date: string;
      transaction_number: string;
      items: Array<{ item_name: string; item_description: string; quantity: number; revenue: number }>;
      total_revenue: number;
      total_units: number;
    }>();

    for (const row of allData) {
      const txKey = row.transaction_number || row.transaction_date;
      if (!transactionMap.has(txKey)) {
        transactionMap.set(txKey, {
          date: row.transaction_date,
          transaction_number: row.transaction_number,
          items: [],
          total_revenue: 0,
          total_units: 0,
        });
      }
      const tx = transactionMap.get(txKey)!;
      tx.items.push({
        item_name: row.item_name,
        item_description: row.item_description || '',
        quantity: row.quantity || 0,
        revenue: row.revenue || 0,
      });
      tx.total_revenue += row.revenue || 0;
      tx.total_units += row.quantity || 0;
    }

    const transactions = Array.from(transactionMap.values())
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 50);

    // Calculate current vs prior period totals
    const currentPeriodRevenue = allData
      .filter(r => {
        const d = new Date(r.transaction_date);
        return d >= currentPeriodStart && d <= currentPeriodEnd;
      })
      .reduce((sum, r) => sum + (r.revenue || 0), 0);

    const priorPeriodRevenue = allData
      .filter(r => {
        const d = new Date(r.transaction_date);
        return d >= priorPeriodStart && d <= priorPeriodEnd;
      })
      .reduce((sum, r) => sum + (r.revenue || 0), 0);

    const revenueChangePct = priorPeriodRevenue > 0
      ? ((currentPeriodRevenue - priorPeriodRevenue) / priorPeriodRevenue) * 100
      : currentPeriodRevenue > 0 ? 100 : 0;

    // Products that were stopped
    const stoppedProducts = products.filter(p => p.stopped_buying === 'stopped');
    const warningProducts = products.filter(p => p.stopped_buying === 'warning');

    // Cross-sell opportunities: find classes they don't buy
    const currentClasses = [...new Set(products.filter(p => p.current_revenue > 0).map(p => p.class_name))];

    // Get all classes available in the system with their average metrics
    const { data: allClassesData, error: classesError } = await admin
      .from('diversified_sales')
      .select('class_name, revenue, cost')
      .gte('transaction_date', formatDate(currentPeriodStart))
      .not('class_name', 'is', null);

    const classMetrics = new Map<string, { totalRevenue: number; totalCost: number; count: number }>();
    if (allClassesData) {
      for (const row of allClassesData) {
        const className = row.class_name;
        if (!classMetrics.has(className)) {
          classMetrics.set(className, { totalRevenue: 0, totalCost: 0, count: 0 });
        }
        const metrics = classMetrics.get(className)!;
        metrics.totalRevenue += row.revenue || 0;
        metrics.totalCost += row.cost || 0;
        metrics.count++;
      }
    }

    // Find opportunities: classes they don't currently buy
    const crossSellOpportunities = Array.from(classMetrics.entries())
      .filter(([className]) => !currentClasses.includes(className))
      .map(([className, metrics]) => {
        const avgRevenue = metrics.totalRevenue / metrics.count;
        const avgMargin = metrics.totalRevenue > 0 ? ((metrics.totalRevenue - metrics.totalCost) / metrics.totalRevenue) * 100 : 0;

        // Generate talking points based on what they already buy
        let talkingPoints: string[] = [];
        const complementaryClasses: Record<string, string[]> = {
          'Spools': ['Strainers', 'Valve Keys', 'Fillers Flanges'],
          'Strainers': ['Spools', 'Valve Keys'],
          'Valve Keys': ['Spools', 'Strainers'],
          'Fillers Flanges': ['Spools', 'Strainers'],
          'VeroFlow': ['Spools', 'Strainers', 'Valve Keys'],
        };

        const relatedClasses = currentClasses.filter(current =>
          complementaryClasses[current]?.includes(className)
        );

        if (relatedClasses.length > 0) {
          talkingPoints.push(`Complements their existing ${relatedClasses.join(', ')} purchases`);
        }

        // Add more context based on the class
        if (className === 'VeroFlow') {
          talkingPoints.push('High-efficiency alternative to traditional backflow preventers');
          talkingPoints.push('Customers report 30-40% labor savings on installation');
        } else if (className === 'Spools') {
          talkingPoints.push('Custom configurations available for specific applications');
          talkingPoints.push('Often paired with strainers for complete system solutions');
        } else if (className === 'Strainers') {
          talkingPoints.push('Essential for protecting equipment downstream');
          talkingPoints.push('Variety of mesh sizes for different applications');
        }

        return {
          class_name: className,
          estimated_annual_revenue: Math.round(avgRevenue * 12), // Estimate annual spend
          avg_margin_pct: Math.round(avgMargin * 10) / 10,
          priority: relatedClasses.length > 0 ? 'high' : 'medium',
          talking_points: talkingPoints.length > 0 ? talkingPoints : [
            `Currently buying ${currentClasses.join(', ')}`,
            `${className} offers additional solutions for their applications`,
          ],
          related_products: currentClasses.filter(c => c !== className).slice(0, 3),
        };
      })
      .filter(opp => opp.estimated_annual_revenue > 1000) // Only meaningful opportunities
      .sort((a, b) => {
        // Sort by priority first, then revenue
        if (a.priority !== b.priority) {
          return a.priority === 'high' ? -1 : 1;
        }
        return b.estimated_annual_revenue - a.estimated_annual_revenue;
      })
      .slice(0, 5); // Top 5 opportunities

    return NextResponse.json({
      customer: {
        id: customerId,
        name: customerName,
        status,
        days_since_last_order: daysSinceLast,
      },
      summary: {
        total_revenue: allRevenue,
        total_units: allUnits,
        first_order: firstOrder,
        last_order: lastOrder,
        current_period_revenue: currentPeriodRevenue,
        prior_period_revenue: priorPeriodRevenue,
        revenue_change_pct: revenueChangePct,
      },
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
      monthly_trend: monthlyTrend,
      products,
      stopped_buying_summary: {
        stopped_count: stoppedProducts.length,
        stopped_prior_revenue: stoppedProducts.reduce((sum, p) => sum + p.prior_revenue, 0),
        warning_count: warningProducts.length,
        warning_prior_revenue: warningProducts.reduce((sum, p) => sum + p.prior_revenue, 0),
      },
      transactions,
      cross_sell_opportunities: crossSellOpportunities,
    });
  } catch (error) {
    console.error('Error fetching customer detail:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch customer detail',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
