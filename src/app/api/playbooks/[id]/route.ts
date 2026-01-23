import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET: Get a single playbook with its current version
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Playbook ID is required' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    // Fetch the playbook
    const { data: playbook, error: playbookError } = await admin
      .from('playbooks')
      .select('*')
      .eq('id', id)
      .single();

    if (playbookError || !playbook) {
      return NextResponse.json(
        { error: 'Playbook not found' },
        { status: 404 }
      );
    }

    // Fetch all versions
    const { data: versions, error: versionsError } = await admin
      .from('playbook_versions')
      .select('*')
      .eq('playbook_id', id)
      .order('version', { ascending: false });

    if (versionsError) {
      console.error('Failed to fetch versions:', versionsError);
    }

    // Get current version content
    const currentVersion = versions?.find(v => v.version === playbook.current_version);

    return NextResponse.json({
      playbook: {
        ...playbook,
        content: currentVersion?.content || '',
      },
      versions: versions || [],
    });
  } catch (error) {
    console.error('Error fetching playbook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT: Update playbook metadata
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Playbook ID is required' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    const { data: playbook, error } = await admin
      .from('playbooks')
      .update({
        name: name?.trim() || undefined,
        description: description?.trim() || undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update playbook:', error);
      return NextResponse.json(
        { error: 'Failed to update playbook' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      playbook,
    });
  } catch (error) {
    console.error('Error updating playbook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE: Delete a playbook (and its versions via cascade)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Playbook ID is required' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    const { error } = await admin
      .from('playbooks')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Failed to delete playbook:', error);
      return NextResponse.json(
        { error: 'Failed to delete playbook' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting playbook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
