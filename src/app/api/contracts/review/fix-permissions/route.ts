import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const GRANTS_SQL = `
-- Grant permissions for contract_reviews table
GRANT ALL ON public.contract_reviews TO postgres;
GRANT ALL ON public.contract_reviews TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_reviews TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_reviews TO anon;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
`.trim();

/**
 * Run SQL via Supabase Management API
 */
async function runSQL(sql: string): Promise<{ success: boolean; error?: string; result?: unknown }> {
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  const projectRef = process.env.SUPABASE_PROJECT_REF;

  if (!accessToken || !projectRef) {
    return { success: false, error: 'Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF' };
  }

  try {
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: sql }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Management API error: ${response.status} - ${errorText}` };
    }

    const result = await response.json();
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * POST /api/contracts/review/fix-permissions
 * Fixes the contract_reviews table permissions for PostgREST access
 * This runs the necessary GRANT statements to expose the table to the API
 */
export async function POST() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Service role key not configured' },
        { status: 500 }
      );
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'public' }
    });

    // First, check if table is accessible
    const { error: checkError } = await admin
      .from('contract_reviews')
      .select('id')
      .limit(1);

    // If we get PGRST205 or 42P01, the table needs to be created or granted
    if (checkError?.code === 'PGRST205' || checkError?.code === '42P01' || checkError?.message?.includes('does not exist')) {
      console.log('Table may not exist or lacks permissions. Creating table and running grants...');

      // Create table and run grants
      const createAndGrantSQL = `
CREATE TABLE IF NOT EXISTS public.contract_reviews (
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

CREATE INDEX IF NOT EXISTS idx_contract_reviews_contract_id ON public.contract_reviews(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_reviews_created_at ON public.contract_reviews(created_at DESC);

${GRANTS_SQL}
      `.trim();

      const createResult = await runSQL(createAndGrantSQL);

      if (!createResult.success) {
        return NextResponse.json({
          success: false,
          error: 'Failed to create table and run grants',
          details: createResult.error,
          manualFix: 'Run the following SQL in your Supabase SQL Editor',
          sql: createAndGrantSQL,
        });
      }

      // Wait a moment for schema cache to reload
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Try again
      const { error: recheckError } = await admin
        .from('contract_reviews')
        .select('id')
        .limit(1);

      if (recheckError) {
        return NextResponse.json({
          success: false,
          grantsRun: true,
          stillError: recheckError.message,
          note: 'Grants were executed but schema cache may need more time. Try again in a few seconds.',
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Permissions fixed! contract_reviews table is now accessible.',
        grantsRun: true,
      });
    }

    if (checkError) {
      // Some other error - might mean table doesn't exist
      // Try to create it
      const createTableSQL = `
CREATE TABLE IF NOT EXISTS public.contract_reviews (
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

CREATE INDEX IF NOT EXISTS idx_contract_reviews_contract_id ON public.contract_reviews(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_reviews_created_at ON public.contract_reviews(created_at DESC);

${GRANTS_SQL}
      `.trim();

      console.log('Table may not exist. Attempting to create...');
      const createResult = await runSQL(createTableSQL);

      if (!createResult.success) {
        return NextResponse.json({
          success: false,
          error: checkError.message,
          code: checkError.code,
          createAttempt: createResult.error,
        });
      }

      // Wait for schema cache
      await new Promise(resolve => setTimeout(resolve, 2000));

      return NextResponse.json({
        success: true,
        message: 'Table created and permissions set!',
        tableCreated: true,
      });
    }

    // Table is accessible!
    return NextResponse.json({
      success: true,
      message: 'contract_reviews table is accessible',
      alreadyWorking: true,
    });
  } catch (error) {
    console.error('Error checking/fixing permissions:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Return instructions for manual fix
  return NextResponse.json({
    instructions: 'POST to this endpoint to automatically fix permissions, or run manually in SQL Editor',
    sql: GRANTS_SQL,
  });
}
