import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getSupabaseAdmin();

  try {
    // Check what data we have
    const checks = await Promise.all([
      supabase.from('netsuite_sales_orders').select('*', { count: 'exact', head: true }),
      supabase.from('netsuite_sales_order_lines').select('*', { count: 'exact', head: true }),
      supabase.from('netsuite_work_orders').select('*', { count: 'exact', head: true }),
      supabase.from('netsuite_work_order_lines').select('*', { count: 'exact', head: true }),
      supabase.from('project_profitability').select('*', { count: 'exact', head: true }),
    ]);

    // Get sample data
    const samples = await Promise.all([
      supabase.from('netsuite_sales_orders').select('*').limit(3),
      supabase.from('netsuite_sales_order_lines').select('*').limit(3),
      supabase.from('netsuite_work_orders').select('*').limit(3),
      supabase.from('netsuite_work_order_lines').select('*').limit(3),
    ]);

    // Check for NULL item_names
    const nullChecks = await Promise.all([
      supabase.from('netsuite_sales_order_lines').select('id', { count: 'exact', head: true }).is('item_name', null),
      supabase.from('netsuite_work_order_lines').select('id', { count: 'exact', head: true }).is('item_name', null),
    ]);

    return NextResponse.json({
      success: true,
      counts: {
        sales_orders: checks[0].count || 0,
        sales_order_lines: checks[1].count || 0,
        work_orders: checks[2].count || 0,
        work_order_lines: checks[3].count || 0,
        project_profitability: checks[4].count || 0,
      },
      null_counts: {
        so_lines_null_items: nullChecks[0].count || 0,
        wo_lines_null_items: nullChecks[1].count || 0,
      },
      samples: {
        sales_orders: samples[0].data,
        sales_order_lines: samples[1].data,
        work_orders: samples[2].data,
        work_order_lines: samples[3].data,
      },
      errors: {
        sales_orders: checks[0].error?.message,
        sales_order_lines: checks[1].error?.message,
        work_orders: checks[2].error?.message,
        work_order_lines: checks[3].error?.message,
        project_profitability: checks[4].error?.message,
      },
    });
  } catch (error) {
    console.error('Data check error:', error);
    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    );
  }
}
