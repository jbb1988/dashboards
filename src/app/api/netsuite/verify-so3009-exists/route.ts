import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const supabase = getSupabaseAdmin();

  // 1. Count total SOs
  const { count: totalSOs } = await supabase
    .from('netsuite_sales_orders')
    .select('*', { count: 'exact', head: true });

  // 2. Search for SO3009 by all possible fields
  const { data: byNumber } = await supabase
    .from('netsuite_sales_orders')
    .select('id, netsuite_id, so_number, tranid')
    .or('so_number.eq.SO3009,tranid.eq.SO3009')
    .maybeSingle();

  const { data: byNetsuiteId } = await supabase
    .from('netsuite_sales_orders')
    .select('id, netsuite_id, so_number, tranid')
    .eq('netsuite_id', '341203')
    .maybeSingle();

  // 3. Get sample of SOs to see data structure
  const { data: sampleSOs } = await supabase
    .from('netsuite_sales_orders')
    .select('id, netsuite_id, so_number, tranid')
    .limit(5);

  // 4. Check if 341203 exists as ANY field value
  const { data: searchAll } = await supabase
    .from('netsuite_sales_orders')
    .select('*')
    .or('netsuite_id.eq.341203,so_number.eq.341203,tranid.eq.341203,id.eq.341203');

  return NextResponse.json({
    totalSOs,
    byNumber,
    byNetsuiteId,
    sampleSOs,
    searchAll,
    exists: !!(byNumber || byNetsuiteId || (searchAll && searchAll.length > 0)),
  });
}
