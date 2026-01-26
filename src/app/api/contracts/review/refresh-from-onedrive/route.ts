import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import DiffMatchPatch from 'diff-match-patch';

// Dynamic import for Microsoft Graph
let getFileInfo: ((fileId: string) => Promise<{ downloadUrl: string }>) | null = null;

try {
  const graphModule = require('@/lib/microsoft-graph');
  getFileInfo = graphModule.getFileInfo;
} catch {
  console.log('Microsoft Graph module not available');
}

/**
 * Extract text from a .docx file buffer
 * .docx files are ZIP archives containing XML
 */
async function extractTextFromDocx(buffer: ArrayBuffer): Promise<string> {
  // Use dynamic import for mammoth (docx to text converter)
  const mammoth = await import('mammoth');

  const result = await mammoth.extractRawText({
    buffer: Buffer.from(buffer)
  });

  return result.value;
}

/**
 * Generate HTML with redline markup from original and modified text
 */
function generateRedlineHtml(originalText: string, modifiedText: string): string {
  const dmp = new DiffMatchPatch();

  const normalizedOriginal = originalText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  const normalizedModified = modifiedText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

  const diffs = dmp.diff_main(normalizedOriginal, normalizedModified);
  dmp.diff_cleanupSemantic(diffs);

  let html = '';
  for (const [op, text] of diffs) {
    const escapedText = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');

    if (op === 0) {
      html += escapedText;
    } else if (op === -1) {
      html += `<del>${escapedText}</del>`;
    } else {
      html += `<ins>${escapedText}</ins>`;
    }
  }

  return html;
}

export async function POST(request: NextRequest) {
  try {
    const { reviewId } = await request.json();

    if (!reviewId) {
      return NextResponse.json(
        { error: 'reviewId is required' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    // Get the review
    const { data: review, error: fetchError } = await admin
      .from('contract_reviews')
      .select('id, original_text, onedrive_file_id, onedrive_web_url')
      .eq('id', reviewId)
      .single();

    if (fetchError || !review) {
      return NextResponse.json(
        { error: 'Review not found' },
        { status: 404 }
      );
    }

    if (!review.onedrive_file_id) {
      return NextResponse.json(
        { error: 'No OneDrive document linked to this review' },
        { status: 400 }
      );
    }

    if (!review.original_text) {
      return NextResponse.json(
        { error: 'No original text found for this review' },
        { status: 400 }
      );
    }

    if (!getFileInfo) {
      return NextResponse.json(
        { error: 'Microsoft Graph not configured' },
        { status: 500 }
      );
    }

    // Get the download URL from OneDrive
    let fileInfo;
    try {
      fileInfo = await getFileInfo(review.onedrive_file_id);
      console.log('File info retrieved:', {
        name: fileInfo?.name,
        hasDownloadUrl: !!fileInfo?.downloadUrl
      });
    } catch (graphError) {
      console.error('Graph API error:', graphError);
      return NextResponse.json(
        { error: `Failed to get file info: ${graphError instanceof Error ? graphError.message : 'Unknown error'}` },
        { status: 500 }
      );
    }

    if (!fileInfo || !fileInfo.downloadUrl) {
      return NextResponse.json(
        { error: 'Could not get download URL from OneDrive. The file may have been moved or deleted.' },
        { status: 500 }
      );
    }

    // Download the file
    const response = await fetch(fileInfo.downloadUrl);
    if (!response.ok) {
      console.error('Download failed:', response.status, response.statusText);
      throw new Error(`Failed to download file from OneDrive: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();

    // Extract text from the Word document
    const extractedText = await extractTextFromDocx(buffer);

    // Generate new redline HTML comparing original with the updated document
    const newRedlineHtml = generateRedlineHtml(review.original_text, extractedText);

    // Update the review with the new content
    const { error: updateError } = await admin
      .from('contract_reviews')
      .update({
        redlined_text: newRedlineHtml,
        modified_text: extractedText,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reviewId);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      message: 'Document refreshed from OneDrive',
      redlinedText: newRedlineHtml,
    });

  } catch (error) {
    console.error('Error refreshing from OneDrive:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to refresh from OneDrive' },
      { status: 500 }
    );
  }
}
