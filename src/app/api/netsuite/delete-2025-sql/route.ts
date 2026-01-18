import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    console.log('Getting SO IDs to delete...');
    const { data: soIds } = await supabase
      .from('netsuite_sales_orders')
      .select('id')
      .gte('so_date', '2025-01-01')
      .lte('so_date', '2025-12-31');

    if (!soIds || soIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No 2025 data to delete',
        deleted_sos: 0,
        deleted_lines: 0,
      });
    }

    const ids = soIds.map(row => row.id);
    console.log(`Found ${ids.length} SOs to delete`);

    // Delete lines in batches (Supabase has query size limits)
    console.log('Deleting lines in batches...');
    const BATCH_SIZE = 100;
    let totalLinesDeleted = 0;

    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      const { error: delLinesError, count } = await supabase
        .from('netsuite_sales_order_lines')
        .delete({ count: 'exact' })
        .in('sales_order_id', batch);

      if (delLinesError) {
        return NextResponse.json({
          success: false,
          error: `Failed to delete lines batch ${i}: ${delLinesError.message}`,
          details: delLinesError,
        }, { status: 500 });
      }

      totalLinesDeleted += (count || 0);
      console.log(`  Deleted lines for ${i + batch.length}/${ids.length} SOs`);
    }

    console.log(`Lines deleted (${totalLinesDeleted} total), now deleting SOs in batches...`);

    // Delete SOs in batches
    let totalSOsDeleted = 0;

    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      const { error: delSOsError, count } = await supabase
        .from('netsuite_sales_orders')
        .delete({ count: 'exact' })
        .in('id', batch);

      if (delSOsError) {
        return NextResponse.json({
          success: false,
          error: `Failed to delete SOs batch ${i}: ${delSOsError.message}`,
          details: delSOsError,
        }, { status: 500 });
      }

      totalSOsDeleted += (count || 0);
      console.log(`  Deleted ${i + batch.length}/${ids.length} SOs`);
    }

    // Verify
    const { count } = await supabase
      .from('netsuite_sales_orders')
      .select('*', { count: 'exact', head: true })
      .gte('so_date', '2025-01-01')
      .lte('so_date', '2025-12-31');

    return NextResponse.json({
      success: true,
      deleted_lines: totalLinesDeleted,
      deleted_sos: totalSOsDeleted,
      remaining: count || 0,
      message: `Deleted ${totalLinesDeleted} lines and ${totalSOsDeleted} SOs, ${count || 0} remaining`,
    });
  } catch (e: any) {
    return NextResponse.json({
      success: false,
      error: e?.message || String(e),
    }, { status: 500 });
  }
}
