import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sendApprovalRequestEmail, sendCCNotificationEmail } from '@/lib/email';
import { randomUUID } from 'crypto';

// Configurable approver and CC emails via environment variables
const APPROVER_EMAIL = process.env.APPROVER_EMAIL || null;
const DEFAULT_CC_EMAIL = process.env.DEFAULT_CC_EMAIL || null;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reviewId, contractName, submittedBy, summaryPreview, reviewerNotes, ccEmails } = body;

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

    // Generate CC token for read-only access
    const ccToken = randomUUID();

    // Set token expiration to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Create initial activity log entry for submission
    const submittedAt = new Date().toISOString();
    const activityLog = [
      {
        action: 'submitted',
        by: submittedBy,
        at: submittedAt,
      },
    ];

    // Parse and validate CC emails
    const validCCEmails: string[] = [];

    // Add default CC email if configured (always CC this email on all approvals)
    if (DEFAULT_CC_EMAIL) {
      validCCEmails.push(DEFAULT_CC_EMAIL.toLowerCase());
      console.log('Adding default CC email:', DEFAULT_CC_EMAIL);
    }

    if (ccEmails && typeof ccEmails === 'string') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const emails = ccEmails.split(',').map((e: string) => e.trim()).filter((e: string) => e);
      for (const email of emails) {
        if (emailRegex.test(email) && !validCCEmails.includes(email.toLowerCase())) {
          validCCEmails.push(email.toLowerCase());
        }
      }
    }

    // Update contract_reviews with approval data
    const { error: updateError } = await admin
      .from('contract_reviews')
      .update({
        approval_status: 'pending',
        approval_token: approvalToken,
        token_expires_at: expiresAt.toISOString(),
        submitted_by_email: submittedBy,
        submitted_at: submittedAt,
        status: 'sent_to_boss', // Legacy status field
        updated_at: submittedAt,
        activity_log: activityLog,
        reviewer_notes: reviewerNotes || null,
        cc_emails: validCCEmails.length > 0 ? validCCEmails : null,
        cc_token: validCCEmails.length > 0 ? ccToken : null,
      })
      .eq('id', reviewId);

    if (updateError) {
      console.error('Failed to update review with approval data:', updateError);
      return NextResponse.json(
        { error: 'Failed to create approval request' },
        { status: 500 }
      );
    }

    // Determine approver emails
    // Priority: 1. Environment variable APPROVER_EMAIL, 2. Admin users from database
    let approverEmails: string[] = [];

    if (APPROVER_EMAIL) {
      // Use configured approver email
      approverEmails = [APPROVER_EMAIL];
      console.log('Using configured APPROVER_EMAIL:', APPROVER_EMAIL);
    } else {
      // Fallback to fetching admin users from database
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
          { error: 'No admin users found to send approval request. Configure APPROVER_EMAIL in environment variables.' },
          { status: 404 }
        );
      }

      approverEmails = adminUsers.map(u => u.email);
    }

    // Use provided summary preview or fallback to review summary
    const summary = summaryPreview && summaryPreview.length > 0
      ? summaryPreview
      : (review.summary || []).slice(0, 5);

    // Send email to each approver
    const emailResults = await Promise.allSettled(
      approverEmails.map(email =>
        sendApprovalRequestEmail(
          email,
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
        email: approverEmails[idx],
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

    // Send CC notification emails
    let ccEmailsSent = 0;
    let ccEmailsFailed = 0;
    if (validCCEmails.length > 0) {
      const ccEmailResults = await Promise.allSettled(
        validCCEmails.map(email =>
          sendCCNotificationEmail(
            email,
            contractName,
            submittedBy,
            summary,
            ccToken
          )
        )
      );

      ccEmailsSent = ccEmailResults.filter(
        result => result.status === 'fulfilled' && result.value.success
      ).length;

      ccEmailsFailed = validCCEmails.length - ccEmailsSent;

      // Add CC recipients to activity log
      if (ccEmailsSent > 0) {
        await admin
          .from('contract_reviews')
          .update({
            activity_log: [
              ...activityLog,
              {
                action: 'cc_sent',
                by: submittedBy,
                at: new Date().toISOString(),
                recipients: validCCEmails,
              },
            ],
          })
          .eq('id', reviewId);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Approval request sent to ${successCount} admin(s)${ccEmailsSent > 0 ? ` and CC'd ${ccEmailsSent} recipient(s)` : ''}`,
      reviewId,
      approvalToken, // For testing/debugging
      emailsSent: successCount,
      emailsFailed: failures.length,
      ccEmailsSent,
      ccEmailsFailed,
    });

  } catch (error) {
    console.error('Error creating approval request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
