import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// Route segment config for App Router
export const maxDuration = 60; // Allow longer execution for conversion
export const dynamic = 'force-dynamic';

const ASPOSE_CLIENT_ID = process.env.ASPOSE_CLIENT_ID;
const ASPOSE_CLIENT_SECRET = process.env.ASPOSE_CLIENT_SECRET;

// Cache token with expiry
let cachedToken: { token: string; expires: number } | null = null;

/**
 * Get OAuth token from Aspose Cloud
 */
async function getAsposeToken(): Promise<string> {
  if (cachedToken && cachedToken.expires > Date.now() + 300000) {
    return cachedToken.token;
  }

  if (!ASPOSE_CLIENT_ID || !ASPOSE_CLIENT_SECRET) {
    throw new Error('Aspose Cloud credentials not configured.');
  }

  const response = await fetch('https://api.aspose.cloud/connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=client_credentials&client_id=${ASPOSE_CLIENT_ID}&client_secret=${ASPOSE_CLIENT_SECRET}`,
  });

  if (!response.ok) {
    throw new Error('Failed to authenticate with Aspose Cloud');
  }

  const data = await response.json();
  cachedToken = {
    token: data.access_token,
    expires: Date.now() + (data.expires_in || 3600) * 1000,
  };

  return data.access_token;
}

/**
 * Helper to clean up uploaded files from Aspose storage
 */
async function cleanupAsposeFile(token: string, filename: string): Promise<void> {
  await fetch(
    `https://api.aspose.cloud/v4.0/words/storage/file/${encodeURIComponent(filename)}`,
    {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    }
  ).catch(() => {}); // Ignore cleanup errors
}

/**
 * Convert DOCX to PDF with tracked changes visible using Aspose.Words Cloud API
 */
async function convertDocxToPdfWithTrackedChanges(buffer: Buffer): Promise<Buffer> {
  const token = await getAsposeToken();
  const filename = `convert-${Date.now()}.docx`;

  console.log('Uploading DOCX to Aspose Cloud...');

  // Upload to Aspose storage
  const uploadResponse = await fetch(
    `https://api.aspose.cloud/v4.0/words/storage/file/${encodeURIComponent(filename)}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
      },
      body: new Uint8Array(buffer),
    }
  );

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text().catch(() => 'Unknown error');
    console.error(`Aspose upload failed (${uploadResponse.status}): ${errorText}`);
    throw new Error(`Failed to upload document: ${uploadResponse.status}`);
  }

  console.log('Aspose upload successful, converting to PDF with tracked changes...');

  // Convert to PDF with tracked changes visible
  // The loadEncoding=Track parameter tells Aspose to render tracked changes
  const convertResponse = await fetch(
    `https://api.aspose.cloud/v4.0/words/${encodeURIComponent(filename)}?format=pdf&loadEncoding=Track`,
    {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
    }
  );

  if (!convertResponse.ok) {
    const errorText = await convertResponse.text().catch(() => 'Unknown error');
    console.error(`Aspose conversion failed (${convertResponse.status}): ${errorText}`);

    // Cleanup and throw
    await cleanupAsposeFile(token, filename);
    throw new Error(`Failed to convert document: ${convertResponse.status}`);
  }

  // Get the PDF as buffer
  const pdfArrayBuffer = await convertResponse.arrayBuffer();
  const pdfBuffer = Buffer.from(pdfArrayBuffer);

  console.log(`Conversion successful: ${pdfBuffer.length} bytes`);

  // Cleanup - delete from Aspose storage
  await cleanupAsposeFile(token, filename);

  return pdfBuffer;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const documentId = searchParams.get('documentId');
    const fileUrl = searchParams.get('fileUrl');

    if (!documentId && !fileUrl) {
      return NextResponse.json(
        { error: 'Missing documentId or fileUrl parameter' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Step 1: Check if we have a cached PDF
    let cachedPdfUrl: string | null = null;
    let originalFileUrl: string | null = fileUrl;
    let fileName = 'document';

    if (documentId) {
      // Get document info from database
      const { data: docData, error: docError } = await supabaseAdmin
        .from('documents')
        .select('file_url, file_name, converted_pdf_url')
        .eq('id', documentId)
        .single();

      if (docError || !docData) {
        console.error('Document lookup error:', docError);
        return NextResponse.json(
          { error: 'Document not found' },
          { status: 404 }
        );
      }

      originalFileUrl = docData.file_url;
      fileName = docData.file_name || 'document';
      cachedPdfUrl = docData.converted_pdf_url;

      // If we have a cached PDF URL, verify it still exists
      if (cachedPdfUrl) {
        console.log('Found cached PDF URL, verifying existence...');
        try {
          const checkResponse = await fetch(cachedPdfUrl, { method: 'HEAD' });
          if (checkResponse.ok) {
            console.log('Cached PDF exists, returning URL');
            return NextResponse.json({
              success: true,
              pdfUrl: cachedPdfUrl,
              cached: true,
            });
          } else {
            console.log('Cached PDF no longer exists, will reconvert');
            cachedPdfUrl = null;
          }
        } catch (error) {
          console.log('Error checking cached PDF, will reconvert:', error);
          cachedPdfUrl = null;
        }
      }
    }

    if (!originalFileUrl) {
      return NextResponse.json(
        { error: 'No file URL available' },
        { status: 400 }
      );
    }

    // Step 2: Download the original DOCX file
    console.log('Downloading original DOCX from Supabase...');
    const fileResponse = await fetch(originalFileUrl);
    if (!fileResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to download original document' },
        { status: 400 }
      );
    }

    const docxBuffer = Buffer.from(await fileResponse.arrayBuffer());
    console.log(`Downloaded ${docxBuffer.length} bytes`);

    // Step 3: Convert DOCX to PDF with tracked changes
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await convertDocxToPdfWithTrackedChanges(docxBuffer);
    } catch (conversionError) {
      console.error('Conversion error:', conversionError);
      return NextResponse.json({
        success: false,
        fallback: true,
        error: conversionError instanceof Error ? conversionError.message : 'Conversion failed',
      });
    }

    // Step 4: Upload converted PDF to Supabase storage cache
    const pdfFileName = documentId
      ? `${documentId}.pdf`
      : `${fileName.replace(/\.(docx?|doc)$/i, '')}-${Date.now()}.pdf`;
    const storagePath = `converted-pdfs/${pdfFileName}`;

    console.log(`Uploading converted PDF to Supabase: ${storagePath}`);
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('data-files')
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true, // Overwrite if exists
      });

    if (uploadError) {
      console.error('Failed to upload PDF to storage:', uploadError);
      // Still return success but without caching
      return NextResponse.json({
        success: true,
        pdfUrl: originalFileUrl, // Fallback to original
        cached: false,
        warning: 'Failed to cache converted PDF',
      });
    }

    // Get public URL for the cached PDF
    const { data: urlData } = supabaseAdmin.storage
      .from('data-files')
      .getPublicUrl(storagePath);

    const pdfUrl = urlData.publicUrl;

    // Step 5: Update database with cached PDF URL
    if (documentId) {
      await supabaseAdmin
        .from('documents')
        .update({ converted_pdf_url: pdfUrl })
        .eq('id', documentId);
    }

    console.log('Conversion complete, PDF cached at:', pdfUrl);

    return NextResponse.json({
      success: true,
      pdfUrl: pdfUrl,
      cached: false, // First time conversion
    });
  } catch (error) {
    console.error('Document conversion error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      success: false,
      fallback: true,
      error: `Failed to convert document: ${errorMessage}`,
    });
  }
}
