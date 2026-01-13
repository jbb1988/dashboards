import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * Apply manual status override migration
 * Adds manual_status_override column to contracts table
 */
export async function POST() {
  try {
    const admin = getSupabaseAdmin();

    // Step 1: Check if column exists
    const { data: existing, error: checkError } = await admin
      .from('contracts')
      .select('id, manual_status_override')
      .limit(1);

    if (checkError && checkError.message.includes('column "manual_status_override" does not exist')) {
      // Column doesn't exist - we need to add it
      // Unfortunately, Supabase REST API doesn't support ALTER TABLE
      // We need to do this through the Supabase dashboard SQL Editor
      return NextResponse.json({
        success: false,
        error: 'Manual migration required',
        message: 'Please run the migration SQL in Supabase SQL Editor',
        sql: `
-- Add manual status override column
ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS manual_status_override BOOLEAN DEFAULT FALSE;

-- Create index
CREATE INDEX IF NOT EXISTS idx_contracts_manual_status_override
ON contracts(manual_status_override);

-- Update trigger function
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
        `,
      }, { status: 400 });
    }

    // Column already exists
    return NextResponse.json({
      success: true,
      message: 'Migration already applied - manual_status_override column exists',
    });

  } catch (error) {
    console.error('Migration check error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
