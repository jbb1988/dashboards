import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Create contract_reviews table
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS contract_reviews (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            contract_id TEXT,
            contract_name TEXT,
            provision_name TEXT NOT NULL,
            original_text TEXT NOT NULL,
            redlined_text TEXT NOT NULL,
            modified_text TEXT,
            summary JSONB DEFAULT '[]'::jsonb,
            status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent_to_boss', 'sent_to_client', 'approved')),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_contract_reviews_contract_id ON contract_reviews(contract_id);
        CREATE INDEX IF NOT EXISTS idx_contract_reviews_created_at ON contract_reviews(created_at DESC);
      `
    });

    if (error) {
      // If rpc doesn't exist, try direct query approach
      console.log('RPC not available, trying direct approach...');

      // Try to insert into the table to see if it exists
      const { error: testError } = await supabase
        .from('contract_reviews')
        .select('id')
        .limit(1);

      if (testError && testError.code === '42P01') {
        // Table doesn't exist - need to create via Supabase dashboard
        return NextResponse.json({
          success: false,
          error: 'Table does not exist. Please run the SQL manually in Supabase dashboard.',
          sql: `CREATE TABLE IF NOT EXISTS contract_reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    contract_id TEXT,
    contract_name TEXT,
    provision_name TEXT NOT NULL,
    original_text TEXT NOT NULL,
    redlined_text TEXT NOT NULL,
    modified_text TEXT,
    summary JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);`
        }, { status: 400 });
      }

      // Table exists
      return NextResponse.json({
        success: true,
        message: 'Table already exists'
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully'
    });

  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Migration failed' },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Check if table exists
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase
      .from('contract_reviews')
      .select('id')
      .limit(1);

    if (error && error.code === '42P01') {
      return NextResponse.json({
        exists: false,
        message: 'Table does not exist'
      });
    }

    return NextResponse.json({
      exists: true,
      message: 'Table exists',
      count: data?.length || 0
    });

  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Check failed' },
      { status: 500 }
    );
  }
}
