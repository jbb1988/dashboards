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

    // 2b. Check if this contract is part of a bundle
    // If bundled, use the bundle name for the file title instead of individual opportunity name
    let bundleName: string | null = null;
    const contractId = document.contract_id || document.salesforce_id;
    if (contractId) {
      try {
        const { data: bundleContract } = await supabase
          .from('bundle_contracts')
          .select(`
            bundle_id,
            contract_bundles (
              name
            )
          `)
          .eq('contract_id', contractId)
          .single();

        if (bundleContract?.contract_bundles) {
          // Supabase returns the joined record as an object (not array) for single relations
          const bundle = bundleContract.contract_bundles as unknown as { name: string } | null;
          if (bundle?.name) {
            bundleName = bundle.name;
          }
        }
      } catch {
        // Not part of a bundle or bundle tables don't exist - continue with opportunity name
      }
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
    // Use bundle name if contract is bundled, otherwise use opportunity name
    const contractOrBundleName = bundleName || document.opportunity_name || document.account_name || 'Unknown';
    const title = `${document.document_type} - ${contractOrBundleName}`;

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
