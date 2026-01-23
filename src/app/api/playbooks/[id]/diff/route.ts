import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/apiAuth';
import DiffMatchPatch from 'diff-match-patch';

// GET: Get diff between two versions
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const fromVersion = request.nextUrl.searchParams.get('from');
    const toVersion = request.nextUrl.searchParams.get('to');

    if (!id) {
      return NextResponse.json(
        { error: 'Playbook ID is required' },
        { status: 400 }
      );
    }

    if (!fromVersion || !toVersion) {
      return NextResponse.json(
        { error: 'Both from and to version parameters are required' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    // Fetch both versions
    const { data: versions, error } = await admin
      .from('playbook_versions')
      .select('*')
      .eq('playbook_id', id)
      .in('version', [parseFloat(fromVersion), parseFloat(toVersion)]);

    if (error) {
      console.error('Failed to fetch versions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch versions' },
        { status: 500 }
      );
    }

    if (!versions || versions.length < 2) {
      return NextResponse.json(
        { error: 'One or both versions not found' },
        { status: 404 }
      );
    }

    const v1 = versions.find(v => v.version == parseFloat(fromVersion));
    const v2 = versions.find(v => v.version == parseFloat(toVersion));

    if (!v1 || !v2) {
      return NextResponse.json(
        { error: 'Version not found' },
        { status: 404 }
      );
    }

    // Generate diff
    const dmp = new DiffMatchPatch();
    const diffs = dmp.diff_main(v1.content || '', v2.content || '');
    dmp.diff_cleanupSemantic(diffs);

    // Calculate stats
    let deletions = 0;
    let insertions = 0;
    let unchanged = 0;

    for (const [type, text] of diffs) {
      if (type === -1) {
        deletions += text.length;
      } else if (type === 1) {
        insertions += text.length;
      } else {
        unchanged += text.length;
      }
    }

    return NextResponse.json({
      diffs, // Array of [type, text] where type: -1=delete, 0=equal, 1=insert
      fromVersion: {
        version: v1.version,
        created_at: v1.created_at,
        created_by: v1.created_by,
        change_notes: v1.change_notes,
      },
      toVersion: {
        version: v2.version,
        created_at: v2.created_at,
        created_by: v2.created_by,
        change_notes: v2.change_notes,
      },
      stats: {
        deletions,
        insertions,
        unchanged,
        totalChanges: deletions + insertions,
      },
    });
  } catch (error) {
    console.error('Error generating diff:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
