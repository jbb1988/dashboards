import { NextRequest, NextResponse } from 'next/server';
import { notifyAcceptanceSigned, isSlackConfigured } from '@/lib/slack';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    if (!isSlackConfigured()) {
      return NextResponse.json(
        { error: 'Slack webhook not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { customerName, type, signedDate, envelopeId } = body;

    // Validate required fields
    if (!customerName || !type || !envelopeId) {
      return NextResponse.json(
        { error: 'Missing required fields: customerName, type, envelopeId' },
        { status: 400 }
      );
    }

    // Send notification
    const result = await notifyAcceptanceSigned({
      customerName,
      type,
      signedDate: signedDate || new Date().toISOString(),
      envelopeId,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send Slack notification' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Notification sent to Slack',
    });

  } catch (error) {
    console.error('Error sending Slack notification:', error);
    return NextResponse.json(
      {
        error: 'Failed to send notification',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
