import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    // Count 2025 SOs
    const { count, error } = await supabase
      .from('netsuite_sales_orders')
      .select('*', { count: 'exact', head: true })
      .gte('so_date', '2025-01-01')
      .lte('so_date', '2025-12-31');

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message,
        details: error,
      });
    }

    return NextResponse.json({
      success: true,
      count_2025: count,
    });
  } catch (e: any) {
    return NextResponse.json({
      success: false,
      error: e?.message || 'Unknown error',
      type: typeof e,
    });
  }
}
