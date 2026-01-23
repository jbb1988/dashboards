import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/apiAuth';

// GET: Download playbook version file
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: playbookId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const versionId = searchParams.get('versionId');
    const version = searchParams.get('version');

    if (!playbookId) {
      return NextResponse.json(
        { error: 'Playbook ID is required' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    // Get the version record
    let query = admin
      .from('playbook_versions')
      .select('file_name, file_path, file_type')
      .eq('playbook_id', playbookId);

    if (versionId) {
      query = query.eq('id', versionId);
    } else if (version) {
      query = query.eq('version', parseInt(version, 10));
    } else {
      // Get latest version
      query = query.order('version', { ascending: false }).limit(1);
    }

    const { data: versionData, error: versionError } = await query.single();

    if (versionError || !versionData) {
      return NextResponse.json(
        { error: 'Version not found' },
        { status: 404 }
      );
    }

    if (!versionData.file_path) {
      return NextResponse.json(
        { error: 'No file associated with this version' },
        { status: 404 }
      );
    }

    // Download from Supabase Storage
    const { data: fileData, error: downloadError } = await admin.storage
      .from('playbook-files')
      .download(versionData.file_path);

    if (downloadError || !fileData) {
      console.error('Download error:', downloadError);
      return NextResponse.json(
        { error: 'Failed to download file' },
        { status: 500 }
      );
    }

    // Get content type based on file type
    const contentTypes: Record<string, string> = {
      pdf: 'application/pdf',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      doc: 'application/msword',
      txt: 'text/plain',
    };

    const contentType = contentTypes[versionData.file_type || ''] || 'application/octet-stream';

    // Return file as download
    const arrayBuffer = await fileData.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${versionData.file_name || 'playbook'}"`,
        'Content-Length': arrayBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json(
      { error: 'Failed to download file' },
      { status: 500 }
    );
  }
}
