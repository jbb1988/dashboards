/**
 * API Route: Archive and unarchive contracts
 * POST: Archive a contract (set is_closed = true)
 * DELETE: Unarchive a contract (set is_closed = false)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

interface ArchiveRequest {
  salesforceId: string;
}

// POST: Archive a contract
export async function POST(request: NextRequest) {
  try {
    const body: ArchiveRequest = await request.json();
    const { salesforceId } = body;

    if (!salesforceId) {
      return NextResponse.json(
        { error: 'salesforceId is required' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    // Get current contract data to return for undo
    const { data: contract, error: fetchError } = await admin
      .from('contracts')
      .select('id, salesforce_id, opportunity_name, status, is_closed')
      .eq('salesforce_id', salesforceId)
      .single();

    if (fetchError || !contract) {
      return NextResponse.json(
        { error: 'Contract not found' },
        { status: 404 }
      );
    }

    // Archive the contract
    const { error: updateError } = await admin
      .from('contracts')
      .update({
        is_closed: true,
        updated_at: new Date().toISOString(),
      })
      .eq('salesforce_id', salesforceId);

    if (updateError) {
      console.error('Error archiving contract:', updateError);
      return NextResponse.json(
        { error: 'Failed to archive contract', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      archived: true,
      contract: {
        salesforceId: contract.salesforce_id,
        name: contract.opportunity_name,
        previousStatus: contract.status,
      },
    });
  } catch (error) {
    console.error('Archive error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE: Unarchive a contract
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const salesforceId = searchParams.get('salesforceId');

    if (!salesforceId) {
      return NextResponse.json(
        { error: 'salesforceId query parameter is required' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    // Unarchive the contract
    const { error: updateError } = await admin
      .from('contracts')
      .update({
        is_closed: false,
        updated_at: new Date().toISOString(),
      })
      .eq('salesforce_id', salesforceId);

    if (updateError) {
      console.error('Error unarchiving contract:', updateError);
      return NextResponse.json(
        { error: 'Failed to unarchive contract', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      archived: false,
      salesforceId,
    });
  } catch (error) {
    console.error('Unarchive error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
