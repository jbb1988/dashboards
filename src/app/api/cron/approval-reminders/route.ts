import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sendApprovalReminderEmail } from '@/lib/email';

// GET: Send reminder emails for pending approvals
// This endpoint is called by Vercel Cron daily at 9 AM
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();

    // Find pending approvals that are:
    // 1. More than 2 days old
    // 2. Not reminded in the last 24 hours
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const { data: pendingReviews, error: fetchError } = await admin
      .from('contract_reviews')
      .select('id, contract_name, submitted_by_email, submitted_at, approval_token, reminder_sent_at, reminder_count')
      .eq('approval_status', 'pending')
      .lt('created_at', twoDaysAgo.toISOString())
      .or(`reminder_sent_at.is.null,reminder_sent_at.lt.${oneDayAgo.toISOString()}`);

    if (fetchError) {
      console.error('Failed to fetch pending reviews:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch pending reviews' },
        { status: 500 }
      );
    }

    if (!pendingReviews || pendingReviews.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending reviews require reminders',
        sent: 0,
      });
    }

    // Get admin users to send reminders to
    const { data: adminUsers, error: adminError } = await admin
      .from('user_roles')
      .select('email')
      .eq('role', 'admin');

    if (adminError || !adminUsers || adminUsers.length === 0) {
      console.error('No admin users found for reminders');
      return NextResponse.json({
        success: true,
        message: 'No admin users to send reminders to',
        sent: 0,
      });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://mars-dashboards.vercel.app';
    let sentCount = 0;
    const errors: string[] = [];

    // Send reminders for each pending review
    for (const review of pendingReviews) {
      const daysPending = Math.floor(
        (Date.now() - new Date(review.submitted_at || review.created_at).getTime()) /
          (24 * 60 * 60 * 1000)
      );

      const approvalUrl = review.approval_token
        ? `${baseUrl}/contracts/review/approve/${review.approval_token}`
        : `${baseUrl}/contracts/review?id=${review.id}`;

      // Send to each admin
      for (const adminUser of adminUsers) {
        try {
          await sendApprovalReminderEmail({
            approverEmail: adminUser.email,
            contractName: review.contract_name || 'Contract Review',
            submittedBy: review.submitted_by_email || 'Unknown',
            daysPending,
            approvalUrl,
          });
          sentCount++;
        } catch (emailError) {
          console.error(`Failed to send reminder to ${adminUser.email}:`, emailError);
          errors.push(`Failed to send to ${adminUser.email}`);
        }
      }

      // Update reminder tracking
      await admin
        .from('contract_reviews')
        .update({
          reminder_sent_at: new Date().toISOString(),
          reminder_count: (review.reminder_count || 0) + 1,
        })
        .eq('id', review.id);
    }

    return NextResponse.json({
      success: true,
      message: `Sent ${sentCount} reminder emails for ${pendingReviews.length} reviews`,
      sent: sentCount,
      reviews: pendingReviews.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Approval reminders cron error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
