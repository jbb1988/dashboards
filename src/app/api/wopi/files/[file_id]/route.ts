import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { verifyWOPIAccessToken } from '@/lib/wopi-token';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-WOPI-Override, X-WOPI-Lock',
  'Access-Control-Expose-Headers': 'X-WOPI-ItemVersion',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

// CheckFileInfo - Returns file metadata
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ file_id: string }> }
) {
  const { file_id: fileId } = await params;
  const accessToken = request.nextUrl.searchParams.get('access_token');

  if (!accessToken) {
    return NextResponse.json({ error: 'Missing access token' }, { status: 401, headers: corsHeaders });
  }

  const tokenData = verifyWOPIAccessToken(accessToken);
  if (!tokenData || tokenData.file_id !== fileId) {
    return NextResponse.json({ error: 'Invalid access token' }, { status: 403, headers: corsHeaders });
  }

  const supabase = getSupabaseAdmin();
  const { data: document } = await supabase
    .from('documents')
    .select('*')
    .eq('id', tokenData.document_id)
    .single();

  if (!document) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404, headers: corsHeaders });
  }

  // Get file size from Supabase storage
  const storagePath = document.file_url.split('/data-files/')[1];
  const { data: fileData } = await supabase
    .storage
    .from('data-files')
    .download(storagePath);

  const fileSize = fileData?.size || 0;

  // Return WOPI CheckFileInfo response
  return NextResponse.json({
    BaseFileName: document.file_name,
    Size: fileSize,
    Version: document.version || '1.0',
    UserId: tokenData.user_id,
    UserFriendlyName: tokenData.user_email,
    UserCanWrite: false,
    SupportsUpdate: false,
    SupportsLocks: false,
    LastModifiedTime: new Date(document.updated_at).toISOString(),
    SupportsReviewing: true, // Enable tracked changes mode
    AllowExternalMarketplace: false,
    DisablePrint: false,
    DisableTranslation: false,
  }, { headers: corsHeaders });
}
