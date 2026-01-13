import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Add manual_status_override column to contracts table
 * This uses Supabase's postgres meta API
 */
export async function POST() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // Try to query the column to see if it exists
    const { data: testData, error: testError } = await admin
      .from('contracts')
      .select('id, manual_status_override')
      .limit(1);

    if (!testError) {
      return NextResponse.json({
        success: true,
        message: 'Column already exists',
        alreadyExists: true,
      });
    }

    if (!testError || !testError.message.includes('column "manual_status_override" does not exist')) {
      throw testError;
    }

    // Column doesn't exist - we need to add it
    // Use postgres extension to run raw SQL
    const { data: sqlResult, error: sqlError } = await admin.rpc('exec_sql', {
      query: `
        BEGIN;

        ALTER TABLE contracts
        ADD COLUMN IF NOT EXISTS manual_status_override BOOLEAN DEFAULT FALSE;

        CREATE INDEX IF NOT EXISTS idx_contracts_manual_status_override
        ON contracts(manual_status_override);

        CREATE OR REPLACE FUNCTION mark_contract_pending_sync()
        RETURNS TRIGGER AS $$
        BEGIN
          -- Mark manual status override when status is changed
          IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
            IF OLD.sf_last_pulled_at = NEW.sf_last_pulled_at OR NEW.sf_last_pulled_at IS NULL THEN
              NEW.manual_status_override = TRUE;
            END IF;
          END IF;

          -- Track DATE field changes (existing logic)
          IF TG_OP = 'UPDATE' AND (
            OLD.award_date IS DISTINCT FROM NEW.award_date OR
            OLD.contract_date IS DISTINCT FROM NEW.contract_date OR
            OLD.deliver_date IS DISTINCT FROM NEW.deliver_date OR
            OLD.install_date IS DISTINCT FROM NEW.install_date OR
            OLD.cash_date IS DISTINCT FROM NEW.cash_date
          ) THEN
            NEW.sf_sync_pending_fields = COALESCE(NEW.sf_sync_pending_fields, '{}'::jsonb);

            IF OLD.award_date IS DISTINCT FROM NEW.award_date THEN
              NEW.sf_sync_pending_fields = NEW.sf_sync_pending_fields || jsonb_build_object('award_date', NEW.award_date);
            END IF;
            IF OLD.contract_date IS DISTINCT FROM NEW.contract_date THEN
              NEW.sf_sync_pending_fields = NEW.sf_sync_pending_fields || jsonb_build_object('contract_date', NEW.contract_date);
            END IF;
            IF OLD.deliver_date IS DISTINCT FROM NEW.deliver_date THEN
              NEW.sf_sync_pending_fields = NEW.sf_sync_pending_fields || jsonb_build_object('deliver_date', NEW.deliver_date);
            END IF;
            IF OLD.install_date IS DISTINCT FROM NEW.install_date THEN
              NEW.sf_sync_pending_fields = NEW.sf_sync_pending_fields || jsonb_build_object('install_date', NEW.install_date);
            END IF;
            IF OLD.cash_date IS DISTINCT FROM NEW.cash_date THEN
              NEW.sf_sync_pending_fields = NEW.sf_sync_pending_fields || jsonb_build_object('cash_date', NEW.cash_date);
            END IF;

            NEW.sf_sync_status = 'pending';
          END IF;

          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        COMMIT;
      `
    });

    if (sqlError) {
      // exec_sql RPC doesn't exist, return manual instructions
      return NextResponse.json({
        success: false,
        error: 'Manual migration required',
        message: 'Supabase REST API cannot execute ALTER TABLE. Please run the SQL manually in Supabase Dashboard.',
        instructions: 'Go to https://supabase.com/dashboard/project/opgunonejficgxztqegf/sql/new and paste the SQL from the migration file',
        sqlFile: '/supabase/migrations/013_protect_manual_status_updates.sql',
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully',
      columnAdded: true,
    });

  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
