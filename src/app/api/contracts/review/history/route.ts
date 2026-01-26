import { NextRequest, NextResponse } from 'next/server';
import {
  getContractReviews,
  createContractReview,
  deleteContractReview,
  ContractReview,
} from '@/lib/supabase';
import { uploadToOneDrive, isGraphConfigured, OneDriveUploadResult } from '@/lib/microsoft-graph';

/**
 * GET /api/contracts/review/history
 * Get all contract review history with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get('contractId') || undefined;
    const status = searchParams.get('status') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;

    let reviews;
    try {
      reviews = await getContractReviews({ contractId, status, limit });
    } catch (dbError) {
      // Table might not exist yet
      console.error('Database error (table may not exist):', dbError);
      return NextResponse.json({
        history: [],
        tableExists: false,
        message: 'contract_reviews table does not exist. Please run migration.'
      });
    }

    // Transform to match the frontend ReviewHistory interface
    const history = reviews.map(review => ({
      id: review.id,
      contractId: review.contract_id || '',
      contractName: review.contract_name || '',
      provisionName: review.provision_name,
      createdAt: review.created_at,
      status: review.status,
      // Include full review data for when user clicks to view
      originalText: review.original_text,
      redlinedText: review.redlined_text,
      modifiedText: review.modified_text,
      summary: review.summary,
    }));

    return NextResponse.json({ history });
  } catch (error) {
    console.error('Error fetching review history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch review history' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/contracts/review/history
 * Create a new contract review record
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      contractId,
      contractName,
      provisionName,
      originalText,
      redlinedText,
      modifiedText,
      summary,
      status = 'draft',
      documentFile, // Base64 encoded document file
    } = body;

    if (!provisionName || !originalText || !redlinedText) {
      return NextResponse.json(
        { error: 'Missing required fields: provisionName, originalText, redlinedText' },
        { status: 400 }
      );
    }

    // Handle OneDrive upload if document file is provided
    let onedriveInfo: OneDriveUploadResult | null = null;

    if (documentFile && isGraphConfigured()) {
      try {
        // Create a sanitized filename from provision name
        const sanitizedName = provisionName.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
        const timestamp = Date.now();
        const fileName = `${sanitizedName}_${timestamp}.docx`;

        // Convert base64 to buffer
        const fileBuffer = Buffer.from(documentFile, 'base64');

        // Upload to OneDrive
        onedriveInfo = await uploadToOneDrive(fileName, fileBuffer);
        console.log('Document uploaded to OneDrive:', onedriveInfo.fileId);
      } catch (uploadError) {
        // Log the error but continue - OneDrive upload is optional
        console.error('OneDrive upload failed (continuing without it):', uploadError);
      }
    } else if (documentFile && !isGraphConfigured()) {
      console.log('Document file provided but Microsoft Graph not configured - skipping OneDrive upload');
    }

    const review: Omit<ContractReview, 'id' | 'created_at' | 'updated_at'> = {
      contract_id: contractId || null,
      contract_name: contractName || null,
      provision_name: provisionName,
      original_text: originalText,
      redlined_text: redlinedText,
      modified_text: modifiedText || null,
      summary: summary || [],
      status,
      // OneDrive integration fields
      onedrive_file_id: onedriveInfo?.fileId || undefined,
      onedrive_web_url: onedriveInfo?.webUrl || undefined,
      onedrive_embed_url: onedriveInfo?.embedUrl || undefined,
      document_versions: onedriveInfo
        ? [{ version: 1, savedAt: new Date().toISOString(), fileId: onedriveInfo.fileId }]
        : undefined,
    };

    let created;
    try {
      created = await createContractReview(review);
    } catch (dbError) {
      console.error('Database error creating review:', dbError);
      return NextResponse.json(
        { error: dbError instanceof Error ? dbError.message : 'Database error' },
        { status: 500 }
      );
    }

    if (!created) {
      return NextResponse.json(
        { error: 'Failed to create review record - no data returned' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      review: {
        id: created.id,
        contractId: created.contract_id,
        contractName: created.contract_name,
        provisionName: created.provision_name,
        createdAt: created.created_at,
        status: created.status,
        onedriveFileId: created.onedrive_file_id,
        onedriveEmbedUrl: created.onedrive_embed_url,
      },
    });
  } catch (error) {
    console.error('Error creating review record:', error);
    return NextResponse.json(
      { error: 'Failed to create review record' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/contracts/review/history
 * Delete a contract review record
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reviewId = searchParams.get('id');

    if (!reviewId) {
      return NextResponse.json(
        { error: 'Missing required parameter: id' },
        { status: 400 }
      );
    }

    const success = await deleteContractReview(reviewId);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete review record' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting review record:', error);
    return NextResponse.json(
      { error: 'Failed to delete review record' },
      { status: 500 }
    );
  }
}
