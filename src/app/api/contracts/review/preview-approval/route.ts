import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { randomUUID } from 'crypto';

/**
 * POST /api/contracts/review/preview-approval
 * Creates a preview token for the approval page without sending emails
 * This allows users to see what the approver will see before committing
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reviewId, contractName, submittedBy, reviewerNotes } = body;

    // Validate required fields
    if (!reviewId || !contractName || !submittedBy) {
      return NextResponse.json(
        { error: 'Missing required fields: reviewId, contractName, submittedBy' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    // Verify review exists
    const { data: review, error: reviewError } = await admin
      .from('contract_reviews')
      .select('id, approval_token, approval_status')
      .eq('id', reviewId)
      .single();

    if (reviewError || !review) {
      return NextResponse.json(
        { error: 'Review not found' },
        { status: 404 }
      );
    }

    // If review already has a token and is pending, reuse it
    if (review.approval_token && review.approval_status === 'pending') {
      return NextResponse.json({
        success: true,
        previewToken: review.approval_token,
        message: 'Using existing approval token for preview',
      });
    }

    // Generate preview token
    const previewToken = randomUUID();

    // Set token expiration to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Update contract_reviews with preview token (but don't change status to pending yet)
    // Use a special 'preview' status or keep as draft
    const { error: updateError } = await admin
      .from('contract_reviews')
      .update({
        approval_token: previewToken,
        token_expires_at: expiresAt.toISOString(),
        submitted_by_email: submittedBy,
        reviewer_notes: reviewerNotes || null,
        // Keep status as draft - only change to pending when actually sent
        updated_at: new Date().toISOString(),
      })
      .eq('id', reviewId);

    if (updateError) {
      console.error('Failed to update review with preview token:', updateError);
      return NextResponse.json(
        { error: 'Failed to create preview' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      previewToken,
      message: 'Preview token created. No emails sent.',
    });

  } catch (error) {
    console.error('Error creating preview:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
