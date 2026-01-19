import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { generateWOPIAccessToken } from '@/lib/wopi-token';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Get authenticated user
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { document_id } = await request.json();

  // Verify document exists and user has access
  const supabaseAdmin = getSupabaseAdmin();
  const { data: document, error } = await supabaseAdmin
    .from('documents')
    .select('*')
    .eq('id', document_id)
    .single();

  if (error || !document) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  // Generate unique file_id
  const fileId = `${document_id}-${Date.now()}`;

  // Generate WOPI access token
  const accessToken = generateWOPIAccessToken({
    fileId,
    userId: user.id,
    userEmail: user.email || 'unknown@example.com',
    documentId: document_id,
    expiresInMinutes: 60,
  });

  return NextResponse.json({
    access_token: accessToken,
    file_id: fileId,
    expires_in: 3600,
  });
}
