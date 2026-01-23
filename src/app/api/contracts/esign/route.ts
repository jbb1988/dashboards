import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/apiAuth';
import { createEnvelope, isDocuSignConfigured } from '@/lib/docusign';

// POST: Create a DocuSign envelope for a contract
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if DocuSign is configured
    if (!isDocuSignConfigured()) {
      return NextResponse.json(
        { error: 'DocuSign is not configured. Please set up DocuSign credentials.' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const {
      contract_review_id,
      contract_name,
      document_content,
      document_name,
      signers,
      carbon_copies,
      email_subject,
      email_body,
    } = body;

    // Validate required fields
    if (!document_content) {
      return NextResponse.json(
        { error: 'Document content is required' },
        { status: 400 }
      );
    }
    if (!signers || signers.length === 0) {
      return NextResponse.json(
        { error: 'At least one signer is required' },
        { status: 400 }
      );
    }

    // Build webhook URL for status updates
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://mars-contracts.vercel.app';
    const webhookUrl = `${appUrl}/api/contracts/esign/webhook`;

    // Create the envelope
    const envelopeResult = await createEnvelope(
      [
        {
          content: document_content, // Assume base64 encoded
          name: document_name || `${contract_name || 'Contract'}.pdf`,
          extension: 'pdf',
        },
      ],
      signers.map((s: { email: string; name: string }, i: number) => ({
        email: s.email,
        name: s.name,
        order: i + 1,
      })),
      {
        emailSubject: email_subject || `Please sign: ${contract_name || 'Contract Document'}`,
        emailBody: email_body || 'Please review and sign the attached document.',
        webhookUrl,
        carbonCopies: carbon_copies,
        sendImmediately: true,
      }
    );

    const admin = getSupabaseAdmin();

    // Store the envelope tracking record
    const { error: insertError } = await admin
      .from('docusign_envelopes')
      .insert({
        envelope_id: envelopeResult.envelopeId,
        contract_review_id: contract_review_id || null,
        contract_name: contract_name || document_name,
        status: 'sent',
        signers: signers,
        carbon_copies: carbon_copies || [],
        sent_by: user.email,
        sent_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('Failed to store envelope tracking:', insertError);
      // Don't fail - envelope was created successfully
    }

    // Update contract review status if linked
    if (contract_review_id) {
      await admin
        .from('contract_reviews')
        .update({
          esign_status: 'sent',
          esign_envelope_id: envelopeResult.envelopeId,
          esign_sent_at: new Date().toISOString(),
        })
        .eq('id', contract_review_id);
    }

    return NextResponse.json({
      success: true,
      envelopeId: envelopeResult.envelopeId,
      status: envelopeResult.status,
    });
  } catch (error) {
    console.error('Error creating DocuSign envelope:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create envelope' },
      { status: 500 }
    );
  }
}

// GET: Get e-sign status for a contract
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const contractReviewId = searchParams.get('contract_review_id');
    const envelopeId = searchParams.get('envelope_id');

    if (!contractReviewId && !envelopeId) {
      return NextResponse.json(
        { error: 'Either contract_review_id or envelope_id is required' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    let query = admin.from('docusign_envelopes').select('*');

    if (envelopeId) {
      query = query.eq('envelope_id', envelopeId);
    } else if (contractReviewId) {
      query = query.eq('contract_review_id', contractReviewId);
    }

    const { data: envelope, error } = await query.maybeSingle();

    if (error) {
      console.error('Failed to fetch envelope status:', error);
      return NextResponse.json(
        { error: 'Failed to fetch status' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      envelope: envelope || null,
    });
  } catch (error) {
    console.error('Error fetching e-sign status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
