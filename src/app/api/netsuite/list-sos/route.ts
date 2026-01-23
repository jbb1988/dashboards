import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: Request) {
  const supabase = getSupabaseAdmin();
  const url = new URL(request.url);
  const search = url.searchParams.get('search') || '';

  // Get total count
  const { count } = await supabase
    .from('netsuite_sales_orders')
    .select('*', { count: 'exact', head: true });

  // Search for specific SO or get samples
  let query = supabase
    .from('netsuite_sales_orders')
    .select('id, netsuite_id, so_number, tranid, so_date, customer_name, total_amount')
    .order('so_date', { ascending: false });

  if (search) {
    query = query.or(`netsuite_id.eq.${search},so_number.ilike.%${search}%,tranid.ilike.%${search}%`);
  }

  const { data: sos } = await query.limit(20);

  return NextResponse.json({
    totalCount: count,
    search,
    results: sos || [],
    so3009Exists: (sos || []).some((so) =>
      so.netsuite_id === '341203' ||
      so.so_number === 'SO3009' ||
      so.tranid === 'SO3009'
    ),
  });
}
