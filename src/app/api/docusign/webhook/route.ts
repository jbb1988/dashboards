import { NextRequest, NextResponse } from 'next/server';
import { notifyAcceptanceSignedWithDocument, isSlackFileUploadConfigured } from '@/lib/slack';
import { getDocumentDownload, isDocuSignConfigured } from '@/lib/docusign';
import { uploadDocuSignDocument, saveDocuSignDocumentRecord } from '@/lib/supabase';

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
    const envelopeId = payload.data.envelopeId;

    // Extract customer info from subject
    const { customerName, type } = extractCustomerInfo(envelope.emailSubject);
    const signedDate = envelope.completedDateTime || new Date().toISOString();

    // Track results for response
    let documentBuffer: Buffer | undefined;
    let supabaseStored = false;
    let supabaseDocId: string | undefined;
    let supabaseUrl: string | undefined;

    // Step 1: Fetch the signed document from DocuSign
    const docuSignConfigured = isDocuSignConfigured();
    console.log('[DocuSign Webhook] Configuration check:', {
      isDocuSignConfigured: docuSignConfigured,
      hasUserId: !!process.env.DOCUSIGN_USER_ID,
      hasIntegrationKey: !!process.env.DOCUSIGN_INTEGRATION_KEY,
      hasPrivateKey: !!process.env.DOCUSIGN_PRIVATE_KEY,
      hasAccountId: !!process.env.DOCUSIGN_ACCOUNT_ID,
    });

    if (docuSignConfigured) {
      try {
        console.log('[DocuSign Webhook] Fetching signed document for envelope:', envelopeId);
        documentBuffer = await getDocumentDownload(envelopeId, 'combined');
        console.log('[DocuSign Webhook] Document fetched successfully, size:', documentBuffer.length);
      } catch (error) {
        console.error('[DocuSign Webhook] Failed to fetch document from DocuSign:', error);
        // Continue without document
      }
    } else {
      console.warn('[DocuSign Webhook] DocuSign not configured - skipping document fetch');
    }

    // Step 2: Store document in Supabase (always, as backup and audit trail)
    console.log('[DocuSign Webhook] Document buffer status before Supabase:', {
      hasBuffer: !!documentBuffer,
      bufferSize: documentBuffer?.length || 0,
    });

    if (documentBuffer) {
      try {
        console.log('[DocuSign Webhook] Storing document in Supabase for:', customerName);
        const { path, url } = await uploadDocuSignDocument({
          buffer: documentBuffer,
          customerName,
          type,
          envelopeId,
        });
        supabaseUrl = url;
        console.log('[DocuSign Webhook] Document stored in Supabase:', path);

        // Step 3: Save metadata to database
        const record = await saveDocuSignDocumentRecord({
          customerName,
          type,
          envelopeId,
          storagePath: path,
          storageUrl: url,
          signedDate,
          fileSize: documentBuffer.length,
        });

        if (record) {
          supabaseDocId = record.id;
          supabaseStored = true;
          console.log('[DocuSign Webhook] Document metadata saved, ID:', record.id);
        }
      } catch (error) {
        console.error('[DocuSign Webhook] Failed to store document in Supabase:', error);
        // Continue to Slack notification - document still in memory
      }
    } else {
      console.warn('[DocuSign Webhook] No document buffer available - skipping Supabase storage');
    }

    // Step 4: Send Slack notification with document attachment
    console.log('[DocuSign Webhook] Sending Slack notification:', {
      customerName,
      type,
      envelopeId,
      hasDocumentBuffer: !!documentBuffer,
      documentBufferSize: documentBuffer?.length || 0,
    });

    const result = await notifyAcceptanceSignedWithDocument({
      customerName,
      type,
      signedDate,
      envelopeId,
      documentBuffer,
    });

    console.log('[DocuSign Webhook] Slack notification result:', result);

    if (!result.success) {
      console.error('Failed to send Slack notification:', result.error);
      // Still return 200 to DocuSign so it doesn't retry
      return NextResponse.json({
        received: true,
        processed: true,
        supabaseStored,
        supabaseDocId,
        slackSent: false,
        error: result.error,
      });
    }

    console.log('Processing complete for:', customerName, {
      supabaseStored,
      slackSent: true,
      documentAttached: result.fileUploaded,
    });

    return NextResponse.json({
      received: true,
      processed: true,
      supabaseStored,
      supabaseDocId,
      supabaseUrl,
      slackSent: true,
      documentAttached: result.fileUploaded,
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
