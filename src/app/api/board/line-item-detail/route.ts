/**
 * Line Item Detail Report with Future Revenue Indicators
 * Shows which specific line items have revenue extending to future years
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get('year') || '2025';
  const customer = searchParams.get('customer'); // Optional filter

  try {
    const supabase = getSupabaseAdmin();

    // Get all lines with revenue dates
    let query = supabase
      .from('netsuite_sales_order_lines')
      .select(`
        id,
        item_name,
        item_description,
        item_type,
        quantity,
        rate,
        amount,
        revrecstartdate,
        revrecenddate,
        netsuite_sales_orders!inner(
          customer_name,
          so_number,
          so_date
        )
      `)
      .gte('netsuite_sales_orders.so_date', `${year}-01-01`)
      .lte('netsuite_sales_orders.so_date', `${year}-12-31`)
      .order('amount', { ascending: false });

    if (customer) {
      query = query.eq('netsuite_sales_orders.customer_name', customer);
    }

    const { data: lines, error } = await query.range(0, 9999);

    if (error) {
      throw new Error(`Query failed: ${error.message}`);
    }

    // Add helper fields
    const currentYear = parseInt(year);
    const enrichedLines = (lines || []).map(line => {
      let futureYearRevenue = 'No';
      let revenueYears = '';

      if (line.revrecstartdate && line.revrecenddate) {
        const startYear = new Date(line.revrecstartdate).getFullYear();
        const endYear = new Date(line.revrecenddate).getFullYear();

        if (endYear > currentYear) {
          futureYearRevenue = 'Yes';
          const years = [];
          for (let y = startYear; y <= endYear; y++) {
            years.push(y);
          }
          revenueYears = years.join(', ');
        } else {
          revenueYears = `${startYear}`;
          if (startYear !== endYear) {
            revenueYears += `-${endYear}`;
          }
        }
      }

      return {
        customer_name: line.netsuite_sales_orders.customer_name,
        so_number: line.netsuite_sales_orders.so_number,
        so_date: line.netsuite_sales_orders.so_date,
        item_name: line.item_name,
        item_description: line.item_description,
        item_type: line.item_type,
        quantity: line.quantity,
        rate: line.rate,
        amount: line.amount,
        revenue_start: line.revrecstartdate,
        revenue_end: line.revrecenddate,
        has_future_revenue: futureYearRevenue,
        revenue_years: revenueYears,
      };
    });

    const linesWithFutureRevenue = enrichedLines.filter(
      l => l.has_future_revenue === 'Yes'
    );

    return NextResponse.json({
      success: true,
      year,
      customer_filter: customer || 'all',
      total_lines: enrichedLines.length,
      lines_with_future_revenue: linesWithFutureRevenue.length,
      future_revenue_amount: linesWithFutureRevenue.reduce(
        (sum, l) => sum + (l.amount || 0),
        0
      ),
      line_items: enrichedLines,
    });
  } catch (e: any) {
    console.error('Line item detail error:', e);
    return NextResponse.json(
      {
        success: false,
        error: e?.message || String(e),
      },
      { status: 500 }
    );
  }
}
