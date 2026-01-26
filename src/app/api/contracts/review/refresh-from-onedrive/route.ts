import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import DiffMatchPatch from 'diff-match-patch';
import JSZip from 'jszip';

// Dynamic import for Microsoft Graph
let getFileInfo: ((fileId: string) => Promise<{ downloadUrl: string }>) | null = null;
let getFileContent: ((fileId: string) => Promise<ArrayBuffer | null>) | null = null;

try {
  const graphModule = require('@/lib/microsoft-graph');
  getFileInfo = graphModule.getFileInfo;
  getFileContent = graphModule.getFileContent;
} catch {
  console.log('Microsoft Graph module not available');
}

/**
 * Extract text from a .docx file buffer (plain text, no formatting)
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

  // Create a regex to match tracked changes and regular runs
  // Order matters: match tracked changes first, then regular content
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
      // Regular run - check it's not inside a del/ins (already processed)
      // Also skip runs that are part of deletions (have w:rsidDel attribute)
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
async function extractWithTrackedChanges(buffer: ArrayBuffer): Promise<{
  html: string;
  hasTrackedChanges: boolean;
}> {
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file('word/document.xml')?.async('string');

  if (!documentXml) {
    throw new Error('Invalid Word document - no document.xml found');
  }

  // Check if document has any tracked changes
  const hasDeletedContent = documentXml.includes('<w:del');
  const hasInsertedContent = documentXml.includes('<w:ins');
  const hasTrackedChanges = hasDeletedContent || hasInsertedContent;

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

    let buffer: ArrayBuffer | null = null;

    // Try to get download URL first (faster for large files)
    try {
      const fileInfo = await getFileInfo(review.onedrive_file_id);
      console.log('File info retrieved, hasDownloadUrl:', !!fileInfo?.downloadUrl);

      if (fileInfo?.downloadUrl) {
        try {
          const response = await fetch(fileInfo.downloadUrl);
          if (response.ok) {
            buffer = await response.arrayBuffer();
            console.log('Downloaded file via downloadUrl');
          } else {
            console.log('Download via downloadUrl failed:', response.status);
          }
        } catch (fetchError) {
          console.log('Fetch via downloadUrl failed, trying fallback');
        }
      }
    } catch (graphError) {
      console.log('getFileInfo failed, trying fallback:', graphError);
    }

    // Fallback: Use direct content endpoint if downloadUrl failed
    if (!buffer && getFileContent) {
      try {
        buffer = await getFileContent(review.onedrive_file_id);
        if (buffer) {
          console.log('Downloaded file via /content endpoint fallback');
        }
      } catch (contentError) {
        console.error('Content endpoint fallback failed:', contentError);
      }
    }

    if (!buffer) {
      return NextResponse.json(
        { error: 'Failed to download file from OneDrive. The file may have been moved, deleted, or access has been revoked.' },
        { status: 500 }
      );
    }

    // First, try to extract tracked changes from OOXML (preserves strikethroughs/insertions)
    let newRedlineHtml: string;
    let extractedText: string;

    try {
      const trackedChangesResult = await extractWithTrackedChanges(buffer);

      if (trackedChangesResult.hasTrackedChanges && trackedChangesResult.html) {
        // Use tracked changes HTML directly - this preserves the actual Word revisions
        newRedlineHtml = trackedChangesResult.html;
        console.log('Using tracked changes from Word document');

        // Also extract plain text for modified_text field (for display/search)
        extractedText = await extractTextFromDocx(buffer);
      } else {
        // No tracked changes - fall back to diff-match-patch comparison
        console.log('No tracked changes found, using diff-match-patch fallback');
        extractedText = await extractTextFromDocx(buffer);
        newRedlineHtml = generateRedlineHtml(review.original_text, extractedText);
      }
    } catch (ooxmlError) {
      // OOXML parsing failed - fall back to diff-match-patch
      console.log('OOXML parsing failed, using diff-match-patch fallback:', ooxmlError);
      extractedText = await extractTextFromDocx(buffer);
      newRedlineHtml = generateRedlineHtml(review.original_text, extractedText);
    }

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
