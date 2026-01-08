import { NextRequest, NextResponse } from 'next/server';
import { notifyAcceptanceSigned } from '@/lib/slack';

export const dynamic = 'force-dynamic';

/**
 * DocuSign Connect Webhook
 * Receives notifications when envelope status changes
 * Automatically sends Slack notification when acceptance docs are signed
 */

interface DocuSignWebhookPayload {
  event: string;
  apiVersion: string;
  uri: string;
  retryCount: number;
  configurationId: number;
  generatedDateTime: string;
  data: {
    accountId: string;
    userId: string;
    envelopeId: string;
    envelopeSummary: {
      status: string;
      emailSubject: string;
      sender: {
        userName: string;
        email: string;
      };
      recipients: {
        signers: Array<{
          name: string;
          email: string;
          status: string;
          signedDateTime?: string;
        }>;
      };
      completedDateTime?: string;
      sentDateTime?: string;
    };
  };
}

// Extract customer name and type from envelope subject
function extractCustomerInfo(subject: string): { customerName: string; type: 'project' | 'mcc' } {
  const projectMatch = subject.match(/Please DocuSign:\s*(.+?)\s*MARS Project Final Acceptance/i);
  if (projectMatch) {
    return { customerName: projectMatch[1].trim(), type: 'project' };
  }

  const mccMatch = subject.match(/Complete with Docusign:\s*(.+?)\s*MCC Work Order Acceptance/i);
  if (mccMatch) {
    return { customerName: mccMatch[1].trim(), type: 'mcc' };
  }

  // Fallback - use full subject
  return { customerName: subject, type: 'project' };
}

export async function POST(request: NextRequest) {
  try {
    const payload: DocuSignWebhookPayload = await request.json();

    console.log('DocuSign webhook received:', {
      event: payload.event,
      envelopeId: payload.data?.envelopeId,
      status: payload.data?.envelopeSummary?.status,
    });

    // Only process envelope-completed events
    if (payload.event !== 'envelope-completed') {
      return NextResponse.json({ received: true, processed: false, reason: 'Not a completion event' });
    }

    const envelope = payload.data.envelopeSummary;

    // Extract customer info from subject
    const { customerName, type } = extractCustomerInfo(envelope.emailSubject);

    // Send Slack notification
    const result = await notifyAcceptanceSigned({
      customerName,
      type,
      signedDate: envelope.completedDateTime || new Date().toISOString(),
      envelopeId: payload.data.envelopeId,
    });

    if (!result.success) {
      console.error('Failed to send Slack notification:', result.error);
      // Still return 200 to DocuSign so it doesn't retry
      return NextResponse.json({
        received: true,
        processed: true,
        slackSent: false,
        error: result.error,
      });
    }

    console.log('Slack notification sent for:', customerName);

    return NextResponse.json({
      received: true,
      processed: true,
      slackSent: true,
      customerName,
      type,
    });

  } catch (error) {
    console.error('DocuSign webhook error:', error);
    // Return 200 anyway to prevent DocuSign from retrying
    return NextResponse.json({
      received: true,
      processed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// DocuSign may send GET requests to verify the endpoint
export async function GET() {
  return NextResponse.json({
    status: 'active',
    message: 'DocuSign webhook endpoint is ready',
  });
}
