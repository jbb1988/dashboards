import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * PATCH /api/contracts/review/history/update
 * Update a contract review record (provision name, contract name, summary, etc.)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { reviewId, provisionName, contractName, summary } = body;

    if (!reviewId) {
      return NextResponse.json(
        { error: 'Missing required field: reviewId' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (provisionName !== undefined) {
      updateData.provision_name = provisionName;
    }

    if (contractName !== undefined) {
      updateData.contract_name = contractName;
    }

    if (summary !== undefined) {
      updateData.summary = summary;
    }

    const { data, error } = await admin
      .from('contract_reviews')
      .update(updateData)
      .eq('id', reviewId)
      .select()
      .single();

    if (error) {
      console.error('Failed to update review:', error);
      return NextResponse.json(
        { error: 'Failed to update review' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      review: {
        id: data.id,
        provisionName: data.provision_name,
        contractName: data.contract_name,
        summary: data.summary,
      },
    });
  } catch (error) {
    console.error('Error updating review:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
