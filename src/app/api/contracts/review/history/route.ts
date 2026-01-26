import { NextRequest, NextResponse } from 'next/server';
import {
  getContractReviews,
  createContractReview,
  deleteContractReview,
  ContractReview,
} from '@/lib/supabase';
import DiffMatchPatch from 'diff-match-patch';

// Dynamic import to avoid build issues if Graph SDK isn't configured
let uploadToOneDrive: ((fileName: string, fileContent: Buffer) => Promise<{ fileId: string; webUrl: string; embedUrl: string }>) | null = null;
let isGraphConfigured: (() => boolean) | null = null;

try {
  const graphModule = require('@/lib/microsoft-graph');
  uploadToOneDrive = graphModule.uploadToOneDrive;
  isGraphConfigured = graphModule.isGraphConfigured;
} catch {
  console.log('Microsoft Graph module not available - OneDrive integration disabled');
}

/**
 * Generate HTML with redline markup from original and modified text
 * Uses diff-match-patch for word-level comparison
 */
function generateRedlineHtml(originalText: string, modifiedText: string): string {
  const dmp = new DiffMatchPatch();

  // Normalize text
  const normalizedOriginal = originalText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  const normalizedModified = modifiedText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

  // Get diffs
  const diffs = dmp.diff_main(normalizedOriginal, normalizedModified);
  dmp.diff_cleanupSemantic(diffs);

  // Convert to HTML with del/ins tags
  let html = '';
  for (const [op, text] of diffs) {
    // Escape HTML entities
    const escapedText = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');

    if (op === 0) {
      // Equal - no markup
      html += escapedText;
    } else if (op === -1) {
      // Deletion - red strikethrough
      html += `<del>${escapedText}</del>`;
    } else {
      // Insertion - green underline
      html += `<ins>${escapedText}</ins>`;
    }
  }

  return html;
}

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
    let onedriveInfo: { fileId: string; webUrl: string; embedUrl: string } | null = null;

    if (documentFile && isGraphConfigured && isGraphConfigured() && uploadToOneDrive) {
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
    } else if (documentFile) {
      console.log('Document file provided but Microsoft Graph not configured - skipping OneDrive upload');
    }

    // Generate redline HTML if we have both original and modified text
    let redlineHtml = redlinedText;
    if (originalText && modifiedText && originalText !== modifiedText) {
      try {
        redlineHtml = generateRedlineHtml(originalText, modifiedText);
      } catch (diffError) {
        console.error('Failed to generate redline HTML:', diffError);
        // Fall back to plain text
        redlineHtml = redlinedText;
      }
    }

    const review: Omit<ContractReview, 'id' | 'created_at' | 'updated_at'> = {
      contract_id: contractId || null,
      contract_name: contractName || null,
      provision_name: provisionName,
      original_text: originalText,
      redlined_text: redlineHtml,
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
