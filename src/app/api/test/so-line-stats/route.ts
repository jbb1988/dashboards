import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get('year') || '2025';

  const supabase = getSupabaseAdmin();

  // Get SOs with line counts for the year
  const { data: sosWithLines, error } = await supabase
    .from('netsuite_sales_orders')
    .select(`
      so_number,
      so_date,
      customer_name,
      netsuite_sales_order_lines (id)
    `)
    .gte('so_date', `${year}-01-01`)
    .lte('so_date', `${year}-12-31`)
    .order('so_date', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const stats = sosWithLines?.map(so => ({
    soNumber: so.so_number,
    soDate: so.so_date,
    customer: so.customer_name,
    lineCount: so.netsuite_sales_order_lines?.length || 0,
  }));

  const withLines = stats?.filter(s => s.lineCount > 0).length || 0;
  const withoutLines = stats?.filter(s => s.lineCount === 0).length || 0;

  return NextResponse.json({
    success: true,
    year,
    summary: {
      total: stats?.length || 0,
      withLines,
      withoutLines,
      percentWithLines: stats ? ((withLines / stats.length) * 100).toFixed(1) + '%' : '0%',
    },
    recentSOs: stats?.slice(0, 20),
  });
}
