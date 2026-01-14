import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sendApprovalRequestEmail } from '@/lib/email';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reviewId, contractName, submittedBy, summaryPreview } = body;

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
      .select('id, contract_id, contract_name, provision_name, summary')
      .eq('id', reviewId)
      .single();

    if (reviewError || !review) {
      return NextResponse.json(
        { error: 'Review not found' },
        { status: 404 }
      );
    }

    // Generate secure approval token
    const approvalToken = randomUUID();

    // Set token expiration to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Update contract_reviews with approval data
    const { error: updateError } = await admin
      .from('contract_reviews')
      .update({
        approval_status: 'pending',
        approval_token: approvalToken,
        token_expires_at: expiresAt.toISOString(),
        submitted_by_email: submittedBy,
        submitted_at: new Date().toISOString(),
        status: 'sent_to_boss', // Legacy status field
        updated_at: new Date().toISOString(),
      })
      .eq('id', reviewId);

    if (updateError) {
      console.error('Failed to update review with approval data:', updateError);
      return NextResponse.json(
        { error: 'Failed to create approval request' },
        { status: 500 }
      );
    }

    // Fetch all admin users
    const { data: adminUsers, error: adminError } = await admin
      .from('user_roles')
      .select('email')
      .eq('role', 'admin');

    if (adminError) {
      console.error('Failed to fetch admin users:', adminError);
      return NextResponse.json(
        { error: 'Failed to fetch admin users' },
        { status: 500 }
      );
    }

    if (!adminUsers || adminUsers.length === 0) {
      return NextResponse.json(
        { error: 'No admin users found to send approval request' },
        { status: 404 }
      );
    }

    // Use provided summary preview or fallback to review summary
    const summary = summaryPreview && summaryPreview.length > 0
      ? summaryPreview
      : (review.summary || []).slice(0, 5);

    // Send email to each admin
    const emailResults = await Promise.allSettled(
      adminUsers.map(user =>
        sendApprovalRequestEmail(
          user.email,
          contractName,
          submittedBy,
          summary,
          approvalToken
        )
      )
    );

    // Count successful emails
    const successCount = emailResults.filter(
      result => result.status === 'fulfilled' && result.value.success
    ).length;

    // Log email failures
    const failures = emailResults
      .map((result, idx) => ({
        email: adminUsers[idx].email,
        result
      }))
      .filter(({ result }) =>
        result.status === 'rejected' ||
        (result.status === 'fulfilled' && !result.value.success)
      );

    if (failures.length > 0) {
      console.error('Failed to send approval emails to some admins:', failures);
    }

    if (successCount === 0) {
      return NextResponse.json(
        {
          error: 'Failed to send approval emails',
          warning: 'Approval request created but email delivery failed'
        },
        { status: 207 } // Multi-Status
      );
    }

    return NextResponse.json({
      success: true,
      message: `Approval request sent to ${successCount} admin(s)`,
      reviewId,
      approvalToken, // For testing/debugging
      emailsSent: successCount,
      emailsFailed: failures.length,
    });

  } catch (error) {
    console.error('Error creating approval request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
