import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST() {
  const supabase = getSupabaseAdmin();

  // Delete ALL lines (nuclear option)
  console.log('Deleting ALL sales order lines...');

  const { error, count } = await supabase
    .from('netsuite_sales_order_lines')
    .delete({ count: 'exact' })
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Match all

  if (error) {
    return NextResponse.json({
      success: false,
      error: error.message,
      details: error,
    }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    deleted: count,
    message: `Deleted ${count} lines`,
  });
}
