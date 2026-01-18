/**
 * Run migration 036 - Add item class to sales order lines
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const supabase = getSupabaseAdmin();

    console.log('Running migration 036: Add item class to sales order lines');

    // Add columns
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE netsuite_sales_order_lines
          ADD COLUMN IF NOT EXISTS item_class_id VARCHAR(50),
          ADD COLUMN IF NOT EXISTS item_class_name VARCHAR(255);
      `
    });

    if (alterError && !alterError.message.includes('already exists')) {
      throw alterError;
    }

    // Create index
    const { error: indexError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_ns_sol_item_class
        ON netsuite_sales_order_lines(item_class_name);
      `
    });

    if (indexError && !indexError.message.includes('already exists')) {
      throw indexError;
    }

    return NextResponse.json({
      success: true,
      message: 'Migration 036 completed successfully',
    });
  } catch (error: any) {
    console.error('Migration failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
