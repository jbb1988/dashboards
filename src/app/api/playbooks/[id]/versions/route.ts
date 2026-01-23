import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/apiAuth';

// GET: Get all versions of a playbook
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

    if (!id) {
      return NextResponse.json(
        { error: 'Playbook ID is required' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    const { data: versions, error } = await admin
      .from('playbook_versions')
      .select('*')
      .eq('playbook_id', id)
      .order('version', { ascending: false });

    if (error) {
      console.error('Failed to fetch versions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch versions' },
        { status: 500 }
      );
    }

    return NextResponse.json({ versions: versions || [] });
  } catch (error) {
    console.error('Error fetching versions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Create a new version
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { content, changeNotes, createdBy, versionNumber } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Playbook ID is required' },
        { status: 400 }
      );
    }

    if (!content?.trim()) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    // Get the playbook and current version
    const { data: playbook, error: playbookError } = await admin
      .from('playbooks')
      .select('current_version')
      .eq('id', id)
      .single();

    if (playbookError || !playbook) {
      return NextResponse.json(
        { error: 'Playbook not found' },
        { status: 404 }
      );
    }

    // Use custom version number if provided, otherwise auto-increment
    const newVersion = versionNumber?.toString().trim()
      ? parseFloat(versionNumber.toString().trim())
      : (playbook.current_version || 0) + 1;

    // Create the new version
    const { data: version, error: versionError } = await admin
      .from('playbook_versions')
      .insert({
        playbook_id: id,
        version: newVersion,
        content: content.trim(),
        change_notes: changeNotes?.trim() || null,
        created_by: createdBy || null,
      })
      .select()
      .single();

    if (versionError) {
      console.error('Failed to create version:', versionError);
      return NextResponse.json(
        { error: 'Failed to create version' },
        { status: 500 }
      );
    }

    // Update the playbook's current version
    const { error: updateError } = await admin
      .from('playbooks')
      .update({
        current_version: newVersion,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('Failed to update playbook version:', updateError);
    }

    return NextResponse.json({
      success: true,
      version,
    });
  } catch (error) {
    console.error('Error creating version:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
