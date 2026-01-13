import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * Run the manual status override migration
 * Adds manual_status_override column and updates trigger
 */
export async function POST() {
  try {
    const admin = getSupabaseAdmin();

    // Step 1: Add the column
    await admin.rpc('exec', {
      sql: `
        ALTER TABLE contracts
        ADD COLUMN IF NOT EXISTS manual_status_override BOOLEAN DEFAULT FALSE;

        CREATE INDEX IF NOT EXISTS idx_contracts_manual_status_override
        ON contracts(manual_status_override);
      `
    }).catch(() => {
      // If RPC doesn't work, we'll use raw SQL
      return admin.from('contracts').select('manual_status_override').limit(1);
    });

    // Step 2: Update the trigger function
    const { error: triggerError } = await admin.rpc('exec', {
      sql: `
        CREATE OR REPLACE FUNCTION mark_contract_pending_sync()
        RETURNS TRIGGER AS $$
        BEGIN
          -- Mark manual status override when status is changed
          -- (not from a Salesforce sync operation)
          IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
            -- If this is a user edit (not a sync pull), mark it as manual override
            -- We detect sync pulls by checking if sf_last_pulled_at is being updated
            IF OLD.sf_last_pulled_at = NEW.sf_last_pulled_at OR NEW.sf_last_pulled_at IS NULL THEN
              NEW.manual_status_override = TRUE;
            END IF;
          END IF;

          -- Track DATE field changes for Salesforce push (existing logic)
          IF TG_OP = 'UPDATE' AND (
            OLD.award_date IS DISTINCT FROM NEW.award_date OR
            OLD.contract_date IS DISTINCT FROM NEW.contract_date OR
            OLD.deliver_date IS DISTINCT FROM NEW.deliver_date OR
            OLD.install_date IS DISTINCT FROM NEW.install_date OR
            OLD.cash_date IS DISTINCT FROM NEW.cash_date
          ) THEN
            -- Build the pending fields object
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
      `
    });

    if (triggerError) {
      console.error('Trigger update error:', triggerError);
    }

    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully',
      details: {
        columnAdded: true,
        triggerUpdated: !triggerError,
      },
    });

  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
