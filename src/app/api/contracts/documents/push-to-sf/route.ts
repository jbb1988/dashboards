import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  getAccountIdFromOpportunity,
  uploadFileToAccount,
} from '@/lib/salesforce';

/**
 * POST /api/contracts/documents/push-to-sf
 * Push a document to Salesforce Files, linked to the Account
 *
 * Body: { documentId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { documentId } = body;

    if (!documentId) {
      return NextResponse.json(
        { error: 'documentId is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // 1. Fetch document metadata from Supabase
    const { data: document, error: fetchError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (fetchError || !document) {
      return NextResponse.json(
        { error: 'Document not found', details: fetchError?.message },
        { status: 404 }
      );
    }

    // Check if already synced
    if (document.sf_content_document_id) {
      return NextResponse.json(
        {
          error: 'Document already synced to Salesforce',
          sf_content_document_id: document.sf_content_document_id,
          sf_synced_at: document.sf_synced_at,
        },
        { status: 409 }
      );
    }

    // Get the Salesforce Opportunity ID
    const opportunityId = document.salesforce_id;
    if (!opportunityId) {
      return NextResponse.json(
        { error: 'Document has no associated Salesforce Opportunity' },
        { status: 400 }
      );
    }

    // 2. Get AccountId from the Opportunity
    const accountId = await getAccountIdFromOpportunity(opportunityId);
    if (!accountId) {
      return NextResponse.json(
        { error: 'Could not find Account for this Opportunity in Salesforce' },
        { status: 400 }
      );
    }

    // 3. Download file from Supabase storage
    const fileUrl = document.file_url;
    if (!fileUrl) {
      return NextResponse.json(
        { error: 'Document has no file URL' },
        { status: 400 }
      );
    }

    // Extract storage path from the URL
    // URL format: https://xxx.supabase.co/storage/v1/object/public/data-files/uploads/filename
    // or signed URL: https://xxx.supabase.co/storage/v1/object/sign/data-files/uploads/filename?token=...
    let storagePath: string;
    try {
      const url = new URL(fileUrl);
      const pathMatch = url.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/data-files\/(.+)/);
      if (pathMatch) {
        storagePath = pathMatch[1];
      } else {
        // Try to extract from direct path
        storagePath = fileUrl.split('/data-files/')[1]?.split('?')[0] || '';
      }
    } catch {
      storagePath = fileUrl;
    }

    if (!storagePath) {
      return NextResponse.json(
        { error: 'Could not parse file storage path' },
        { status: 400 }
      );
    }

    // Download the file from Supabase storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('data-files')
      .download(storagePath);

    if (downloadError || !fileData) {
      return NextResponse.json(
        { error: 'Failed to download file from storage', details: downloadError?.message },
        { status: 500 }
      );
    }

    // Convert Blob to Buffer
    const arrayBuffer = await fileData.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // 4. Upload to Salesforce and link to Account
    const fileName = document.file_name || storagePath.split('/').pop() || 'document';
    const title = `${document.document_type} - ${document.account_name || 'Unknown'}`;

    const result = await uploadFileToAccount(
      fileBuffer,
      fileName,
      accountId,
      title
    );

    if (!result.success) {
      // Update document with error
      await supabase
        .from('documents')
        .update({
          sf_sync_error: result.errors?.join(', ') || 'Unknown error',
          updated_at: new Date().toISOString(),
        })
        .eq('id', documentId);

      return NextResponse.json(
        { error: 'Failed to upload to Salesforce', details: result.errors },
        { status: 500 }
      );
    }

    // 5. Update document metadata with SF ContentDocumentId
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        sf_content_document_id: result.contentDocumentId,
        sf_synced_at: new Date().toISOString(),
        sf_sync_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    if (updateError) {
      console.error('Failed to update document metadata:', updateError);
      // Don't fail the request - SF upload succeeded
    }

    return NextResponse.json({
      success: true,
      message: 'Document pushed to Salesforce successfully',
      contentVersionId: result.contentVersionId,
      contentDocumentId: result.contentDocumentId,
      contentDocumentLinkId: result.contentDocumentLinkId,
      accountId,
    });
  } catch (error) {
    console.error('Error pushing document to Salesforce:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
