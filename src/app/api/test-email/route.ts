import { NextRequest, NextResponse } from 'next/server';
import {
  sendApprovalRequestEmail,
  sendCCNotificationEmail,
  sendApprovalDecisionEmail,
  sendMentionNotificationEmail,
  sendApprovalReminderEmail,
} from '@/lib/email';
import { getAuthenticatedUser } from '@/lib/apiAuth';

// POST: Send test emails for all templates
export async function POST(request: NextRequest) {
  try {
    // Allow authenticated users or cron secret
    const authHeader = request.headers.get('authorization');
    const user = await getAuthenticatedUser(request);
    const isAuthorized =
      user !== null ||
      authHeader === `Bearer ${process.env.CRON_SECRET}`;

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const testEmail = body.email || 'jbutt@marswater.com';
    const emailType = body.type || 'all'; // 'all', 'approval', 'cc', 'decision', 'mention', 'reminder'

    const results: Record<string, { success: boolean; error?: string }> = {};

    // Send Approval Request Email
    if (emailType === 'all' || emailType === 'approval') {
      results.approvalRequest = await sendApprovalRequestEmail(
        testEmail,
        'Test Contract - Service Agreement 2026',
        'system@marswater.com',
        [
          'Contract value: $150,000 annually',
          'Term: 24 months with auto-renewal',
          'Payment terms: Net 30',
          'Liability cap: 2x annual contract value',
          'Standard termination clause: 90 days notice',
        ],
        'test-token-approval-12345'
      );
    }

    // Send CC Notification Email
    if (emailType === 'all' || emailType === 'cc') {
      results.ccNotification = await sendCCNotificationEmail(
        testEmail,
        'Test Contract - Vendor Partnership Agreement',
        'legal@marswater.com',
        [
          'Partnership type: Strategic vendor',
          'Contract value: $250,000 over 3 years',
          'Exclusivity clause included',
          'IP assignment provisions',
        ],
        'test-token-cc-12345'
      );
    }

    // Send Approval Decision Email (Approved)
    if (emailType === 'all' || emailType === 'decision') {
      results.decisionApproved = await sendApprovalDecisionEmail({
        submitterEmail: testEmail,
        contractName: 'Test Contract - NDA with Acme Corp',
        decision: 'approved',
        approverEmail: 'cfo@marswater.com',
        feedback: 'Looks good. Standard terms are acceptable. Proceed with execution.',
        reviewUrl: 'https://mars-dashboards.vercel.app/contracts/review/test',
      });

      // Also send a rejected version
      results.decisionRejected = await sendApprovalDecisionEmail({
        submitterEmail: testEmail,
        contractName: 'Test Contract - Consulting Agreement',
        decision: 'rejected',
        approverEmail: 'legal@marswater.com',
        feedback: 'The indemnification clause needs revision. Please update section 5.2 to limit our liability exposure.',
        reviewUrl: 'https://mars-dashboards.vercel.app/contracts/review/test',
      });
    }

    // Send Mention Notification Email
    if (emailType === 'all' || emailType === 'mention') {
      results.mentionNotification = await sendMentionNotificationEmail({
        mentionedEmail: testEmail,
        mentionerName: 'Sarah Johnson',
        contractName: 'Test Contract - Equipment Lease',
        commentPreview: '@jbutt Can you review the payment schedule in section 3? I think we should negotiate better terms given our volume.',
        viewUrl: 'https://mars-dashboards.vercel.app/contracts/review/test',
      });
    }

    // Send Approval Reminder Email
    if (emailType === 'all' || emailType === 'reminder') {
      results.reminderUrgent = await sendApprovalReminderEmail({
        approverEmail: testEmail,
        contractName: 'Test Contract - Urgent Software License',
        submittedBy: 'procurement@marswater.com',
        daysPending: 6,
        approvalUrl: 'https://mars-dashboards.vercel.app/contracts/review/approve/test',
      });
    }

    const allSuccessful = Object.values(results).every(r => r.success);
    const successCount = Object.values(results).filter(r => r.success).length;
    const totalCount = Object.keys(results).length;

    return NextResponse.json({
      success: allSuccessful,
      message: `Sent ${successCount}/${totalCount} test emails to ${testEmail}`,
      results,
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
    }, { status: allSuccessful ? 200 : 207 });

  } catch (error) {
    console.error('Test email error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
