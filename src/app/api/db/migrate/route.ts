/**
 * Database Migration API
 * Adds account fields to netsuite_sales_order_lines table
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({
        success: false,
        error: 'Missing Supabase credentials',
      }, { status: 500 });
    }

    // Create admin client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('Adding account columns to netsuite_sales_order_lines...');

    // Check if columns already exist
    const { data: existingColumns, error: checkError } = await supabase
      .from('netsuite_sales_order_lines')
      .select('account_number')
      .limit(1);

    if (!checkError) {
      return NextResponse.json({
        success: true,
        message: 'Migration already applied - account columns exist',
        alreadyExists: true,
      });
    }

    // Execute migration SQL using raw query
    // Note: This requires direct database access via connection string
    const migrationSQL = `
-- Add account fields to sales order lines for product type derivation
ALTER TABLE netsuite_sales_order_lines
  ADD COLUMN IF NOT EXISTS account_id VARCHAR(50),
  ADD COLUMN IF NOT EXISTS account_number VARCHAR(20),
  ADD COLUMN IF NOT EXISTS account_name VARCHAR(255);

-- Index for fast product type queries
CREATE INDEX IF NOT EXISTS idx_ns_sol_account ON netsuite_sales_order_lines(account_number);
`;

    // Return SQL for manual execution since Supabase client can't run DDL
    return NextResponse.json({
      success: false,
      requiresManualExecution: true,
      message: 'Please run this migration manually in Supabase SQL Editor',
      instructions: [
        '1. Go to your Supabase Dashboard (https://supabase.com/dashboard)',
        '2. Select your project',
        '3. Navigate to SQL Editor in the left sidebar',
        '4. Click "New Query"',
        '5. Paste the SQL below and click "Run"',
        '6. After successful execution, proceed to resync data',
      ],
      sql: migrationSQL,
      nextSteps: [
        'After running the SQL above, resync data with:',
        '  POST /api/netsuite/truly-clean-2025?year=2025',
        '  POST /api/netsuite/truly-clean-2025?year=2026',
      ],
    });

  } catch (error) {
    console.error('Migration check error:', error);
    return NextResponse.json({
      success: false,
      error: 'Migration check failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Database Migration Endpoint',
    usage: 'POST /api/db/migrate to run migration',
    migration: '035_add_account_to_sales_order_lines.sql',
  });
}
