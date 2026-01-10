/**
 * API Route: Update Salesforce sync status for contracts
 * Used after successfully pushing changes to Salesforce
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

interface SyncStatusRequest {
  salesforceIds: string[];
  status: 'synced' | 'pending' | 'error';
  errorMessage?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: SyncStatusRequest = await request.json();
    const { salesforceIds, status, errorMessage } = body;

    if (!salesforceIds || salesforceIds.length === 0) {
      return NextResponse.json(
        { error: 'salesforceIds array is required' },
        { status: 400 }
      );
    }

    if (!['synced', 'pending', 'error'].includes(status)) {
      return NextResponse.json(
        { error: 'status must be synced, pending, or error' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    // Update sync status for all specified contracts
    const updateData: Record<string, any> = {
      sf_sync_status: status,
      updated_at: new Date().toISOString(),
    };

    // If marking as synced, clear pending fields and set last pushed time
    if (status === 'synced') {
      updateData.sf_sync_pending_fields = {};
      updateData.sf_last_pushed_at = new Date().toISOString();
    }

    const { error, count } = await admin
      .from('contracts')
      .update(updateData)
      .in('salesforce_id', salesforceIds);

    if (error) {
      console.error('Error updating sync status:', error);
      return NextResponse.json(
        { error: 'Failed to update sync status', details: error.message },
        { status: 500 }
      );
    }

    // Log to sync audit table
    try {
      const logEntries = salesforceIds.map(sfId => ({
        salesforce_id: sfId,
        action: status === 'synced' ? 'push' : status === 'error' ? 'push_failed' : 'status_change',
        error_message: errorMessage || null,
      }));

      await admin.from('salesforce_sync_log').insert(logEntries);
    } catch (logErr) {
      // Don't fail if logging fails
      console.error('Failed to log sync action:', logErr);
    }

    return NextResponse.json({
      success: true,
      updated: count || salesforceIds.length,
      status,
    });
  } catch (error) {
    console.error('Sync status update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to check sync status for specific contracts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const salesforceId = searchParams.get('salesforceId');

    const admin = getSupabaseAdmin();

    if (salesforceId) {
      // Get status for a specific contract
      const { data, error } = await admin
        .from('contracts')
        .select('salesforce_id, sf_sync_status, sf_sync_pending_fields, sf_last_pushed_at, sf_last_pulled_at')
        .eq('salesforce_id', salesforceId)
        .single();

      if (error) {
        return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
      }

      return NextResponse.json({
        salesforceId: data.salesforce_id,
        syncStatus: data.sf_sync_status,
        pendingFields: data.sf_sync_pending_fields,
        lastPushedAt: data.sf_last_pushed_at,
        lastPulledAt: data.sf_last_pulled_at,
      });
    }

    // Get summary of sync statuses
    const { data: contracts, error } = await admin
      .from('contracts')
      .select('sf_sync_status')
      .not('is_closed', 'eq', true);

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch sync status' }, { status: 500 });
    }

    const summary = {
      synced: 0,
      pending: 0,
      error: 0,
      unknown: 0,
    };

    contracts?.forEach(c => {
      const status = c.sf_sync_status || 'synced';
      if (status in summary) {
        summary[status as keyof typeof summary]++;
      } else {
        summary.unknown++;
      }
    });

    return NextResponse.json({ summary });
  } catch (error) {
    console.error('Error fetching sync status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
