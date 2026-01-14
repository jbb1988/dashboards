import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, decision, feedback, approverEmail } = body;

    // Validate required fields
    if (!token || !decision || !approverEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: token, decision, approverEmail' },
        { status: 400 }
      );
    }

    // Validate decision value
    if (decision !== 'approve' && decision !== 'reject') {
      return NextResponse.json(
        { error: 'Invalid decision value. Must be "approve" or "reject"' },
        { status: 400 }
      );
    }

    // Require feedback for rejections
    if (decision === 'reject' && (!feedback || !feedback.trim())) {
      return NextResponse.json(
        { error: 'Feedback is required when rejecting a contract' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    // Fetch review by token
    const { data: review, error: fetchError } = await admin
      .from('contract_reviews')
      .select('id, approval_status, token_expires_at')
      .eq('approval_token', token)
      .single();

    if (fetchError || !review) {
      return NextResponse.json(
        { error: 'Invalid approval link. The token may be incorrect.' },
        { status: 404 }
      );
    }

    // Check if token has expired
    if (review.token_expires_at) {
      const expiresAt = new Date(review.token_expires_at);
      if (expiresAt < new Date()) {
        // Mark as expired
        await admin
          .from('contract_reviews')
          .update({ approval_status: 'expired' })
          .eq('id', review.id);

        return NextResponse.json(
          { error: 'This approval link has expired. Please request a new approval.' },
          { status: 410 } // Gone
        );
      }
    }

    // Check if already decided
    if (review.approval_status === 'approved' || review.approval_status === 'rejected') {
      return NextResponse.json(
        {
          error: 'This contract has already been reviewed',
          currentDecision: review.approval_status
        },
        { status: 409 } // Conflict
      );
    }

    // Update review with decision
    const approvalStatus = decision === 'approve' ? 'approved' : 'rejected';
    const legacyStatus = decision === 'approve' ? 'approved' : 'sent_to_boss'; // Keep rejected ones as 'sent_to_boss' for resubmission

    const { error: updateError } = await admin
      .from('contract_reviews')
      .update({
        approval_status: approvalStatus,
        approver_email: approverEmail,
        approval_feedback: feedback || null,
        approved_at: new Date().toISOString(),
        status: legacyStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', review.id);

    if (updateError) {
      console.error('Failed to update approval decision:', updateError);
      return NextResponse.json(
        { error: 'Failed to save approval decision' },
        { status: 500 }
      );
    }

    // TODO: Optional enhancement - send confirmation email to submitter

    return NextResponse.json({
      success: true,
      message: decision === 'approve'
        ? 'Contract approved successfully'
        : 'Contract rejected successfully',
      reviewId: review.id,
      decision: approvalStatus,
    });

  } catch (error) {
    console.error('Error processing approval decision:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
