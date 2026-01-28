/**
 * API Route: Archive and unarchive contracts
 * POST: Archive a contract (set is_closed = true)
 * DELETE: Unarchive a contract (set is_closed = false)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

interface ArchiveRequest {
  salesforceId?: string;
  contractId?: string;
}

// POST: Archive a contract
export async function POST(request: NextRequest) {
  try {
    const body: ArchiveRequest = await request.json();
    const { salesforceId, contractId } = body;

    if (!salesforceId && !contractId) {
      return NextResponse.json(
        { error: 'Either salesforceId or contractId is required' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    // Get current contract data - try salesforce_id first, then id
    let contract = null;

    if (salesforceId) {
      const { data, error } = await admin
        .from('contracts')
        .select('id, salesforce_id, opportunity_name, status, is_closed')
        .eq('salesforce_id', salesforceId)
        .single();

      if (!error && data) {
        contract = data;
      }
    }

    // Fallback to id lookup if salesforce_id lookup failed or wasn't provided
    if (!contract && (contractId || salesforceId)) {
      const lookupValue = contractId || salesforceId;

      const { data, error } = await admin
        .from('contracts')
        .select('id, salesforce_id, opportunity_name, status, is_closed')
        .eq('id', lookupValue)
        .single();

      if (!error && data) {
        contract = data;
      }
    }

    if (!contract) {
      return NextResponse.json(
        { error: 'Contract not found' },
        { status: 404 }
      );
    }

    // Archive the contract using the field we found it with
    const { error: updateError } = await admin
      .from('contracts')
      .update({
        is_closed: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contract.id);

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
    const contractId = searchParams.get('contractId');

    if (!salesforceId && !contractId) {
      return NextResponse.json(
        { error: 'Either salesforceId or contractId query parameter is required' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    // Find the contract - try salesforce_id first, then id
    let contract = null;

    if (salesforceId) {
      const { data, error } = await admin
        .from('contracts')
        .select('id, salesforce_id')
        .eq('salesforce_id', salesforceId)
        .single();

      if (!error && data) {
        contract = data;
      }
    }

    // Fallback to id lookup
    if (!contract && (contractId || salesforceId)) {
      const lookupValue = contractId || salesforceId;
      const { data, error } = await admin
        .from('contracts')
        .select('id, salesforce_id')
        .eq('id', lookupValue)
        .single();

      if (!error && data) {
        contract = data;
      }
    }

    if (!contract) {
      return NextResponse.json(
        { error: 'Contract not found' },
        { status: 404 }
      );
    }

    // Unarchive the contract
    const { error: updateError } = await admin
      .from('contracts')
      .update({
        is_closed: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contract.id);

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
      contractId: contract.id,
      salesforceId: contract.salesforce_id,
    });
  } catch (error) {
    console.error('Unarchive error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
