import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET: Create signed upload URL (client uploads directly to Supabase)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');

    if (!filename) {
      return NextResponse.json({ error: 'Filename required' }, { status: 400 });
    }

    // Sanitize filename
    const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `uploads/${Date.now()}-${safeName}`;

    const supabaseAdmin = getSupabaseAdmin();

    // Create signed URL for direct upload (bypasses Vercel limit)
    const { data, error } = await supabaseAdmin.storage
      .from('data-files')
      .createSignedUploadUrl(storagePath);

    if (error) {
      console.error('Signed URL error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      signedUrl: data.signedUrl,
      storagePath,
      token: data.token,
    });
  } catch (error) {
    console.error('Error creating signed URL:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create upload URL' },
      { status: 500 }
    );
  }
}

// DELETE: Clean up file after processing
export async function DELETE(request: NextRequest) {
  try {
    const { storagePath } = await request.json();

    if (!storagePath) {
      return NextResponse.json({ error: 'Storage path required' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    await supabaseAdmin.storage.from('data-files').remove([storagePath]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
