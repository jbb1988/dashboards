import { NextRequest, NextResponse } from 'next/server';
import {
  getContractReviews,
  createContractReview,
  deleteContractReview,
  ContractReview,
} from '@/lib/supabase';
import DiffMatchPatch from 'diff-match-patch';
import JSZip from 'jszip';

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
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Extract text content from Word XML runs (<w:r> elements containing <w:t> text)
 */
function extractTextFromRuns(xml: string): string {
  const textMatches = xml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
  return textMatches
    .map(match => {
      const textMatch = match.match(/<w:t[^>]*>([^<]*)<\/w:t>/);
      return textMatch ? textMatch[1] : '';
    })
    .join('');
}

/**
 * Process a paragraph's XML to extract text with tracked changes
 * Returns HTML with <del> and <ins> tags for tracked changes
 */
function processParagraphWithTrackedChanges(paraXml: string): string {
  let result = '';

  // Process the paragraph sequentially to preserve order
  // Look for: <w:del>, <w:ins>, and regular <w:r> (runs)
  const regex = /<w:del\b[^>]*>([\s\S]*?)<\/w:del>|<w:ins\b[^>]*>([\s\S]*?)<\/w:ins>|<w:r\b(?![^>]*w:rsidDel)[^>]*>[\s\S]*?<\/w:r>/g;

  let match;
  while ((match = regex.exec(paraXml)) !== null) {
    if (match[0].startsWith('<w:del')) {
      // Deletion - wrap in <del> tag
      const deletedText = extractTextFromRuns(match[1]);
      if (deletedText) {
        result += `<del>${escapeHtml(deletedText)}</del>`;
      }
    } else if (match[0].startsWith('<w:ins')) {
      // Insertion - wrap in <ins> tag
      const insertedText = extractTextFromRuns(match[2]);
      if (insertedText) {
        result += `<ins>${escapeHtml(insertedText)}</ins>`;
      }
    } else {
      // Regular run
      const runText = extractTextFromRuns(match[0]);
      if (runText) {
        result += escapeHtml(runText);
      }
    }
  }

  return result;
}

/**
 * Extract text with tracked changes from a Word document (OOXML)
 * Parses the document.xml to find <w:del> and <w:ins> elements
 * Returns HTML with <del> and <ins> tags
 */
async function extractWithTrackedChanges(buffer: Buffer): Promise<{
  html: string;
  hasTrackedChanges: boolean;
}> {
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file('word/document.xml')?.async('string');

  if (!documentXml) {
    throw new Error('Invalid Word document - no document.xml found');
  }

  // Debug: Log raw OOXML info
  console.log('=== OOXML Extraction Debug ===');
  console.log('documentXml length:', documentXml.length);

  // Check if document has any tracked changes
  const hasDeletedContent = documentXml.includes('<w:del');
  const hasInsertedContent = documentXml.includes('<w:ins');
  const hasTrackedChanges = hasDeletedContent || hasInsertedContent;

  console.log('hasDeletedContent (<w:del):', hasDeletedContent);
  console.log('hasInsertedContent (<w:ins):', hasInsertedContent);

  // Find and log first w:del and w:ins elements if they exist
  const firstDelMatch = documentXml.match(/<w:del[^>]*>[\s\S]{0,200}/);
  const firstInsMatch = documentXml.match(/<w:ins[^>]*>[\s\S]{0,200}/);
  if (firstDelMatch) console.log('First w:del sample:', firstDelMatch[0]);
  if (firstInsMatch) console.log('First w:ins sample:', firstInsMatch[0]);

  let html = '';

  // Extract paragraphs from the document body
  const bodyMatch = documentXml.match(/<w:body[^>]*>([\s\S]*)<\/w:body>/);
  if (!bodyMatch) {
    return { html: '', hasTrackedChanges: false };
  }

  const bodyContent = bodyMatch[1];

  // Find all paragraphs
  const paragraphs = bodyContent.match(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g) || [];

  for (const para of paragraphs) {
    const paraHtml = processParagraphWithTrackedChanges(para);
    if (paraHtml.trim()) {
      html += paraHtml + '<br>';
    }
  }

  // Clean up consecutive <br> tags
  html = html.replace(/(<br>)+/g, '<br>').replace(/<br>$/, '');

  return { html, hasTrackedChanges };
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

    // Debug: Log OneDrive configuration status
    console.log('=== OneDrive Configuration Debug ===');
    console.log('documentFile received:', !!documentFile);
    console.log('documentFile length:', documentFile?.length || 0);
    console.log('isGraphConfigured function available:', !!isGraphConfigured);
    console.log('isGraphConfigured() returns:', isGraphConfigured ? isGraphConfigured() : 'N/A');
    console.log('uploadToOneDrive function available:', !!uploadToOneDrive);

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
        console.log('Attempting OneDrive upload with filename:', fileName, 'buffer size:', fileBuffer.length);
        onedriveInfo = await uploadToOneDrive(fileName, fileBuffer);
        console.log('OneDrive upload SUCCESS:', JSON.stringify(onedriveInfo, null, 2));
      } catch (uploadError) {
        // Log the error but continue - OneDrive upload is optional
        console.error('OneDrive upload failed (continuing without it):', uploadError);
      }
    } else if (documentFile) {
      console.log('Document file provided but Microsoft Graph not configured - skipping OneDrive upload');
    }

    // Generate redline HTML
    // Priority: 1. Extract from document OOXML (preserves Word's tracked changes)
    //           2. Generate diff from original vs modified text
    //           3. Use provided redlinedText as fallback
    let redlineHtml = redlinedText;

    // Try to extract tracked changes from the document file (if provided)
    console.log('=== History API POST ===');
    console.log('documentFile provided:', !!documentFile);
    console.log('documentFile length:', documentFile?.length || 0);

    if (documentFile) {
      try {
        const fileBuffer = Buffer.from(documentFile, 'base64');
        console.log('fileBuffer length:', fileBuffer.length);
        const trackedChangesResult = await extractWithTrackedChanges(fileBuffer);

        const hasDel = trackedChangesResult.html.includes('<del>');
        const hasIns = trackedChangesResult.html.includes('<ins>');

        console.log('OOXML extraction result - hasDel:', hasDel, 'hasIns:', hasIns);

        // Only use OOXML if it has BOTH deletions and insertions
        // (Office JS API often only records insertions, not deletions)
        if (hasDel && hasIns && trackedChangesResult.html) {
          // Document has proper tracked changes - use the OOXML-extracted HTML
          redlineHtml = trackedChangesResult.html;
          console.log('Using tracked changes from document OOXML (has both del and ins)');
        } else if (hasIns && !hasDel) {
          // Only insertions - Office JS API limitation, use diff instead
          console.log('OOXML has insertions but no deletions - using diff instead');
        } else {
          console.log('No tracked changes in document, falling back to diff');
        }
      } catch (extractError) {
        console.log('OOXML extraction failed, falling back to diff:', extractError);
      }
    }

    // If we didn't get tracked changes from OOXML, generate diff from text
    if (!redlineHtml.includes('<del>') && !redlineHtml.includes('<ins>')) {
      if (originalText && modifiedText && originalText !== modifiedText) {
        try {
          redlineHtml = generateRedlineHtml(originalText, modifiedText);
          console.log('Generated redline from diff');
          console.log('redlineHtml has <del>:', redlineHtml.includes('<del>'));
          console.log('redlineHtml has <ins>:', redlineHtml.includes('<ins>'));
        } catch (diffError) {
          console.error('Failed to generate redline HTML:', diffError);
          redlineHtml = redlinedText;
        }
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
