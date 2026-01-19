/**
 * Test endpoint to verify account data in sales order lines
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseAdmin();

    // Get a sample of sales order lines with account data AND their SO info
    const { data: lines, error } = await supabase
      .from('netsuite_sales_order_lines')
      .select(`
        id,
        item_name,
        account_id,
        account_number,
        account_name,
        amount,
        sales_order_id,
        netsuite_sales_orders!inner (
          so_number,
          customer_name
        )
      `)
      .not('account_number', 'is', null)
      .limit(5);

    if (error) {
      return NextResponse.json({
        error: 'Query failed',
        message: error.message,
        details: error,
      }, { status: 500 });
    }

    // Also count total lines with account data
    const { count: totalWithAccount } = await supabase
      .from('netsuite_sales_order_lines')
      .select('*', { count: 'exact', head: true })
      .not('account_number', 'is', null);

    const { count: totalLines } = await supabase
      .from('netsuite_sales_order_lines')
      .select('*', { count: 'exact', head: true });

    // Test fetching a specific SO with lines
    const testSONumber = lines && lines.length > 0 ? (lines[0] as any).netsuite_sales_orders?.so_number : null;

    let testSOData = null;
    if (testSONumber) {
      const { data: testSO } = await supabase
        .from('netsuite_sales_orders')
        .select(`
          so_number,
          customer_name,
          netsuite_sales_order_lines (
            item_name,
            account_number,
            account_name,
            amount
          )
        `)
        .eq('so_number', testSONumber)
        .single();

      testSOData = testSO;
    }

    return NextResponse.json({
      success: true,
      sampleLines: lines,
      testSO: testSOData,
      stats: {
        totalLines,
        linesWithAccountData: totalWithAccount,
        percentageWithData: totalLines ? ((totalWithAccount || 0) / totalLines * 100).toFixed(1) + '%' : '0%',
      },
    });

  } catch (error) {
    console.error('Test endpoint error:', error);
    return NextResponse.json({
      error: 'Server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
