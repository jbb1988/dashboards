import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    // Fetch review by approval token
    const { data: review, error } = await admin
      .from('contract_reviews')
      .select('*')
      .eq('approval_token', token)
      .single();

    if (error || !review) {
      return NextResponse.json(
        { error: 'Invalid approval link. The token may be incorrect.' },
        { status: 404 }
      );
    }

    // Check if token has expired
    if (review.token_expires_at) {
      const expiresAt = new Date(review.token_expires_at);
      if (expiresAt < new Date()) {
        // Mark as expired in database
        await admin
          .from('contract_reviews')
          .update({ approval_status: 'expired', updated_at: new Date().toISOString() })
          .eq('id', review.id);

        return NextResponse.json(
          { error: 'This approval link has expired. Please request a new approval.' },
          { status: 410 } // Gone
        );
      }
    }

    // Return review data
    return NextResponse.json({
      id: review.id,
      contractId: review.contract_id,
      contractName: review.contract_name || 'Unnamed Contract',
      provisionName: review.provision_name,
      submittedBy: review.submitted_by_email,
      submittedAt: review.submitted_at,
      summary: review.summary || [],
      originalText: review.original_text,
      redlinedText: review.redlined_text,
      modifiedText: review.modified_text,
      approvalStatus: review.approval_status,
    });

  } catch (error) {
    console.error('Error fetching review by token:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
