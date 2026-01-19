import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// Aspose Cloud API credentials
const ASPOSE_CLIENT_ID = process.env.ASPOSE_CLIENT_ID;
const ASPOSE_CLIENT_SECRET = process.env.ASPOSE_CLIENT_SECRET;

// Token cache
let asposeTokenCache: { token: string; expires: number } | null = null;

async function getAsposeToken(): Promise<string> {
  // Return cached token if still valid
  if (asposeTokenCache && asposeTokenCache.expires > Date.now()) {
    return asposeTokenCache.token;
  }

  // Get new token
  const response = await fetch('https://api.aspose.cloud/connect/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: ASPOSE_CLIENT_ID!,
      client_secret: ASPOSE_CLIENT_SECRET!,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to get Aspose token');
  }

  const data = await response.json();

  // Cache token (expires in 1 hour, we cache for 50 minutes to be safe)
  asposeTokenCache = {
    token: data.access_token,
    expires: Date.now() + 50 * 60 * 1000,
  };

  return data.access_token;
}

export async function POST(request: NextRequest) {
  try {
    const { documentId, fileUrl, fileName } = await request.json();

    if (!documentId || !fileUrl) {
      return NextResponse.json(
        { error: 'Missing documentId or fileUrl' },
        { status: 400 }
      );
    }

    // Check if credentials are configured
    if (!ASPOSE_CLIENT_ID || !ASPOSE_CLIENT_SECRET) {
      console.warn('Aspose credentials not configured');
      return NextResponse.json(
        { error: 'Conversion service not configured', fallback: true },
        { status: 503 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Check for cached converted PDF
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('converted_pdf_url')
      .eq('id', documentId)
      .single();

    if (!docError && doc?.converted_pdf_url) {
      console.log('Returning cached PDF for document', documentId);
      return NextResponse.json({ pdfUrl: doc.converted_pdf_url, cached: true });
    }

    // Download the Word document
    console.log('Downloading Word document:', fileUrl);
    const wordResponse = await fetch(fileUrl);
    if (!wordResponse.ok) {
      throw new Error('Failed to download Word document');
    }

    const wordBuffer = await wordResponse.arrayBuffer();
    const asposeFileName = fileName || `document-${documentId}.docx`;

    // Get Aspose token
    const token = await getAsposeToken();

    // Upload to Aspose storage
    console.log('Uploading to Aspose storage...');
    const uploadResponse = await fetch(
      `https://api.aspose.cloud/v4.0/words/storage/file/${asposeFileName}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: wordBuffer,
      }
    );

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload to Aspose storage');
    }

    // Convert to PDF with tracked changes visible
    console.log('Converting to PDF with tracked changes...');
    const convertResponse = await fetch(
      `https://api.aspose.cloud/v4.0/words/${encodeURIComponent(asposeFileName)}?format=pdf&revisionOptions.showInBalloons=Revisions`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!convertResponse.ok) {
      throw new Error('PDF conversion failed');
    }

    const pdfBuffer = await convertResponse.arrayBuffer();

    // Upload PDF to Supabase storage
    const pdfPath = `converted-pdfs/${documentId}.pdf`;
    console.log('Uploading PDF to Supabase storage...');

    const { error: uploadError } = await supabase.storage
      .from('data-files')
      .upload(pdfPath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      console.error('Failed to upload PDF to Supabase:', uploadError);
      // Continue anyway, we can return the PDF
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('data-files')
      .getPublicUrl(pdfPath);

    const pdfUrl = urlData.publicUrl;

    // Cache the PDF URL in database
    await supabase
      .from('documents')
      .update({ converted_pdf_url: pdfUrl })
      .eq('id', documentId);

    // Clean up Aspose storage
    try {
      await fetch(
        `https://api.aspose.cloud/v4.0/words/storage/file/${encodeURIComponent(asposeFileName)}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );
    } catch (e) {
      console.warn('Failed to clean up Aspose storage:', e);
    }

    console.log('Conversion complete:', pdfUrl);
    return NextResponse.json({ pdfUrl, cached: false });

  } catch (error) {
    console.error('Conversion error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Conversion failed',
        fallback: true
      },
      { status: 500 }
    );
  }
}
