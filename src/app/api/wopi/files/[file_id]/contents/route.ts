import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { verifyWOPIAccessToken } from '@/lib/wopi-token';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://word-view.officeapps.live.com',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-WOPI-Override',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

// GetFile - Returns file binary contents
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ file_id: string }> }
) {
  const { file_id: fileId } = await params;
  const accessToken = request.nextUrl.searchParams.get('access_token');

  if (!accessToken) {
    return new NextResponse('Missing access token', { status: 401, headers: corsHeaders });
  }

  const tokenData = verifyWOPIAccessToken(accessToken);
  if (!tokenData || tokenData.file_id !== fileId) {
    return new NextResponse('Invalid access token', { status: 403, headers: corsHeaders });
  }

  const supabase = getSupabaseAdmin();
  const { data: document } = await supabase
    .from('documents')
    .select('*')
    .eq('id', tokenData.document_id)
    .single();

  if (!document) {
    return new NextResponse('Document not found', { status: 404, headers: corsHeaders });
  }

  // Download file from Supabase storage
  const storagePath = document.file_url.split('/data-files/')[1];
  const { data: fileData, error } = await supabase
    .storage
    .from('data-files')
    .download(storagePath);

  if (error || !fileData) {
    return new NextResponse('Failed to download file', { status: 500, headers: corsHeaders });
  }

  // Convert Blob to Buffer
  const arrayBuffer = await fileData.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Return file binary
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/octet-stream',
      'Content-Length': buffer.length.toString(),
      'X-WOPI-ItemVersion': document.version || '1.0',
    },
  });
}
