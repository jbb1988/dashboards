import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { verifyWOPIAccessToken } from '@/lib/wopi-token';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-WOPI-Override, X-WOPI-Lock',
  'Access-Control-Expose-Headers': 'X-WOPI-ItemVersion, Content-Length, Content-Type',
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

  if (!storagePath) {
    console.error('Failed to parse storage path from file_url:', document.file_url);
    return new NextResponse('Invalid file URL', { status: 500, headers: corsHeaders });
  }

  console.log('Downloading file from storage:', storagePath);
  const { data: fileData, error } = await supabase
    .storage
    .from('data-files')
    .download(storagePath);

  if (error || !fileData) {
    console.error('Failed to download file from storage:', error);
    return new NextResponse(`Failed to download file: ${error?.message || 'Unknown error'}`, { status: 500, headers: corsHeaders });
  }

  console.log('File downloaded successfully, size:', fileData.size);

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
