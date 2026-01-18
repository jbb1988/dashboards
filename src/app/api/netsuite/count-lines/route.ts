import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getSupabaseAdmin();

  const { count } = await supabase
    .from('netsuite_sales_order_lines')
    .select('*', { count: 'exact', head: true });

  return NextResponse.json({ total_lines: count });
}
