import { NextRequest, NextResponse } from 'next/server';
import { sendApprovalRequestEmail } from '@/lib/email';
import { getAuthenticatedUser } from '@/lib/apiAuth';

// POST: Send a test approval request email
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

    const result = await sendApprovalRequestEmail(
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
      'test-token-12345'
    );

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Test email sent to ${testEmail}`,
        from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error,
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Test email error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
