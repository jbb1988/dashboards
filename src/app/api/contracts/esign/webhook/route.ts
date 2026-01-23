import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getDocumentDownload } from '@/lib/docusign';

// POST: Handle DocuSign Connect webhook events
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();

    // Optionally verify webhook signature if HMAC key is configured
    const hmacKey = process.env.DOCUSIGN_WEBHOOK_HMAC_KEY;
    if (hmacKey) {
      const signature = request.headers.get('X-DocuSign-Signature-1');
      if (signature) {
        const { verifyWebhookSignature } = await import('@/lib/docusign');
        if (!verifyWebhookSignature(body, signature, hmacKey)) {
          console.error('DocuSign webhook signature verification failed');
          return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }
      }
    }

    const event = JSON.parse(body);

    // Handle different event types
    const envelopeStatus = event.envelopeStatus || event;
    const envelopeId = envelopeStatus?.envelopeId || event.envelopeId;
    const status = envelopeStatus?.status || event.status;

    if (!envelopeId) {
      console.error('DocuSign webhook: No envelope ID found in event');
      return NextResponse.json({ error: 'No envelope ID' }, { status: 400 });
    }

    console.log(`DocuSign webhook: Envelope ${envelopeId} status: ${status}`);

    const admin = getSupabaseAdmin();

    // Update envelope tracking
    const { data: existingEnvelope, error: fetchError } = await admin
      .from('docusign_envelopes')
      .select('*')
      .eq('envelope_id', envelopeId)
      .maybeSingle();

    if (fetchError) {
      console.error('Failed to fetch envelope:', fetchError);
    }

    // Build update data based on status
    const updateData: Record<string, unknown> = {
      status: status?.toLowerCase(),
      status_updated_at: new Date().toISOString(),
      last_webhook_event: event,
    };

    if (status === 'completed' || status === 'signed') {
      updateData.completed_at = new Date().toISOString();

      // Try to download signed document
      try {
        const signedDocument = await getDocumentDownload(envelopeId);
        // Store signed document (you might want to upload to storage)
        updateData.signed_document_downloaded = true;
        updateData.signed_document_size = signedDocument.length;
      } catch (downloadError) {
        console.error('Failed to download signed document:', downloadError);
      }
    } else if (status === 'declined') {
      updateData.declined_at = new Date().toISOString();
      updateData.declined_reason = envelopeStatus?.declinedReason || 'No reason provided';
    } else if (status === 'voided') {
      updateData.voided_at = new Date().toISOString();
      updateData.voided_reason = envelopeStatus?.voidedReason || 'No reason provided';
    } else if (status === 'delivered') {
      updateData.delivered_at = new Date().toISOString();
    }

    // Update or insert envelope record
    if (existingEnvelope) {
      const { error: updateError } = await admin
        .from('docusign_envelopes')
        .update(updateData)
        .eq('envelope_id', envelopeId);

      if (updateError) {
        console.error('Failed to update envelope:', updateError);
      }
    } else {
      // Create a new record if envelope wasn't found
      const { error: insertError } = await admin
        .from('docusign_envelopes')
        .insert({
          envelope_id: envelopeId,
          ...updateData,
        });

      if (insertError) {
        console.error('Failed to insert envelope:', insertError);
      }
    }

    // Update linked contract review if exists
    if (existingEnvelope?.contract_review_id) {
      const contractUpdateData: Record<string, unknown> = {
        esign_status: status?.toLowerCase(),
        esign_updated_at: new Date().toISOString(),
      };

      if (status === 'completed' || status === 'signed') {
        contractUpdateData.esign_completed_at = new Date().toISOString();
      }

      await admin
        .from('contract_reviews')
        .update(contractUpdateData)
        .eq('id', existingEnvelope.contract_review_id);

      // Extract obligations from completed contracts
      if (status === 'completed' || status === 'signed') {
        // Trigger obligation extraction (async, don't wait)
        fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/obligations/extract`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contract_review_id: existingEnvelope.contract_review_id,
            contract_name: existingEnvelope.contract_name,
          }),
        }).catch(err => console.error('Failed to trigger obligation extraction:', err));
      }
    }

    // Send notifications for important status changes
    if (['completed', 'declined', 'voided'].includes(status?.toLowerCase())) {
      // Could send email notifications here
      console.log(`DocuSign: Important status change - ${status} for envelope ${envelopeId}`);
    }

    return NextResponse.json({ success: true, processed: true });
  } catch (error) {
    console.error('DocuSign webhook error:', error);
    // Return 200 to prevent DocuSign from retrying
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Webhook processing failed',
    });
  }
}

// GET: Health check for webhook endpoint
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'DocuSign Connect Webhook',
    timestamp: new Date().toISOString(),
  });
}
